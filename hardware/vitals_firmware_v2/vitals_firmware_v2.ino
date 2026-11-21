/*
  VITALS sensor firmware v2 - team Mission 61:4 - NASA Space Apps 2026
  ====================================================================
  HOBBY-GRADE PROTOTYPE. NOT A MEDICAL DEVICE.

  v2 = vitals_firmware + two additions (everything else is unchanged):
    - Body temperature: a MAX30205 (0x48) or MLX90614 (0x5A) on I2C bus 1, found automatically.
      Sent as "bodyTemp" once the reading has settled, else null with "tempSettling":true.
    - Simulated ECG (SIM_ECG below): when there's no real ECG (AD8232 not fitted, or the
      electrodes are off) it sends the team's sample heartbeat (ECG_TEMPLATE), marked "ecgSimulated":true.
      A simulated ECG is never used for alarms, and the website labels it "Simulated".

  What it does
    - MAX30102  -> heart rate + SpO2 (only when a finger is on it and the reading is steady)
    - MAX30205 / MLX90614 -> body temperature (settled reading only)
    - AD8232    -> ECG waveform (250 samples/s) + heart rate from the ECG, or a simulated trace
    - BME280    -> cabin temperature, humidity, pressure
    - MQ-135    -> cabin air quality, as "% worse than clean-air baseline" (NOT CO2 ppm)
    - 3 OLEDs   -> crew screen, cabin screen, SIM screen (values sent by the dashboard)
    - Buzzer    -> 1 beep on WATCH, 3 beeps every 10 s while ACT
    - USB       -> one JSON line per second, 115200 baud. Unknown values are sent as null.

  Wiring (all modules on 3V3 except the MQ-135)
    I2C bus 1  SDA=GPIO21 SCL=GPIO22 : MAX30102 0x57, BME280 0x76, OLED crew 0x3C,
                                       body temp MAX30205 0x48 or MLX90614 0x5A (3V3 versions)
    I2C bus 2  SDA=GPIO32 SCL=GPIO33 : OLED sim 0x3C
               SDA=GPIO26 SCL=GPIO27 : OLED cabin 0x3C (bus 2 switches between the two pin pairs)
    AD8232     OUTPUT=GPIO34  LO+=GPIO18  LO-=GPIO19
    MQ-135     VCC=VIN(5V), AO -> voltage divider -> GPIO35
    Buzzer     I/O=GPIO25

  Board: "ESP32 Dev Module". Arduino IDE Tools > Core Debug Level: "None".

  Libraries (Library Manager):
    SparkFun MAX3010x Pulse and Proximity Sensor Library
    Adafruit BME280 Library  (+ Adafruit Unified Sensor, Adafruit BusIO)
    Adafruit SH110X          (+ Adafruit GFX Library)   for SH1106 screens
    Adafruit SSD1306                                    for SSD1306 screens
*/
// ============================ SETTINGS YOU MAY CHANGE ============================
#define OLED_SH1106 1                // 1 = SH1106 screens (garbage/noise with the SSD1306 driver)
                                     // 0 = SSD1306 screens
#define USE_AD8232 1                 // 0 = no ECG module fitted
#define ECG_FORCE_SIM 1              // 1 = ALWAYS show the simulated ECG and ignore the AD8232
                                     //     (use while the electrode-off pins LO+/LO- don't work)
#define SIM_ECG    1                 // 1 = send a simulated ECG whenever there's no real one
                                     //     (marked "ecgSimulated":true, never used for alarms)
                                     // 0 = no ECG at all without the AD8232 and electrodes

#include <Wire.h>
#include <Adafruit_Sensor.h>
#include <Adafruit_BME280.h>
#include <Adafruit_GFX.h>
#include "MAX30105.h"          // SparkFun library, also drives the MAX30102
#include "spo2_algorithm.h"    // Maxim's HR + SpO2 algorithm (same library)

#if OLED_SH1106
  #include <Adafruit_SH110X.h>
  typedef Adafruit_SH1106G Oled;
  #define OLED_WHITE SH110X_WHITE
#else
  #include <Adafruit_SSD1306.h>
  typedef Adafruit_SSD1306 Oled;
  #define OLED_WHITE SSD1306_WHITE
#endif

const float MQ_DIVIDER   = 1.5;      // 1k top + 2x1k bottom = 1.5   |  two equal resistors = 2.0
const float MQ_VCC       = 5.0;      // MQ-135 supply (VIN pin)
const uint32_t MQ_WARMUP_MS = 120000;  // MQ-135 heater warm-up after power on (2 min)

