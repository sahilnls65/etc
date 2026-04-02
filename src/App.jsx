import React, { useState, useEffect, useCallback, useMemo } from "react";
import { FaPlus, FaTrashAlt } from "react-icons/fa";
import { RxCross2 } from "react-icons/rx";
import { IoCloseCircle } from "react-icons/io5";
import Loader from "./Loader";
import TimeInput from "./TimeInput";

import "./styles.css";

const DEFAULT_PAIRS = 6;
const DEFAULT_DAY_TYPE = 510;

const createInitialTimes = (pairs = DEFAULT_PAIRS) => {
  const data = {};
  for (let i = 1; i <= pairs; i++) {
    data[`in${i}`] = "";
    data[`out${i}`] = "";
  }
  return data;
};

const dayOption = [
  { key: "Full Day (08:30)", value: 510 },
  { key: "Full Day (08:00)", value: 480 },
  { key: "Half Day (04:15)", value: 255 },
  { key: "Half Day (04:00)", value: 240 },
  { key: "Early Leave (06:30)", value: 390 },
  { key: "Early Leave (06:00)", value: 360 },
];

// --- Utilities ---

const formatMinutesToHHMM = (totalMinutes) => {
  if (!totalMinutes || totalMinutes <= 0) return "00:00";
  const h = Math.floor(totalMinutes / 60);
  const m = Math.round(totalMinutes % 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
};

const formatTimeDisplay = (hours, minutes, is24h) => {
  const h = ((hours % 24) + 24) % 24;
  const m = Math.round(minutes);
  if (is24h) return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
};

const formatDateTimeDisplay = (date, is24h) =>
  formatTimeDisplay(date.getHours(), date.getMinutes(), is24h);

const getCurrentHHMM = () => {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
};

const getTodayKey = () => new Date().toISOString().split("T")[0];

const parseTimeToMinutes = (timeStr) => {
  if (!timeStr || !timeStr.includes(":")) return null;
  const [h, m] = timeStr.split(":").map(Number);
  if (isNaN(h) || isNaN(m)) return null;
  return h * 60 + m;
};

// --- Core Calculation ---

const computeTimeData = (times, dayTypeMinutes, is24h) => {
  let totalPunchMinutes = 0;
  let lastEntryType = null;
  let lastInTime = null;
  const missingFields = {};
  const pairCount = Object.keys(times).length / 2;

  for (let i = 1; i <= pairCount; i++) {
    const inTime = times[`in${i}`];
    const outTime = times[`out${i}`];
    if (inTime && outTime) {
      const inMin = parseTimeToMinutes(inTime);
      const outMin = parseTimeToMinutes(outTime);
      if (inMin !== null && outMin !== null && outMin > inMin) {
        totalPunchMinutes += outMin - inMin;
      }
    } else if (inTime && !outTime) {
      missingFields[`out${i}`] = true;
    } else if (!inTime && outTime) {
      missingFields[`in${i}`] = true;
    }
  }

  const entries = Object.entries(times);
  for (let i = entries.length - 1; i >= 0; i--) {
    if (entries[i][1]) {
      lastEntryType = entries[i][0].startsWith("in") ? "in" : "out";
      break;
    }
  }

  for (let i = entries.length - 1; i >= 0; i--) {
    if (entries[i][0].startsWith("in") && entries[i][1]) {
      lastInTime = entries[i][1];
      break;
    }
  }

  let liveTotalMinutes = totalPunchMinutes;
  if (lastEntryType === "in" && lastInTime) {
    const lastInMin = parseTimeToMinutes(lastInTime);
    if (lastInMin !== null) {
      const now = new Date();
      const nowMin = now.getHours() * 60 + now.getMinutes();
      const elapsed = nowMin - lastInMin;
      if (elapsed > 0) liveTotalMinutes += elapsed;
    }
  }

  let finishTime = null;
  const remaining = dayTypeMinutes - liveTotalMinutes;

  if (remaining <= 0) {
    finishTime = "completed";
  } else if (lastEntryType === "in" && lastInTime) {
    const lastInMin = parseTimeToMinutes(lastInTime);
    if (lastInMin !== null) {
      const finishMin = lastInMin + (liveTotalMinutes - totalPunchMinutes) + remaining;
      finishTime = formatTimeDisplay(Math.floor(finishMin / 60), finishMin % 60, is24h);
    }
  } else if (lastEntryType === "out" || lastEntryType === null) {
    const now = new Date();
    const finishDate = new Date(now.getTime() + remaining * 60000);
    finishTime = formatDateTimeDisplay(finishDate, is24h);
  }

  const isCompleted = liveTotalMinutes >= dayTypeMinutes;
  const progressPercent = Math.min(100, (liveTotalMinutes / dayTypeMinutes) * 100);

  return { totalPunchMinutes, liveTotalMinutes, missingFields, lastEntryType, finishTime, isCompleted, progressPercent, remaining };
};

// --- Circular Progress ---
function CircularProgress({ percent, isCompleted, isActive }) {
  const r = 54;
  const circ = 2 * Math.PI * r;
  const offset = circ - (percent / 100) * circ;
  return (
    <svg className="circle-progress" viewBox="0 0 120 120">
      <circle className="circle-bg" cx="60" cy="60" r={r} />
      <circle
        className={`circle-fill ${isCompleted ? "circle-done" : ""} ${isActive ? "circle-active" : ""}`}
        cx="60" cy="60" r={r}
        strokeDasharray={circ}
        strokeDashoffset={offset}
      />
    </svg>
  );
}

// --- Status Badge ---
function StatusBadge({ lastEntryType, isCompleted }) {
  if (isCompleted) return <span className="status-badge status-done">Completed</span>;
  if (lastEntryType === "in") return <span className="status-badge status-active">Working</span>;
  if (lastEntryType === "out") return <span className="status-badge status-paused">Paused</span>;
  return <span className="status-badge status-idle">Idle</span>;
}

// --- Live Clock ---
function LiveClock({ is24h }) {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return <span className="live-clock">{formatDateTimeDisplay(now, is24h)}</span>;
}

// --- App ---

function App() {
  const [loading, setLoading] = useState(true);
  const [times, setTimes] = useState(createInitialTimes());
  const [dayOptions, setDayOptions] = useState(dayOption);
  const [dayType, setDayType] = useState(DEFAULT_DAY_TYPE);
  const [is24h, setIs24h] = useState(() => {
    const stored = localStorage.getItem("etc_timeFormat");
    if (stored !== null) return stored === "24";
    const test = new Date(2000, 0, 1, 14, 0).toLocaleTimeString([], { hour: "numeric" });
    return !test.includes("AM") && !test.includes("PM");
  });
  const [customWorkingHours, setCustomWorkingHours] = useState({ time: "", visible: false, error: false });
  const [completedDuration, setCompletedDuration] = useState("");
  const [remainingFinishTime, setRemainingFinishTime] = useState("");
  const [completedError, setCompletedError] = useState(false);
  const [tick, setTick] = useState(0);

  const computed = useMemo(() => computeTimeData(times, dayType, is24h), [times, dayType, is24h, tick]);

  const saveTimesToStorage = useCallback((t) => { localStorage.setItem("etc_times", JSON.stringify(t)); }, []);

  const clearAllData = useCallback(() => {
    setTimes(createInitialTimes());
    localStorage.removeItem("etc_times");
    setCompletedDuration("");
    setRemainingFinishTime("");
    setCompletedError(false);
  }, []);

  const handleInputChange = useCallback((e) => {
    const { name, value } = e.target;
    setTimes((prev) => { const u = { ...prev, [name]: value }; saveTimesToStorage(u); return u; });
  }, [saveTimesToStorage]);

  const addCurrentTime = useCallback((name) => {
    const t = getCurrentHHMM();
    setTimes((prev) => { const u = { ...prev, [name]: t }; saveTimesToStorage(u); return u; });
  }, [saveTimesToStorage]);

  const handleClear = useCallback((name) => {
    setTimes((prev) => { const u = { ...prev, [name]: "" }; saveTimesToStorage(u); return u; });
  }, [saveTimesToStorage]);

  const handleDayChange = useCallback((e) => {
    const val = Number(e.target.value);
    setDayType(val);
    localStorage.setItem("etc_dayType", val);
  }, []);

  const toggleTimeFormat = useCallback(() => {
    setIs24h((prev) => { const n = !prev; localStorage.setItem("etc_timeFormat", n ? "24" : "12"); return n; });
  }, []);

  const addMoreCard = useCallback(() => {
    setTimes((prev) => {
      const pc = Object.keys(prev).length / 2;
      const u = { ...prev, [`in${pc + 1}`]: "", [`out${pc + 1}`]: "" };
      saveTimesToStorage(u);
      return u;
    });
  }, [saveTimesToStorage]);

  const removeCard = useCallback((pn) => {
    setTimes((prev) => { const u = { ...prev }; delete u[`in${pn}`]; delete u[`out${pn}`]; saveTimesToStorage(u); return u; });
  }, [saveTimesToStorage]);

  const isFieldEnabled = useCallback((name) => {
    const fo = Object.keys(times);
    const idx = fo.indexOf(name);
    if (idx === 0) return true;
    return !!times[fo[idx - 1]];
  }, [times]);

  // Custom hours
  const handleCustomWorkingHours = useCallback((e) => {
    const input = e.target.value;
    if (/^[0-9:]*$/.test(input)) {
      if (input.length === 2 && !input.includes(":")) {
        setCustomWorkingHours((p) => ({ ...p, time: input + ":", error: false }));
      } else if (input.length <= 5) {
        setCustomWorkingHours((p) => ({ ...p, time: input, error: false }));
      }
    }
  }, []);

  const handleAddCustomTime = useCallback((cwh) => {
    const [hours, minutes] = cwh.time.split(":");
    if (hours?.length === 2 && minutes?.length === 2 && +hours >= 0 && +hours <= 23 && +minutes >= 0 && +minutes <= 59) {
      const totalMin = +hours * 60 + +minutes;
      const fmt = `${hours.padStart(2, "0")}:${minutes.padStart(2, "0")}`;
      setCustomWorkingHours({ visible: true, time: fmt, error: false });
      setDayOptions([...dayOption, { key: `Custom (${fmt})`, value: totalMin }]);
      setDayType(totalMin);
      localStorage.setItem("etc_customHours", fmt);
      localStorage.setItem("etc_dayType", totalMin);
    } else {
      setCustomWorkingHours((p) => ({ ...p, error: true }));
    }
  }, []);

  const handleRemoveCustomTime = useCallback(() => {
    setCustomWorkingHours({ visible: false, time: "", error: false });
    setDayType(DEFAULT_DAY_TYPE);
    setDayOptions(dayOption);
    localStorage.removeItem("etc_customHours");
    localStorage.setItem("etc_dayType", DEFAULT_DAY_TYPE);
  }, []);

  // Completed duration
  const handleCompletedDurationChange = useCallback((e) => {
    let v = e.target.value.replace(/[^\d:]/g, "");
    if (v.length === 3 && !v.includes(":")) v = v.slice(0, 2) + ":" + v.slice(2);
    if (v.length <= 5) { setCompletedDuration(v); setCompletedError(false); }
  }, []);

  const calculateRemainingFinishTime = useCallback(() => {
    if (!completedDuration) { setRemainingFinishTime(""); return; }
    const parts = completedDuration.split(":").map(Number);
    if (parts.length < 2 || parts.some(isNaN) || parts[1] > 59) { setCompletedError(true); setRemainingFinishTime(""); return; }
    const completedMin = parts[0] * 60 + parts[1];
    const rem = dayType - completedMin;
    if (rem <= 0) { setRemainingFinishTime("Completed"); setCompletedError(false); return; }
    const finish = new Date(Date.now() + rem * 60000);
    setRemainingFinishTime(formatDateTimeDisplay(finish, is24h));
    setCompletedError(false);
  }, [completedDuration, dayType, is24h]);

  // Init
  useEffect(() => {
    const todayKey = getTodayKey();
    const storedDate = localStorage.getItem("etc_date");
    if (storedDate === todayKey) {
      const st = localStorage.getItem("etc_times");
      if (st) { try { setTimes(JSON.parse(st)); } catch { /* ignore */ } }
      const sd = localStorage.getItem("etc_dayType");
      if (sd) setDayType(Number(sd));
      const ch = localStorage.getItem("etc_customHours");
      if (ch) {
        const [h, m] = ch.split(":").map(Number);
        setCustomWorkingHours({ visible: true, time: ch, error: false });
        setDayOptions([...dayOption, { key: `Custom (${ch})`, value: h * 60 + m }]);
        setDayType(h * 60 + m);
      }
    } else {
      localStorage.removeItem("etc_times");
      localStorage.setItem("etc_date", todayKey);
    }
    const lt = setTimeout(() => setLoading(false), 600);
    const ti = setInterval(() => {
      setTick((t) => t + 1);
      if (getTodayKey() !== localStorage.getItem("etc_date")) {
        localStorage.removeItem("etc_times");
        localStorage.setItem("etc_date", getTodayKey());
        setTimes(createInitialTimes());
      }
    }, 30000);
    return () => { clearTimeout(lt); clearInterval(ti); };
  }, []);

  const pairKeys = useMemo(() => {
    const keys = Object.keys(times);
    const pairs = [];
    for (let i = 0; i < keys.length; i += 2) {
      const ik = keys[i], ok = keys[i + 1];
      if (ik && ok) pairs.push({ inKey: ik, outKey: ok, num: Number(ik.replace("in", "")) });
    }
    return pairs;
  }, [times]);

  const totalPairs = pairKeys.length;
  const canAddPair = useMemo(() => {
    if (!pairKeys.length) return true;
    const l = pairKeys[pairKeys.length - 1];
    return !!(times[l.inKey] && times[l.outKey]);
  }, [pairKeys, times]);

  if (loading) return <Loader />;

  const dateStr = new Date().toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  return (
    <div className="app">
      {/* ====== HERO DASHBOARD ====== */}
      <section className="hero">
        <div className="hero-top">
          <div className="hero-title-area">
            <h1 className="hero-title">Time Calculator</h1>
            <p className="hero-date">{dateStr}</p>
          </div>
          <div className="hero-clock-area">
            <LiveClock is24h={is24h} />
            <StatusBadge lastEntryType={computed.lastEntryType} isCompleted={computed.isCompleted} />
          </div>
        </div>

        <div className="hero-body">
          {/* Circular Progress */}
          <div className="hero-progress">
            <CircularProgress
              percent={computed.progressPercent}
              isCompleted={computed.isCompleted}
              isActive={computed.lastEntryType === "in"}
            />
            <div className="hero-progress-text">
              <span className="hero-percent">{Math.round(computed.progressPercent)}%</span>
              <span className="hero-sub">{formatMinutesToHHMM(computed.liveTotalMinutes)} / {formatMinutesToHHMM(dayType)}</span>
            </div>
          </div>

          {/* Key Metrics */}
          <div className="hero-metrics">
            <div className="hero-metric">
              <span className="hm-label">Total Worked</span>
              <span className={`hm-value ${computed.isCompleted ? "hm-done" : ""}`}>
                {formatMinutesToHHMM(computed.liveTotalMinutes)}
              </span>
            </div>
            <div className="hero-metric">
              <span className="hm-label">Remaining</span>
              <span className={`hm-value ${computed.isCompleted ? "hm-done" : ""}`}>
                {computed.remaining <= 0 ? "00:00" : formatMinutesToHHMM(computed.remaining)}
              </span>
            </div>
            <div className="hero-metric hero-metric-accent">
              <span className="hm-label">Finish At</span>
              <span className={`hm-value hm-finish ${computed.isCompleted ? "hm-done" : ""}`}>
                {computed.isCompleted ? "Done!" : computed.finishTime || "--:--"}
              </span>
              {!computed.isCompleted && computed.lastEntryType === "out" && computed.finishTime && (
                <span className="hm-hint">Paused</span>
              )}
            </div>
          </div>
        </div>

        {/* Controls strip */}
        <div className="hero-controls">
          <button className="fmt-toggle" onClick={toggleTimeFormat} title={`Switch to ${is24h ? "12h" : "24h"}`}>
            <span className={`fmt-opt ${!is24h ? "fmt-on" : ""}`}>12h</span>
            <span className={`fmt-opt ${is24h ? "fmt-on" : ""}`}>24h</span>
          </button>

          <select value={dayType} onChange={handleDayChange} className="day-select">
            {dayOptions.map((op, i) => <option key={i} value={op.value}>{op.key}</option>)}
          </select>

          {customWorkingHours.visible ? (
            <div className="custom-hours-row">
              <input type="text" placeholder="HH:mm" value={customWorkingHours.time} onChange={handleCustomWorkingHours}
                className={`custom-input ${customWorkingHours.error ? "input-error" : ""}`} maxLength={5} />
              <button className="ctrl-btn ctrl-add" onClick={() => handleAddCustomTime(customWorkingHours)}><FaPlus size={10} /></button>
              <button className="ctrl-btn ctrl-remove" onClick={handleRemoveCustomTime}><IoCloseCircle size={14} /></button>
            </div>
          ) : (
            <button className="ctrl-btn-text" onClick={() => setCustomWorkingHours({ visible: true, time: "", error: false })}>
              + Custom
            </button>
          )}

          <div className="hero-controls-right">
            <button className="ctrl-btn-text" onClick={addMoreCard} disabled={!canAddPair}>+ Add Pair</button>
            <button className="ctrl-btn-text ctrl-refresh" onClick={() => setTick((t) => t + 1)}>Refresh</button>
            <button className="ctrl-btn-text ctrl-danger" onClick={() => { if (confirm("Clear all punch data?")) clearAllData(); }}>Clear All</button>
          </div>
        </div>
      </section>

      {/* ====== PUNCH CARDS ====== */}
      <section className="section">
        <h2 className="section-title">Punch Entries</h2>
        <div className="cards-grid">
          {pairKeys.map(({ inKey, outKey, num }, pi) => {
            const inE = isFieldEnabled(inKey), outE = isFieldEnabled(outKey);
            const inV = times[inKey], outV = times[outKey];
            const inM = computed.missingFields[inKey], outM = computed.missingFields[outKey];
            const canRm = pi >= DEFAULT_PAIRS && pi === totalPairs - 1;
            const isLive = inV && !outV && computed.lastEntryType === "in";

            let dur = null;
            if (inV && outV) {
              const a = parseTimeToMinutes(inV), b = parseTimeToMinutes(outV);
              if (a !== null && b !== null && b > a) dur = formatMinutesToHHMM(b - a);
            }

            return (
              <div className={`pair-card ${!inE && !inV ? "pair-disabled" : ""} ${isLive ? "pair-live" : ""}`} key={num}>
                <div className="pair-top">
                  <span className="pair-num">#{num}</span>
                  {dur && <span className="pair-dur">{dur}</span>}
                  {isLive && <span className="pair-live-dot" />}
                  {canRm && (
                    <button className="pair-rm" onClick={() => removeCard(num)} title="Remove"><RxCross2 size={12} /></button>
                  )}
                </div>

                <div className="pair-fields">
                  <div className={`pf ${inM ? "pf-miss" : ""}`}>
                    <span className="pf-label pf-in">IN</span>
                    <TimeInput name={inKey} value={inV} onChange={handleInputChange} is24h={is24h} disabled={!inE} tabIndex={pi * 2 + 1} />
                    <div className="pf-btns">
                      <button className="pf-btn pf-now" onClick={() => addCurrentTime(inKey)} disabled={!inE}>Now</button>
                      <button className="pf-btn pf-clr" onClick={() => handleClear(inKey)} disabled={!inE}><FaTrashAlt size={9} /></button>
                    </div>
                  </div>
                  <div className="pair-arrow">&#8594;</div>
                  <div className={`pf ${outM ? "pf-miss" : ""}`}>
                    <span className="pf-label pf-out">OUT</span>
                    <TimeInput name={outKey} value={outV} onChange={handleInputChange} is24h={is24h} disabled={!outE} tabIndex={pi * 2 + 2} />
                    <div className="pf-btns">
                      <button className="pf-btn pf-now" onClick={() => addCurrentTime(outKey)} disabled={!outE}>Now</button>
                      <button className="pf-btn pf-clr" onClick={() => handleClear(outKey)} disabled={!outE}><FaTrashAlt size={9} /></button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ====== MANUAL ENTRY ====== */}
      <section className="section">
        <h2 className="section-title">Manual Entry</h2>
        <div className="manual-card">
          <p className="manual-hint">Enter your completed hours from the system to calculate remaining time.</p>
          <div className="manual-row">
            <div className="manual-field">
              <label className="manual-label">Completed</label>
              <input
                type="text"
                className={`manual-input ${completedError ? "input-error" : ""} ${remainingFinishTime === "Completed" ? "manual-done" : ""}`}
                placeholder="HH:mm"
                value={completedDuration}
                onChange={handleCompletedDurationChange}
                maxLength={5}
              />
            </div>
            <div className="manual-result">
              <label className="manual-label">Finish At</label>
              <span className={`manual-value ${remainingFinishTime === "Completed" ? "hm-done" : ""}`}>
                {completedError || !remainingFinishTime ? "--:--" : remainingFinishTime}
              </span>
            </div>
            <div className="manual-actions">
              <button className="btn-pill btn-pill-primary" onClick={calculateRemainingFinishTime}>Calculate</button>
              <button className="btn-pill btn-pill-ghost" onClick={() => { setCompletedDuration(""); setRemainingFinishTime(""); setCompletedError(false); }}>Clear</button>
            </div>
          </div>
          {completedError && <p className="error-msg">Invalid format — use HH:mm</p>}
        </div>
      </section>
    </div>
  );
}

export default App;
