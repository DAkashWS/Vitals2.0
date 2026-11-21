# VITALS firmware v3

`vitals_firmware_v3.ino` is firmware v2 with these changes. Wiring, screens and the data format are otherwise the same.
Hobby-grade prototype, **not a medical device**.

## Changes from v2

| What | v3 |
|---|---|
| Cabin sensor | **DHT11 on GPIO4** replaces the BME280: temperature and humidity. `cabinPressure` is always `null`. |
| Heart rate | SparkFun beat detector (the one that worked in the step 1 test), with filtering against wrong readings: beats in the first 2 s after placing a finger are ignored, double-counted and missed beats are dropped, beats more than 30 % off the current rate are rejected, and the median of the last 5 beats is shown (after at least 3). Works with boards whose red and IR LEDs are swapped. SpO2 still uses Maxim's algorithm. |
| Simulated ECG | Runs on its own, **without the MAX30102**. Its bpm and intervals appear **3 s after the ECG starts** (`ECG_READY_MS`). With a steady finger reading it follows the measured heart rate; otherwise it drifts gently between 66 and 78 bpm. It is always labelled simulated and never triggers alarms. |
| ECG shape | The team's 50-point beat with realistic timing, 12 ms per point (not stretched). |
| ECG intervals | New JSON fields `ecgPR`, `ecgQRS`, `ecgQT`, `ecgQTc` in ms, from the simulated beat. `null` without an ECG. |
| Bluetooth | **New.** Advertises as **VITALS-61** (BLE, Nordic UART Service) and sends the same JSON lines as USB. The website connects with **Pair → Bluetooth → Scan for devices** (Chrome or Edge). The website's {"sim":...} values come back the same way. USB keeps working at the same time. |
| Wi-Fi | **New.** Set `WIFI_SSID` and `WIFI_PASS` at the top (2.4 GHz network). The ESP32 joins in the background and runs a WebSocket at **ws://vitals.local:81/**. The cabin screen shows its IP address. On the website: **Pair → Wi-Fi**, type `vitals.local` (or the IP), connect. Needs the library **WebSockets** by Markus Sattler. With Wi-Fi and Bluetooth together, set **Tools → Partition Scheme → Huge APP (3MB No OTA)**. |
| SIM screen | No breathing line (the website doesn't send it). |

At 72 bpm the simulated beat gives PR 168 ms (normal 120–200), QRS 96 ms (normal 60–100), QT 300 ms and QTc 331 ms (normal ≤ 440 men, ≤ 460 women). The QRS axis needs a 12-lead ECG, so it isn't sent.

## DHT11 wiring

| DHT11 pin | ESP32 |
|---|---|
| VCC (+) | 3V3 |
| GND (−) | GND |
| DATA (S / OUT) | GPIO4 |

A 3-pin module already has its pull-up resistor. A bare 4-pin sensor needs a 10 kΩ resistor between DATA and 3V3, with pin 3 left unconnected.
The DHT11 reads 0–50 °C (±2 °C) and 20–90 % humidity (±5 %), at most once every 1–2 s. A DHT22 also works: set `DHT_TYPE` to `DHT22`.

## Libraries

Same as v2, plus **DHT sensor library** (by Adafruit), which needs **Adafruit Unified Sensor**. The BME280 library is no longer needed.

## Settings at the top of the sketch

- `ECG_FORCE_SIM 1`: always use the simulated ECG (the AD8232's electrode-off pins don't work on our board). Set it to 0 to use the real AD8232.
- `DHT_PIN 4`, `DHT_TYPE DHT11`
- `MQ_DIVIDER 1.5`: 1k top + 2×1k bottom. Use 2.0 for two equal resistors.