const uint32_t FINGER_IR_LEVEL  = 50000;  // IR above this = finger on the MAX30102
const uint32_t FINGER_SETTLE_MS = 10000;  // finger must stay still 10 s before we report
const int HR_MAX_SPREAD   = 12;           // bpm  - how steady the last 5 readings must be
const int SPO2_MAX_SPREAD = 3;            // %

const int BEEP_HZ = 2500, BEEP_MS = 150;
const uint32_t ACT_REPEAT_MS = 10000;

// Overall status. Declared up here because the Arduino IDE adds function
// declarations near the top of the sketch, and they use this type.
enum Status { NORMAL = 0, WATCH = 1, ACT = 2 };
const char* STATUS_WORD[] = { "NORMAL", "WATCH", "ACT" };

// ================================== PINS ==================================
const int PIN_SDA1 = 21, PIN_SCL1 = 22;   // I2C bus 1
const int PIN_SDA2 = 32, PIN_SCL2 = 33;   // I2C bus 2: sim OLED
const int PIN_SDA3 = 26, PIN_SCL3 = 27;   // I2C bus 2, other pins: cabin OLED (same 0x3C address)
const int PIN_ECG = 34, PIN_LO_PLUS = 18, PIN_LO_MINUS = 19;
const int PIN_MQ = 35;
const int PIN_BUZZER = 25;

// ================================ OBJECTS =================================
MAX30105 pulse;
Adafruit_BME280 bme;
// last two numbers keep the I2C bus at 400 kHz during and after each screen update
Oled oledCrew (128, 64, &Wire,  -1, 400000UL, 400000UL);   // bus 1, 0x3C
Oled oledCabin(128, 64, &Wire1, -1, 400000UL, 400000UL);   // bus 2 on pins 26/27, 0x3C
Oled oledSim  (128, 64, &Wire1, -1, 400000UL, 400000UL);   // bus 2 on pins 32/33, 0x3C
uint8_t cabinAddr = 0x3C;

bool i2cPresent(TwoWire& bus, uint8_t addr) {   // does anything answer at this address?
  bus.beginTransmission(addr);
  return bus.endTransmission() == 0;
}

// The cabin and sim OLEDs both use address 0x3C, so they sit on different pins and
// bus 2 is switched between them. A screen keeps showing its picture while unselected.
void selectBus2(bool cabin) {
  static int current = -1;
  if (current == (int)cabin) return;
  Wire1.end();
  if (cabin) Wire1.begin(PIN_SDA3, PIN_SCL3); else Wire1.begin(PIN_SDA2, PIN_SCL2);
  Wire1.setClock(400000);
  current = cabin;
}

bool oledBegin(Oled& d, uint8_t addr) {
#if OLED_SH1106
  return d.begin(addr, true);
#else
  return d.begin(SSD1306_SWITCHCAPVCC, addr, true, false);
#endif
}

bool havePulse = false, haveBme = false, haveCrew = false, haveCabin = false, haveSim = false;

// ======================= ECG + MQ-135 (runs on core 0) =======================
// The ECG must be sampled exactly every 4 ms. Screen updates on core 1 would
// interrupt that, so sampling runs in its own task on the other CPU core.
// The MQ-135 is read in the same task so only one task ever uses the ADC.
const int ECG_HZ = 250;
const int ECG_RING = 1024;                     // ~4 s of samples
int16_t ecgRing[ECG_RING];
volatile uint32_t ecgWritten = 0;              // total samples written so far
portMUX_TYPE ecgMux = portMUX_INITIALIZER_UNLOCKED;
volatile bool ecgLeadsOn = false;
volatile int  ecgBpmRaw = -1;
volatile uint32_t ecgLastBeatMs = 0;
volatile int  mqMilliVolts = -1;               // voltage at GPIO35 (after the divider)
volatile bool ecgSimulated = false;            // true while the simulated trace is being sent
volatile int  simEcgBpm = 72;                  // heart rate the simulated trace follows (set each second)

// One simulated heartbeat, from the team's sample ECG data (50 points, baseline 512).
// The beat is stretched to fit the current heart rate. t runs from 0 to 1 over the beat.
// Returns the value with the 512 baseline removed: about -117 (S wave) .. +483 (R peak).
const int16_t ECG_TEMPLATE[] = {
  512, 512, 513, 516, 522, 530, 536, 538, 532, 522,   // P wave
  515, 512, 512, 512, 512, 512, 498, 465, 560, 890,   // Q, rising R
  995, 640, 395, 455, 505, 512, 512, 512, 514, 518,   // R peak, S wave
  525, 540, 562, 585, 602, 608, 598, 578, 552, 530,   // T wave
  516, 512, 512, 512, 512, 512, 512, 512, 512, 512,   // back to baseline
};
const int ECG_TEMPLATE_LEN = sizeof(ECG_TEMPLATE) / sizeof(ECG_TEMPLATE[0]);

