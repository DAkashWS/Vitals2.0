"""
VITALS chatbots: seven bots on one small local model (gemma3:270m, through Ollama).

How the work is split, so a tiny model stays safe:
  - Python decides every label (green / yellow / red) from the team's ranges.
  - The model only puts Python's facts into plain words.
  - Python checks every reply before it's shown: word limit, no medicine, no colour
    that disagrees with Python's label, the required flight-surgeon line on red,
    and MISSING values listed. A reply that breaks a rule is swapped for a
    rule-written answer, so every answer is safe even if the model wanders.
  - If Ollama isn't running, every bot still answers from its rules.

Run (Windows):
  py vitals_bots.py              menu: choose a bot, type its data, "exit" to quit
  py vitals_bots.py --selftest   runs every bot once on sample data

Data is typed as  name=value; name=value ...  A series of days is space-separated,
oldest first, e.g.  hr=72 74 73 80 84 86 88
Monitoring and support only. Not a diagnosis, not medical advice.
"""

from __future__ import annotations

import json
import re
import sys
from collections import deque
from dataclasses import dataclass, field
from pathlib import Path

try:
    sys.stdout.reconfigure(encoding="utf-8")  # so "°C" prints in the Windows console
except Exception:
    pass

MODEL = "gemma3:270m"
# Small context and short replies keep it fast on a low-power PC.
OPTIONS = {"num_ctx": 1024, "num_predict": 120, "temperature": 0.2, "top_p": 0.9}
KEEP_ALIVE = "30m"  # keep the model loaded between questions: load once, reuse for all bots
HERE = Path(__file__).resolve().parent

SURGEON_NOW = "Contact the flight surgeon now."

# ---------------------------------------------------------------------------
# The team's ranges (same as the website: src/content.ts and knowledge/*.md)
# (label, unit, green range, yellow range). None means the team hasn't set one yet.
# ---------------------------------------------------------------------------

VITAL_RANGES = {
    "hr": ("Heart rate", "bpm", (60, 100), (50, 110)),
    "spo2": ("SpO2", "%", (95, 100), (92, 100)),
    "ecg": ("ECG heart rate", "bpm", (60, 100), (50, 110)),
    "sleep": ("Sleep", "h", (7, 9), (6, 10)),
    "water": ("Water intake", "L/day", (2.5, 3.5), (1.8, 4.0)),
    "exercise": ("Exercise", "min/day", (30, 180), (15, 240)),
}
ENV_RANGES = {
    "co2": ("Cabin CO2", "ppm", (0, 999), (0, 2000)),
    "air": ("Air quality", "% worse than clean air", (0, 19), (0, 50)),
    "cabin_temp": ("Room temperature", "°C", (18, 33), (16, 36)),
    "humidity": ("Humidity", "%", (30, 60), (25, 75)),
    "pressure": ("Cabin pressure", "kPa", None, None),
    "radiation": ("Radiation dose rate", "mSv/day", None, None),
}
ENV_EFFECT = {
    "co2": "headaches, tiredness, poor concentration",
    "air": "breathing comfort, irritated eyes and throat",
    "cabin_temp": "sleep and fluid loss",
    "humidity": "dry skin, eyes and nose",
    "pressure": "ears and sinuses",
    "radiation": "long-term radiation dose",
}

# The crew's latest readings (from the website's crew cards, src/content.ts).
CREW = {
    "akash": {"hr": 100, "spo2": 99, "ecg": 80, "cabin_temp": 23.6, "sleep": 7.5, "air": 0},
    "darsan": {"hr": 90, "spo2": 100, "cabin_temp": 23.0, "sleep": 9, "air": 0},
    "nithin": {"hr": 93, "spo2": 99, "ecg": 85, "cabin_temp": 23.5, "sleep": 7.5, "air": 0},
    "vishnu": {"hr": 95, "spo2": 99, "cabin_temp": 22.9, "sleep": 8, "air": 0},
    "kirthik": {"hr": 90, "spo2": 100, "ecg": 85, "cabin_temp": 23.4, "sleep": 8.5, "air": 0},
}

LEVELS = ("green", "yellow", "red")
RANK = {"green": 0, "yellow": 1, "red": 2}

