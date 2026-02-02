import React, { useState, useEffect, useRef } from "react";
import { FaPlus, FaTrashAlt } from "react-icons/fa";
import { RxCross2 } from "react-icons/rx";
import { IoCloseCircle } from "react-icons/io5";
import Loader from "./Loader";

import "./styles.css";

const timeData = {
  in1: "",
  out1: "",
  in2: "",
  out2: "",
  in3: "",
  out3: "",
  in4: "",
  out4: "",
  in5: "",
  out5: "",
  in6: "",
  out6: "",
};

const dayOption = [
  { key: "Full Day (08:30 Hour)", value: 510 },
  { key: "Half Day (04:15 Hour)", value: 255 },
  { key: "Early Leave (06:30 Hour)", value: 390 },
  { key: "Full Day (08:00 Hour)", value: 480 },
  { key: "Half Day (04:00 Hour)", value: 240 },
  { key: "Early Leave (06:00 Hour)", value: 360 },
];

function App() {
  const [loading, setLoading] = useState(true);
  const [times, setTimes] = useState(timeData);
  const [dayOptions, setDayOptions] = useState(dayOption);
  const [customWorkingHours, setCustomWorkingHours] = useState({
    time: "",
    visible: false,
    error: false,
  });
  const [currentDate, setCurrentDate] = useState(new Date().toLocaleDateString());
  const [totalTime, setTotalTime] = useState(0); // Total working minutes
  const [endTime, setEndTime] = useState("00:00"); // When work time finishes
  const [dayType, setDayType] = useState(510);
  const [missingFields, setMissingFields] = useState({});
  const [timeIsCompleted, setTimeIsCompleted] = useState(false);
  const [lastPunchType, setLastPunchType] = useState("out");
  const lastCheckedTimeRef = useRef(null);

  const [completedDuration, setCompletedDuration] = useState(""); // HH:mm or HH:mm:ss
  const [remainingFinishTime, setRemainingFinishTime] = useState("");
  const [completedError, setCompletedError] = useState(false);

  const handleCompletedDurationChange = (e) => {
    let value = e.target.value.replace(/[^\d:]/g, ""); // Remove non-digit and non-colon characters

    // Handle HH:mm mask
    if (value.length === 0) {
      setCompletedDuration("");
      setCompletedError(false);
    } else if (value.length <= 2 && !value.includes(":")) {
      setCompletedDuration(value);
      setCompletedError(false);
    } else if (value.length === 3 && !value.includes(":")) {
      // Insert colon after 2 digits
      setCompletedDuration(value.slice(0, 2) + ":" + value.slice(2));
      setCompletedError(false);
    } else if (value.includes(":")) {
      const parts = value.split(":");
      // Limit to HH:mm format (max 5 characters: HH:mm)
      if (parts[0].length <= 2 && parts[1] && parts[1].length <= 2 && value.length <= 5) {
        setCompletedDuration(value);
        setCompletedError(false);
      } else if (parts[0].length <= 2 && !parts[1] && value.length <= 3) {
        setCompletedDuration(value);
        setCompletedError(false);
      }
    }
  };

  const getCurrentHoursMinutes = () => {
    const now = new Date();
    const hours = now.getHours().toString().padStart(2, "0");
    const minutes = now.getMinutes().toString().padStart(2, "0");
    return `${hours}:${minutes}`;
  };

  const transformTimeLabel = (label) => {
    if (label.startsWith("in")) {
      return "In - " + label.slice(2);
    } else if (label.startsWith("out")) {
      return "Out - " + label.slice(3);
    } else {
      return label;
    }
  };

  const clearLocalStorage = () => {
    localStorage.removeItem("times");
    setTimes(timeData);
    setEndTime("00:00");
    setTotalTime(0);
  };

  const isFieldEnabled = (name) => {
    const fieldOrder = Object.keys(times);
    const index = fieldOrder.indexOf(name);
    if (index === 0) return false;

    const previousField = fieldOrder[index - 1];

    if (times[previousField]) {
      return false;
    } else {
      return true;
    }
  };

  const handleDayChange = (event) => {
    setDayType(event.target.value);
    localStorage.setItem("dayType", event.target.value);
    calculateTotalTime(times, event.target.value);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    const tempTime = { ...times, [name]: value };
    setTimes(tempTime);
    localStorage.setItem("times", JSON.stringify(tempTime));
    calculateTotalTime(tempTime, dayType);
  };

  const addCurrentTime = (name) => {
    const now = new Date();
    const hours = now.getHours().toString().padStart(2, "0");
    const minutes = now.getMinutes().toString().padStart(2, "0");
    const currentTime = `${hours}:${minutes}`;
    const tempTime = { ...times, [name]: currentTime };
    setTimes(tempTime);
    localStorage.setItem("times", JSON.stringify(tempTime));
    calculateTotalTime(tempTime, dayType);
  };

  const handleClear = (name) => {
    const tempTime = { ...times, [name]: "" };
    setTimes(tempTime);
    localStorage.setItem("times", JSON.stringify(tempTime));
    calculateTotalTime(tempTime, dayType);
  };

  const resetTimesIfNewDay = () => {
    const storedDate = localStorage.getItem("currentDate");
    const today = new Date().toLocaleDateString();

    if (storedDate !== today) {
      clearLocalStorage();
      localStorage.setItem("currentDate", today);
      setCurrentDate(today);
    }
  };

  const getLastTime = (times, type) => {
    const lastKey = Object.keys(times)
      .reverse()
      .find((key) => key.startsWith(type) && times[key] !== "");

    return lastKey ? times[lastKey] : null;
  };

  const getLastEntryType = (times) => {
    const entries = Object.entries(times);
    for (let i = entries.length - 1; i >= 0; i--) {
      const [key, value] = entries[i];
      if (value) {
        return key.includes("in") ? "in" : "out";
      }
    }
    return null;
  };

  const calculateDurationFromLastIn = (times, lastTimeTotal, lastEntryType) => {
    if (lastEntryType === "in") {
      const lastInTime = getLastTime(times, "in");
      if (lastInTime) {
        const [lastInHours, lastInMinutes] = lastInTime.split(":").map(Number);
        const lastInDate = new Date();
        lastInDate.setHours(lastInHours, lastInMinutes, 0, 0);

        const now = new Date();
        const diffMs = now - lastInDate;
        const diffMins = Math.floor(diffMs / 60000);

        const newTotalMinutes = lastTimeTotal + diffMins;

        return newTotalMinutes;
      } else {
        return lastTimeTotal;
      }
    } else {
      return lastTimeTotal;
    }
  };

  const calculateTotalTime = (times, dayType) => {
    console.log(dayType, "test++++");
    let totalMinutes = 0;
    let totalPunchMinutes = 0;
    const newMissingFields = {};

    for (let i = 1; i <= 6; i++) {
      const inTime = times[`in${i}`];
      const outTime = times[`out${i}`];

      if (inTime && outTime) {
        const [inHours, inMinutes] = inTime.split(":").map(Number);
        const [outHours, outMinutes] = outTime.split(":").map(Number);

        const inMinutesTotal = inHours * 60 + inMinutes;
        const outMinutesTotal = outHours * 60 + outMinutes;

        if (outMinutesTotal > inMinutesTotal) {
          totalMinutes += outMinutesTotal - inMinutesTotal;
        } else {
          console.log(
            `Out time (${outMinutesTotal}) should be greater than In time (${inMinutesTotal})`
          );
        }
      } else if (inTime && !outTime) {
        newMissingFields[`out${i}`] = true;
      } else if (!inTime && outTime) {
        const prevOutTime = times[`out${i - 1}`];
        if (!prevOutTime) {
          newMissingFields[`in${i}`] = true;
        }
      }
    }
    setMissingFields(newMissingFields);
    const lastEntryType = getLastEntryType(times);
    setLastPunchType(lastEntryType);
    totalPunchMinutes = totalMinutes;
    totalMinutes = calculateDurationFromLastIn(times, totalMinutes, lastEntryType);

    const remainingMinutes = dayType - totalMinutes;
    const lastRecordedTime = getLastTime(times, lastEntryType);

    if (!lastRecordedTime) {
      const currentTime = new Date();
      let endDate = new Date(currentTime.getTime() + remainingMinutes * 60000);

      const endHours = endDate.getHours().toString().padStart(2, "0");
      const endMinutes = endDate.getMinutes().toString().padStart(2, "0");

      setEndTime(`${endHours}:${endMinutes}`);
    } else if (lastEntryType == "in") {
      const [lastHours, lastMinutes] = lastRecordedTime.split(":").map(Number);
      const lastTotalMinutes = lastHours * 60 + lastMinutes;

      const endTotalMinutes =
        lastTotalMinutes + totalMinutes + remainingMinutes - totalPunchMinutes;
      const endHours = Math.floor(endTotalMinutes / 60);
      const endMinutes = endTotalMinutes % 60;

      setEndTime(
        `${endHours.toString().padStart(2, "0")}:${endMinutes.toString().padStart(2, "0")}`
      );
    }

    setTotalTime(totalMinutes);
    setTimeIsCompleted(totalMinutes >= dayType);
  };

  const addMoreCard = (times) => {
    const currentPair = Object.keys(times)?.length / 2;
    const tempTimes = {
      ...times,
      [`in${currentPair + 1}`]: "",
      [`out${currentPair + 1}`]: "",
    };
    setTimes(tempTimes);
    localStorage.setItem("times", JSON.stringify(tempTimes));
  };

  const removeCard = (times, key) => {
    const tempTimes = { ...times };
    const pairNumber = key.split("out")?.[1];

    if (tempTimes[`in${pairNumber}`] || tempTimes[`out${pairNumber}`]) {
      calculateTotalTime(tempTimes, dayType);
    }

    delete tempTimes[`in${pairNumber}`];
    delete tempTimes[`out${pairNumber}`];
    setTimes(tempTimes);
    localStorage.setItem("times", JSON.stringify(tempTimes));
  };

  const handleCustomWorkingHours = (e) => {
    const input = e.target.value;

    if (/^[0-9:]*$/.test(input)) {
      if (input.length === 2 && !input.includes(":")) {
        setCustomWorkingHours((prev) => ({
          ...prev,
          time: input + ":",
        }));
      } else if (input.length <= 5) {
        setCustomWorkingHours((prev) => ({
          ...prev,
          time: input,
        }));
      }
    }
  };

  const handleAddCustomTime = (customWorkingHours) => {
    const [hours, minutes] = customWorkingHours.time.split(":");
    if (
      hours !== undefined &&
      minutes !== undefined &&
      hours.length === 2 &&
      minutes.length === 2 &&
      parseInt(hours, 10) >= 0 &&
      parseInt(hours, 10) <= 23 &&
      parseInt(minutes, 10) >= 0 &&
      parseInt(minutes, 10) <= 59
    ) {
      let totalMinutes = Number(hours) * 60 + Number(minutes);
      setCustomWorkingHours({
        visible: true,
        time: `${hours.padStart(2, "0")}:${minutes.padStart(2, "0")}`,
      });
      setDayOptions([
        ...dayOption,
        {
          key: `${hours.padStart(2, "0")}:${minutes.padStart(2, "0")}`,
          value: totalMinutes,
        },
      ]);
      setDayType(totalMinutes);
      calculateTotalTime(times, totalMinutes);
      localStorage.setItem("customHours", `${hours.padStart(2, "0")}:${minutes.padStart(2, "0")}`);
    } else {
      setCustomWorkingHours({
        time: "",
        error: true,
        visible: true,
      });
    }
  };

  const handleRemoveCustomTime = () => {
    setCustomWorkingHours({ visible: false, time: "", error: false });
    setDayType(510);
    setDayOptions(dayOption);
    calculateTotalTime(times, 510);
    localStorage.removeItem("customHours");
  };

  const calculateRemainingFinishTime = () => {
    if (!completedDuration) return;

    const parts = completedDuration.split(":").map(Number);

    if (parts.length < 2 || parts.length > 3 || parts.some(isNaN)) {
      setCompletedError(true);
      setRemainingFinishTime("");
      return;
    }

    const [h, m, s = 0] = parts;

    if (m > 59 || s > 59) {
      setCompletedError(true);
      setRemainingFinishTime("");
      return;
    }

    const completedMinutes = h * 60 + m + s / 60;
    const remainingMinutes = dayType - completedMinutes;

    if (remainingMinutes <= 0) {
      setRemainingFinishTime("Already completed 🎉");
      setCompletedError(false);
      return;
    }

    const now = new Date();
    const finish = new Date(now.getTime() + remainingMinutes * 60000);

    setRemainingFinishTime(
      finish.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })
    );

    setCompletedError(false);
  };

  useEffect(() => {
    const storedTimes = localStorage.getItem("times");
    const storedDate = localStorage.getItem("currentDate");
    let dayTypes = Number(localStorage.getItem("dayType"));
    let customHours = localStorage.getItem("customHours");
    const today = new Date().toLocaleDateString();
    setDayType(dayTypes ? dayTypes : 510);

    if (storedDate === today) {
      if (storedTimes) {
        setTimes(JSON.parse(storedTimes));
        if (customHours) {
          customHours = {
            time: customHours,
          };
          handleAddCustomTime(customHours);
        } else {
          calculateTotalTime(JSON.parse(storedTimes), dayTypes ? dayTypes : 510);
        }
      }
    } else {
      clearLocalStorage();
      localStorage.setItem("currentDate", today);
      setCurrentDate(today);
    }

    const interval = setInterval(() => {
      resetTimesIfNewDay();
    }, 60000);

    const intervalCalculateTime = setInterval(() => {
      const currentHoursMinutes = getCurrentHoursMinutes();

      if (currentHoursMinutes !== lastCheckedTimeRef.current && lastPunchType != "out") {
        lastCheckedTimeRef.current = currentHoursMinutes;
        calculateTotalTime(times, dayType);
      }
    }, 1000);

    const LoaderTimer = setTimeout(() => {
      setLoading(false);
    }, 800);

    return () => {
      clearInterval(interval);
      clearInterval(intervalCalculateTime);
      clearTimeout(LoaderTimer);
    };
  }, []);

  return (
    <div
      className="App"
      style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}
    >
      {loading ? (
        <Loader />
      ) : (
        <>
          <div className="header-container">
            <div className="time-label">Date: {currentDate.replaceAll("/", "-")}</div>

            <div className="card-hours-container responsible-flex">
              <div>
                {customWorkingHours.visible ? (
                  <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                    {customWorkingHours.error && (
                      <div class="tooltip">
                        <span class="tooltip-text">Invalid Format(Must be in "HH:mm")</span>
                      </div>
                    )}
                    <input
                      type="text"
                      placeholder="HH:mm"
                      value={customWorkingHours.time}
                      onChange={handleCustomWorkingHours}
                      className="time-select-text"
                    />
                    <button
                      className="add"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        backgroundColor: "#e1e9f4",
                        margin: 0,
                        height: "35px",
                      }}
                      onClick={() => {
                        handleAddCustomTime(customWorkingHours);
                      }}
                    >
                      <FaPlus color="#0085ca" />
                    </button>
                    <button
                      className="remove"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        backgroundColor: "#ffe2e2",
                        margin: 0,
                        height: "35px",
                      }}
                      onClick={() => {
                        handleRemoveCustomTime(customWorkingHours);
                      }}
                    >
                      <IoCloseCircle size={20} color="#e0364e" />
                    </button>
                  </div>
                ) : (
                  <button
                    className="add-more-card"
                    style={{ height: "35px !important" }}
                    onClick={() => {
                      setCustomWorkingHours({ visible: true });
                    }}
                  >
                    <FaPlus color="#0085ca" style={{ marginRight: "5px" }} /> Custom Working hours
                  </button>
                )}
              </div>

              <select
                value={dayType}
                onChange={handleDayChange}
                className="time-select"
                placeholder="Select an option"
                style={{ width: "200px !important" }}
              >
                {dayOptions?.map((op) => {
                  return (
                    <option key={`${op.key}_${op.value}`} value={op.value}>
                      {op.key}
                    </option>
                  );
                })}
              </select>

              <div>
                <button
                  className="add-more-card"
                  style={{ height: "35px !important" }}
                  onClick={() => addMoreCard(times)}
                >
                  <FaPlus color="#0085ca" style={{ marginRight: "5px" }} /> Add More Cards
                </button>
              </div>
            </div>
          </div>
          <div className="timesheet-container">
            {Object.entries(times).map(([key, value], i) => {
              let isDisabled = isFieldEnabled(key);
              const keyIncludesOut = key.includes("out");
              const showDeleteButton = i + 1 === Object.keys(times)?.length && keyIncludesOut;
              return (
                <div
                  className={`time-box ${isDisabled ? "disabled_box" : ""} ${
                    missingFields[key] ? "missing-field" : ""
                  }`}
                  style={{ position: "relative" }}
                  key={i}
                >
                  {i > 11 && showDeleteButton && (
                    <div
                      title="Remove card pair"
                      style={{ position: "absolute", top: "0.5rem" }}
                      className="remove-card"
                      onClick={() => removeCard(times, key)}
                    >
                      <RxCross2 />
                    </div>
                  )}

                  <div>
                    <h3 style={{ margin: "0px", marginBottom: "0.5rem" }}>
                      {transformTimeLabel(key)}
                    </h3>
                    <input
                      type="time"
                      name={key}
                      value={value}
                      max={getCurrentHoursMinutes()}
                      onChange={handleInputChange}
                      disabled={isDisabled}
                    />
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "center",
                        gap: "10px",
                        backgroundColor: "transparent",
                      }}
                    >
                      <button
                        title="Add current time"
                        className="add"
                        style={{
                          display: "flex",
                          alignItems: "center",
                          backgroundColor: "#e1e9f4",
                        }}
                        onClick={() => addCurrentTime(key)}
                        disabled={isDisabled}
                      >
                        <FaPlus color="#0085ca" style={{ marginRight: "5px" }} /> Add
                      </button>
                      <button
                        title="Remove current card time"
                        className="remove"
                        style={{
                          display: "flex",
                          alignItems: "center",
                          backgroundColor: "#ffe2e2",
                        }}
                        onClick={() => handleClear(key)}
                        disabled={isDisabled}
                      >
                        <FaTrashAlt color="#e0364e" style={{ marginRight: "5px" }} /> Clear
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="time-summary-layout">
            {/* LEFT GROUP */}
            <div className="summary-panel">
              <div className="panel-title">Work Time Summary</div>

              <div className="summary-values" style={{ marginBottom: "20px" }}>
                <div className="summary-item">
                  <span>Total Time</span>
                  <strong className={timeIsCompleted ? "done" : ""}>
                    {totalTime
                      ? `${String(Math.floor(totalTime / 60)).padStart(2, "0")}:${String(
                          totalTime % 60
                        ).padStart(2, "0")}`
                      : "00:00"}
                  </strong>
                </div>

                <div className="summary-item">
                  <span>Finish At</span>
                  <strong
                    style={{
                      textDecoration: getLastEntryType(times) === "out" ? "line-through" : "none",
                    }}
                  >
                    {endTime !== "00:00"
                      ? new Date(
                          2024,
                          1,
                          1,
                          Number(endTime.split(":")[0]),
                          Number(endTime.split(":")[1])
                        ).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                      : "--"}
                  </strong>
                </div>
              </div>

              <div className="summary-actions">
                <button
                  onClick={() => calculateTotalTime(times, dayType)}
                  style={{ background: "#2563eb", color: "#fff" }}
                >
                  Calculate
                </button>
                <button
                  className="danger"
                  onClick={() => {
                    if (confirm("Would you like to clear it?")) clearLocalStorage();
                  }}
                >
                  Clear
                </button>
              </div>
            </div>

            {/* RIGHT GROUP */}
            <div className="completed-panel">
              <div className="panel-title">Completed Working Hours</div>
              <div className="summary-values" style={{ marginBottom: "10px" }}>
                {/* Completed Duration Input */}
                <div className="summary-item">
                  <span>Completed Duration</span>
                  <input
                    type="text"
                    placeholder="HH:mm"
                    value={completedDuration}
                    onChange={handleCompletedDurationChange}
                    maxLength="5"
                    style={{
                      fontSize: "34px",
                      textAlign: "center",
                      fontWeight: "800",
                      color: completedError ? "#ef4444" : "#2563eb",
                      border: "none",
                      outline: "none",
                      background: "transparent",
                      padding: "0",
                      lineHeight: "1.2",
                    }}
                  />
                </div>
                {/* Finish At display */}
                <div className="summary-item">
                  <span>Finish At</span>
                  <strong style={{ color: "#2563eb", fontSize: "34px", fontWeight: 800 }}>
                    {completedError || !remainingFinishTime ? "--" : remainingFinishTime}
                  </strong>
                </div>
              </div>

              {completedError && (
                <div className="error-text" style={{ marginTop: "-20px", marginBottom: "10px" }}>
                  Invalid format. Use HH:mm or HH:mm:ss
                </div>
              )}

              <div className="summary-actions">
                <button
                  onClick={calculateRemainingFinishTime}
                  style={{ background: "#2563eb", color: "#fff" }}
                >
                  Calculate
                </button>
                <button
                  className="danger"
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
        </>
      )}
    </div>
  );
}

export default App;
