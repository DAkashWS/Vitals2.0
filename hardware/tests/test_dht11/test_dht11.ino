/*
  VITALS - DHT11 test: room temperature + humidity on the OLED and Serial Monitor
  Wiring: DHT11  VCC -> 3V3, GND -> GND, DATA -> GPIO4
                 (bare 4-pin sensor: also a 10k resistor between DATA and 3V3)
          OLED   VCC -> 3V3, GND -> GND, SDA -> GPIO21, SCL -> GPIO22 (SH1106, 0x3C)
  Libraries: "DHT sensor library" by Adafruit (+ Adafruit Unified Sensor),
             "Adafruit SH110X" (+ Adafruit GFX Library)
  New reading every 2 s (the DHT11 can't go faster). No delay(): millis() timer.
*/
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SH110X.h>
#include <DHT.h>

DHT dht(4, DHT11);                             // pin, type (DHT22: change DHT11 to DHT22)
Adafruit_SH1106G oled(128, 64, &Wire, -1);
uint32_t nextRead = 0;

void show(float t, float h) {
  oled.clearDisplay();
  oled.setTextColor(SH110X_WHITE);
  oled.setTextSize(1);
  oled.setCursor(0, 0);
  oled.print("ROOM");
  oled.drawFastHLine(0, 10, 128, SH110X_WHITE);

  if (isnan(t) || isnan(h)) {
    oled.setCursor(0, 24); oled.print("DHT11: no reading");
    oled.setCursor(0, 40); oled.print("Check wires, GPIO4");
  } else {
    oled.setCursor(0, 18); oled.print("Temperature");
    oled.setTextSize(2); oled.setCursor(0, 28); oled.printf("%.0f C", t);
    oled.setTextSize(1); oled.setCursor(72, 18); oled.print("Humidity");
    oled.setTextSize(2); oled.setCursor(72, 28); oled.printf("%.0f%%", h);
    oled.setTextSize(1); oled.setCursor(0, 54);
    oled.print(h < 30 ? "Air: dry" : h > 60 ? "Air: humid" : "Air: comfortable");
  }
  oled.display();
}

void setup() {
  Serial.begin(115200);
  Wire.begin(21, 22);
  oled.begin(0x3C, true);
  dht.begin();
  show(NAN, NAN);
  Serial.println("DHT11 test - first reading in 2 s");
}

void loop() {
  if (millis() < nextRead) return;
  nextRead = millis() + 2000;

  float t = dht.readTemperature();             // degrees C
  float h = dht.readHumidity();                // % relative humidity
  show(t, h);
  if (isnan(t) || isnan(h)) {
    Serial.println("No reading - check VCC, GND, DATA on GPIO4 (and the 10k pull-up on a bare sensor)");
    return;
  }
  Serial.printf("Room temp: %.0f C   Humidity: %.0f %%\n", t, h);
}