float syntheticBeat(float t) {
  float pos = t * ECG_TEMPLATE_LEN;                  // position between two template points
  int i = (int)pos;
  float f = pos - i;
  int a = ECG_TEMPLATE[i % ECG_TEMPLATE_LEN], b = ECG_TEMPLATE[(i + 1) % ECG_TEMPLATE_LEN];
  return (a + (b - a) * f) - 512.0f;                 // straight line between the two points
}

void ecgTask(void*) {
  float simPhase = 0, simBeatBpm = 72;           // simulated ECG state
  float base = 0;                              // slow baseline (breathing, movement)
  // 25 Hz low-pass (2nd-order Butterworth): keeps the heartbeat, removes hum above 25 Hz
  const float w = 2 * PI * 25.0f / ECG_HZ, cw = cosf(w), al = sinf(w) / sqrtf(2.0f), a0 = 1 + al;
  const float lb0 = (1 - cw) / 2 / a0, lb1 = (1 - cw) / a0, la1 = -2 * cw / a0, la2 = (1 - al) / a0;
  float lx1 = 0, lx2 = 0, ly1 = 0, ly2 = 0;
  int   avg[5] = {0}, avgIdx = 0; long avgSum = 0;   // 5-sample average removes 50 Hz mains hum
  float y1 = 0, y2 = 0;                        // previous outputs, for the slope
  float win[30] = {0}; int winIdx = 0; float winSum = 0;   // 120 ms energy window
  float env = 0;                               // slowly decaying peak of the energy
  bool  above = false, wasOn = false;
  uint32_t n = 0, lastBeatN = 0;
  int rr[5], rrCount = 0, rrIdx = 0;

  TickType_t last = xTaskGetTickCount();
  for (;;) {
    vTaskDelayUntil(&last, pdMS_TO_TICKS(1000 / ECG_HZ));    // every 4 ms
    n++;

    if (n % ECG_HZ == 0) {                     // once per second: MQ-135
      uint32_t s = 0;
      for (int i = 0; i < 8; i++) s += analogReadMilliVolts(PIN_MQ);
      mqMilliVolts = s / 8;
    }

    bool on = USE_AD8232 && !ECG_FORCE_SIM &&
              digitalRead(PIN_LO_PLUS) == LOW && digitalRead(PIN_LO_MINUS) == LOW;
    int16_t y = 0;

    if (on) {
      int raw = analogRead(PIN_ECG);
      if (!wasOn) {                            // electrodes just attached: start fresh
        base = raw; avgSum = 0; for (int i = 0; i < 5; i++) avg[i] = 0;
        lx1 = lx2 = ly1 = ly2 = 0;
        winSum = 0; for (int i = 0; i < 30; i++) win[i] = 0;
        env = 0; rrCount = 0; lastBeatN = n; ecgBpmRaw = -1;
      }
      base += (raw - base) / 64.0f;            // high-pass ~0.6 Hz
      int hp = raw - (int)base;
      avgSum += hp - avg[avgIdx]; avg[avgIdx] = hp; avgIdx = (avgIdx + 1) % 5;
      float a = avgSum / 5.0f;
      float lp = lb0 * a + lb1 * lx1 + lb0 * lx2 - la1 * ly1 - la2 * ly2;   // b2 == b0
      lx2 = lx1; lx1 = a; ly2 = ly1; ly1 = lp;
      y = (int16_t)lp;

      // --- beat detection (simplified Pan-Tompkins) ---
      float d = y - y2; y2 = y1; y1 = y;       // slope
      float e = d * d;                         // energy
      winSum += e - win[winIdx]; win[winIdx] = e; winIdx = (winIdx + 1) % 30;
      float energy = winSum / 30;
      env = max(energy, env * 0.998f);
      bool nowAbove = env > 1 && energy > 0.35f * env;
      if (nowAbove && !above && n - lastBeatN > ECG_HZ / 4) {      // 250 ms refractory
        uint32_t rrSamples = n - lastBeatN;
        lastBeatN = n;
        if (rrSamples >= ECG_HZ * 60 / 200 && rrSamples <= ECG_HZ * 60 / 30) {  // 30-200 bpm
          rr[rrIdx] = rrSamples; rrIdx = (rrIdx + 1) % 5;
          if (rrCount < 5) rrCount++;
          if (rrCount >= 3) {
            long sum = 0;
            for (int i = 0; i < rrCount; i++) sum += rr[i];
            ecgBpmRaw = (60L * ECG_HZ * rrCount + sum / 2) / sum;
          }
          ecgLastBeatMs = millis();
        }
      }
      above = nowAbove;
      ecgSimulated = false;
    } else if (SIM_ECG) {
      // No real ECG: send a simulated heartbeat that follows the pulse sensor's heart rate.
      simPhase += simBeatBpm / (60.0f * ECG_HZ);
      if (simPhase >= 1.0f) {                    // a new beat: small beat-to-beat variation
        simPhase -= 1.0f;
        simBeatBpm = simEcgBpm + (int)(esp_random() % 5) - 2;
        ecgBpmRaw = (int)(simBeatBpm + 0.5f);
        ecgLastBeatMs = millis();
      }
      y = (int16_t)syntheticBeat(simPhase);         // the team's sample beat, at the current heart rate
      ecgSimulated = true;
    } else {
      ecgBpmRaw = -1;
      ecgSimulated = false;
    }
    wasOn = on;
    ecgLeadsOn = on;

    portENTER_CRITICAL(&ecgMux);
    ecgRing[ecgWritten % ECG_RING] = y;
    ecgWritten = ecgWritten + 1;
    portEXIT_CRITICAL(&ecgMux);
  }
}

