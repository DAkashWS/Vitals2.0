/*
  VITALS - ECG cable + heartbeat sensor diagnostic.
  Follow the steps shown on the crew OLED (15 s each, finger step 30 s).
  Prints one CSV line every 0.5 s:
  D,step,ms,loPlus%,loMinus%,ecgMin,ecgMax,ecgMean,ecgSpread,irLatest,irMin,irMax
*/
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SH110X.h>
#include "MAX30105.h"

Adafruit_SH1106G oled(128, 64, &Wire, -1);
MAX30105 pulse;
bool havePulse = false;
const int PIN_ECG = 34, LOP = 18, LOM = 19;

const char* STEPS[] = {
  "1. UNPLUG the ECG\n   cable jack",
  "2. PLUG the ECG jack\n   in. Pads NOT on\n   the body",
  "3. Pads ON the body\n   Sit still",
  "4. Finger on the RED\n   sensor. Hold still",
  "Done. Thank you!"
};

int stepAt(uint32_t t) { return t < 15000 ? 0 : t < 30000 ? 1 : t < 45000 ? 2 : t < 75000 ? 3 : 4; }

uint32_t nextSample = 0, nextPrint = 0, t0 = 0;
long eSum = 0; int eMin = 4095, eMax = 0, eN = 0, loP = 0, loM = 0;
uint32_t ir = 0, irMin = 0xFFFFFFFF, irMax = 0;

void setup() {
  Serial.begin(115200);
  Wire.begin(21, 22);
  oled.begin(0x3C, true);
  havePulse = pulse.begin(Wire, I2C_SPEED_FAST);
  if (havePulse) pulse.setup(60, 4, 2, 100, 411, 4096);
  pinMode(LOP, INPUT);
  pinMode(LOM, INPUT);
  t0 = millis();
}

void loop() {
  uint32_t now = millis();
  if (now >= nextSample) {                         // ECG at 250 Hz
    nextSample = now + 4;
    int v = analogRead(PIN_ECG);
    eSum += v; eN++; eMin = min(eMin, v); eMax = max(eMax, v);
    loP += digitalRead(LOP); loM += digitalRead(LOM);
  }
  if (havePulse) {
    pulse.check();
    while (pulse.available()) {
      ir = pulse.getFIFOIR(); pulse.nextSample();
      irMin = min(irMin, ir); irMax = max(irMax, ir);
    }
  }
  if (now >= nextPrint) {
    nextPrint = now + 500;
    uint32_t t = now - t0;
    int st = stepAt(t);
    if (eN) Serial.printf("D,%d,%lu,%d,%d,%d,%d,%ld,%d,%lu,%lu,%lu\n", st + 1, (unsigned long)t,
                          loP * 100 / eN, loM * 100 / eN, eMin, eMax, eSum / eN, eMax - eMin,
                          (unsigned long)ir, (unsigned long)irMin, (unsigned long)irMax);
    eSum = 0; eN = 0; eMin = 4095; eMax = 0; loP = 0; loM = 0; irMin = 0xFFFFFFFF; irMax = 0;

    uint32_t stepEnd = st == 0 ? 15000 : st == 1 ? 30000 : st == 2 ? 45000 : 75000;
    oled.clearDisplay();
    oled.setTextColor(SH110X_WHITE);
    oled.setTextSize(1);
    oled.setCursor(0, 0);
    oled.println(STEPS[st]);
    if (st < 4) { oled.setCursor(0, 54); oled.printf("%lu s left", (unsigned long)((stepEnd - t) / 1000)); }
    oled.display();
  }
}
