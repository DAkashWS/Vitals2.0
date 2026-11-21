# VITALS firmware v2

`vitals_firmware_v2.ino` is the team's `vitals_firmware` (SH1106/SSD1306 screens, cabin OLED on pins 26/27) with two additions. Everything else, including the wiring and the data format, is unchanged. The original firmware is left untouched in `../vitals_firmware/`.

Hobby-grade prototype, **not a medical device**.

## 1. Body temperature

Add **one** of these to I2C bus 1 (the same 4 wires as the MAX30102 and BME280). The firmware finds it automatically:

| Sensor | Address | What it is | Notes |
|---|---|---|---|
| **MAX30205** (e.g. CJMCU-30205) | 0x48 | Contact sensor, ±0.1 °C | Recommended. Hold it firmly in the armpit. |
| **MLX90614** (GY-906, 3.3 V version) | 0x5A | Infrared, no contact | Reads the skin surface, which is cooler than the body. Point it at the skin from 1–2 cm. |

| Sensor pin | ESP32 |
|---|---|
| VCC / VIN | 3V3 |
| GND | GND |
| SDA | GPIO21 |
| SCL | GPIO22 |

No extra library is needed. The firmware only sends a reading once it has **settled** (changed less than 0.15 °C over 30 seconds, and above 34 °C). Until then it sends `"bodyTemp":null,"tempSettling":true` and the website shows "Measuring…". A settled reading counts towards the alarm (green 36.1–37.2 °C, yellow 35.5–38.0 °C), the same as the website. The crew screen shows it on the right of the heart-rate line.

Both sensors read the **skin**, which is a little cooler than the body's core. Under the arm is the closest you'll get without a clinical thermometer.

## 2. Simulated ECG

With `SIM_ECG 1` (the default), whenever there's **no real ECG** (no AD8232 fitted, or the electrodes are off), the firmware sends a simulated trace built from the team's 50-point sample heartbeat (`ECG_TEMPLATE` in the sketch, baseline 512), stretched to the current heart rate at 250 samples a second. Replace those 50 numbers to change the shape. It follows the MAX30102 heart rate when there is one, or 72 bpm otherwise. It's marked in every JSON line:

```json
{"ecgHeartRate":74,"leadsOn":false,"ecgSimulated":true,"bodyTemp":36.9,"tempSettling":false,"ecg":[...]}
```

- The website labels it **Simulated** and never counts it towards the health status.
- The crew screen shows **ECG SIM** instead of ECG.
- It never triggers the buzzer.
- As soon as real electrodes are attached, the real ECG replaces it.

Set `SIM_ECG 0` to turn this off.

## Upload

Same as the original (see `../README.md`): board **ESP32 Dev Module**, Core Debug Level **None**, same libraries. Open `vitals_firmware_v2.ino` and upload. On start-up the crew screen now also shows `BodyTemp MAX30205 / MLX90614 / MISSING`.

**Not tested on hardware yet**, and not compiled here: there's no Arduino command-line tool on this PC. Press **Verify** in the Arduino IDE first and send any error to the team.
