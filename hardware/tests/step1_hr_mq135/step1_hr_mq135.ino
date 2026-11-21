/*
  VITALS - Step 1: heart rate (MAX30102) + CO2 estimate (MQ-135)
  Shows the values on the crew OLED (pins 21/22) and in the Serial Monitor (115200).

  Heart rate: rest a fingertip lightly on the sensor and keep still. The first value
  appears after a few beats (about 5-10 s).
  CO2: the MQ-135 needs 60 s to warm up. It then assumes the room air is fresh
  (about 400 ppm) and measures changes from there. It is an ESTIMATE: the MQ-135
  reacts to many gases, not only CO2. Breathe on it to see the value rise.

  Libraries: SparkFun MAX3010x, Adafruit SH110X (+ Adafruit GFX)
*/
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SH110X.h>
#include "MAX30105.h"
#include "heartRate.h"          // beat detection from the SparkFun library

// ---------- settings ----------
const float MQ_DIVIDER = 1.5;   // 1k top + 2x1k bottom = 1.5 | two equal resistors = 2.0
const float MQ_VCC = 5.0;       // MQ-135 powered from VIN (5 V)
const uint32_t MQ_WARMUP_MS = 60000;
const int PIN_MQ = 35;

Adafruit_SH1106G oled(128, 64, &Wire, -1);
MAX30105 sensor;
bool haveSensor = false;

// ---------- heart rate ----------
const int AVG = 4;              // average the last 4 beats
int beats[AVG], beatIdx = 0, beatCount = 0;
uint32_t lastBeat = 0;
int bpm = 0;                    // 0 = no value yet
long irNow = 0, redNow = 0;

// ---------- MQ-135 ----------
float r0 = 0;                   // sensor resistance in fresh air (calibrated after warm-up)
int co2 = -1;                   // -1 = warming up / no value
float aoVolts = 0;

uint32_t nextSecond = 0;

void setup() {
  Serial.begin(115200);
  Wire.begin(21, 22);
  oled.begin(0x3C, true);

  haveSensor = sensor.begin(Wire, I2C_SPEED_FAST);
  if (haveSensor) {
    sensor.setup();                         // SparkFun defaults: 100 samples/s, both LEDs on
    sensor.setPulseAmplitudeGreen(0);
    // Both LEDs stay at full power: on many clone boards the red and IR LEDs are
    // swapped, so we read whichever channel sees the finger best (see readHeart).
  }
  Serial.println(haveSensor ? "MAX30102 OK" : "MAX30102 NOT FOUND - check wiring");
}

void readHeart() {
  if (!haveSensor) return;
  sensor.check();
  if (!sensor.available()) return;          // no new sample yet
  long ir = sensor.getFIFOIR(), red = sensor.getFIFORed();
  sensor.nextSample();
  redNow = red;
  irNow = max(ir, red);                     // handles boards with swapped LEDs
  if (irNow < 50000) {                      // no finger: forget old beats
    beatCount = 0; bpm = 0;
    return;
  }
  if (checkForBeat(irNow)) {
    uint32_t now = millis();
    uint32_t gap = now - lastBeat;
    lastBeat = now;
    float b = 60000.0 / gap;
    if (b > 40 && b < 180) {                // ignore impossible values
      beats[beatIdx] = (int)b;
      beatIdx = (beatIdx + 1) % AVG;
      if (beatCount < AVG) beatCount++;
      long sum = 0;
      for (int i = 0; i < beatCount; i++) sum += beats[i];
      bpm = sum / beatCount;
    }
  }
  if (millis() - lastBeat > 3000) bpm = 0;  // no beat for 3 s
}

void readMq() {
  long mv = 0;
  for (int i = 0; i < 10; i++) mv += analogReadMilliVolts(PIN_MQ);
  aoVolts = mv / 10.0 / 1000.0 * MQ_DIVIDER;            // real MQ-135 output voltage
  if (aoVolts < 0.05 || aoVolts > MQ_VCC - 0.05) { co2 = -1; return; }
  float rs = (MQ_VCC - aoVolts) / aoVolts;              // proportional to sensor resistance
  if (millis() < MQ_WARMUP_MS) { co2 = -1; return; }
  // Standard MQ-135 CO2 curve: ppm = 116.6 * (Rs/R0)^-2.769
  if (r0 == 0) r0 = rs * pow(400.0 / 116.6020682, 1.0 / 2.769034857);  // fresh air = 400 ppm
  co2 = (int)(116.6020682 * pow(rs / r0, -2.769034857));
}

void show() {
  bool finger = irNow >= 50000;
  oled.clearDisplay();
  oled.setTextColor(SH110X_WHITE);

  oled.setTextSize(1); oled.setCursor(0, 0); oled.print("HEART RATE");
  oled.setTextSize(2); oled.setCursor(0, 10);
  if (!haveSensor) oled.print("no sensor");
  else if (!finger) { oled.setTextSize(1); oled.setCursor(0, 14); oled.print("Place finger on sensor"); }
  else if (bpm == 0) { oled.setTextSize(1); oled.setCursor(0, 14); oled.print("Hold still..."); }
  else { oled.print(bpm); oled.print(" bpm"); }

  oled.setTextSize(1); oled.setCursor(0, 34); oled.print("CO2 (estimate)");
  oled.setTextSize(2); oled.setCursor(0, 44);
  if (co2 >= 0) { oled.print(co2); oled.setTextSize(1); oled.print(" ppm"); }
  else if (millis() < MQ_WARMUP_MS) {
    oled.setTextSize(1); oled.setCursor(0, 48);
    oled.printf("Warming up %lus", (unsigned long)((MQ_WARMUP_MS - millis()) / 1000));
  } else { oled.setTextSize(1); oled.setCursor(0, 48); oled.print("Check MQ-135 wiring"); }
  oled.display();

  Serial.printf("HR: %s   finger: %s   signal: %ld (red %ld)   |   MQ-135: AO %.2f V   CO2: %s\n",
                bpm ? String(bpm).c_str() : "--", finger ? "yes" : "no", irNow, redNow, aoVolts,
                co2 >= 0 ? (String(co2) + " ppm").c_str() : (millis() < MQ_WARMUP_MS ? "warming up" : "--"));
}

void loop() {
  readHeart();                              // as often as possible: beats need every sample
  if (millis() >= nextSecond) {
    nextSecond = millis() + 1000;
    readMq();
    show();
  }
}
