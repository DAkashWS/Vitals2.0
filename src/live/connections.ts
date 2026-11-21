/*
 * Connecting to a VITALS device: USB cable, Bluetooth, Wi-Fi, or the built-in demo device.
 *
 * Every connection carries the same data as the ESP32 firmware in /hardware: one JSON
 * line per second, e.g.
 *   {"heartRate":74,"spo2":97,"finger":true,"ecgHeartRate":72,"leadsOn":true,
 *    "cabinTemp":22.4,"cabinHumidity":45,"airQuality":8,
 *    "status":"NORMAL","ecg":[12,15,...]}
 * Unknown values are null. cabinTemp and cabinHumidity are the room temperature and humidity (DHT11).
 * The page can send back {"sim":{...}} (the daily log, for OLED 3).
 *
 *  USB        Web Serial, 115200 baud. Chrome / Edge on a computer.
 *  Bluetooth  Web Bluetooth, BLE "Nordic UART Service": the device notifies JSON lines on
 *             the TX characteristic and accepts lines written to RX. Name starts with "VITALS".
 *  Wi-Fi      WebSocket at ws://<address>:81/ (e.g. ws://vitals.local:81/), one JSON line per message.
 *  Demo       Simulated readings in the page, for when there's no hardware.
 */

import { ecgIntervals, makeEcgSimulator } from "@/live/ecgSim";

export type LinkKind = "usb" | "bluetooth" | "wifi" | "demo";

export type DeviceData = {
  heartRate?: number | null;
  spo2?: number | null;
  finger?: boolean;
  ecgHeartRate?: number | null;
  leadsOn?: boolean;
  /** true when the ECG trace and ECG heart rate are simulated (no electrodes / no AD8232). */
  ecgSimulated?: boolean;
  /** ECG intervals in ms (firmware v3, from the simulated beat). null when there's no ECG. */
  ecgPR?: number | null;
  ecgQRS?: number | null;
  ecgQT?: number | null;
  ecgQTc?: number | null;
  cabinTemp?: number | null;
  cabinHumidity?: number | null;
  airQuality?: number | null;
  status?: string;
  ecg?: number[];
};

export type Handlers = {
  onData: (d: DeviceData) => void;
  onClose: (reason: string) => void;
};

/** A device the user picked, not connected yet (the "confirm pairing" step). */
export type Candidate = {
  kind: LinkKind;
  name: string;
  detail: string;
  /** Opens the connection. Resolves once data can flow. */
  open: (h: Handlers) => Promise<Link>;
};

export type Link = {
  kind: LinkKind;
  name: string;
  send: (obj: unknown) => void;
  close: () => Promise<void>;
};

/* eslint-disable @typescript-eslint/no-explicit-any */
const nav = navigator as any;

export const support = {
  usb: typeof navigator !== "undefined" && "serial" in navigator,
  bluetooth: typeof navigator !== "undefined" && "bluetooth" in navigator,
  wifi: typeof WebSocket !== "undefined",
};

/** Splits a stream of text into lines and passes each JSON object on. */
function lineParser(onData: (d: DeviceData) => void) {
  let buf = "";
  return (text: string) => {
    buf += text;
    let nl: number;
    while ((nl = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line.startsWith("{")) continue; // boot messages from the ESP32
      try {
        const d = JSON.parse(line);
        if (d && typeof d === "object" && !("sim" in d)) onData(d as DeviceData);
      } catch {
        /* a broken line: skip it */
      }
    }
    if (buf.length > 20000) buf = ""; // junk with no line ends
  };
}

/* ------------------------------- USB (Web Serial) ------------------------------- */

const USB_CHIPS: Record<number, string> = {
  0x10c4: "Silicon Labs CP210x USB-serial",
  0x1a86: "WCH CH340 USB-serial",
  0x303a: "Espressif ESP32 USB",
  0x0403: "FTDI USB-serial",
  0x2341: "Arduino",
};

function serialCandidate(port: any): Candidate {
  const info = port.getInfo?.() ?? {};
  const chip = info.usbVendorId != null ? USB_CHIPS[info.usbVendorId] : undefined;
  return {
    kind: "usb",
    name: "VITALS sensor (USB cable)",
    detail: chip ? `${chip} · 115200 baud` : "USB serial device · 115200 baud",
    open: (h) => openSerial(port, h),
  };
}

/**
 * Opens the browser's list of USB devices. By default it only lists the USB-serial chips
 * ESP32 boards use, so built-in ports like COM1 don't appear. `all` lists every port.
 * Returns null if the user cancels.
 */
