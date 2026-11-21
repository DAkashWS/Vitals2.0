/*
  VITALS - Step 3b: OLED test (0.96" SSD1306, 128x64, I2C 0x3C)
  Libraries: "Adafruit SSD1306" (+ "Adafruit GFX Library")
*/
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

Adafruit_SSD1306 oled(128, 64, &Wire, -1);   // width, height, bus, no reset pin

void setup() {
  Serial.begin(115200);
  delay(1000);
  Wire.begin(21, 22);

  if (!oled.begin(SSD1306_SWITCHCAPVCC, 0x3C)) {
    Serial.println("OLED not found at 0x3C (try 0x3D). Stopping.");
    while (true) delay(1000);
  }
  Serial.println("OLED OK");
}

void loop() {
  static int counter = 0;

  oled.clearDisplay();
  oled.setTextColor(SSD1306_WHITE);
  oled.setTextSize(2);                 // big text: 12x16 px per letter
  oled.setCursor(0, 0);
  oled.println("VITALS");
  oled.setTextSize(1);                 // small text: 6x8 px per letter
  oled.println("Mission 61:4");
  oled.println();
  oled.print("OLED test ");
  oled.println(counter++);
  oled.display();                      // nothing appears until you call this

  delay(1000);
}
