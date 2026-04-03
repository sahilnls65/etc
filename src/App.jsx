import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { FaPlus, FaTrashAlt } from "react-icons/fa";
import { RxCross2 } from "react-icons/rx";
import { IoCloseCircle } from "react-icons/io5";
import Loader from "./Loader";
import Login from "./Login";
import TimeInput from "./TimeInput";
import { isLoggedIn, getUser, fetchPunches, logout } from "./api";

import "./styles.css";

const DEFAULT_DAY_TYPE = 510;

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

const getTodayKey = () => new Date().toISOString().split("T")[0];

const parseTimeToMinutes = (timeStr) => {
  if (!timeStr || !timeStr.includes(":")) return null;
  const [h, m] = timeStr.split(":").map(Number);
  if (isNaN(h) || isNaN(m)) return null;
  return h * 60 + m;
};

const EMPTY_PAIR = { in: "", out: "" };
const STORAGE_KEY = "etc_local_pairs";

// --- Core Calculation ---

const computeTimeData = (pairs, dayTypeMinutes, is24h) => {
  let totalPunchMinutes = 0;
  let lastEntryType = null;
  let lastInTime = null;

  for (const pair of pairs) {
    if (pair.in && pair.out) {
      const inMin = parseTimeToMinutes(pair.in);
      const outMin = parseTimeToMinutes(pair.out);
      if (inMin !== null && outMin !== null && outMin > inMin) {
        totalPunchMinutes += outMin - inMin;
      }
    }
    if (pair.out) lastEntryType = "out";
    else if (pair.in) { lastEntryType = "in"; lastInTime = pair.in; }
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
  } else {
    const now = new Date();
    const finishDate = new Date(now.getTime() + remaining * 60000);
    finishTime = formatDateTimeDisplay(finishDate, is24h);
  }

  const isCompleted = liveTotalMinutes >= dayTypeMinutes;
  const progressPercent = Math.min(100, (liveTotalMinutes / dayTypeMinutes) * 100);

  return { totalPunchMinutes, liveTotalMinutes, lastEntryType, finishTime, isCompleted, progressPercent, remaining };
};

// --- Sub-components ---

function CircularProgress({ percent, isCompleted, isActive }) {
  const r = 54;
  const circ = 2 * Math.PI * r;
  const offset = circ - (percent / 100) * circ;
  return (
    <svg className="circle-progress" viewBox="0 0 120 120">
      <circle className="circle-bg" cx="60" cy="60" r={r} />
      <circle className={`circle-fill ${isCompleted ? "circle-done" : ""} ${isActive ? "circle-active" : ""}`}
        cx="60" cy="60" r={r} strokeDasharray={circ} strokeDashoffset={offset} />
    </svg>
  );
}

function StatusBadge({ lastEntryType, isCompleted }) {
  if (isCompleted) return <span className="status-badge status-done">Completed</span>;
  if (lastEntryType === "in") return <span className="status-badge status-active">Working</span>;
  if (lastEntryType === "out") return <span className="status-badge status-paused">Paused</span>;
  return <span className="status-badge status-idle">Idle</span>;
}

function LiveClock({ is24h }) {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return <span className="live-clock">{formatDateTimeDisplay(now, is24h)}</span>;
}