export async function pickUsb(all = false): Promise<Candidate | null> {
  try {
    const filters = Object.keys(USB_CHIPS).map((id) => ({ usbVendorId: Number(id) }));
    return serialCandidate(await nav.serial.requestPort(all ? {} : { filters }));
  } catch {
    return null;
  }
}

/** USB devices this site was already allowed to use. */
export async function pairedUsb(): Promise<Candidate[]> {
  if (!support.usb) return [];
  try {
    return ((await nav.serial.getPorts()) as any[]).map(serialCandidate);
  } catch {
    return [];
  }
}

async function openSerial(port: any, h: Handlers): Promise<Link> {
  await port.open({ baudRate: 115200 });
  const writer = port.writable?.getWriter();
  const parse = lineParser(h.onData);
  let reader: any = null;
  let open = true;
  let reason = "Device disconnected";

  (async () => {
    const decoder = new TextDecoder();
    let errors = 0;
    while (open && port.readable) {
      reader = port.readable.getReader();
      try {
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          errors = 0;
          parse(decoder.decode(value, { stream: true }));
        }
      } catch {
        /* cable pulled, or a small glitch: try again below, but not forever */
        if (++errors >= 5) reason = "The device stopped responding";
      } finally {
        reader.releaseLock();
        reader = null;
      }
      if (!port.readable || errors >= 5) break;
      await new Promise((r) => setTimeout(r, 200)); // never retry in a tight loop
    }
    open = false;
    try {
      writer?.releaseLock();
    } catch {
      /* already released */
    }
    try {
      await port.close();
    } catch {
      /* already closed */
    }
    h.onClose(reason);
  })();

  const onDisconnect = (e: any) => {
    if (e.target === port) {
      reason = "The USB cable was unplugged";
      open = false;
      reader?.cancel().catch(() => {});
      nav.serial.removeEventListener("disconnect", onDisconnect);
    }
  };
  nav.serial.addEventListener("disconnect", onDisconnect);

  return {
    kind: "usb",
    name: serialCandidate(port).name,
    send: (obj) => {
      if (open && writer) writer.write(new TextEncoder().encode(JSON.stringify(obj) + "\n")).catch(() => {});
    },
    close: async () => {
      reason = "Disconnected";
      open = false;
      nav.serial.removeEventListener("disconnect", onDisconnect);
      await reader?.cancel().catch(() => {});
    },
  };
}

/* ----------------------------- Bluetooth (Web Bluetooth) ----------------------------- */

const NUS = "6e400001-b5a3-f393-e0a9-e50e24dcca9e";
const NUS_RX = "6e400002-b5a3-f393-e0a9-e50e24dcca9e"; // page -> device
const NUS_TX = "6e400003-b5a3-f393-e0a9-e50e24dcca9e"; // device -> page

function bluetoothCandidate(device: any): Candidate {
  return {
    kind: "bluetooth",
    name: device.name || "VITALS sensor (Bluetooth)",
    detail: "Bluetooth Low Energy",
    open: (h) => openBluetooth(device, h),
  };
}

/** Opens the browser's Bluetooth scan, showing VITALS devices nearby. */
export async function pickBluetooth(): Promise<Candidate | null> {
  try {
    const device = await nav.bluetooth.requestDevice({
      filters: [{ namePrefix: "VITALS" }, { services: [NUS] }],
      optionalServices: [NUS],
    });
    return bluetoothCandidate(device);
  } catch {
    return null;
  }
}

/** Bluetooth devices this site was already allowed to use (where the browser supports listing them). */
export async function pairedBluetooth(): Promise<Candidate[]> {
  if (!support.bluetooth || typeof nav.bluetooth.getDevices !== "function") return [];
  try {
    return ((await nav.bluetooth.getDevices()) as any[]).map(bluetoothCandidate);
  } catch {
    return [];
  }
}

async function openBluetooth(device: any, h: Handlers): Promise<Link> {
  const server = await device.gatt.connect();
  const service = await server.getPrimaryService(NUS);
  const tx = await service.getCharacteristic(NUS_TX);
  const rx = await service.getCharacteristic(NUS_RX).catch(() => null);
  const parse = lineParser(h.onData);
  const decoder = new TextDecoder();
  let reason = "The Bluetooth connection was lost";

  const onValue = (e: any) => parse(decoder.decode(e.target.value, { stream: true }));
  tx.addEventListener("characteristicvaluechanged", onValue);
  await tx.startNotifications();

  const onGone = () => {
    tx.removeEventListener("characteristicvaluechanged", onValue);
    device.removeEventListener("gattserverdisconnected", onGone);
    h.onClose(reason);
  };
  device.addEventListener("gattserverdisconnected", onGone);

  return {
    kind: "bluetooth",
    name: device.name || "VITALS sensor (Bluetooth)",
    send: async (obj) => {
      if (!rx || !device.gatt.connected) return;
      const bytes = new TextEncoder().encode(JSON.stringify(obj) + "\n");
      try {
        for (let i = 0; i < bytes.length; i += 20) await rx.writeValue(bytes.slice(i, i + 20)); // safe BLE chunk size
      } catch {
        /* busy or disconnected: skip this update */
      }
    },
    close: async () => {
      reason = "Disconnected";
      device.gatt.disconnect();
    },
  };
}

