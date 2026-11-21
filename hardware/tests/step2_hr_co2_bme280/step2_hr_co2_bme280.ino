/*
  VITALS - Step 2: heart rate + CO2 estimate + cabin air (BME280), on 2 OLEDs
    OLED 1 (SDA 21, SCL 22): heart rate + CO2
    OLED 2 (SDA 32, SCL 33): cabin temperature, humidity, pressure
    BME280 (SDA 21, SCL 22, 3V3): address 0x76 or 0x77, found automatically
  Serial Monitor (115200) shows everything once per second.
  No delay() in the loop: millis() timers keep the heartbeat sensor sampling.

  Libraries: SparkFun MAX3010x, Adafruit SH110X (+ GFX), Adafruit BME280 (+ Unified Sensor)
*/
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SH110X.h>
#include <Adafruit_Sensor.h>
#include <Adafruit_BME280.h>
#include "MAX30105.h"
#include "heartRate.h"

// ---------- settings ----------
const float MQ_DIVIDER = 1.5;   // 1k top + 2x1k bottom = 1.5 | two equal resistors = 2.0
const float MQ_VCC = 5.0;
const uint32_t MQ_WARMUP_MS = 60000;
const int PIN_MQ = 35;

Adafruit_SH1106G oled1(128, 64, &Wire, -1);    // bus 1: heart + CO2
Adafruit_SH1106G oled2(128, 64, &Wire1, -1);   // bus 2: cabin air
MAX30105 sensor;
Adafruit_BME280 bme;
bool haveSensor = false, haveBme = false, haveOled2 = false;

// ---------- heart rate ----------
const int AVG = 4;
int beats[AVG], beatIdx = 0, beatCount = 0;
uint32_t lastBeat = 0;
int bpm = 0;
long signalNow = 0;

// ---------- MQ-135 ----------
float r0 = 0;
int co2 = -1;
float aoVolts = 0;

// ---------- BME280 ----------
float temp = NAN, hum = NAN, pres = NAN;

uint32_t nextSecond = 0;

void setup() {
  Serial.begin(115200);
  Wire.begin(21, 22);
  Wire1.begin(32, 33);
  oled1.begin(0x3C, true);
  haveOled2 = oled2.begin(0x3C, true);

  haveSensor = sensor.begin(Wire, I2C_SPEED_FAST);
  if (haveSensor) {
    sensor.setup();                         // both LEDs on, 100 samples/s
    sensor.setPulseAmplitudeGreen(0);
  }
  haveBme = bme.begin(0x76, &Wire) || bme.begin(0x77, &Wire);

  Serial.printf("MAX30102 %s | BME280 %s | OLED 2 %s\n", haveSensor ? "OK" : "MISSING",
                haveBme ? "OK" : "MISSING", haveOled2 ? "OK" : "MISSING");
}

void readHeart() {
  if (!haveSensor) return;
  sensor.check();
  if (!sensor.available()) return;
  long ir = sensor.getFIFOIR(), red = sensor.getFIFORed();
  sensor.nextSample();
  signalNow = max(ir, red);                 // works even if the board's LEDs are swapped
  if (signalNow < 50000) { beatCount = 0; bpm = 0; return; }   // no finger
  if (checkForBeat(signalNow)) {
    uint32_t now = millis();
    float b = 60000.0 / (now - lastBeat);
    lastBeat = now;
    if (b > 40 && b < 180) {
      beats[beatIdx] = (int)b;
      beatIdx = (beatIdx + 1) % AVG;
      if (beatCount < AVG) beatCount++;
      long sum = 0;
      for (int i = 0; i < beatCount; i++) sum += beats[i];
      bpm = sum / beatCount;
    }
  }
  if (millis() - lastBeat > 3000) bpm = 0;
}

void readMq() {
  long mv = 0;
  for (int i = 0; i < 10; i++) mv += analogReadMilliVolts(PIN_MQ);
  aoVolts = mv / 10.0 / 1000.0 * MQ_DIVIDER;
  if (aoVolts < 0.05 || aoVolts > MQ_VCC - 0.05 || millis() < MQ_WARMUP_MS) { co2 = -1; return; }
  float rs = (MQ_VCC - aoVolts) / aoVolts;
  if (r0 == 0) r0 = rs * pow(400.0 / 116.6020682, 1.0 / 2.769034857);   // fresh air = 400 ppm
  co2 = (int)(116.6020682 * pow(rs / r0, -2.769034857));
}

void readBme() {
  if (!haveBme) return;
  temp = bme.readTemperature();
  hum  = bme.readHumidity();
  pres = bme.readPressure() / 1000.0;       // kPa
}

void showOled1() {
  bool finger = signalNow >= 50000;
  oled1.clearDisplay();
  oled1.setTextColor(SH110X_WHITE);
  oled1.setTextSize(1); oled1.setCursor(0, 0); oled1.print("HEART RATE");
  oled1.setCursor(0, 14);
  if (!haveSensor) oled1.print("Sensor missing");
  else if (!finger) oled1.print("Place finger on sensor");
  else if (bpm == 0) oled1.print("Hold still...");
  else { oled1.setTextSize(2); oled1.setCursor(0, 10); oled1.printf("%d bpm", bpm); }

  oled1.setTextSize(1); oled1.setCursor(0, 34); oled1.print("CO2 (estimate)");
  oled1.setCursor(0, 48);
  if (co2 >= 0) { oled1.setTextSize(2); oled1.setCursor(0, 44); oled1.print(co2); oled1.setTextSize(1); oled1.print(" ppm"); }
  else if (millis() < MQ_WARMUP_MS) oled1.printf("Warming up %lus", (unsigned long)((MQ_WARMUP_MS - millis()) / 1000));
  else oled1.print("Check MQ-135 wiring");
  oled1.display();
}

void showOled2() {
  if (!haveOled2) return;
  oled2.clearDisplay();
  oled2.setTextColor(SH110X_WHITE);
  oled2.setTextSize(1);
  oled2.setCursor(0, 0); oled2.print("CABIN AIR");
  oled2.drawFastHLine(0, 10, 128, SH110X_WHITE);
  if (!haveBme) {
    oled2.setCursor(0, 28); oled2.print("BME280 not found");
  } else {
    oled2.setCursor(0, 18); oled2.printf("Temp     %.1f C", temp);
    oled2.setCursor(0, 32); oled2.printf("Humidity %.0f %%", hum);
    oled2.setCursor(0, 46); oled2.printf("Pressure %.1f kPa", pres);
  }
  oled2.display();
}

void loop() {
  readHeart();                              // every loop: beats need every sample
  if (millis() >= nextSecond) {             // once per second
    nextSecond = millis() + 1000;
    readMq();
    readBme();
    showOled1();
    showOled2();
    Serial.printf("HR: %s | CO2: %s | Temp: %.1f C | Humidity: %.0f %% | Pressure: %.1f kPa\n",
                  bpm ? String(bpm).c_str() : "--",
                  co2 >= 0 ? (String(co2) + " ppm").c_str() : "warming up",
                  temp, hum, pres);
  }
}
