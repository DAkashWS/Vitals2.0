/*
  VITALS sensor firmware - team Mission 61:4 - NASA Space Apps 2026
  ------------------------------------------------------------------
  Sends ONE JSON line per second over USB (115200 baud), e.g.
  {"heartRate":74,"spo2":97,"cabinTemp":22.4,"cabinHumidity":45,"cabinPressure":101.2,"co2":850,"finger":true}
  Any value it cannot measure reliably is sent as null. Nothing else is printed.

  Sensors: MAX30102 (0x57), BME280 (0x76), OLED SSD1306 (0x3C), SCD40 (0x62, optional)
  Wiring:  3V3, GND, SDA=GPIO21, SCL=GPIO22. Buzzer I/O = GPIO25.

  HOBBY-GRADE DEMO. NOT A MEDICAL DEVICE. Body temperature is NOT measured
  (the MAX30102's temperature is the chip's own temperature).

  Libraries (Library Manager):
    SparkFun MAX3010x Pulse and Proximity Sensor Library
    Adafruit BME280 Library, Adafruit Unified Sensor, Adafruit BusIO
    Adafruit SSD1306, Adafruit GFX Library
    SparkFun SCD4x Arduino Library
*/
#include <Wire.h>
#include <Adafruit_Sensor.h>
#include <Adafruit_BME280.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include "MAX30105.h"                         // SparkFun library (works for MAX30102)
#include "spo2_algorithm.h"                   // Maxim's HR + SpO2 algorithm (in the same library)
#include "SparkFun_SCD4x_Arduino_Library.h"

// ---------------- Pins and addresses ----------------
const int     PIN_SDA    = 21;
const int     PIN_SCL    = 22;
const int     PIN_BUZZER = 25;
const uint8_t ADDR_BME   = 0x76;              // 0x77 on some boards
const uint8_t ADDR_OLED  = 0x3C;
const uint8_t ADDR_SCD   = 0x62;

// ---------------- Settings you may tune ----------------
const uint32_t FINGER_IR_LEVEL  = 50000;      // IR above this = finger on sensor
const uint32_t FINGER_SETTLE_MS = 10000;      // finger must stay 10 s before we report
const int      AVG_LEN          = 5;          // moving average over the last 5 good readings
const int      HR_MAX_SPREAD    = 12;         // bpm: window must be this steady to count as "stable"
const int      SPO2_MAX_SPREAD  = 3;          // %
const uint32_t READING_MAX_AGE  = 3000;       // ms: older pulse readings are treated as missing
const uint32_t CO2_MAX_AGE      = 15000;      // ms: SCD40 updates every 5 s; older = missing
const int      BEEP_HZ          = 2500;
const int      BEEP_MS          = 150;
const uint32_t ACT_REPEAT_MS    = 10000;      // ACT: 3 beeps every 10 s

// ---------------- Sensor objects ----------------
MAX30105         pulse;
Adafruit_BME280  bme;
Adafruit_SSD1306 oled(128, 64, &Wire, -1);
SCD4x            scd;
bool havePulse = false, haveBme = false, haveOled = false, haveScd = false;

// ---------------- Pulse (MAX30102) data ----------------
const int BUF_LEN = 100;                      // 4 s of samples at 25 samples/s
const int STEP    = 25;                       // re-run the algorithm every 1 s of new data
uint32_t irBuf[BUF_LEN], redBuf[BUF_LEN];
int  bufFill = 0, newSamples = 0;
bool finger = false;
uint32_t fingerSince = 0, lastGoodMs = 0;
int  hrHist[AVG_LEN], spo2Hist[AVG_LEN], histCount = 0, histIdx = 0;
int  hrOut = -1, spo2Out = -1;                // -1 means "send null"

// ---------------- Cabin data ----------------
float cabinTemp = NAN, cabinHum = NAN, cabinPres = NAN;
int   co2 = -1;
uint32_t co2Ms = 0;

// ---------------- Status and buzzer ----------------
enum Status { NORMAL = 0, WATCH = 1, ACT = 2 };
const char* STATUS_WORD[] = { "NORMAL", "WATCH", "ACT" };
Status status = NORMAL;
int beepsLeft = 0;
uint32_t nextBeepMs = 0, nextActMs = 0, lastTickMs = 0;

// =====================================================================
//  Helpers
// =====================================================================
bool i2cPresent(uint8_t addr) {               // does anything answer at this address?
  Wire.beginTransmission(addr);
  return Wire.endTransmission() == 0;
}

bool timeReached(uint32_t t) {                // millis()-safe "now >= t"
  return (int32_t)(millis() - t) >= 0;
}

void resetPulse() {                           // forget everything when the finger moves
  bufFill = newSamples = histCount = histIdx = 0;
  hrOut = spo2Out = -1;
}

// =====================================================================
//  MAX30102: collect samples (called as often as possible)
// =====================================================================
void analysePulse();

