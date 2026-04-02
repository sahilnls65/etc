import React, { useState, useEffect, useCallback, useMemo } from "react";
import { FaPlus, FaTrashAlt } from "react-icons/fa";
import { RxCross2 } from "react-icons/rx";
import { IoCloseCircle } from "react-icons/io5";
import Loader from "./Loader";
import TimeInput from "./TimeInput";

import "./styles.css";

const DEFAULT_PAIRS = 6;
const DEFAULT_DAY_TYPE = 510; // 8:30 hours

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

// --- Utility Functions ---

const formatMinutesToHHMM = (totalMinutes) => {
  if (!totalMinutes || totalMinutes <= 0) return "00:00";
  const h = Math.floor(totalMinutes / 60);
  const m = Math.round(totalMinutes % 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
};

/** Format hours:minutes into display string based on 12h/24h preference */
const formatTimeDisplay = (hours, minutes, is24h) => {
  const h = ((hours % 24) + 24) % 24; // normalize
  const m = Math.round(minutes);
  if (is24h) {
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
};

/** Format a Date object into display string */
const formatDateTimeDisplay = (date, is24h) => {
  return formatTimeDisplay(date.getHours(), date.getMinutes(), is24h);
};

const getCurrentHHMM = () => {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
};

const getTodayKey = () => new Date().toISOString().split("T")[0];

const getLocaleDateString = () => {
  return new Date().toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

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

  // Determine last entry type
  const entries = Object.entries(times);
  for (let i = entries.length - 1; i >= 0; i--) {
    if (entries[i][1]) {
      lastEntryType = entries[i][0].startsWith("in") ? "in" : "out";
      break;
    }
  }

  // Find the last "in" time for live tracking
  for (let i = entries.length - 1; i >= 0; i--) {
    if (entries[i][0].startsWith("in") && entries[i][1]) {
      lastInTime = entries[i][1];
      break;
    }
  }

  // Add live duration if last punch is "in"
  let liveTotalMinutes = totalPunchMinutes;
  if (lastEntryType === "in" && lastInTime) {
    const lastInMin = parseTimeToMinutes(lastInTime);
    if (lastInMin !== null) {
      const now = new Date();
      const nowMin = now.getHours() * 60 + now.getMinutes();
      const elapsed = nowMin - lastInMin;
      if (elapsed > 0) {
        liveTotalMinutes += elapsed;
      }
    }
  }

  // Calculate finish time
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

  return {
    totalPunchMinutes,
    liveTotalMinutes,
    missingFields,
    lastEntryType,
    finishTime,
    isCompleted,
    progressPercent,
    remaining,
  };
};

// --- Component ---

function App() {
  const [loading, setLoading] = useState(true);
  const [times, setTimes] = useState(createInitialTimes());
  const [dayOptions, setDayOptions] = useState(dayOption);
  const [dayType, setDayType] = useState(DEFAULT_DAY_TYPE);
  const [is24h, setIs24h] = useState(() => {
    const stored = localStorage.getItem("etc_timeFormat");
    if (stored !== null) return stored === "24";
    // Default: detect from browser locale
    const test = new Date(2000, 0, 1, 14, 0).toLocaleTimeString([], { hour: "numeric" });
    return !test.includes("AM") && !test.includes("PM");
  });
  const [customWorkingHours, setCustomWorkingHours] = useState({
    time: "",
    visible: false,
    error: false,
  });

  const [completedDuration, setCompletedDuration] = useState("");
  const [remainingFinishTime, setRemainingFinishTime] = useState("");
  const [completedError, setCompletedError] = useState(false);

  // --- Computed values (recalculated on state change) ---
  const [tick, setTick] = useState(0);
  const computed = useMemo(
    () => computeTimeData(times, dayType, is24h),
    [times, dayType, is24h, tick]
  );

  // --- Local Storage Helpers ---

  const saveTimesToStorage = useCallback((t) => {
    localStorage.setItem("etc_times", JSON.stringify(t));
  }, []);

  const clearAllData = useCallback(() => {
    const fresh = createInitialTimes();
    setTimes(fresh);
    localStorage.removeItem("etc_times");
    setCompletedDuration("");
    setRemainingFinishTime("");
    setCompletedError(false);
  }, []);

  // --- Handlers ---

  const handleInputChange = useCallback((e) => {
    const { name, value } = e.target;
    setTimes((prev) => {
      const updated = { ...prev, [name]: value };
      saveTimesToStorage(updated);
      return updated;
    });
  }, [saveTimesToStorage]);

  const addCurrentTime = useCallback((name) => {
    const currentTime = getCurrentHHMM();
    setTimes((prev) => {
      const updated = { ...prev, [name]: currentTime };
      saveTimesToStorage(updated);
      return updated;
    });
  }, [saveTimesToStorage]);

  const handleClear = useCallback((name) => {
    setTimes((prev) => {
      const updated = { ...prev, [name]: "" };
      saveTimesToStorage(updated);
      return updated;
    });
  }, [saveTimesToStorage]);

  const handleDayChange = useCallback((e) => {
    const val = Number(e.target.value);
    setDayType(val);
    localStorage.setItem("etc_dayType", val);
  }, []);

  const toggleTimeFormat = useCallback(() => {
    setIs24h((prev) => {
      const next = !prev;
      localStorage.setItem("etc_timeFormat", next ? "24" : "12");
      return next;
    });
  }, []);

  const addMoreCard = useCallback(() => {
    setTimes((prev) => {
      const pairCount = Object.keys(prev).length / 2;
      const updated = {
        ...prev,
        [`in${pairCount + 1}`]: "",
        [`out${pairCount + 1}`]: "",
      };
      saveTimesToStorage(updated);
      return updated;
    });
  }, [saveTimesToStorage]);

  const removeCard = useCallback((pairNumber) => {
    setTimes((prev) => {
      const updated = { ...prev };
      delete updated[`in${pairNumber}`];
      delete updated[`out${pairNumber}`];
      saveTimesToStorage(updated);
      return updated;
    });
  }, [saveTimesToStorage]);

  const isFieldEnabled = useCallback((name) => {
    const fieldOrder = Object.keys(times);
    const index = fieldOrder.indexOf(name);
    if (index === 0) return true;
    const previousField = fieldOrder[index - 1];
    return !!times[previousField];
  }, [times]);

  // --- Custom Working Hours ---

  const handleCustomWorkingHours = useCallback((e) => {
    const input = e.target.value;
    if (/^[0-9:]*$/.test(input)) {
      if (input.length === 2 && !input.includes(":")) {
        setCustomWorkingHours((prev) => ({ ...prev, time: input + ":", error: false }));
      } else if (input.length <= 5) {
        setCustomWorkingHours((prev) => ({ ...prev, time: input, error: false }));
      }
    }
  }, []);

  const handleAddCustomTime = useCallback((cwh) => {
    const parts = cwh.time.split(":");
    const [hours, minutes] = parts;
    if (
      hours?.length === 2 &&
      minutes?.length === 2 &&
      +hours >= 0 && +hours <= 23 &&
      +minutes >= 0 && +minutes <= 59
    ) {
      const totalMin = +hours * 60 + +minutes;
      const formatted = `${hours.padStart(2, "0")}:${minutes.padStart(2, "0")}`;
      setCustomWorkingHours({ visible: true, time: formatted, error: false });
      setDayOptions([...dayOption, { key: `Custom (${formatted})`, value: totalMin }]);
      setDayType(totalMin);
      localStorage.setItem("etc_customHours", formatted);
      localStorage.setItem("etc_dayType", totalMin);
    } else {
      setCustomWorkingHours((prev) => ({ ...prev, error: true }));
    }
  }, []);

  const handleRemoveCustomTime = useCallback(() => {
    setCustomWorkingHours({ visible: false, time: "", error: false });
    setDayType(DEFAULT_DAY_TYPE);
    setDayOptions(dayOption);
    localStorage.removeItem("etc_customHours");
    localStorage.setItem("etc_dayType", DEFAULT_DAY_TYPE);
  }, []);

  // --- Completed Duration ---

  const handleCompletedDurationChange = useCallback((e) => {
    let value = e.target.value.replace(/[^\d:]/g, "");
    if (value.length === 3 && !value.includes(":")) {
      value = value.slice(0, 2) + ":" + value.slice(2);
    }
    if (value.length <= 5) {
      setCompletedDuration(value);
      setCompletedError(false);
    }
  }, []);

  const calculateRemainingFinishTime = useCallback(() => {
    if (!completedDuration) {
      setRemainingFinishTime("");
      return;
    }
    const parts = completedDuration.split(":").map(Number);
    if (parts.length < 2 || parts.some(isNaN) || parts[1] > 59) {
      setCompletedError(true);
      setRemainingFinishTime("");
      return;
    }
    const [h, m] = parts;
    const completedMin = h * 60 + m;
    const remainingMin = dayType - completedMin;

    if (remainingMin <= 0) {
      setRemainingFinishTime("Completed");
      setCompletedError(false);
      return;
    }

    const now = new Date();
    const finish = new Date(now.getTime() + remainingMin * 60000);
    setRemainingFinishTime(formatDateTimeDisplay(finish, is24h));
    setCompletedError(false);
  }, [completedDuration, dayType, is24h]);

  // --- Initialization & Intervals ---

  useEffect(() => {
    const todayKey = getTodayKey();
    const storedDate = localStorage.getItem("etc_date");

    if (storedDate === todayKey) {
      const storedTimes = localStorage.getItem("etc_times");
      if (storedTimes) {
        try { setTimes(JSON.parse(storedTimes)); } catch { /* ignore */ }
      }
      const storedDayType = localStorage.getItem("etc_dayType");
      if (storedDayType) setDayType(Number(storedDayType));

      const customHours = localStorage.getItem("etc_customHours");
      if (customHours) {
        const [h, m] = customHours.split(":").map(Number);
        const totalMin = h * 60 + m;
        setCustomWorkingHours({ visible: true, time: customHours, error: false });
        setDayOptions([...dayOption, { key: `Custom (${customHours})`, value: totalMin }]);
        setDayType(totalMin);
      }
    } else {
      localStorage.removeItem("etc_times");
      localStorage.setItem("etc_date", todayKey);
    }

    const loaderTimer = setTimeout(() => setLoading(false), 600);

    const tickInterval = setInterval(() => {
      setTick((t) => t + 1);
      if (getTodayKey() !== localStorage.getItem("etc_date")) {
        localStorage.removeItem("etc_times");
        localStorage.setItem("etc_date", getTodayKey());
        setTimes(createInitialTimes());
      }
    }, 30000);

    return () => {
      clearTimeout(loaderTimer);
      clearInterval(tickInterval);
    };
  }, []);

  // --- Derive pair data for rendering ---
  const pairKeys = useMemo(() => {
    const keys = Object.keys(times);
    const pairs = [];
    for (let i = 0; i < keys.length; i += 2) {
      const inKey = keys[i];
      const outKey = keys[i + 1];
      if (inKey && outKey) {
        const num = inKey.replace("in", "");
        pairs.push({ inKey, outKey, num: Number(num) });
      }
    }
    return pairs;
  }, [times]);

  const totalPairs = pairKeys.length;

  // Disable "Add Pair" until the last pair is fully filled
  const canAddPair = useMemo(() => {
    if (pairKeys.length === 0) return true;
    const last = pairKeys[pairKeys.length - 1];
    return !!(times[last.inKey] && times[last.outKey]);
  }, [pairKeys, times]);

  if (loading) return <Loader />;

  return (
    <div className="app">
      {/* Header */}
      <header className="app-header">
        <div className="header-left">
          <h1 className="app-title">Time Calculator</h1>
          <span className="app-date">{getLocaleDateString()}</span>
        </div>
        <div className="header-controls">
          {/* 12h / 24h Toggle */}
          <button
            className={`time-format-toggle`}
            onClick={toggleTimeFormat}
            title={`Switch to ${is24h ? "12-hour" : "24-hour"} format`}
          >
            <span className={`toggle-option ${!is24h ? "toggle-active" : ""}`}>12h</span>
            <span className={`toggle-option ${is24h ? "toggle-active" : ""}`}>24h</span>
          </button>

          {customWorkingHours.visible ? (
            <div className="custom-hours-input">
              <input
                type="text"
                placeholder="HH:mm"
                value={customWorkingHours.time}
                onChange={handleCustomWorkingHours}
                className={`custom-input ${customWorkingHours.error ? "input-error" : ""}`}
                maxLength={5}
              />
              <button
                className="btn btn-icon btn-primary-light"
                onClick={() => handleAddCustomTime(customWorkingHours)}
                title="Apply custom hours"
              >
                <FaPlus size={12} />
              </button>
              <button
                className="btn btn-icon btn-danger-light"
                onClick={handleRemoveCustomTime}
                title="Remove custom hours"
              >
                <IoCloseCircle size={16} />
              </button>
              {customWorkingHours.error && (
                <span className="inline-error">Invalid (HH:mm)</span>
              )}
            </div>
          ) : (
            <button
              className="btn btn-outline"
              onClick={() => setCustomWorkingHours({ visible: true, time: "", error: false })}
            >
              <FaPlus size={10} style={{ marginRight: 6 }} />
              Custom Hours
            </button>
          )}

          <select value={dayType} onChange={handleDayChange} className="day-select">
            {dayOptions.map((op, i) => (
              <option key={i} value={op.value}>{op.key}</option>
            ))}
          </select>

          <button className="btn btn-outline" onClick={addMoreCard} disabled={!canAddPair}>
            <FaPlus size={10} style={{ marginRight: 6 }} />
            Add Pair
          </button>
        </div>
      </header>

      {/* Progress Bar */}
      <div className="progress-container">
        <div className="progress-bar">
          <div
            className={`progress-fill ${computed.isCompleted ? "progress-completed" : ""}`}
            style={{ width: `${computed.progressPercent}%` }}
          />
        </div>
        <div className="progress-label">
          <span>{formatMinutesToHHMM(computed.liveTotalMinutes)} / {formatMinutesToHHMM(dayType)}</span>
          <span>{Math.round(computed.progressPercent)}%</span>
        </div>
      </div>

      {/* Time Cards Grid */}
      <div className="cards-grid">
        {pairKeys.map(({ inKey, outKey, num }, pairIndex) => {
          const inEnabled = isFieldEnabled(inKey);
          const outEnabled = isFieldEnabled(outKey);
          const inValue = times[inKey];
          const outValue = times[outKey];
          const inMissing = computed.missingFields[inKey];
          const outMissing = computed.missingFields[outKey];
          const canRemove = pairIndex >= DEFAULT_PAIRS && pairIndex === totalPairs - 1;

          // Calculate pair duration
          let pairDuration = null;
          if (inValue && outValue) {
            const inMin = parseTimeToMinutes(inValue);
            const outMin = parseTimeToMinutes(outValue);
            if (inMin !== null && outMin !== null && outMin > inMin) {
              pairDuration = formatMinutesToHHMM(outMin - inMin);
            }
          }

          return (
            <div className={`pair-card ${!inEnabled && !inValue ? "pair-disabled" : ""}`} key={num}>
              <div className="pair-header">
                <span className="pair-number">Pair {num}</span>
                {pairDuration && <span className="pair-duration">{pairDuration}</span>}
                {canRemove && (
                  <button
                    className="btn-remove-card"
                    onClick={() => removeCard(num)}
                    title="Remove pair"
                  >
                    <RxCross2 size={14} />
                  </button>
                )}
              </div>

              <div className="pair-fields">
                {/* In Field */}
                <div className={`field-group ${inMissing ? "field-missing" : ""}`}>
                  <label className="field-label in-label">In</label>
                  <TimeInput
                    name={inKey}
                    value={inValue}
                    onChange={handleInputChange}
                    is24h={is24h}
                    disabled={!inEnabled}
                    tabIndex={pairIndex * 2 + 1}
                  />
                  <div className="field-actions">
                    <button
                      className="btn-sm btn-add"
                      onClick={() => addCurrentTime(inKey)}
                      disabled={!inEnabled}
                      title="Set current time"
                    >
                      Now
                    </button>
                    <button
                      className="btn-sm btn-clear"
                      onClick={() => handleClear(inKey)}
                      disabled={!inEnabled}
                      title="Clear"
                    >
                      <FaTrashAlt size={10} />
                    </button>
                  </div>
                </div>

                {/* Out Field */}
                <div className={`field-group ${outMissing ? "field-missing" : ""}`}>
                  <label className="field-label out-label">Out</label>
                  <TimeInput
                    name={outKey}
                    value={outValue}
                    onChange={handleInputChange}
                    is24h={is24h}
                    disabled={!outEnabled}
                    tabIndex={pairIndex * 2 + 2}
                  />
                  <div className="field-actions">
                    <button
                      className="btn-sm btn-add"
                      onClick={() => addCurrentTime(outKey)}
                      disabled={!outEnabled}
                      title="Set current time"
                    >
                      Now
                    </button>
                    <button
                      className="btn-sm btn-clear"
                      onClick={() => handleClear(outKey)}
                      disabled={!outEnabled}
                      title="Clear"
                    >
                      <FaTrashAlt size={10} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary Section */}
      <div className="summary-layout">
        {/* Punch Summary */}
        <div className="summary-card">
          <div className="summary-card-title">Punch Summary</div>
          <div className="summary-row">
            <div className="summary-metric">
              <span className="metric-label">Total Worked</span>
              <span className={`metric-value ${computed.isCompleted ? "value-completed" : ""}`}>
                {formatMinutesToHHMM(computed.liveTotalMinutes)}
              </span>
            </div>
            <div className="summary-metric">
              <span className="metric-label">Finish At</span>
              <span
                className={`metric-value ${computed.isCompleted ? "value-completed" : ""} ${
                  !computed.isCompleted && computed.lastEntryType === "out" ? "value-paused" : ""
                }`}
              >
                {computed.isCompleted
                  ? "Done!"
                  : computed.finishTime || "--"}
              </span>
              {!computed.isCompleted && computed.lastEntryType === "out" && computed.finishTime && (
                <span className="metric-hint">Paused — punch in to resume</span>
              )}
            </div>
          </div>
          <div className="summary-card-actions">
            <button
              className="btn btn-primary"
              onClick={() => setTick((t) => t + 1)}
            >
              Recalculate
            </button>
            <button
              className="btn btn-danger"
              onClick={() => {
                if (confirm("Clear all punch data?")) clearAllData();
              }}
            >
              Clear All
            </button>
          </div>
        </div>

        {/* Completed Hours */}
        <div className="summary-card">
          <div className="summary-card-title">
            Manual Entry
            <span className="title-hint">Enter completed hours from your system</span>
          </div>
          <div className="summary-row">
            <div className="summary-metric">
              <span className="metric-label">Completed Duration</span>
              <input
                type="text"
                className={`completed-input ${completedError ? "input-error" : ""} ${
                  remainingFinishTime === "Completed" ? "input-completed" : ""
                }`}
                placeholder="HH:mm"
                value={completedDuration}
                onChange={handleCompletedDurationChange}
                maxLength={5}
              />
            </div>
            <div className="summary-metric">
              <span className="metric-label">Finish At</span>
              <span className={`metric-value ${remainingFinishTime === "Completed" ? "value-completed" : ""}`}>
                {completedError || !remainingFinishTime ? "--" : remainingFinishTime}
              </span>
            </div>
          </div>
          {completedError && (
            <p className="error-msg">Invalid format — use HH:mm</p>
          )}
          <div className="summary-card-actions">
            <button className="btn btn-primary" onClick={calculateRemainingFinishTime}>
              Calculate
            </button>
            <button
              className="btn btn-danger"
              onClick={() => {
                setCompletedDuration("");
                setRemainingFinishTime("");
                setCompletedError(false);
              }}
            >
              Clear
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
