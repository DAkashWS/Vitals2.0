/*
  VITALS - Step 3a: BME280 test (cabin temperature, humidity, pressure)
  Libraries: "Adafruit BME280 Library" (+ "Adafruit Unified Sensor", "Adafruit BusIO")
  Serial Monitor: 115200 baud.

  It also reads the chip ID, which tells you whether you really have a BME280:
    0x60 = BME280 (good)     0x58 = BMP280 (no humidity!)     0x00 = nothing answered
*/
#include <Wire.h>
#include <Adafruit_Sensor.h>
#include <Adafruit_BME280.h>

const uint8_t BME_ADDR = 0x76;   // change to 0x77 if the scanner found 0x77
Adafruit_BME280 bme;

// Read the chip ID register (0xD0) directly, without the library
uint8_t readChipId() {
  Wire.beginTransmission(BME_ADDR);
  Wire.write(0xD0);
  if (Wire.endTransmission() != 0) return 0x00;   // no answer
  Wire.requestFrom((int)BME_ADDR, 1);
  return Wire.available() ? Wire.read() : 0x00;
}

void setup() {
  Serial.begin(115200);
  delay(1000);
  Wire.begin(21, 22);

  uint8_t id = readChipId();
  Serial.printf("\nChip ID = 0x%02X  ", id);
  if (id == 0x60)      Serial.println("-> genuine BME280");
  else if (id == 0x58) Serial.println("-> this is a BMP280 (no humidity sensor)");
  else                 Serial.println("-> no sensor answered at this address");

  if (!bme.begin(BME_ADDR, &Wire)) {
    Serial.println("BME280 library could not start. Stopping here.");
    while (true) delay(1000);
  }
  Serial.println("BME280 OK. Reading every 2 seconds...");
}

void loop() {
  float t = bme.readTemperature();          // degrees C
  float h = bme.readHumidity();             // % relative humidity
  float p = bme.readPressure() / 1000.0;    // Pa -> kPa

  Serial.printf("Temp %.1f C   Humidity %.0f %%   Pressure %.1f kPa\n", t, h, p);
  delay(2000);
}