void samplePulse() {
  if (!havePulse) return;
  pulse.check();                              // copy new samples out of the sensor FIFO
  while (pulse.available()) {
    uint32_t red = pulse.getFIFORed();
    uint32_t ir  = pulse.getFIFOIR();
    pulse.nextSample();

    bool nowFinger = ir > FINGER_IR_LEVEL;
    if (nowFinger != finger) {                // finger placed or removed: start over
      resetPulse();
      fingerSince = millis();
    }
    finger = nowFinger;
    if (!finger) continue;

    if (bufFill == BUF_LEN) {                 // buffer full: drop the oldest 1 s
      memmove(irBuf,  irBuf  + STEP, (BUF_LEN - STEP) * sizeof(uint32_t));
      memmove(redBuf, redBuf + STEP, (BUF_LEN - STEP) * sizeof(uint32_t));
      bufFill = BUF_LEN - STEP;
    }
    irBuf[bufFill]  = ir;
    redBuf[bufFill] = red;
    bufFill++;
    newSamples++;

    if (bufFill == BUF_LEN && newSamples >= STEP) {   // 4 s of data, 1 s new
      newSamples = 0;
      analysePulse();
    }
  }
}

// Run Maxim's algorithm on the last 4 s and keep the result if it is plausible
void analysePulse() {
  int32_t spo2, hr;
  int8_t  spo2Ok, hrOk;
  maxim_heart_rate_and_oxygen_saturation(irBuf, BUF_LEN, redBuf, &spo2, &spo2Ok, &hr, &hrOk);

  if (!hrOk || !spo2Ok) return;                       // algorithm not confident
  if (hr < 40 || hr > 180 || spo2 < 80 || spo2 > 100) return;  // implausible -> ignore

  hrHist[histIdx]   = hr;
  spo2Hist[histIdx] = spo2;
  histIdx = (histIdx + 1) % AVG_LEN;
  if (histCount < AVG_LEN) histCount++;
  lastGoodMs = millis();
}

// Decide what to report this second: averaged values, or null
void updatePulseOutputs() {
  hrOut = spo2Out = -1;
  if (!finger) return;
  if (millis() - fingerSince < FINGER_SETTLE_MS) return;        // still settling
  if (histCount < AVG_LEN) return;                               // not enough good readings
  if (millis() - lastGoodMs > READING_MAX_AGE) return;           // readings went stale

  int hMin = 999, hMax = 0, sMin = 999, sMax = 0;
  long hSum = 0, sSum = 0;
  for (int i = 0; i < AVG_LEN; i++) {
    hMin = min(hMin, hrHist[i]);   hMax = max(hMax, hrHist[i]);   hSum += hrHist[i];
    sMin = min(sMin, spo2Hist[i]); sMax = max(sMax, spo2Hist[i]); sSum += spo2Hist[i];
  }
  if (hMax - hMin > HR_MAX_SPREAD || sMax - sMin > SPO2_MAX_SPREAD) return;  // jumping

  hrOut   = (hSum + AVG_LEN / 2) / AVG_LEN;                      // rounded average
  spo2Out = (sSum + AVG_LEN / 2) / AVG_LEN;
}

// =====================================================================
//  Cabin sensors (once per second)
// =====================================================================
void readCabin() {
  if (haveBme) {
    cabinTemp = bme.readTemperature();                // C
    cabinHum  = bme.readHumidity();                   // %
    cabinPres = bme.readPressure() / 1000.0;          // Pa -> kPa
  }
  if (haveScd && scd.readMeasurement()) {             // true only when a new value is ready
    co2   = scd.getCO2();
    co2Ms = millis();
  }
  if (co2 >= 0 && millis() - co2Ms > CO2_MAX_AGE) co2 = -1;   // unplugged or stuck -> null
}

// =====================================================================
//  Status rules (null values do not count)
// =====================================================================
Status hrStatus(int v) {
  if (v < 0) return NORMAL;
  if (v >= 60 && v <= 100) return NORMAL;
  if (v >= 50 && v <= 110) return WATCH;
  return ACT;
}
Status spo2Status(int v) {
  if (v < 0) return NORMAL;
  if (v >= 95) return NORMAL;
  if (v >= 92) return WATCH;
  return ACT;
}
Status co2Status(int v) {                             // DRAFT thresholds - confirm with team
  if (v < 0) return NORMAL;
  if (v < 1000) return NORMAL;
  if (v <= 2000) return WATCH;
  return ACT;
}

// =====================================================================
//  Buzzer (non-blocking: tone() returns immediately on ESP32)
// =====================================================================
void startBeeps(int n) { beepsLeft = n; nextBeepMs = millis(); }