uint32_t ecgCount() {
  portENTER_CRITICAL(&ecgMux);
  uint32_t c = ecgWritten;
  portEXIT_CRITICAL(&ecgMux);
  return c;
}

// ============================ MAX30102 (core 1) ============================
const int BUF_LEN = 100, STEP = 25;            // 4 s window, re-checked every 1 s (25 samples/s)
uint32_t irBuf[BUF_LEN], redBuf[BUF_LEN];
int bufFill = 0, newSamples = 0;
bool finger = false;
uint32_t fingerSince = 0, lastGoodMs = 0;
const int AVG_LEN = 5;
int hrHist[AVG_LEN], spo2Hist[AVG_LEN], histCount = 0, histIdx = 0;

void resetPulse() { bufFill = newSamples = histCount = histIdx = 0; }

void analysePulse() {
  int32_t spo2, hr; int8_t spo2Ok, hrOk;
  maxim_heart_rate_and_oxygen_saturation(irBuf, BUF_LEN, redBuf, &spo2, &spo2Ok, &hr, &hrOk);
  if (!hrOk || !spo2Ok) return;
  if (hr < 40 || hr > 180 || spo2 < 80 || spo2 > 100) return;     // implausible
  hrHist[histIdx] = hr; spo2Hist[histIdx] = spo2;
  histIdx = (histIdx + 1) % AVG_LEN;
  if (histCount < AVG_LEN) histCount++;
  lastGoodMs = millis();
}

void samplePulse() {                           // call as often as possible
  if (!havePulse) return;
  pulse.check();
  while (pulse.available()) {
    uint32_t red = pulse.getFIFORed();
    uint32_t ir  = pulse.getFIFOIR();
    pulse.nextSample();
    bool now = ir > FINGER_IR_LEVEL;
    if (now != finger) { resetPulse(); fingerSince = millis(); }   // placed or removed
    finger = now;
    if (!finger) continue;
    if (bufFill == BUF_LEN) {                  // drop the oldest second
      memmove(irBuf,  irBuf  + STEP, (BUF_LEN - STEP) * sizeof(uint32_t));
      memmove(redBuf, redBuf + STEP, (BUF_LEN - STEP) * sizeof(uint32_t));
      bufFill = BUF_LEN - STEP;
    }
    irBuf[bufFill] = ir; redBuf[bufFill] = red; bufFill++; newSamples++;
    if (bufFill == BUF_LEN && newSamples >= STEP) { newSamples = 0; analysePulse(); }
  }
}

// ============================ VALUES SENT EACH SECOND ============================
int hrOut = -1, spo2Out = -1, ecgBpmOut = -1;   // -1 = null
float cabinTemp = NAN, cabinHum = NAN, cabinPres = NAN;
int airQuality = -1;                            // % worse than baseline, -1 = null
float mqR0 = 0;                                 // clean-air baseline

void updatePulse() {
  hrOut = spo2Out = -1;
  if (!finger || millis() - fingerSince < FINGER_SETTLE_MS) return;
  if (histCount < AVG_LEN || millis() - lastGoodMs > 3000) return;
  int hMin = 999, hMax = 0, sMin = 999, sMax = 0; long hSum = 0, sSum = 0;
  for (int i = 0; i < AVG_LEN; i++) {
    hMin = min(hMin, hrHist[i]);   hMax = max(hMax, hrHist[i]);   hSum += hrHist[i];
    sMin = min(sMin, spo2Hist[i]); sMax = max(sMax, spo2Hist[i]); sSum += spo2Hist[i];
  }
  if (hMax - hMin > HR_MAX_SPREAD || sMax - sMin > SPO2_MAX_SPREAD) return;   // still jumping
  hrOut   = (hSum + AVG_LEN / 2) / AVG_LEN;
  spo2Out = (sSum + AVG_LEN / 2) / AVG_LEN;
}

