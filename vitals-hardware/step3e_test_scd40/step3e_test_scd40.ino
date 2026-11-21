/*
  VITALS - Step 3e: SCD40 CO2 test (optional sensor, I2C 0x62)
  Library: "SparkFun SCD4x Arduino Library"
  The SCD40 gives a new reading every 5 seconds. The first one takes ~5 s.
  Demo trick: breathe gently towards it - CO2 should climb within ~10-20 s.
*/
#include <Wire.h>
#include "SparkFun_SCD4x_Arduino_Library.h"

SCD4x scd;

void setup() {
  Serial.begin(115200);
  delay(1000);
  Wire.begin(21, 22);

  if (!scd.begin(Wire)) {          // also starts periodic measurement
    Serial.println("SCD40 not found at 0x62. Check wiring. Stopping.");
    while (true) delay(1000);
  }
  Serial.println("SCD40 OK. Waiting for first reading (~5 s)...");
}

void loop() {
  if (scd.readMeasurement()) {     // true only when a NEW reading is ready
    Serial.printf("CO2 %u ppm   Temp %.1f C   Humidity %.0f %%\n",
                  scd.getCO2(), scd.getTemperature(), scd.getHumidity());
  }
  delay(500);
}
