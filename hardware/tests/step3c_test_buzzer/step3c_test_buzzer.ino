/*
  VITALS - Step 3c: Passive buzzer test (I/O pin -> GPIO25)
  No libraries needed. You should hear: 1 beep (WATCH), pause, 3 beeps (ACT), repeat.
*/
const int PIN_BUZZER = 25;
const int FREQ = 2500;      // Hz. Passive buzzers are loudest around 2000-4000 Hz

void beep() {
  tone(PIN_BUZZER, FREQ, 150);   // 150 ms beep (tone() does not block on ESP32)
  delay(300);                    // wait for the beep + a short gap (OK in a test sketch)
}

void setup() {
  Serial.begin(115200);
  Serial.println("Buzzer test");
}

void loop() {
  Serial.println("WATCH pattern: 1 beep");
  beep();
  delay(2000);

  Serial.println("ACT pattern: 3 beeps");
  beep(); beep(); beep();
  delay(3000);
}