# Never suggest medicine, doses or treatments.
MEDICINE = re.compile(
    r"\b(medicine|medication|meds|painkiller|tablet|pill|capsule|dose|dosage|mg|drug|ibuprofen|paracetamol|"
    r"acetaminophen|aspirin|antihistamine|antibiotic|melatonin|caffeine pill|prescri\w*|treatment|treat|inject\w*|"
    r"electrolyte|salt tablet|supplement)s?\b",
    re.I,
)
# Short names a reply must use for a reading that changed or is out of range.
SHORT = {
    "hr": "heart rate", "spo2": "SpO2", "ecg": "ECG", "sleep": "sleep", "water": "water",
    "exercise": "exercise", "co2": "CO2", "air": "air", "cabin_temp": "room temperature", "humidity": "humidity",
    "pressure": "pressure", "radiation": "radiation",
}

# Readings a reply may only mention if they're in the current data.
TERMS = ("heart rate", "spo2", "ecg", "temperature", "sleep", "water", "intake", "exercise", "co2", "air quality", "humidity", "pressure", "radiation", "mood", "stress", "pain", "session")

# A reply about the bot itself rather than an answer for the crew.
META = re.compile(r"^(okay|ok|sure|understood|got it)\b|\bI understand\b|\bI will (focus|provide|follow|do|help)\b|\bas an ai\b|\blanguage model\b|\bI('m| am) (here|ready)\b|\bmy instructions\b", re.I)

# At least one of these shows the reply gives the crew something to do.
ACTION = re.compile(r"\b(drink|follow|plan|schedule|add|try|keep|book|talk|rest|stop|log|join|call|share|spend|take part|catch[- ]up|check|tell|walk|set)\b", re.I)

# Words that sound like a diagnosis.
DIAGNOSIS = re.compile(r"\b(you have|diagnos\w*|you are suffering|it is (a|an) \w+ (disease|infection|syndrome))\b", re.I)


def level_of(value: float, rng) -> str:
    """green inside the normal range, yellow inside the watch range, red outside both; MISSING if no range."""
    _, _, green, yellow = rng
    if green is None:
        return "MISSING"
    if green[0] <= value <= green[1]:
        return "green"
    if yellow[0] <= value <= yellow[1]:
        return "yellow"
    return "red"


def worst(levels) -> str:
    known = [l for l in levels if l in RANK]
    return max(known, key=RANK.get) if known else "MISSING"


def fmt(v: float) -> str:
    return f"{v:g}"


# ---------------------------------------------------------------------------
# Input: "name=value; name=v1 v2 v3; flag=yes"
# ---------------------------------------------------------------------------

ALIASES = {
    "heart": "hr", "heartrate": "hr", "heart_rate": "hr", "pulse": "hr",
    "oxygen": "spo2", "o2": "spo2", "temperature": "cabin_temp", "temp": "cabin_temp", "room": "cabin_temp", "roomtemp": "cabin_temp", "room_temp": "cabin_temp",
    "intake": "water", "fluid": "water", "aq": "air", "airquality": "air",
    "cabintemp": "cabin_temp", "rh": "humidity",
}


def parse(text: str) -> dict:
    """Returns {name: [numbers]} or {name: True/False/str}."""
    out: dict = {}
    for part in re.split(r"[;\n]", text):
        if "=" not in part:
            continue
        k, v = part.split("=", 1)
        k = ALIASES.get(k.strip().lower().replace(" ", ""), k.strip().lower().replace(" ", "_"))
        v = v.strip()
        if v.lower() in ("yes", "y", "true"):
            out[k] = True
        elif v.lower() in ("no", "n", "false"):
            out[k] = False
        else:
            nums = re.findall(r"[-+]?\d+(?:\.\d+)?", v)
            out[k] = [float(n) for n in nums] if nums and not re.search(r"[a-df-z]{3,}", v, re.I) else v
    return out


def series(d: dict, k: str) -> list[float]:
    v = d.get(k)
    return v if isinstance(v, list) else []


def last(d: dict, k: str):
    s = series(d, k)
    return s[-1] if s else None


def falling(s: list[float], days: int) -> bool:
    """True if each of the last `days` values is lower than the one before."""
    return len(s) > days and all(s[-i] < s[-i - 1] for i in range(1, days + 1))


def rising(s: list[float], days: int) -> bool:
    return len(s) >= days and all(s[-i] > s[-i - 1] for i in range(1, days))