void updateEcg() {
  ecgBpmOut = -1;
  if ((ecgLeadsOn || ecgSimulated) && ecgBpmRaw > 0 && millis() - ecgLastBeatMs < 3000) ecgBpmOut = ecgBpmRaw;
  simEcgBpm = hrOut > 0 ? hrOut : 72;            // the simulated trace follows the real pulse when there is one
}

// ============================ BODY TEMPERATURE (bus 1) ============================
// MAX30205: contact sensor, +-0.1 C. MLX90614: infrared, no contact, reads the skin surface.
// Both read the skin, which is cooler than the body's core: hold the sensor firmly in the
// armpit. A reading is only sent once it has settled (changed < 0.15 C over 30 s).
enum TempChip { TEMP_NONE, TEMP_MAX30205, TEMP_MLX90614 };
TempChip tempChip = TEMP_NONE;
float bodyTempOut = NAN;                        // settled reading, NAN = null
bool  tempSettling = false;
float tempHist[30]; int tempCount = 0, tempIdx = 0;

float readBodyTempRaw() {
  if (tempChip == TEMP_MAX30205) {
    Wire.beginTransmission(0x48); Wire.write(0x00);           // temperature register
    if (Wire.endTransmission(false) != 0 || Wire.requestFrom(0x48, 2) != 2) return NAN;
    uint8_t msb = Wire.read();                                 // read one at a time: the order matters
    uint8_t lsb = Wire.read();
    int16_t raw = (int16_t)((msb << 8) | lsb);
    return raw * 0.00390625f;
  }
  if (tempChip == TEMP_MLX90614) {
    Wire.setClock(100000);                                     // the MLX90614 needs <= 100 kHz
    Wire.beginTransmission(0x5A); Wire.write(0x07);           // object temperature
    float t = NAN;
    if (Wire.endTransmission(false) == 0 && Wire.requestFrom(0x5A, 3) == 3) {
      uint8_t lo = Wire.read();                                // low byte first
      uint8_t hi = Wire.read();
      Wire.read();                                             // PEC byte, not checked
      uint16_t raw = (uint16_t)((hi << 8) | lo);
      if (!(raw & 0x8000)) t = raw * 0.02f - 273.15f;
    }
    Wire.setClock(400000);
    return t;
  }
  return NAN;
}

void updateBodyTemp() {                         // once per second
  bodyTempOut = NAN; tempSettling = false;
  if (tempChip == TEMP_NONE) return;
  float t = readBodyTempRaw();
  if (isnan(t) || t < 25 || t > 45) { tempCount = 0; return; }   // missing, or nothing on the sensor
  tempHist[tempIdx] = t; tempIdx = (tempIdx + 1) % 30;
  if (tempCount < 30) tempCount++;
  float oldest = tempHist[tempIdx % 30];        // the reading from 30 s ago (once the buffer is full)
  if (tempCount < 30 || fabsf(t - oldest) > 0.15f || t < 34.0f) { tempSettling = true; return; }
  bodyTempOut = t;
}

void updateCabin() {
  if (haveBme) {
    cabinTemp = bme.readTemperature();
    cabinHum  = bme.readHumidity();
    cabinPres = bme.readPressure() / 1000.0;   // Pa -> kPa
  }

  // MQ-135: more gas -> lower sensor resistance -> higher AO voltage.
  // (VCC - V) / V is proportional to the sensor resistance, so we compare it with
  // the cleanest air seen since power-on. The module's own resistor cancels out.
  airQuality = -1;
  float v = mqMilliVolts / 1000.0 * MQ_DIVIDER;            // real AO voltage
  if (mqMilliVolts < 0 || v < 0.05 || v > MQ_VCC - 0.05) return;   // missing / saturated
  if (millis() < MQ_WARMUP_MS) return;                     // heater still warming up
  float rs = (MQ_VCC - v) / v;
  mqR0 *= 0.99995f;                                        // baseline slowly forgets (~16 %/hour)
  if (rs > mqR0) mqR0 = rs;                                // cleaner air = new baseline
  airQuality = constrain((int)((mqR0 / rs - 1.0f) * 100.0f + 0.5f), 0, 999);
}

// ================================ STATUS + BUZZER ================================
Status status = NORMAL;
int beepsLeft = 0;
uint32_t nextBeepMs = 0, nextActMs = 0;