/* ----------------------------------- Wi-Fi (WebSocket) ----------------------------------- */

/** Why Wi-Fi can't work from this page, or null if it can. */
export function wifiBlockedReason(): string | null {
  if (!support.wifi) return "This browser can't open Wi-Fi connections.";
  if (location.protocol === "https:") {
    return "This page was opened over https, and browsers block plain connections to devices from secure pages. Open the site over http on the same network as the device (for example http://localhost:5190 on the computer running it), then pair over Wi-Fi.";
  }
  return null;
}

export function wifiCandidate(address: string): Candidate {
  const host = address.trim().replace(/^wss?:\/\//, "").replace(/\/.*$/, "");
  return {
    kind: "wifi",
    name: `VITALS sensor at ${host}`,
    detail: "Wi-Fi (same network)",
    open: (h) => openWifi(host, h),
  };
}

function openWifi(host: string, h: Handlers): Promise<Link> {
  return new Promise((resolve, reject) => {
    const url = host.includes(":") ? `ws://${host}/` : `ws://${host}:81/`;
    let ws: WebSocket;
    try {
      ws = new WebSocket(url);
    } catch (e) {
      reject(e);
      return;
    }
    const parse = lineParser(h.onData);
    let opened = false;
    let reason = "The Wi-Fi connection was lost";
    const timer = setTimeout(() => {
      if (!opened) {
        ws.close();
        reject(new Error(`No VITALS device answered at ${url}`));
      }
    }, 6000);
    ws.onopen = () => {
      opened = true;
      clearTimeout(timer);
      resolve({
        kind: "wifi",
        name: `VITALS sensor at ${host}`,
        send: (obj) => {
          if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(obj) + "\n");
        },
        close: async () => {
          reason = "Disconnected";
          ws.close();
        },
      });
    };
    ws.onmessage = (e) => parse(String(e.data).endsWith("\n") ? String(e.data) : String(e.data) + "\n");
    ws.onerror = () => {
      if (!opened) {
        clearTimeout(timer);
        reject(new Error(`No VITALS device answered at ${url}`));
      }
    };
    ws.onclose = () => {
      if (opened) h.onClose(reason);
    };
  });
}

/* --------------------------------------- Demo device --------------------------------------- */

export const demoCandidate: Candidate = {
  kind: "demo",
  name: "VITALS demo device",
  detail: "Demo readings, no hardware needed",
  open: (h) => openDemo(h),
};

/** A pretend device: gently drifting readings, sent once a second like the v2 firmware. */
async function openDemo(h: Handlers): Promise<Link> {
  const ecgSim = makeEcgSimulator();
  const v = { heartRate: 72, spo2: 98, cabinTemp: 22.4, cabinHumidity: 45, airQuality: 8 };
  const walk = (x: number, lo: number, hi: number, step: number) => Math.min(hi, Math.max(lo, x + (Math.random() * 2 - 1) * step));
  const tick = () => {
    v.heartRate = walk(v.heartRate, 64, 84, 1.5);
    v.spo2 = walk(v.spo2, 96, 99, 0.4);
    v.cabinTemp = walk(v.cabinTemp, 21.8, 23, 0.05);
    v.cabinHumidity = walk(v.cabinHumidity, 42, 48, 0.4);
    v.airQuality = walk(v.airQuality, 3, 14, 0.8);
    const hr = Math.round(v.heartRate);
    h.onData({
      heartRate: hr,
      spo2: Math.round(v.spo2),
      finger: true,
      ecgHeartRate: hr, // simulated, following the heart rate, like firmware v3
      leadsOn: false,
      ecgSimulated: true,
      ...ecgIntervals(hr),
      cabinTemp: +v.cabinTemp.toFixed(1),
      cabinHumidity: Math.round(v.cabinHumidity),
      airQuality: Math.round(v.airQuality),
      ecg: ecgSim(hr),
    });
  };
  tick();
  const timer = setInterval(tick, 1000);
  return {
    kind: "demo",
    name: demoCandidate.name,
    send: () => {},
    close: async () => {
      clearInterval(timer);
      h.onClose("Disconnected");
    },
  };
}