# ---------------------------------------------------------------------------
# What each bot computes (Python) before the model says anything
# ---------------------------------------------------------------------------


@dataclass
class Result:
    level: str  # green / yellow / red / MISSING
    facts: list[str]  # what the model is given, already labelled
    fallback: str  # a rule-written answer, used if the model is off or breaks a rule
    missing: list[str] = field(default_factory=list)
    must_include: list[str] = field(default_factory=list)  # strings the reply must contain (e.g. values)
    use_model: bool = True


def health_intelligence(d: dict) -> Result:
    """Compares the latest of 7 days with the first 3 days (the baseline) and lists what changed together."""
    if isinstance(d.get("crew"), str) or isinstance(d.get("crew"), list):
        name = str(d["crew"]).strip("[]'\" ").lower()
        if name in CREW:
            d = {**{k: [v] for k, v in CREW[name].items()}, **{k: v for k, v in d.items() if k != "crew"}}
    facts, missing, changed, levels, flagged, env_bad = [], [], [], [], [], []
    mention: set[str] = set()  # short names the reply must include
    for key, rng in {**VITAL_RANGES, **ENV_RANGES}.items():
        s = series(d, key)
        if not s:
            continue
        name, unit = rng[0], rng[1]
        lv = level_of(s[-1], rng)
        levels.append(lv if key in VITAL_RANGES or key in ("cabin_temp", "humidity") else "green")  # room temperature and humidity count, like on the crew cards
        line = f"{name}: {fmt(s[-1])} {unit} ({lv})"
        if len(s) >= 4:
            base = sum(s[:3]) / 3
            diff = s[-1] - base
            pct = abs(diff) / base * 100 if base else 0
            big = pct >= 10 or (key == "spo2" and abs(diff) >= 2) or (key == "cabin_temp" and abs(diff) >= 2)
            if big:
                mention.add(SHORT[key])
                way = "up" if diff > 0 else "down"
                changed.append(f"{name} {way}")
                line += f", {way} from a {fmt(round(base, 1))} baseline"
        else:
            missing.append(f"{name} days 4-7 (for the trend)")
        facts.append(line)
        if lv in ("yellow", "red"):
            (env_bad if key in ENV_RANGES else flagged).append(f"{name} {fmt(s[-1])} {unit} ({lv})")
            mention.add(SHORT[key])
    if not facts:
        return Result("MISSING", [], "", ["readings, e.g. hr=72 74 73 80 84 86 88; sleep=7.5 7.4 7.6 6.5 6.2 6 5.8"], use_model=False)
    together = ", ".join(changed) if len(changed) >= 2 else ("only " + changed[0] if changed else "no trend yet")
    facts.append(f"Changed together: {together}")
    if flagged:
        facts.append("Outside the normal range now: " + ", ".join(flagged))
    level = worst(levels)
    checks = []
    if any("CO2" in c or "Air" in c for c in changed) or env_bad:
        checks.append("check the cabin air and the CO2 scrubber")
    if any("Sleep" in c for c in changed):
        checks.append("check sleep times and the night-time light and noise")
    if any("Water" in c for c in changed):
        checks.append("check the water log")
    at_rest = [VITAL_RANGES[k][0] for k in ("hr", "spo2", "ecg") if series(d, k) and level_of(series(d, k)[-1], VITAL_RANGES[k]) != "green"]
    if at_rest:
        checks.append("recheck " + " and ".join(n.lower() for n in at_rest) + " at rest")
    now = f" Outside range now: {', '.join(flagged)}." if flagged else ""
    env = f"{'; '.join(env_bad)}, which may be related to these changes" if env_bad else "no cabin reading outside its range"
    fallback = (
        f"1) What changed together: {together}.{now} "
        f"2) Environment: {env}. "
        f"3) Check: {'; '.join(checks) if checks else 'nothing extra, keep logging'}."
    )
    # the reply has to name everything that changed or is out of range
    return Result(level, facts, fallback, missing, sorted(mention))


