/*
  VITALS - ECG signal scale test (AD8232 OUTPUT -> GPIO34). Reads only: nothing is sent
  to the electrodes. Adjusts how the ESP32 READS and SCALES the signal.
  Serial Plotter or Monitor at 115200. Type a command and press Enter:
    g2.5   software gain (multiply the signal), e.g. g1, g2.5, g10
    o1650  centre line in mV (the AD8232 output rests near 1650 mV), e.g. o1500
    a0..a3 ADC input range: a0 = up to ~1.1 V, a1 = ~1.5 V, a2 = ~2.2 V, a3 = ~3.1 V (default)
*/
const int PIN_ECG = 34;
float gain = 1.0, centreMv = 1650;
int range = 3;
const adc_attenuation_t RANGES[] = { ADC_0db, ADC_2_5db, ADC_6db, ADC_11db };
uint32_t nextSample = 0;
String cmd;

void setup() {
  Serial.begin(115200);
  analogSetPinAttenuation(PIN_ECG, RANGES[range]);
}

void handle(String c) {
  c.trim();
  if (c.length() < 2) return;
  float v = c.substring(1).toFloat();
  if (c[0] == 'g' && v > 0 && v <= 50) gain = v;
  else if (c[0] == 'o' && v >= 0 && v <= 3300) centreMv = v;
  else if (c[0] == 'a' && v >= 0 && v <= 3) { range = (int)v; analogSetPinAttenuation(PIN_ECG, RANGES[range]); }
  else { Serial.println("# unknown command"); return; }
  Serial.printf("# gain %.1f  centre %.0f mV  range a%d\n", gain, centreMv, range);
}

void loop() {
  while (Serial.available()) {                  // commands typed in the Serial Monitor
    char ch = Serial.read();
    if (ch == '\n') { handle(cmd); cmd = ""; } else cmd += ch;
  }
  if (millis() < nextSample) return;            // 250 samples per second, no delay()
  nextSample = millis() + 4;
  int mv = analogReadMilliVolts(PIN_ECG);       // what the ESP32 sees, in mV
  Serial.printf("raw_mV:%d ecg:%.0f\n", mv, (mv - centreMv) * gain);
}