void setStatus(Status s) {
  if (s == status) return;
  status = s;
  if (s == WATCH) {
    startBeeps(1);                                    // one short beep on entering WATCH
  } else if (s == ACT) {
    startBeeps(3);                                    // three beeps now...
    nextActMs = millis() + ACT_REPEAT_MS;             // ...and again every 10 s
  } else {
    beepsLeft = 0;                                    // NORMAL: silence
    noTone(PIN_BUZZER);
  }
}

void serviceBuzzer() {
  if (status == ACT && timeReached(nextActMs)) {
    startBeeps(3);
    nextActMs = millis() + ACT_REPEAT_MS;
  }
  if (beepsLeft > 0 && timeReached(nextBeepMs)) {
    tone(PIN_BUZZER, BEEP_HZ, BEEP_MS);
    beepsLeft--;
    nextBeepMs = millis() + BEEP_MS + 150;            // gap between beeps
  }
}

// =====================================================================
//  Output: JSON line and OLED
// =====================================================================
void fmtInt(char* out, size_t n, int v) {
  if (v < 0) snprintf(out, n, "null"); else snprintf(out, n, "%d", v);
}
void fmtFloat(char* out, size_t n, float v, int decimals) {
  if (isnan(v)) snprintf(out, n, "null"); else snprintf(out, n, "%.*f", decimals, v);
}

void sendJson() {
  char hr[8], sp[8], t[12], h[8], p[12], c[8];
  fmtInt(hr, sizeof hr, hrOut);
  fmtInt(sp, sizeof sp, spo2Out);
  fmtFloat(t, sizeof t, cabinTemp, 1);
  fmtFloat(h, sizeof h, cabinHum, 0);
  fmtFloat(p, sizeof p, cabinPres, 1);
  fmtInt(c, sizeof c, co2);
  Serial.printf("{\"heartRate\":%s,\"spo2\":%s,\"cabinTemp\":%s,\"cabinHumidity\":%s,"
                "\"cabinPressure\":%s,\"co2\":%s,\"finger\":%s}\n",
                hr, sp, t, h, p, c, finger ? "true" : "false");
}

void drawOled() {
  if (!haveOled) return;
  const char* pulseHint = !havePulse ? "no sensor" : (!finger ? "no finger" : "hold still");

  oled.clearDisplay();
  oled.setTextColor(SSD1306_WHITE);
  oled.setTextSize(2);
  oled.setCursor(0, 0);
  oled.print(STATUS_WORD[status]);                    // big status word

  oled.setTextSize(1);
  oled.setCursor(0, 22);
  if (hrOut >= 0) oled.printf("HR    %d bpm", hrOut);   else oled.printf("HR    --  %s", pulseHint);
  oled.setCursor(0, 33);
  if (spo2Out >= 0) oled.printf("SpO2  %d %%", spo2Out); else oled.print("SpO2  --");
  oled.setCursor(0, 44);
  if (!isnan(cabinTemp)) oled.printf("Cabin %.1f C", cabinTemp); else oled.print("Cabin --");
  oled.setCursor(0, 55);
  if (co2 >= 0) oled.printf("CO2   %d ppm", co2);   else oled.print("CO2   --");
  oled.display();
}

// =====================================================================
//  Setup and main loop
// =====================================================================
void setup() {
  Serial.begin(115200);
  Wire.begin(PIN_SDA, PIN_SCL);
  Wire.setClock(400000);                              // fast I2C so the OLED update is quick

  haveOled = oled.begin(SSD1306_SWITCHCAPVCC, ADDR_OLED);
  havePulse = pulse.begin(Wire, I2C_SPEED_FAST);
  if (havePulse) pulse.setup(60, 4, 2, 100, 411, 4096);   // Red+IR, 25 samples/s
  haveBme = bme.begin(ADDR_BME, &Wire);
  if (i2cPresent(ADDR_SCD)) haveScd = scd.begin(Wire);    // optional: skip if not fitted

  // Show which sensors were found (OLED only - Serial stays pure JSON)
  if (haveOled) {
    oled.clearDisplay();
    oled.setTextSize(1);
    oled.setTextColor(SSD1306_WHITE);
    oled.setCursor(0, 0);
    oled.println("VITALS  Mission 61:4");
    oled.println();
    oled.printf("MAX30102  %s\n", havePulse ? "OK" : "MISSING");
    oled.printf("BME280    %s\n", haveBme   ? "OK" : "MISSING");
    oled.printf("SCD40     %s\n", haveScd   ? "OK" : "not fitted");
    oled.display();
    delay(2000);                                      // only at start-up
  }
  lastTickMs = millis();
}

void loop() {
  samplePulse();                                      // every loop: never miss samples

  if (millis() - lastTickMs >= 1000) {                // once per second
    lastTickMs = millis();
    readCabin();
    updatePulseOutputs();
    Status worst = max(hrStatus(hrOut), max(spo2Status(spo2Out), co2Status(co2)));
    setStatus(worst);
    sendJson();
    drawOled();
  }

  serviceBuzzer();
}