def isolation(d: dict) -> Result:
    mood, stress, sleep = series(d, "mood"), series(d, "stress"), series(d, "sleep")
    base = last(d, "sleep_baseline") or 7.0
    missing = [n for n, s in (("mood (1-10 per day)", mood), ("stress (1-10 per day, 10 = calm)", stress), ("sleep (hours per day)", sleep)) if not s]
    if "sleep_baseline" not in d:
        missing.append(f"sleep_baseline (using {fmt(base)} h, the bottom of the green range)")
    evidence, level = [], "green"
    if d.get("hopeless") is True or d.get("withdrawn") is True:
        level = "red"
        evidence.append("hopelessness or withdrawal reported")
    else:
        if len(mood) >= 3 and all(m <= 3 for m in mood[-3:]):
            level, _ = "yellow", evidence.append("mood 3 or lower for 3 days")
        if len(stress) >= 3 and all(s <= 3 for s in stress[-3:]):
            level, _ = "yellow", evidence.append("stress score 3 or lower for 3 days")
        if len(sleep) >= 3 and all(s < base for s in sleep[-3:]):
            level, _ = "yellow", evidence.append(f"sleep below the {fmt(base)} h baseline for 3 days")
    if not (mood or stress or sleep) and level != "red":
        return Result("MISSING", [], "", missing, use_model=False)
    facts = [f"Alert level: {level}", "Evidence: " + ("; ".join(evidence) if evidence else "no warning signs in the data")]
    fallback = {
        "green": "No warning signs right now. Keep the planned team contact and your regular call home this week.",
        "yellow": "Plan some team time today, like a shared meal or a game, and book a private call home or with the crew psychologist.",
        "red": "Stay with a crewmate, and keep the next hours simple and shared.",
    }[level]
    return Result(level, facts, fallback, missing)


def fluid_shift(d: dict) -> Result:
    intake, hr = series(d, "water"), series(d, "hr")
    base = last(d, "hr_baseline") or (hr[0] if hr else None)
    missing = [n for n, s in (("water (litres per day)", intake), ("hr (resting heart rate per day)", hr)) if not s]
    if hr and "hr_baseline" not in d:
        missing.append("hr_baseline (using the first day)")
    symptoms = [n for n in ("dizzy", "headache") if d.get(n) is True]
    evidence, level = [], "green"
    down2 = falling(intake, 2)
    if d.get("dizzy_standing") is True and (down2 or falling(intake, 1)):
        level, evidence = "red", ["dizzy on standing, and water intake is falling"]
    else:
        if down2:
            level, _ = "yellow", evidence.append("water intake down 2 days in a row")
        if hr and base and hr[-1] > base * 1.10 and symptoms:
            level, _ = "yellow", evidence.append(f"resting heart rate {fmt(hr[-1])} bpm is more than 10% above the {fmt(base)} bpm baseline, with {' and '.join(symptoms)}")
    if not intake and not hr:
        return Result("MISSING", [], "", missing, use_model=False)
    if intake:
        evidence.append(f"{fmt(intake[-1])} L logged today")
    facts = [f"Alert level: {level}", "Evidence: " + "; ".join(evidence)]
    fallback = {
        "green": "Hydration looks on track. Keep to the team's drinking schedule and log each drink.",
        "yellow": "Thirst comes late in space. Follow the team's hydration schedule: a drink every hour while awake, logged in VITALS.",
        "red": "Sit or lie down, don't stand up quickly, and have a crewmate stay with you.",
    }[level]
    return Result(level, facts, fallback, missing)


def bone_muscle(d: dict) -> Result:
    done, planned, pain = last(d, "done"), last(d, "planned"), series(d, "pain")
    missing = [n for n, v in (("done (sessions this week)", done), ("planned (sessions this week)", planned), ("pain (0-10 per day)", pain or None)) if v is None]
    evidence, level = [], "green"
    if d.get("injury") is True or d.get("new_pain") is True or (pain and pain[-1] >= 7):
        level = "red"
        evidence.append("injury, new pain or severe pain (7 or more) reported")
    else:
        if done is not None and planned:
            share = done / planned
            if share < 0.8:
                level, _ = "yellow", evidence.append(f"{fmt(done)} of {fmt(planned)} planned sessions ({round(share * 100)}%), under 80%")
            else:
                evidence.append(f"{fmt(done)} of {fmt(planned)} planned sessions done")
        if rising(pain, 3):
            level, _ = "yellow", evidence.append("pain rising for 3 days")
    if done is None and not pain and level != "red":
        return Result("MISSING", [], "", missing, use_model=False)
    facts = [f"Alert level: {level}", "Evidence: " + "; ".join(evidence or ["no warning signs"])]
    fallback = {
        "green": "On track. Keep to the planned exercise sessions this week.",
        "yellow": "Add one safe, lighter catch-up session this week, and stop if anything hurts.",
        "red": "Stop exercising the painful area until the flight surgeon has checked it.",
    }[level]
    return Result(level, facts, fallback, missing)


