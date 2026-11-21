/*
  VITALS - Step 3d: MAX30102 raw test
  Library: "SparkFun MAX3010x Pulse and Proximity Sensor Library"

  Use Tools > Serial PLOTTER (115200). Rest a fingertip lightly on the sensor:
    - IR should jump from a few thousand to well above 50000
    - With a still finger you should see a wavy line: that is your pulse
*/
#include <Wire.h>
#include "MAX30105.h"     // the SparkFun library also handles the MAX30102

MAX30105 sensor;
uint32_t lastPrint = 0;

void setup() {
  Serial.begin(115200);
  delay(1000);
  Wire.begin(21, 22);

  if (!sensor.begin(Wire, I2C_SPEED_FAST)) {
    Serial.println("MAX30102 not found at 0x57. Check wiring. Stopping.");
    while (true) delay(1000);
  }

  // brightness=60, average 4 samples, mode 2 (Red+IR), 100 Hz, pulse width 411 us, range 4096
  // -> 25 finished samples per second
  sensor.setup(60, 4, 2, 100, 411, 4096);
}

void loop() {
  static uint32_t ir = 0, red = 0;

  sensor.check();                          // move new samples from the sensor into memory
  while (sensor.available()) {
    red = sensor.getFIFORed();
    ir  = sensor.getFIFOIR();
    sensor.nextSample();
  }

  if (millis() - lastPrint >= 40) {        // ~25 lines per second for the plotter
    lastPrint = millis();
    Serial.printf("IR:%lu Red:%lu Finger:%d\n",
                  (unsigned long)ir, (unsigned long)red, ir > 50000 ? 100000 : 0);
  }
}
