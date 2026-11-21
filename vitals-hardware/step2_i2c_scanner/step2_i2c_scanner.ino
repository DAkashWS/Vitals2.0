/*
  VITALS - Step 2: I2C scanner
  Run this FIRST. It lists every I2C device the ESP32 can see.
  Open Tools > Serial Monitor at 115200 baud.

  Expected:
    0x3C  OLED SSD1306
    0x57  MAX30102
    0x76  BME280   (some boards use 0x77 instead)
    0x62  SCD40    (only if fitted)
*/
#include <Wire.h>

const int PIN_SDA = 21;
const int PIN_SCL = 22;

// Give each known address a friendly name
const char* nameFor(uint8_t addr) {
  switch (addr) {
    case 0x3C: case 0x3D: return "OLED SSD1306";
    case 0x57:            return "MAX30102 (heart rate / SpO2)";
    case 0x76: case 0x77: return "BME280 or BMP280 (cabin temp/humidity/pressure)";
    case 0x62:            return "SCD40 (CO2)";
    default:              return "unknown device";
  }
}

void setup() {
  Serial.begin(115200);
  delay(1000);                 // give the Serial Monitor time to open
  Wire.begin(PIN_SDA, PIN_SCL);
  Serial.println();
  Serial.println("VITALS I2C scanner (SDA=GPIO21, SCL=GPIO22)");
}

void loop() {
  int found = 0;
  Serial.println("Scanning...");

  // Try every possible 7-bit address; a device that answers returns 0
  for (uint8_t addr = 1; addr < 127; addr++) {
    Wire.beginTransmission(addr);
    if (Wire.endTransmission() == 0) {
      Serial.printf("  Found 0x%02X  ->  %s\n", addr, nameFor(addr));
      found++;
    }
  }

  if (found == 0) {
    Serial.println("  Nothing found! Check 3V3, GND, SDA->21, SCL->22.");
  } else {
    Serial.printf("  %d device(s) found.\n", found);
  }
  Serial.println();
  delay(3000);                 // scan again every 3 s (fine in a test sketch)
}