def environment(d: dict) -> Result:
    lines, levels, affected, must, missing = [], [], [], [], []
    for key, rng in ENV_RANGES.items():
        v = last(d, key)
        if v is None:
            continue
        lv = level_of(v, rng)
        if lv == "MISSING":
            missing.append(f"{rng[0]} range (the team hasn't set one)")
        levels.append(lv)
        lines.append(f"{rng[0]}: {fmt(v)} {rng[1]} ({lv})")
        must.append(fmt(v))
        if lv in ("yellow", "red"):
            affected.append(ENV_EFFECT[key])
    if not lines:
        return Result("MISSING", [], "", ["readings, e.g. co2=1400; air=12; humidity=35"], use_model=False)
    poss = "; ".join(affected) if affected else "nothing expected at these readings"
    fallback = " ".join(f"{l}, possible effect: {ENV_EFFECT[k]}." for l, k in zip(lines, [k for k in ENV_RANGES if last(d, k) is not None])) + f" Possibly affected: {poss}."
    return Result(worst(levels), lines + [f"Possibly affected: {poss}"], fallback, missing, must)


def scenario(d: dict, change: dict) -> Result:
    if not change:
        return Result("MISSING", [], "", ["a 'change:' part, e.g. hr=80; room=24; change: room=+4; sleep=-2"], use_model=False)
    lines, levels, flips, new_values = [], [], [], []
    for key, delta in change.items():
        rng = VITAL_RANGES.get(key) or ENV_RANGES.get(key)
        start = last(d, key)
        if rng is None or start is None or not isinstance(delta, list):
            lines.append(f"MISSING: starting value for {key}")
            continue
        new = round(start + delta[-1], 2)
        new_values.append(fmt(new))
        a, b = level_of(start, rng), level_of(new, rng)
        levels.append(b)
        lines.append(f"{rng[0]}: {fmt(start)} -> {fmt(new)} {rng[1]} ({a} -> {b})")
        if b != a and b in ("yellow", "red"):
            flips.append(f"{rng[0]} turns {b}")
    fallback = "Changed readings: " + "; ".join(lines) + ". " + ("May turn: " + ", ".join(flips) + "." if flips else "No reading changes colour.")
    return Result(worst(levels), lines + ["May turn: " + (", ".join(flips) or "none")], fallback, [], new_values, use_model=bool(levels))


# ---------------------------------------------------------------------------
# The seven bots
# ---------------------------------------------------------------------------

COMMON = (
    "Rules: monitoring and support only, never diagnose. Use only the facts in the latest message, "
    "not facts from earlier messages. Never invent or calculate numbers. "
    "Never suggest medicine, doses or treatments. Plain, short sentences. "
    "Do not say green, yellow or red yourself; the label is already decided."
)


@dataclass
class Bot:
    num: int
    key: str
    name: str
    prompt: str
    words: int
    example: str
    history: deque = field(default_factory=lambda: deque(maxlen=4))  # last four messages, per bot