Status hrStatus(int v)   { if (v < 0) return NORMAL; if (v >= 60 && v <= 100) return NORMAL; if (v >= 50 && v <= 110) return WATCH; return ACT; }
Status spo2Status(int v) { if (v < 0) return NORMAL; if (v >= 95) return NORMAL; if (v >= 92) return WATCH; return ACT; }
Status airStatus(int v)  { if (v < 0) return NORMAL; if (v < 20) return NORMAL; if (v <= 50) return WATCH; return ACT; }
Status tempStatus(float v) { if (isnan(v)) return NORMAL; if (v >= 36.1f && v <= 37.2f) return NORMAL; if (v >= 35.5f && v <= 38.0f) return WATCH; return ACT; }

bool timeReached(uint32_t t) { return (int32_t)(millis() - t) >= 0; }
void startBeeps(int n) { beepsLeft = n; nextBeepMs = millis(); }

void setStatus(Status s) {
  if (s == status) return;
  status = s;
  if (s == WATCH)      startBeeps(1);
  else if (s == ACT) { startBeeps(3); nextActMs = millis() + ACT_REPEAT_MS; }
  else               { beepsLeft = 0; noTone(PIN_BUZZER); }
}

void serviceBuzzer() {
  if (status == ACT && timeReached(nextActMs)) { startBeeps(3); nextActMs = millis() + ACT_REPEAT_MS; }
  if (beepsLeft > 0 && timeReached(nextBeepMs)) {
    tone(PIN_BUZZER, BEEP_HZ, BEEP_MS);
    beepsLeft--;
    nextBeepMs = millis() + BEEP_MS + 150;
  }
}

// ========================= SIM VALUES FROM THE DASHBOARD =========================
// The dashboard sends e.g. {"sim":{"bodyTemp":36.8,"breathing":16,"sleep":7.4,"water":2.6,"exercise":45}}
float simBodyTemp = NAN, simBreathing = NAN, simSleep = NAN, simWater = NAN, simExercise = NAN;
uint32_t simMs = 0;
char rxLine[256]; int rxLen = 0;

float jsonNumber(const char* s, const char* key) {       // tiny parser: finds "key":number
  const char* p = strstr(s, key);
  if (!p) return NAN;
  p = strchr(p + strlen(key), ':');
  if (!p) return NAN;
  p++;
  while (*p == ' ') p++;
  if (*p != '-' && *p != '.' && (*p < '0' || *p > '9')) return NAN;   // null or text
  return atof(p);
}

void handleIncoming(const char* line) {
  if (!strstr(line, "\"sim\"")) return;
  simBodyTemp  = jsonNumber(line, "\"bodyTemp\"");
  simBreathing = jsonNumber(line, "\"breathing\"");
  simSleep     = jsonNumber(line, "\"sleep\"");
  simWater     = jsonNumber(line, "\"water\"");
  simExercise  = jsonNumber(line, "\"exercise\"");
  simMs = millis();
}

void readIncoming() {
  while (Serial.available()) {
    char c = Serial.read();
    if (c == '\n') { rxLine[rxLen] = 0; handleIncoming(rxLine); rxLen = 0; }
    else if (c != '\r') { if (rxLen < (int)sizeof(rxLine) - 1) rxLine[rxLen++] = c; else rxLen = 0; }
  }
}

// ================================ JSON OUTPUT ================================
char out[4096];
int outLen = 0;
uint32_t ecgSentUpTo = 0;

void add(const char* fmt, ...) {
  va_list a; va_start(a, fmt);
  outLen += vsnprintf(out + outLen, sizeof(out) - outLen, fmt, a);
  va_end(a);
  if (outLen > (int)sizeof(out) - 1) outLen = sizeof(out) - 1;
}
void addInt(const char* key, int v)   { if (v < 0) add("\"%s\":null,", key); else add("\"%s\":%d,", key, v); }
void addNum(const char* key, float v, int dec) { if (isnan(v)) add("\"%s\":null,", key); else add("\"%s\":%.*f,", key, dec, v); }

void sendJson() {
  outLen = 0;
  add("{");
  addInt("heartRate", hrOut);
  addInt("spo2", spo2Out);
  add("\"finger\":%s,", finger ? "true" : "false");
  addInt("ecgHeartRate", ecgBpmOut);
  add("\"leadsOn\":%s,", ecgLeadsOn ? "true" : "false");
  add("\"ecgSimulated\":%s,", ecgSimulated && !ecgLeadsOn ? "true" : "false");
  addNum("bodyTemp", bodyTempOut, 1);
  add("\"tempSettling\":%s,", tempSettling ? "true" : "false");
  addNum("cabinTemp", cabinTemp, 1);
  addNum("cabinHumidity", cabinHum, 0);
  addNum("cabinPressure", cabinPres, 1);
  addInt("airQuality", airQuality);
  add("\"status\":\"%s\",", STATUS_WORD[status]);

  // ECG samples since the last line (about 250): real or simulated, or [] when there's neither
  add("\"ecg\":[");
  uint32_t end = ecgCount();
  uint32_t start = ecgSentUpTo;
  if (end - start > 300) start = end - 300;
  ecgSentUpTo = end;
  if (ecgLeadsOn || ecgSimulated) {
    for (uint32_t i = start; i < end; i++) add(i == start ? "%d" : ",%d", ecgRing[i % ECG_RING]);
  }
  add("]}\n");
  Serial.write((const uint8_t*)out, outLen);   // goes into a 4 KB buffer, does not block
}

