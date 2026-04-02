import React, { useState, useEffect, useRef, useCallback } from "react";

/**
 * Custom time input that respects 12h / 24h format.
 *
 * Props:
 *   value     – stored as "HH:mm" (24h) or "" if empty
 *   onChange  – called with { target: { name, value } } where value is "HH:mm" (24h)
 *   is24h     – whether to show 24h or 12h input
 *   name      – field name
 *   disabled  – whether the input is disabled
 *   tabIndex  – tab order
 */

// Convert 24h "HH:mm" → { hours12, minutes, period } for 12h display
const to12h = (val) => {
  if (!val || !val.includes(":")) return { hours: "", minutes: "", period: "AM" };
  const [h, m] = val.split(":").map(Number);
  if (isNaN(h) || isNaN(m)) return { hours: "", minutes: "", period: "AM" };
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return {
    hours: String(h12).padStart(2, "0"),
    minutes: String(m).padStart(2, "0"),
    period,
  };
};

// Convert 12h parts → 24h "HH:mm"
const from12h = (hours, minutes, period) => {
  let h = Number(hours);
  const m = Number(minutes);
  if (isNaN(h) || isNaN(m)) return "";
  if (period === "AM" && h === 12) h = 0;
  else if (period === "PM" && h !== 12) h += 12;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
};

function TimeInput({ value, onChange, is24h, name, disabled, tabIndex }) {
  const minuteRef = useRef(null);
  const hourRef = useRef(null);

  // --- 24h mode: simple text input with auto-colon ---
  const [text24, setText24] = useState(() => value || "");

  // --- 12h mode: separate hour, minute, period ---
  const [parts12, setParts12] = useState(() => to12h(value));

  // Sync from parent value when it changes externally (e.g. "Now" button, clear)
  // Also re-derive when is24h toggles so both display states stay in sync
  useEffect(() => {
    setText24(value || "");
    setParts12(to12h(value));
  }, [value, is24h]);

  // Emit 24h value to parent
  const emit = useCallback(
    (val24) => {
      onChange({ target: { name, value: val24 } });
    },
    [onChange, name]
  );

  // ---- 24h handlers ----
  const handle24Change = (e) => {
    let raw = e.target.value.replace(/[^\d]/g, ""); // digits only
    if (raw.length > 4) raw = raw.slice(0, 4);

    // Auto-insert colon after 2 digits
    let display = raw;
    if (raw.length >= 3) {
      display = raw.slice(0, 2) + ":" + raw.slice(2);
    }
    setText24(display);

    // If we have a complete HH:mm, validate and emit
    if (raw.length === 4) {
      const h = Number(raw.slice(0, 2));
      const m = Number(raw.slice(2, 4));
      if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
        const val = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
        emit(val);
        setParts12(to12h(val));
      }
    } else if (raw.length === 0) {
      emit("");
      setParts12(to12h(""));
    }
  };

  // ---- 12h handlers ----
  const handle12HourChange = (e) => {
    let raw = e.target.value.replace(/[^\d]/g, "");
    if (raw.length > 2) raw = raw.slice(0, 2);
    const n = Number(raw);
    // Allow typing: 0, 1, 2..12
    if (raw.length <= 2 && (raw === "" || (n >= 0 && n <= 12))) {
      const next = { ...parts12, hours: raw };
      setParts12(next);
      // Auto-focus minute when 2 digits typed
      if (raw.length === 2 && n >= 1 && n <= 12 && minuteRef.current) {
        minuteRef.current.focus();
        minuteRef.current.select();
      }
      // Emit if complete
      if (raw.length === 2 && n >= 1 && n <= 12 && next.minutes.length === 2) {
        const val = from12h(raw, next.minutes, next.period);
        emit(val);
        setText24(val);
      }
    }
  };

  const handle12MinuteChange = (e) => {
    let raw = e.target.value.replace(/[^\d]/g, "");
    if (raw.length > 2) raw = raw.slice(0, 2);
    const n = Number(raw);
    if (raw.length <= 2 && (raw === "" || (n >= 0 && n <= 59))) {
      const next = { ...parts12, minutes: raw };
      setParts12(next);
      if (raw.length === 2 && next.hours.length === 2) {
        const val = from12h(next.hours, raw, next.period);
        emit(val);
        setText24(val);
      }
    }
  };

  const toggle12Period = () => {
    const newPeriod = parts12.period === "AM" ? "PM" : "AM";
    const next = { ...parts12, period: newPeriod };
    setParts12(next);
    if (next.hours.length === 2 && next.minutes.length === 2) {
      const val = from12h(next.hours, next.minutes, newPeriod);
      emit(val);
      setText24(val);
    }
  };

  // Handle backspace on empty minute field → jump to hours
  const handleMinuteKeyDown = (e) => {
    if (e.key === "Backspace" && parts12.minutes === "" && hourRef.current) {
      hourRef.current.focus();
    }
  };

  // Handle clear: if both fields empty, emit empty
  useEffect(() => {
    if (!is24h && parts12.hours === "" && parts12.minutes === "") {
      // If parent still has a value, clear it
      if (value) emit("");
    }
  }, [parts12.hours, parts12.minutes, is24h, value, emit]);

  if (is24h) {
    return (
      <input
        type="text"
        className="time-input time-input-24"
        name={name}
        value={text24}
        onChange={handle24Change}
        disabled={disabled}
        tabIndex={tabIndex}
        placeholder="HH:mm"
        maxLength={5}
        inputMode="numeric"
        autoComplete="off"
      />
    );
  }

  return (
    <div className={`time-input-12-wrap ${disabled ? "time-input-disabled" : ""}`}>
      <input
        ref={hourRef}
        type="text"
        className="time-input time-input-12-part time-input-12-hour"
        value={parts12.hours}
        onChange={handle12HourChange}
        disabled={disabled}
        tabIndex={tabIndex}
        placeholder="hh"
        maxLength={2}
        inputMode="numeric"
        autoComplete="off"
      />
      <span className="time-input-12-sep">:</span>
      <input
        ref={minuteRef}
        type="text"
        className="time-input time-input-12-part time-input-12-min"
        value={parts12.minutes}
        onChange={handle12MinuteChange}
        onKeyDown={handleMinuteKeyDown}
        disabled={disabled}
        tabIndex={tabIndex}
        placeholder="mm"
        maxLength={2}
        inputMode="numeric"
        autoComplete="off"
      />
      <button
        type="button"
        className={`time-input-12-period ${parts12.period === "PM" ? "period-pm" : "period-am"}`}
        onClick={toggle12Period}
        disabled={disabled}
        tabIndex={-1}
        title="Toggle AM/PM"
      >
        {parts12.period}
      </button>
    </div>
  );
}

export default React.memo(TimeInput);