BOTS = [
    Bot(1, "health", "Health intelligence",
        "You explain health changes. Given labelled readings, write: 1) what changed and what changed together, "
        "2) relevant environment factors, 3) what the team should check. Use 'may be related to'. Under 80 words.",
        80, "hr=72 74 73 80 84 86 88; sleep=7.5 7.4 7.6 6.5 6.2 6 5.8; co2=800 820 790 1200 1400 1500 1600   (or: crew=Akash)"),
    Bot(2, "isolation", "Isolation",
        "You support crew wellbeing during isolation. Given the alert level and evidence, give one or two general actions "
        "such as planned team contact or a structured activity. No therapy steps. Under 60 words.",
        60, "mood=6 3 3 2; stress=5 4 4 4; sleep=7 6.5 6 6; sleep_baseline=7.5; hopeless=no; withdrawn=no"),
    Bot(3, "fluid", "Fluid shift",
        "You explain hydration and fluid-shift alerts. Given the alert level and evidence, give one general action "
        "following the team's hydration schedule. Never mention electrolytes, drugs or doses. Under 60 words.",
        60, "water=2.8 2.4 2.0; hr=68 70 77; hr_baseline=68; dizzy=no; headache=yes; dizzy_standing=no"),
    Bot(4, "bone", "Bone and muscle",
        "You explain exercise and pain alerts. Given sessions completed versus planned and the pain trend, suggest one "
        "general action, such as a safe catch-up session. Under 60 words.",
        60, "done=3; planned=6; pain=1 2 3; new_pain=no; injury=no"),
    Bot(5, "environment", "Environment monitor",
        "You explain cabin readings. For each reading given, write one line: value, label, possible effect. "
        "Then write 'Possibly affected: ...'. Under 80 words.",
        80, "co2=1400; air=12; cabin_temp=23; humidity=35"),
    Bot(6, "scenario", "Scenario simulator",
        "You describe a what-if scenario using only the numbers given. Start with 'SIMULATION ONLY - not real data.' "
        "Then list changed readings and which indicators may turn yellow or red. Under 80 words.",
        80, "hr=80; room=24; humidity=45; sleep=7.5; change: room=+4; humidity=-20; sleep=-2"),
    Bot(7, "offline", "Offline support",
        "You phrase a short health report from labelled facts in three parts: 1) what changed and what changed together, "
        "2) environment factors, 3) what to check. Use 'may be related to'. Under 80 words.",
        80, "a question like 'I cut my finger', or: report: hr=72 74 73 80 84 86 88; sleep=7.5 7.4 7.6 6.5 6.2 6 5.8"),
]

# ---------------------------------------------------------------------------
# The model (loaded once, reused by every bot)
# ---------------------------------------------------------------------------

_client = None
_model_ok: bool | None = None


def model_ready() -> bool:
    """Connects to Ollama once and loads the model into memory. False if Ollama or the model isn't there."""
    global _client, _model_ok
    if _model_ok is not None:
        return _model_ok
    try:
        import ollama

        _client = ollama.Client()
        _client.chat(model=MODEL, messages=[{"role": "user", "content": "hi"}], options={**OPTIONS, "num_predict": 1}, keep_alive=KEEP_ALIVE)
        _model_ok = True
    except Exception as e:  # no package, no server, or no model: rules only
        print(f"  (model not available, answering from rules only: {type(e).__name__}: {str(e)[:120]})")
        _model_ok = False
    return _model_ok


def ask_model(bot: Bot, facts: list[str]) -> str | None:
    if not model_ready():
        return None
    user = "Facts:\n- " + "\n- ".join(facts) + "\n\nWrite your reply to the crew member now, using only these facts."
    msgs = [{"role": "system", "content": bot.prompt + " " + COMMON}, *bot.history, {"role": "user", "content": user}]
    try:
        r = _client.chat(model=MODEL, messages=msgs, options=OPTIONS, keep_alive=KEEP_ALIVE)
        reply = (r["message"]["content"] or "").strip()
    except Exception as e:
        print(f"  (model error, using rules: {type(e).__name__})")
        return None
    return reply


def remember(bot: Bot, facts: list[str], shown: str) -> None:
    """Keeps the bot's last four messages: the facts it got and the answer that was actually shown,
    so a rejected model reply never becomes an example for the next one."""
    bot.history.append({"role": "user", "content": "Facts:\n- " + "\n- ".join(facts)})
    bot.history.append({"role": "assistant", "content": shown})


def clean(text: str) -> str:
    text = re.sub(r"[*_#`>]+", "", text)
    return re.sub(r"\s+", " ", text).strip()


def cap_words(text: str, n: int) -> str:
    """Cuts to n words, at the end of a sentence where possible."""
    w = text.split()
    if len(w) <= n:
        return text
    cut = " ".join(w[:n])
    end = max(cut.rfind(". "), cut.rfind("! "), cut.rfind("? "))
    return cut[: end + 1] if end > len(cut) // 2 else cut.rstrip(",;:") + "."


