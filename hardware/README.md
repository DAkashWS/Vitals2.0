# VITALS hardware (prototype)

Optional live-demo hardware. The website works without it, using the built-in simulator.
Hobby-grade sensors, **not a medical device**.

## What is where

| Folder | What it is |
|---|---|
| `vitals_firmware/` | The final ESP32 firmware |
| `tests/i2c_scanner/` | Checks both I2C buses. Run this first. |
| `tests/test_ecg_mq135/` | AD8232 + MQ-135 check (Serial Plotter) |
| `tests/step3a_test_bme280/` … `step3d_test_max30102/` | One small test per sensor |
| `../public/dashboard.html` | Live dashboard page (`npm run dev`, then open `/dashboard.html`) |

## Arduino IDE setup

1. Boards Manager: install **esp32 by Espressif Systems**. Board: **ESP32 Dev Module**.
   Set Tools > Core Debug Level to **None**.
2. Library Manager:
   - SparkFun MAX3010x Pulse and Proximity Sensor Library
   - Adafruit BME280 Library (accept *Install all*: Adafruit Unified Sensor, Adafruit BusIO)
   - Adafruit SH110X (accept *Install all*: Adafruit GFX Library). Our OLEDs use the SH1106 chip.
     If a screen is really an SSD1306, install "Adafruit SSD1306" and set `OLED_SH1106` to 0.
3. Upload the sketches in this order: `i2c_scanner`, then each test, then `vitals_firmware`.

Before uploading `vitals_firmware`, check these settings at the top of the sketch:
- `MQ_DIVIDER` = 1.5 for 1k + 2×1k, or 2.0 for two equal resistors
- `USE_AD8232` = 0 if the ECG module isn't fitted

## Wiring

| ESP32 pin | Goes to |
|---|---|
| 3V3 | Every module except the MQ-135 |
| VIN (5V) | MQ-135 VCC only |
| GND | Every module |
| GPIO21 / 22 | I2C bus 1: MAX30102 0x57, BME280 0x76, OLED crew 0x3C |
| GPIO32 / 33 | I2C bus 2: OLED sim 0x3C |
| GPIO26 / 27 | OLED cabin 0x3C (SDA 26, SCL 27). No soldering needed: the firmware switches bus 2 between pins 32/33 and 26/27 |
| GPIO34 | AD8232 OUTPUT |
| GPIO18 / 19 | AD8232 LO+ / LO− |
| GPIO35 | MQ-135 AO **through the voltage divider** (never directly) |
| GPIO25 | Buzzer I/O |

## Data format

Once per second the ESP32 sends one JSON line (115200 baud). Unknown values are `null`:

```json
{"heartRate":74,"spo2":97,"finger":true,"ecgHeartRate":72,"leadsOn":true,"cabinTemp":22.4,"cabinHumidity":45,"cabinPressure":101.2,"airQuality":8,"status":"NORMAL","ecg":[12,15,...]}
```

`ecg` holds the last second of ECG samples (250 per second), or `[]` when the electrodes are off.
`airQuality` is the MQ-135 reading as "% worse than the cleanest air seen since power-on". It is not CO2 in ppm.

The dashboard sends the simulated body values back every 2 s for OLED 3:
`{"sim":{"sleep":7.4,"water":2.6,"exercise":45}}`

## Safety

- **ECG:** keep the laptop on battery (charger unplugged) whenever electrodes are on a person.
- **MQ-135:** it runs hot and needs 24–48 h burn-in the first time, plus 2 minutes warm-up at each start.
