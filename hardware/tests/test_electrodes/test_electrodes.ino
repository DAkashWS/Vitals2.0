/*
  VITALS - ECG electrode detection test (AD8232: LO+ -> GPIO18, LO- -> GPIO19)
  Every second the Serial Monitor (115200) says whether the electrodes are connected.
  Same rule as firmware v3: connected if the LO pins read "attached" for at least 95 %
  of the last second (100 % with the pads on, on our board).
*/
const int PIN_LO_PLUS = 18, PIN_LO_MINUS = 19;

int loOn = 0, loN = 0;
uint32_t nextSample = 0;

void setup() {
  Serial.begin(115200);
  pinMode(PIN_LO_PLUS, INPUT);
  pinMode(PIN_LO_MINUS, INPUT);
}

void loop() {
  if (millis() < nextSample) return;   // millis() timer, no delay(): 250 checks per second
  nextSample = millis() + 4;

  if (digitalRead(PIN_LO_PLUS) == LOW && digitalRead(PIN_LO_MINUS) == LOW) loOn++;
  if (++loN < 250) return;

  int pct = loOn * 100 / loN;          // % of the last second the pins said "attached"
  bool connected = pct >= 95;
  Serial.printf("Electrodes: %s   (LO pins \"attached\" %d %% of the last second)\n",
                connected ? "CONNECTED" : "NOT connected", pct);
  loOn = loN = 0;
}