def safe_reply(bot: Bot, res: Result, reply: str | None) -> tuple[str, str]:
    """Checks the model's reply; returns (text, where it came from)."""
    if not reply:
        return res.fallback, "rules"
    r = clean(reply)
    problems = []
    if MEDICINE.search(r):
        problems.append("mentioned medicine")
    if DIAGNOSIS.search(r):
        problems.append("sounded like a diagnosis")
    said = {l for l in LEVELS if re.search(rf"\b{l}\b", r, re.I)}
    if said - {res.level}:
        problems.append("used a different colour")
    if any(m.lower() not in r.lower() for m in res.must_include):
        problems.append("left out a reading")
    # every number must come from the facts (small models invent numbers)
    allowed = {float(n) for n in re.findall(r"\d+(?:\.\d+)?", " ".join(res.facts))} | {1.0, 2.0, 3.0}
    if any(float(n) not in allowed for n in re.findall(r"\d+(?:\.\d+)?", r)):
        problems.append("used a number that isn't in the data")
    # it may only talk about readings that are actually in this data (not ones from an earlier question)
    facts_low = " ".join(res.facts).lower()
    if any(t in r.lower() and t not in facts_low for t in TERMS):
        problems.append("mentioned a reading that isn't in the data")
    if len(r.split()) < 4:
        problems.append("too short")
    # talking about its instructions instead of answering ("Okay, I understand. I will…")
    if META.search(r):
        problems.append("talked about its instructions instead of answering")
    # Python never hands the model a difference, so "increased by 88" is always invented
    if re.search(r"\b(by|of)\s+[-+]?\d+(\.\d+)?\s*(bpm|%|hours?|h|ppm|mmhg|°c|degrees|beats|points)?\b", r, re.I) and re.search(r"(increas|decreas|rose|fell|drop|went up|went down|change)\w*\s+(by|of)\s+[-+]?\d", r, re.I):
        problems.append("made up a change amount")
    # the explaining bots must use the team's cautious wording
    if bot.key in ("health", "offline") and "may be related" not in r.lower():
        problems.append("didn't say 'may be related to'")
    # the support bots must actually give an action
    if bot.key in ("isolation", "fluid", "bone") and not ACTION.search(r):
        problems.append("gave no action")
    if problems:
        return res.fallback, "rules (model reply " + ", ".join(problems) + ")"
    return r, "model"


def finish(bot: Bot, res: Result, body: str) -> str:
    """Adds what the rules require around the answer, and keeps the whole reply within the word limit."""
    head = f"[{res.level.upper()}] " if res.level in RANK else ""
    tail = []
    if bot.key == "isolation" and res.level == "red":
        tail.append("Please tell the flight surgeon or a crew member now. You don't have to handle this alone.")
    if res.level == "red":
        tail.append(SURGEON_NOW)
    prefix = ""
    if bot.key == "scenario":
        prefix = "SIMULATION ONLY - not real data. "
        body = body.replace("SIMULATION ONLY - not real data.", "").strip()
    room = bot.words - len((prefix + " ".join(tail)).split())
    text = head + prefix + cap_words(body, max(room, 15))
    if tail:
        text += " " + " ".join(tail)
    if res.missing:
        text += "\n" + "\n".join(f"MISSING: {m}" for m in res.missing)
    return text


# ---------------------------------------------------------------------------
# Bot 7: offline support, answered by fixed rules (no model, except to phrase a report)
# ---------------------------------------------------------------------------

RED_FLAGS = [
    "chest pain", "can't breathe", "cant breathe", "cannot breathe", "trouble breathing", "short of breath",
    "unconscious", "passed out", "fainted", "not breathing", "heavy bleeding", "bleeding heavily", "won't stop bleeding",
    "head injury", "hit my head", "seizure", "allergic reaction", "throat swelling", "face swelling",
    "confused", "slurred", "red alert", "suicid", "hurt myself",
]


def load_first_aid() -> list[dict]:
    try:
        return json.loads((HERE / "first_aid.json").read_text(encoding="utf-8"))["topics"]
    except Exception:
        return []


FIRST_AID = load_first_aid()