// ================================== SCREENS ==================================
void drawCrew() {                               // OLED 1: status, HR, SpO2, ECG trace
  if (!haveCrew) return;
  Oled& d = oledCrew;
  d.clearDisplay();
  d.setTextColor(OLED_WHITE);
  d.setTextSize(2); d.setCursor(0, 0); d.print(STATUS_WORD[status]);
  d.setTextSize(1);
  d.setCursor(86, 0); d.print(ecgSimulated && !ecgLeadsOn ? "ECG SIM" : "ECG");
  d.setCursor(86, 8); if (ecgBpmOut > 0) d.printf("%d bpm", ecgBpmOut); else d.print("--");

  d.setCursor(0, 19);
  if (hrOut >= 0) d.printf("HR %d SpO2 %d%%", hrOut, spo2Out);
  else            d.print(!havePulse ? "HR -- no sensor" : !finger ? "HR -- finger" : "HR -- still");
  if (tempChip != TEMP_NONE) {                  // body temperature, right-hand side
    d.setCursor(98, 19);
    if (!isnan(bodyTempOut)) d.printf("%.1fC", bodyTempOut); else d.print(tempSettling ? "..." : "--");
  }

  if (!ecgLeadsOn && !ecgSimulated) {           // ECG trace area: y 30..63
    d.setCursor(0, 44); d.print(USE_AD8232 ? "ECG: attach electrodes" : "ECG: not fitted");
  } else {
    int16_t pts[128];
    uint32_t end = ecgCount();
    int16_t lo = 32767, hi = -32768;
    for (int x = 0; x < 128; x++) {             // last ~1 s (2 samples per pixel)
      pts[x] = ecgRing[(end - 256 + x * 2) % ECG_RING];
      lo = min(lo, pts[x]); hi = max(hi, pts[x]);
    }
    int range = max(hi - lo, 20);
    for (int x = 1; x < 128; x++) {
      int ya = 63 - (pts[x - 1] - lo) * 33 / range;
      int yb = 63 - (pts[x]     - lo) * 33 / range;
      d.drawLine(x - 1, ya, x, yb, OLED_WHITE);
    }
  }
  d.display();
}

void drawCabin() {                              // OLED 2: cabin air
  if (!haveCabin) return;
  selectBus2(true);
  Oled& d = oledCabin;
  d.clearDisplay();
  d.setTextColor(OLED_WHITE);
  d.setTextSize(1);
  d.setCursor(0, 0);  d.print("CABIN AIR");
  d.drawFastHLine(0, 10, 128, OLED_WHITE);
  d.setCursor(0, 16); if (!isnan(cabinTemp)) d.printf("Temp   %.1f C", cabinTemp); else d.print("Temp   --");
  d.setCursor(0, 28); if (!isnan(cabinHum))  d.printf("Humid  %.0f %%", cabinHum); else d.print("Humid  --");
  d.setCursor(0, 40); if (!isnan(cabinPres)) d.printf("Press  %.1f kPa", cabinPres); else d.print("Press  --");
  d.setCursor(0, 52);
  if (airQuality >= 0)              d.printf("Air    +%d %%", airQuality);
  else if (millis() < MQ_WARMUP_MS) d.printf("Air    warm-up %lus", (unsigned long)((MQ_WARMUP_MS - millis()) / 1000));
  else                              d.print("Air    --");
  d.display();
}

void drawSim() {                                // OLED 3: values from the dashboard
  if (!haveSim) return;
  selectBus2(false);
  Oled& d = oledSim;
  d.clearDisplay();
  d.setTextColor(OLED_WHITE);
  d.setTextSize(1);
  d.setCursor(0, 0); d.print("SIM  from dashboard");
  d.drawFastHLine(0, 10, 128, OLED_WHITE);
  if (simMs == 0 || millis() - simMs > 10000) {
    d.setCursor(0, 28); d.print("Waiting for");
    d.setCursor(0, 40); d.print("dashboard...");
  } else {
    d.setCursor(0, 14); if (!isnan(simBodyTemp))  d.printf("Body   %.1f C", simBodyTemp);    else d.print("Body   --");
    d.setCursor(0, 24); if (!isnan(simBreathing)) d.printf("Breath %.0f /min", simBreathing); else d.print("Breath --");
    d.setCursor(0, 34); if (!isnan(simSleep))     d.printf("Sleep  %.1f h", simSleep);       else d.print("Sleep  --");
    d.setCursor(0, 44); if (!isnan(simWater))     d.printf("Water  %.1f L", simWater);       else d.print("Water  --");
    d.setCursor(0, 54); if (!isnan(simExercise))  d.printf("Exerc  %.0f min", simExercise);  else d.print("Exerc  --");
  }
  d.display();
}

