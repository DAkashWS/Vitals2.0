/*
  VITALS - I2C scanner for BOTH buses. Run this first. Serial Monitor at 115200.

  Expected
    Bus 1 (SDA 21, SCL 22): 0x3C OLED crew, 0x57 MAX30102, 0x76 BME280
    Bus 2 (SDA 32, SCL 33): 0x3C OLED sim
    Bus 2 (SDA 26, SCL 27): 0x3C OLED cabin
  Missing address? Check: VCC on 3V3, GND, SDA/SCL not swapped, and that the
  module's pins are pushed fully into the breadboard.
*/
#include <Wire.h>

const char* nameFor(uint8_t a) {
  switch (a) {
    case 0x3C: return "OLED (0x3C)";
    case 0x3D: return "OLED (0x3D)";
    case 0x57: return "MAX30102";
    case 0x76: case 0x77: return "BME280 / BMP280";
    default:   return "unknown";
  }
}

void scan(TwoWire& bus, const char* label) {
  Serial.println(label);
  int found = 0;
  for (uint8_t a = 1; a < 127; a++) {
    bus.beginTransmission(a);
    if (bus.endTransmission() == 0) {
      Serial.printf("   0x%02X  %s\n", a, nameFor(a));
      found++;
    }
  }
  if (!found) Serial.println("   nothing found");
}

void setup() {
  Serial.begin(115200);
  delay(1000);
  Wire.begin(21, 22);
  Wire1.begin(32, 33);
}

void loop() {
  scan(Wire,  "Bus 1 (SDA 21, SCL 22):");
  Wire1.end(); Wire1.begin(32, 33);
  scan(Wire1, "Bus 2 (SDA 32, SCL 33):");
  Wire1.end(); Wire1.begin(26, 27);
  scan(Wire1, "Bus 2 (SDA 26, SCL 27):");
  Serial.println();
  delay(3000);
}
