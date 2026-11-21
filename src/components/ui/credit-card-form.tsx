/*
 * Crew card builder, from the "credit card form" component (21st.dev), adapted for VITALS.
 * The live card preview, sliding digits, focus highlight and flip are kept; the payment parts are not:
 *   card number  -> 16-digit crew ID      (no card checks, no cc- autofill)
 *   card holder  -> crew member's name, plus their job on the mission
 *   expiry       -> mission end (month / year)
 *   CVV (back)   -> the mission name, shown on the back of the card
 * No card-network logo: the VITALS mark instead. Styles live in credit-card-form.css
 * (the original used <style jsx>, which only exists in Next.js).
 */
import React, { useEffect, useMemo, useState } from "react";
import { HeartPulse } from "lucide-react";
import "./credit-card-form.css";
import { ShinyButton } from "@/components/ui/shiny-button";

export type CrewCardState = {
  name: string;
  job: string;
  crewId: string; // 16 digits, no spaces
  month: string; // "01".."12" or ""
  year: string; // "2026".. or ""
  mission: string;
};

export type CrewCardValidity = {
  name: boolean;
  crewId: boolean;
  month: boolean;
  year: boolean;
  mission: boolean;
  allValid: boolean;
};

type Props = {
  defaults?: Partial<CrewCardState>;
  ring1?: string;
  ring2?: string;
  submitLabel?: string;
  /** the crew number was assigned to the account: show it, but it can't be edited */
  lockCrewId?: boolean;
  busy?: boolean;
  error?: string;
  onChange?: (state: CrewCardState, validity: CrewCardValidity) => void;
  onSubmit?: (state: CrewCardState, validity: CrewCardValidity) => void;
  className?: string;
};

const digits = (v: string, max: number) => v.replace(/\D/g, "").slice(0, max);
const spaced = (v: string) => v.replace(/(\d{4})(?=\d)/g, "$1 ");

type Focus = null | "number" | "holder" | "expire" | "mission";
/** Which part of the card the white highlight box frames, for the field being edited. */
const HIGHLIGHT: Record<Exclude<Focus, null>, string> = {
  number: "highlight__number",
  holder: "highlight__holder",
  expire: "highlight__expire",
  mission: "highlight__mission",
};