def offline_support(text: str, bot: Bot) -> str:
    low = f" {text.lower()} "
    if any(f in low for f in RED_FLAGS) or re.search(r"\blevel\s*[:=]?\s*red\b", low):
        return "[RED] Contact the flight surgeon now. Do not wait."
    if low.strip().startswith("report"):
        data = parse(text.split(":", 1)[1] if ":" in text else "")
        res = health_intelligence(data)
        if not res.facts:
            return "MISSING: readings for the report, e.g. report: hr=72 74 73 80 84 86 88; sleep=7.5 7.4 7.6 6.5 6.2 6 5.8"
        body, src = safe_reply(bot, res, ask_model(bot, res.facts))
        remember(bot, res.facts, body)
        return finish(bot, res, body) + f"\n  (worded by: {src})"
    best, score = None, 0
    for t in FIRST_AID:
        s = sum(1 for k in t["keywords"] if re.search(rf"\b{re.escape(k.lower())}\b", low))
        if s > score:
            best, score = t, s
    if best:
        steps = " ".join(best["steps"])
        get_help = "; ".join(best["getHelp"][:2])
        return f"{best['title']}: {steps} Get help if: {get_help}. Contact the flight surgeon for anything serious."
    return "I don't have a rule for that. Contact the flight surgeon."


# ---------------------------------------------------------------------------
# Running a bot
# ---------------------------------------------------------------------------


def run_bot(bot: Bot, text: str) -> str:
    if bot.key == "offline":
        return offline_support(text, bot)
    # a red-flag symptom typed into any bot goes straight to the flight surgeon
    if any(f in f" {text.lower()} " for f in RED_FLAGS):
        return "[RED] Contact the flight surgeon now. Do not wait."
    if bot.key == "scenario":
        base_txt, _, change_txt = text.partition("change:")
        res = scenario(parse(base_txt), parse(change_txt))
    else:
        res = {"health": health_intelligence, "isolation": isolation, "fluid": fluid_shift, "bone": bone_muscle, "environment": environment}[bot.key](parse(text))
    if not res.facts:
        return "\n".join(f"MISSING: {m}" for m in res.missing)
    reply = ask_model(bot, res.facts) if res.use_model else None
    if reply and bot.key == "scenario":
        reply = re.sub(r"SIMULATION ONLY\s*-\s*not real data\.?", "", reply, flags=re.I).strip()
    body, src = safe_reply(bot, res, reply)
    remember(bot, res.facts, body)
    return finish(bot, res, body) + f"\n  (worded by: {src})"


def menu():
    print("VITALS bots  ·  model:", MODEL, " ·  monitoring and support only, not medical advice")
    print("Loading the model once…")
    model_ready()
    while True:
        print()
        for b in BOTS:
            print(f"  {b.num}. {b.name}")
        choice = input("Choose a bot (1-7) or type exit: ").strip().lower()
        if choice in ("exit", "quit", "q"):
            break
        bot = next((b for b in BOTS if str(b.num) == choice), None)
        if not bot:
            print("Please type a number from 1 to 7.")
            continue
        print(f"\n{bot.name}. Example: {bot.example}")
        while True:
            text = input(f"[{bot.num}] data (blank = back, exit = quit): ").strip()
            if not text:
                break
            if text.lower() in ("exit", "quit"):
                return
            print(run_bot(bot, text))


SELFTEST = [
    (1, "hr=72 74 73 80 84 86 88; sleep=7.5 7.4 7.6 6.5 6.2 6 5.8; co2=800 820 790 1200 1400 1500 1600"),
    (1, "crew=Akash"),
    (2, "mood=6 3 3 2; stress=5 4 4 4; sleep=7 6.5 6 6; sleep_baseline=7.5"),
    (2, "mood=4 3; hopeless=yes"),
    (3, "water=2.8 2.4 2.0; hr=68 70 77; hr_baseline=68; headache=yes"),
    (4, "done=3; planned=6; pain=1 2 3"),
    (5, "co2=1400; air=12; cabin_temp=23; humidity=35"),
    (6, "hr=80; room=24; humidity=45; sleep=7.5; change: room=+4; humidity=-20; sleep=-2"),
    (7, "I cut my finger on a panel"),
    (7, "I have chest pain"),
    (7, "report: hr=72 74 73 80 84 86 88; sleep=7.5 7.4 7.6 6.5 6.2 6 5.8"),
    (7, "what's the weather on Mars"),
]


def selftest():
    print("Self-test, model:", MODEL)
    model_ready()
    for num, text in SELFTEST:
        bot = BOTS[num - 1]
        print(f"\n== Bot {num} · {bot.name} ==\n> {text}\n{run_bot(bot, text)}")


if __name__ == "__main__":
    selftest() if "--selftest" in sys.argv else menu()
