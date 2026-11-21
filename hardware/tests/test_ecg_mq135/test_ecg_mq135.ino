/*
  VITALS - AD8232 ECG + MQ-135 quick test. No libraries.
  Open Tools > Serial PLOTTER at 115200.
    - Electrodes on, sitting still: a heartbeat pattern on "ecg"
    - Electrodes off: "leadsOff" jumps to 1000
  Every 2 s the Serial MONITOR also shows the MQ-135 voltage (lines starting with #).
  The real AO voltage must stay below 5 V; GPIO35 must stay below 3.3 V.
*/
const int PIN_ECG = 34, PIN_LO_PLUS = 18, PIN_LO_MINUS = 19, PIN_MQ = 35;
const float MQ_DIVIDER = 1.5;   // 1k top + 2x1k bottom. Two equal resistors = 2.0

uint32_t nextSample = 0, nextMq = 0;

void setup() {
  Serial.begin(115200);
  pinMode(PIN_LO_PLUS, INPUT);
  pinMode(PIN_LO_MINUS, INPUT);
}

void loop() {
  if (millis() >= nextSample) {                 // 250 samples per second
    nextSample = millis() + 4;
    bool off = digitalRead(PIN_LO_PLUS) || digitalRead(PIN_LO_MINUS);
    int ecg = off ? 0 : analogRead(PIN_ECG);
    Serial.printf("ecg:%d leadsOff:%d\n", ecg, off ? 1000 : 0);
  }
  if (millis() >= nextMq) {
    nextMq = millis() + 2000;
    int mv = analogReadMilliVolts(PIN_MQ);
    Serial.printf("# MQ-135: GPIO35 %.2f V  ->  AO %.2f V\n", mv / 1000.0, mv / 1000.0 * MQ_DIVIDER);
  }
}