const CrewCardForm = ({ defaults = {}, ring1 = "#dc2626", ring2 = "#e11d48", submitLabel = "Save my student card", lockCrewId, busy, error, onChange, onSubmit, className = "" }: Props) => {
  const [name, setName] = useState(defaults.name ?? "");
  const [job, setJob] = useState(defaults.job ?? "");
  const [crewId, setCrewId] = useState(digits(defaults.crewId ?? "", 16));
  const [month, setMonth] = useState(defaults.month ?? "");
  const [year, setYear] = useState(defaults.year ?? "");
  const [mission, setMission] = useState(defaults.mission ?? "8B");
  const [focus, setFocus] = useState<Focus>(null);

  const years = useMemo(() => {
    const start = new Date().getFullYear();
    // 50 years: long missions (and their crews' careers) can end well past the next decade
    return Array.from({ length: 50 }, (_, i) => String(start + i));
  }, []);

  const validity: CrewCardValidity = useMemo(() => {
    const now = new Date();
    const v = {
      name: name.trim().length >= 2,
      crewId: crewId.length === 16,
      month: !!month && +month >= 1 && +month <= 12,
      year: !!year && +year >= now.getFullYear(),
      mission: mission.trim().length >= 1,
    };
    return { ...v, allValid: Object.values(v).every(Boolean) };
  }, [name, crewId, month, year, mission]);

  useEffect(() => {
    onChange?.({ name, job, crewId, month, year, mission }, validity);
  }, [name, job, crewId, month, year, mission, validity, onChange]);

  const slots = useMemo(() => Array.from({ length: 16 }, (_, i) => ({ text: crewId[i] ?? "#", filled: i < crewId.length })), [crewId]);

  const highlight = focus ? HIGHLIGHT[focus] : "hidden";
  const on = (f: Focus) => ({ onFocus: () => setFocus(f), onBlur: () => setFocus(null) });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validity.allValid) onSubmit?.({ name: name.trim(), job: job.trim(), crewId, month, year, mission: mission.trim() }, validity);
  };

  const rings = { ["--ring1" as string]: ring1, ["--ring2" as string]: ring2 } as React.CSSProperties;

  return (
    <section className={`ccp ${className}`}>
      <div className="wrap">
        {/* CARD */}
        <section className={`card ${focus === "mission" ? "flip" : ""}`} aria-label="Your student card preview">
          <div id="highlight" className={highlight} />
          <section className="card__front" style={rings}>
            <span className="card__slot" aria-hidden="true" />
            <span className="card__stripe" aria-hidden="true" />
            <div className="card__header">
              <span className="card__brand">
                <span className="card__logo">
                  <HeartPulse size={15} strokeWidth={2.6} aria-hidden="true" />
                </span>
                VITALS
              </span>
              <span className="card__tag">Student card</span>
            </div>
            <div className="card__number" aria-label="Student ID">
              {slots.map((s, i) => (
                <span key={i} className="slot">
                  <span className={`digit ${s.filled ? "filed" : ""}`}>
                    <span className="row">#</span>
                    <span className="row">{s.text}</span>
                  </span>
                </span>
              ))}
            </div>
            <div className="card__footer">
              <div className="card__holder">
                <div className="card__section__title">Student</div>
                <div className="name">{name || "YOUR NAME"}</div>
                <div className="card__job">{job || "Your role in class"}</div>
              </div>
              <div className="card__expires">
                <div className="card__section__title">School year ends</div>
                <span>{month || "MM"}</span>/<span>{year ? year.slice(-2) : "YY"}</span>
              </div>
            </div>
          </section>
          <section className="card__back" style={rings}>
            <div className="card__strip" />
            <div className="card__mission">
              <span>Class</span>
              <div className="card__mission_field">{mission || "—"}</div>
            </div>
          </section>
        </section>

        {/* FORM */}
        <form className="form" onSubmit={submit} noValidate>
          <div>
            <label htmlFor="cc-name">Your name</label>
            <input id="cc-name" autoComplete="name" placeholder="As the class calls you" value={name} onChange={(e) => setName(e.target.value)} {...on("holder")} aria-invalid={!validity.name} />
          </div>
          <div>
            <label htmlFor="cc-job">Role in class</label>
            <input id="cc-job" placeholder="e.g. Flight engineer" value={job} onChange={(e) => setJob(e.target.value)} {...on("holder")} />
          </div>
          <div>
            <label htmlFor="cc-id">Student ID</label>
            <input id="cc-id" inputMode="numeric" autoComplete="off" value={spaced(crewId)} readOnly={lockCrewId} onChange={(e) => setCrewId(digits(e.target.value, 16))} {...on("number")} aria-invalid={!validity.crewId} aria-describedby="cc-id-hint" />
            <p id="cc-id-hint" className="hint">
              {lockCrewId ? "Assigned to your account when you signed up. No two student numbers are the same." : "16 digits. We made one from your name; change it if your school gave you one."}
            </p>
          </div>
          <div className="filed__group">
            <div>
              <label htmlFor="cc-month">School year ends</label>
              <div className="filed__date">
                <select id="cc-month" value={month} onChange={(e) => setMonth(e.target.value)} {...on("expire")} aria-invalid={!validity.month} aria-label="School year end month">
                  <option value="" disabled>
                    Month
                  </option>
                  {Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0")).map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
                <select value={year} onChange={(e) => setYear(e.target.value)} {...on("expire")} aria-invalid={!validity.year} aria-label="School year end year">
                  <option value="" disabled>
                    Year
                  </option>
                  {years.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label htmlFor="cc-mission">Class</label>
              <input id="cc-mission" placeholder="e.g. 61:4" value={mission} onChange={(e) => setMission(e.target.value)} {...on("mission")} aria-invalid={!validity.mission} />
            </div>
          </div>
          {error && (
            <p role="alert" className="err">
              {error}
            </p>
          )}
          <ShinyButton type="submit" disabled={!validity.allValid || busy} className="mt-2 h-12 w-full">
            {busy ? "Saving…" : validity.allValid ? submitLabel : "Fill in every field"}
          </ShinyButton>
        </form>
      </div>
    </section>
  );
};

export { CrewCardForm };