// ================================== SETUP ==================================
uint32_t lastSecondMs = 0, lastCrewMs = 0;

void setup() {
  Serial.setTxBufferSize(4096);                 // big buffer so a JSON line never blocks
  Serial.setRxBufferSize(1024);
  Serial.begin(115200);

  Wire.begin(PIN_SDA1, PIN_SCL1);   Wire.setClock(400000);
  Wire1.begin(PIN_SDA2, PIN_SCL2);  Wire1.setClock(400000);

  pinMode(PIN_LO_PLUS, INPUT);
  pinMode(PIN_LO_MINUS, INPUT);

  // begin(..., reset, periphBegin=false): the buses are already started above
  haveCrew  = oledBegin(oledCrew, 0x3C);
  selectBus2(true);                             // cabin OLED: 0x3C, or 0x3D if its resistor was moved
  if (!i2cPresent(Wire1, 0x3C) && i2cPresent(Wire1, 0x3D)) cabinAddr = 0x3D;
  haveCabin = oledBegin(oledCabin, cabinAddr);
  selectBus2(false);                            // sim OLED
  haveSim   = oledBegin(oledSim, 0x3C);

  havePulse = pulse.begin(Wire, I2C_SPEED_FAST);
  if (havePulse) pulse.setup(60, 4, 2, 100, 411, 4096);   // Red+IR, 25 samples/s
  haveBme = bme.begin(0x76, &Wire);

  Wire.setClock(100000);                        // body temperature sensor (the MLX90614 needs 100 kHz)
  if (i2cPresent(Wire, 0x48))      tempChip = TEMP_MAX30205;
  else if (i2cPresent(Wire, 0x5A)) tempChip = TEMP_MLX90614;
  Wire.setClock(400000);

  // Start-up check on the crew screen (Serial stays pure JSON)
  if (haveCrew) {
    Oled& d = oledCrew;
    d.clearDisplay(); d.setTextSize(1); d.setTextColor(OLED_WHITE); d.setCursor(0, 0);
    d.println("VITALS  Mission 61:4");
    d.println();
    d.printf("MAX30102  %s\n", havePulse ? "OK" : "MISSING");
    d.printf("BME280    %s\n", haveBme   ? "OK" : "MISSING");
    d.printf("OLED 2/3  %s/%s\n", haveCabin ? "OK" : "--", haveSim ? "OK" : "--");
    d.printf("BodyTemp  %s\n", tempChip == TEMP_MAX30205 ? "MAX30205" : tempChip == TEMP_MLX90614 ? "MLX90614" : "MISSING");
    d.printf("ECG       %s\n", USE_AD8232 ? (SIM_ECG ? "AD8232+sim" : "AD8232") : (SIM_ECG ? "simulated" : "off"));
    d.println("MQ-135    warming up");
    d.display();
    delay(2500);                                // start-up only
  }

  xTaskCreatePinnedToCore(ecgTask, "ecg", 4096, nullptr, 2, nullptr, 0);   // core 0
  lastSecondMs = millis();
}

// =================================== LOOP ===================================
void loop() {
  samplePulse();                                // keep the MAX30102 FIFO empty
  readIncoming();                               // SIM values from the dashboard
  uint32_t now = millis();

  if (now - lastSecondMs >= 1000) {             // ---- once per second ----
    lastSecondMs = now;
    updatePulse();
    updateEcg();
    updateCabin();
    updateBodyTemp();
    // Status uses the steady MAX30102 readings, settled body temperature and air quality.
    // The ECG heart rate (real or simulated) is shown but never triggers alarms: a loose
    // electrode makes noise that looks like beats, and a simulated trace isn't a measurement.
    Status worst = max(max(hrStatus(hrOut), spo2Status(spo2Out)), max(airStatus(airQuality), tempStatus(bodyTempOut)));
    setStatus(worst);
    sendJson();
    drawCabin();
    drawSim();
  }

  if (now - lastCrewMs >= 250) {                // crew screen 4x per second (ECG trace)
    lastCrewMs = now;
    drawCrew();
  }

  serviceBuzzer();
}