function LiveCountdown({ remaining, isCompleted, lastEntryType }) {
  const [secs, setSecs] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setSecs((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, []);
  // Reset seconds counter whenever remaining changes (new minute tick)
  useEffect(() => { setSecs(0); }, [remaining]);

  if (isCompleted) return <span className="hero-countdown hero-countdown-done">Done!</span>;

  // If paused/idle, just show remaining as-is (no seconds tick)
  const isActive = lastEntryType === "in";
  const totalSecs = isActive ? Math.max(0, remaining * 60 - secs) : remaining * 60;

  const h = Math.floor(totalSecs / 3600);
  const m = Math.floor((totalSecs % 3600) / 60);
  const s = totalSecs % 60;

  const display = h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    : `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;

  return <span className={`hero-countdown ${totalSecs <= 0 ? "hero-countdown-done" : ""}`}>{totalSecs <= 0 ? "Done!" : display}</span>;
}

// --- Main App ---

function App() {
  const [loading, setLoading] = useState(true);

  // Auth state
  const [authed, setAuthed] = useState(false);
  const [user, setUser] = useState(null);
  const [showLoginModal, setShowLoginModal] = useState(false);

  // Tab navigation for logged-in users: "machine" or "calculator"
  const [activeTab, setActiveTab] = useState("machine");

  // Secret login: 5 rapid clicks on title
  const titleClicksRef = useRef([]);

  // Remote punch data (API mode)
  const [remotePairs, setRemotePairs] = useState([]);
  const [fetchError, setFetchError] = useState("");
  const [fetchingPunches, setFetchingPunches] = useState(false);

  // Local manual pairs (always available for calculator)
  const [localPairs, setLocalPairs] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      const data = stored ? JSON.parse(stored) : null;
      if (data && data.date === getTodayKey() && Array.isArray(data.pairs)) return data.pairs;
    } catch {}
    return Array.from({ length: 6 }, () => ({ ...EMPTY_PAIR }));
  });

  // Which pairs to use for the hero dashboard
  const isOnMachineTab = authed && activeTab === "machine";
  const activePairs = isOnMachineTab ? remotePairs : localPairs;

  // Settings
  const [dayOptions, setDayOptions] = useState(dayOption);
  const [dayType, setDayType] = useState(() => {
    const s = localStorage.getItem("etc_dayType");
    return s ? Number(s) : DEFAULT_DAY_TYPE;
  });
  const [is24h, setIs24h] = useState(() => {
    const stored = localStorage.getItem("etc_timeFormat");
    if (stored !== null) return stored === "24";
    const test = new Date(2000, 0, 1, 14, 0).toLocaleTimeString([], { hour: "numeric" });
    return !test.includes("AM") && !test.includes("PM");
  });
  const [customWorkingHours, setCustomWorkingHours] = useState({ time: "", visible: false, error: false });

  // Manual entry
  const [completedDuration, setCompletedDuration] = useState("");
  const [remainingFinishTime, setRemainingFinishTime] = useState("");
  const [completedError, setCompletedError] = useState(false);

  const [tick, setTick] = useState(0);

  const computed = useMemo(() => computeTimeData(activePairs, dayType, is24h), [activePairs, dayType, is24h, tick]);

  // --- Auth check ---
  useEffect(() => {
    if (isLoggedIn()) {
      setAuthed(true);
      setUser(getUser());
    }
    setTimeout(() => setLoading(false), 500);
  }, []);

  // --- Save local pairs to localStorage ---
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ date: getTodayKey(), pairs: localPairs }));
  }, [localPairs]);

  // --- Fetch punches from API (remote mode) ---
  const loadPunches = useCallback(async () => {
    if (!isLoggedIn()) return;
    setFetchingPunches(true);
    setFetchError("");
    try {
      const data = await fetchPunches(getTodayKey());
      setRemotePairs(data.pairs || []);
    } catch (err) {
      setFetchError(err.message);
    } finally {
      setFetchingPunches(false);
    }
  }, []);

  // Fetch on login and periodically
  useEffect(() => {
    if (!authed) return;
    loadPunches();
    const interval = setInterval(() => {
      loadPunches();
      setTick((t) => t + 1);
    }, 60000);
    return () => clearInterval(interval);
  }, [authed, loadPunches]);

  // Live tick
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 60000);
    return () => clearInterval(interval);
  }, []);

  // --- Secret login trigger: 5 rapid clicks on title ---
  const handleTitleClick = useCallback(() => {
    const now = Date.now();
    const clicks = titleClicksRef.current;
    clicks.push(now);
    const recent = clicks.filter((t) => now - t < 2000);
    titleClicksRef.current = recent;
    if (recent.length >= 5) {
      titleClicksRef.current = [];
      if (!authed) {
        setShowLoginModal(true);
      }
    }
  }, [authed]);

  // --- Local pair management ---
  const handleLocalTimeChange = useCallback((index, field, value) => {
    setLocalPairs((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  }, []);

  const handleAddLocalPair = useCallback(() => {
    setLocalPairs((prev) => [...prev, { ...EMPTY_PAIR }]);
  }, []);

  const handleRemoveLocalPair = useCallback((index) => {
    setLocalPairs((prev) => {
      if (prev.length <= 6) return prev;
      return prev.filter((_, i) => i !== index);
    });
  }, []);

  const handleSetNow = useCallback((index, field) => {
    const now = new Date();
    const val = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    handleLocalTimeChange(index, field, val);
  }, [handleLocalTimeChange]);

  const handleClearField = useCallback((index, field) => {
    handleLocalTimeChange(index, field, "");
  }, [handleLocalTimeChange]);

  const allPairsFilled = localPairs.every((p) => p.in && p.out);

  // --- Settings handlers ---
  const handleDayChange = useCallback((e) => {
    const val = Number(e.target.value);
    setDayType(val);
    localStorage.setItem("etc_dayType", val);
  }, []);

  const toggleTimeFormat = useCallback(() => {
    setIs24h((prev) => { const n = !prev; localStorage.setItem("etc_timeFormat", n ? "24" : "12"); return n; });
  }, []);

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

  const handleCompletedDurationChange = useCallback((e) => {
    let v = e.target.value.replace(/[^\d:]/g, "");
    if (v.length === 3 && !v.includes(":")) v = v.slice(0, 2) + ":" + v.slice(2);
    if (v.length <= 5) { setCompletedDuration(v); setCompletedError(false); }
  }, []);

  const calculateRemainingFinishTime = useCallback(() => {
    if (!completedDuration) { setRemainingFinishTime(""); return; }
    const parts = completedDuration.split(":").map(Number);
    if (parts.length < 2 || parts.some(isNaN) || parts[1] > 59) { setCompletedError(true); setRemainingFinishTime(""); return; }
    const rem = dayType - (parts[0] * 60 + parts[1]);
    if (rem <= 0) { setRemainingFinishTime("Completed"); setCompletedError(false); return; }
    const finish = new Date(Date.now() + rem * 60000);
    setRemainingFinishTime(formatDateTimeDisplay(finish, is24h));
    setCompletedError(false);
  }, [completedDuration, dayType, is24h]);

  useEffect(() => {
    const ch = localStorage.getItem("etc_customHours");
    if (ch) {
      const [h, m] = ch.split(":").map(Number);
      setCustomWorkingHours({ visible: true, time: ch, error: false });
      setDayOptions([...dayOption, { key: `Custom (${ch})`, value: h * 60 + m }]);
      setDayType(h * 60 + m);
    }
  }, []);

  const formatPunchTime = useCallback((hhmm) => {
    if (!hhmm) return "--:--";
    const min = parseTimeToMinutes(hhmm);
    if (min === null) return hhmm;
    return formatTimeDisplay(Math.floor(min / 60), min % 60, is24h);
  }, [is24h]);

  const handleLogin = useCallback((u) => {
    setAuthed(true);
    setUser(u);
    setShowLoginModal(false);
    setActiveTab("machine");
  }, []);

  const handleLogout = useCallback(() => {
    logout();
    setAuthed(false);
    setUser(null);
    setRemotePairs([]);
    setFetchError("");
    setActiveTab("machine");
  }, []);

  if (loading) return <Loader />;

  const dateStr = new Date().toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  // Determine which view to show
  const showCalculator = !authed || activeTab === "calculator";
  const showMachine = authed && activeTab === "machine";

  return (
    <div className="app">
      {/* Login Modal */}
      {showLoginModal && (
        <Login onLogin={handleLogin} onClose={() => setShowLoginModal(false)} isModal />
      )}

      {/* ====== HERO DASHBOARD ====== */}
      <section className="hero">
        <div className="hero-top">
          <div className="hero-title-area">
            <h1 className="hero-title" onClick={handleTitleClick} style={{ cursor: "default", userSelect: "none" }}>
              Time Calculator
            </h1>
            <p className="hero-date">{dateStr}</p>
          </div>
          <div className="hero-clock-area">
            <LiveClock is24h={is24h} />
            <StatusBadge lastEntryType={computed.lastEntryType} isCompleted={computed.isCompleted} />
          </div>
        </div>

        <div className="hero-body">
          <div className="hero-progress">
            <CircularProgress percent={computed.progressPercent} isCompleted={computed.isCompleted} isActive={computed.lastEntryType === "in"} />
            <div className="hero-progress-text">
              <LiveCountdown remaining={computed.remaining} isCompleted={computed.isCompleted} lastEntryType={computed.lastEntryType} />
              <span className="hero-sub">{formatMinutesToHHMM(computed.liveTotalMinutes)} / {formatMinutesToHHMM(dayType)}</span>
            </div>
          </div>

          <div className="hero-metrics">
            <div className="hero-metric">
              <span className="hm-label">Total Worked</span>
              <span className={`hm-value ${computed.isCompleted ? "hm-done" : ""}`}>{formatMinutesToHHMM(computed.liveTotalMinutes)}</span>
            </div>
            <div className="hero-metric">
              <span className="hm-label">Remaining</span>
              <span className={`hm-value ${computed.isCompleted ? "hm-done" : ""}`}>{computed.remaining <= 0 ? "00:00" : formatMinutesToHHMM(computed.remaining)}</span>
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

        {/* Controls */}
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
            <button className="ctrl-btn-text" onClick={() => setCustomWorkingHours({ visible: true, time: "", error: false })}>+ Custom</button>
          )}

          <div className="hero-controls-right">
            {authed && (
              <>
                {showMachine && (
                  <button className="ctrl-btn-text ctrl-refresh" onClick={() => { loadPunches(); setTick((t) => t + 1); }}>
                    {fetchingPunches ? "Syncing..." : "Refresh"}
                  </button>
                )}
                <span className="user-badge">{user?.name || user?.employeeId}</span>
                <button className="ctrl-btn-text ctrl-danger" onClick={handleLogout}>Logout</button>
              </>
            )}
          </div>
        </div>
      </section>

      {/* ====== TAB NAVIGATION (logged in only) ====== */}
      {authed && (
        <nav className="tab-nav">
          <button className={`tab-btn ${activeTab === "machine" ? "tab-active" : ""}`} onClick={() => setActiveTab("machine")}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="3" width="20" height="14" rx="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" />
            </svg>
            Machine Data
          </button>
          <button className={`tab-btn ${activeTab === "calculator" ? "tab-active" : ""}`} onClick={() => setActiveTab("calculator")}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="4" y="2" width="16" height="20" rx="2" /><line x1="8" y1="6" x2="16" y2="6" /><line x1="8" y1="10" x2="10" y2="10" /><line x1="14" y1="10" x2="16" y2="10" /><line x1="8" y1="14" x2="10" y2="14" /><line x1="14" y1="14" x2="16" y2="14" /><line x1="8" y1="18" x2="16" y2="18" />
            </svg>
            Calculator
          </button>
        </nav>
      )}

      {/* ====== MACHINE DATA TAB (read-only) ====== */}
      {showMachine && (
        <section className="section">
          <div className="section-header">
            <h2 className="section-title">
              Punch Entries
              {fetchError && <span className="fetch-error">{fetchError}</span>}
            </h2>
          </div>

          {remotePairs.length === 0 && !fetchingPunches && (
            <div className="empty-state">No punches recorded today. Data syncs every 15 minutes from the biometric machine.</div>
          )}

          <div className="cards-grid">
            {remotePairs.map((pair, i) => {
              const dur = pair.in && pair.out ? (() => {
                const a = parseTimeToMinutes(pair.in), b = parseTimeToMinutes(pair.out);
                return a !== null && b !== null && b > a ? formatMinutesToHHMM(b - a) : null;
              })() : null;
              const isLive = pair.in && !pair.out;

              return (
                <div className={`pair-card ${isLive ? "pair-live" : ""}`} key={i}>
                  <div className="pair-top">
                    <span className="pair-num">#{i + 1}</span>
                    {dur && <span className="pair-dur">{dur}</span>}
                    {isLive && <span className="pair-live-dot" />}
                  </div>
                  <div className="pair-fields">
                    <div className="pf pf-readonly">
                      <span className="pf-label pf-in">IN</span>
                      <span className="pf-time">{formatPunchTime(pair.in)}</span>
                    </div>
                    <div className="pair-arrow">&#8594;</div>
                    <div className="pf pf-readonly">
                      <span className="pf-label pf-out">OUT</span>
                      <span className="pf-time">{pair.out ? formatPunchTime(pair.out) : "--:--"}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ====== CALCULATOR TAB (or guest mode) ====== */}
      {showCalculator && (
        <>
          <section className="section">
            <div className="section-header">
              <h2 className="section-title">Punch Entries</h2>
              <button
                className="ctrl-btn-text ctrl-add-pair"
                onClick={handleAddLocalPair}
                disabled={!allPairsFilled}
                title={!allPairsFilled ? "Fill current pairs first" : "Add new pair"}
              >
                <FaPlus size={10} /> Add Pair
              </button>
            </div>

            <div className="cards-grid">
              {localPairs.map((pair, i) => {
                const dur = pair.in && pair.out ? (() => {
                  const a = parseTimeToMinutes(pair.in), b = parseTimeToMinutes(pair.out);
                  return a !== null && b !== null && b > a ? formatMinutesToHHMM(b - a) : null;
                })() : null;
                const isLive = pair.in && !pair.out;
                const isPairDisabled = i > 0 && !(localPairs[i - 1].in && localPairs[i - 1].out);

                return (
                  <div className={`pair-card ${isLive ? "pair-live" : ""} ${isPairDisabled ? "pair-disabled" : ""}`} key={i}>
                    <div className="pair-top">
                      <span className="pair-num">#{i + 1}</span>
                      {dur && <span className="pair-dur">{dur}</span>}
                      {isLive && <span className="pair-live-dot" />}
                      {localPairs.length > 6 && (
                        <button className="pair-rm" onClick={() => handleRemoveLocalPair(i)} title="Remove pair">
                          <RxCross2 size={12} />
                        </button>
                      )}
                    </div>

                    <div className="pair-fields">
                      <div className={`pf ${!pair.in && pair.out ? "pf-miss" : ""}`}>
                        <span className="pf-label pf-in">IN</span>
                        <TimeInput
                          name={`in-${i}`}
                          value={pair.in}
                          is24h={is24h}
                          disabled={isPairDisabled}
                          onChange={(e) => handleLocalTimeChange(i, "in", e.target.value)}
                        />
                        <div className="pf-btns">
                          <button className="pf-btn pf-now" onClick={() => handleSetNow(i, "in")} disabled={isPairDisabled}>Now</button>
                          <button className="pf-btn pf-clr" onClick={() => handleClearField(i, "in")} disabled={isPairDisabled || !pair.in}>
                            <RxCross2 size={10} />
                          </button>
                        </div>
                      </div>

                      <div className="pair-arrow">&#8594;</div>

                      <div className="pf">
                        <span className="pf-label pf-out">OUT</span>
                        <TimeInput
                          name={`out-${i}`}
                          value={pair.out}
                          is24h={is24h}
                          disabled={isPairDisabled}
                          onChange={(e) => handleLocalTimeChange(i, "out", e.target.value)}
                        />
                        <div className="pf-btns">
                          <button className="pf-btn pf-now" onClick={() => handleSetNow(i, "out")} disabled={isPairDisabled}>Now</button>
                          <button className="pf-btn pf-clr" onClick={() => handleClearField(i, "out")} disabled={isPairDisabled || !pair.out}>
                            <RxCross2 size={10} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Manual Entry */}
          <section className="section">
            <h2 className="section-title">Manual Entry</h2>
            <div className="manual-card">
              <p className="manual-hint">Enter your completed hours from the system to calculate remaining time.</p>
              <div className="manual-row">
                <div className="manual-field">
                  <label className="manual-label">Completed</label>
                  <input type="text" className={`manual-input ${completedError ? "input-error" : ""} ${remainingFinishTime === "Completed" ? "manual-done" : ""}`}
                    placeholder="HH:mm" value={completedDuration} onChange={handleCompletedDurationChange} maxLength={5} />
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
        </>
      )}

      {/* Footer */}
      <footer className="app-footer">
        &copy; {new Date().getFullYear()} Sahil Trambadiya. All rights reserved.
      </footer>
    </div>
  );
}

export default App;
