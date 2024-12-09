import React, { useState, useEffect } from "react";
import { FaPlus, FaTrashAlt } from "react-icons/fa"; // Import the icons
import "./styles.css";

function App() {
  const [times, setTimes] = useState({
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
  });
  const [totalTime, setTotalTime] = useState("00:00");
  const [totalUpToLastInTime, setTotalUpToLastInTime] = useState("00:00");
  const [endTime, setEndTime] = useState("00:00");
  const [currentDate, setCurrentDate] = useState(new Date().toLocaleDateString());
  const [leaveType, setLeaveType] = useState("");
  const [missingFields, setMissingFields] = useState({});
  const [totalTimeMet, setTotalTimeMet] = useState(false);
  const [currentTime, setCurrentTime] = useState("00:00");

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

  const handleDayChange = (event) => {
    setLeaveType(event.target.value);
    localStorage.setItem("leaveType", event.target.value);
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

  const getLastInTime = (times) => {
    const lastInKey = Object.keys(times)
      .reverse()
      .find((key) => key.startsWith("in") && times[key] !== "");

    return lastInKey ? times[lastInKey] : null;
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

  const calculateDurationFromLastIn = (times, lastTimeTotal) => {
    const lastEntryType = getLastEntryType(times);
    const lastTotalUpToLastInTime = lastTimeTotal ? lastTimeTotal : totalUpToLastInTime;

    if (lastEntryType === "in") {
      const lastInTime = getLastInTime(times);

      if (lastInTime) {
        const [lastInHours, lastInMinutes] = lastInTime.split(":").map(Number);
        const lastInDate = new Date();
        lastInDate.setHours(lastInHours, lastInMinutes, 0, 0);

        const now = new Date();
        const diffMs = now - lastInDate;
        const diffMins = Math.floor(diffMs / 60000);

        const [prevHours, prevMinutes] = lastTotalUpToLastInTime.split(":").map(Number);

        const newTotalMinutes = prevHours * 60 + prevMinutes + diffMins;
        const newHours = Math.floor(newTotalMinutes / 60);
        const newMinutes = newTotalMinutes % 60;

        setTotalTime(
          `${newHours.toString().padStart(2, "0")}:${newMinutes.toString().padStart(2, "0")}`
        );
      } else {
        setTotalTime("00:00");
      }
    }
  };

  // Function to find the last recorded time from the "Out" or "In" times
  function findLastRecordedTime(times) {
    const allTimes = [];

    // Collect all non-empty times
    Object.keys(times).forEach((key) => {
      if (times[key] && times[key].trim() !== "--:--") {
        allTimes.push(times[key]);
      }
    });

    // Convert to date objects for easy comparison
    const sortedTimes = allTimes
      .map((time) => {
        const [hours, minutes] = time.split(":").map(Number);
        return new Date(2024, 0, 1, hours, minutes); // Use a placeholder date
      })
      .sort((a, b) => a - b); // Sort by time

    // Return the latest time in HH:MM format
    const lastTime = sortedTimes[sortedTimes.length - 1];
    return lastTime
      ? `${lastTime.getHours().toString().padStart(2, "0")}:${lastTime
          .getMinutes()
          .toString()
          .padStart(2, "0")}`
      : null; // Return null if no valid times
  }

  const calculateTotalTime = (times) => {
    let totalMinutes = 0;
    const newMissingFields = {}; // Track missing fields

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
      }
      // else if (inTime || outTime) {
      //   newMissingFields[`in${i}`] = !inTime;
      //   newMissingFields[`out${i}`] = !outTime;
      // }
      else if (inTime && !outTime) {
        newMissingFields[`out${i}`] = true; // Missing outTime for the corresponding inTime
      } else if (!inTime && outTime) {
        // Highlight only if there is no valid preceding pair
        const prevOutTime = times[`out${i - 1}`];
        if (!prevOutTime) {
          newMissingFields[`in${i}`] = true; // Missing inTime for the corresponding outTime
        }
      }
    }
    setMissingFields(newMissingFields); // Update state with missing fields

    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    const lastEntryType = getLastEntryType(times);
    const newTime = `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
    if (lastEntryType === "out") {
      setTotalUpToLastInTime(newTime);
      setTotalTime(newTime);
    } else {
      calculateDurationFromLastIn(times, newTime);
    }
    let totalRequiredMinutes;
    if (leaveType == "earlyLeave") {
      totalRequiredMinutes = 6 * 60 + 23;
    } else if (leaveType == "halfDay") {
      totalRequiredMinutes = 4 * 60 + 15;
    } else {
      totalRequiredMinutes = 8 * 60 + 30;
    }

    // Determine if the total time meets the required time
    const meetsRequirement = totalMinutes >= totalRequiredMinutes;
    setTotalTimeMet(meetsRequirement);

    const remainingMinutes = totalRequiredMinutes - totalMinutes;
    const lastRecordedTime = findLastRecordedTime(times);

    if (!lastRecordedTime) {
      const currentTime = new Date();

      // Calculate end time by adding the required minutes based on leave type
      let endDate = new Date(currentTime.getTime() + remainingMinutes * 60000); // Add remaining minutes in milliseconds

      // Get the hours and minutes from the end date
      const endHours = endDate.getHours().toString().padStart(2, "0");
      const endMinutes = endDate.getMinutes().toString().padStart(2, "0");

      // Set the end time based on the calculated time
      setEndTime(`${endHours}:${endMinutes}`);

      setTotalTime(
        `${Math.floor(totalMinutes / 60)
          .toString()
          .padStart(2, "0")}:${(totalMinutes % 60).toString().padStart(2, "0")}`
      );
    }

    if (remainingMinutes > 0 && lastRecordedTime) {
      const [lastHours, lastMinutes] = lastRecordedTime.split(":").map(Number);
      const lastTotalMinutes = lastHours * 60 + lastMinutes;

      // Add remaining minutes to the last recorded time
      const endTotalMinutes = lastTotalMinutes + remainingMinutes;
      const endHours = Math.floor(endTotalMinutes / 60);
      const endMinutes = endTotalMinutes % 60;

      setEndTime(
        `${endHours.toString().padStart(2, "0")}:${endMinutes.toString().padStart(2, "0")}`
      );
      setTotalTime(
        `${Math.floor(totalMinutes / 60)
          .toString()
          .padStart(2, "0")}:${(totalMinutes % 60).toString().padStart(2, "0")}`
      );
    } else {
      // If total required time is already met
      setTotalTime(
        `${Math.floor(totalMinutes / 60)
          .toString()
          .padStart(2, "0")}:${(totalMinutes % 60).toString().padStart(2, "0")}`
      );
    }

    // OLD CODE
    // if (remainingMinutes) {
    //   const lastInTime = getLastInTime(times);

    //   if (lastInTime) {
    //     const [lastInHours, lastInMinutes] = lastInTime.split(":").map(Number);
    //     const lastInTotalMinutes = lastInHours * 60 + lastInMinutes;

    //     const endTotalMinutes = lastInTotalMinutes + remainingMinutes;
    //     const endHours = Math.floor(endTotalMinutes / 60);
    //     const endMinutes = endTotalMinutes % 60;

    //     setEndTime(
    //       `${endHours.toString().padStart(2, "0")}:${endMinutes.toString().padStart(2, "0")}`
    //     );
    //   } else {
    //     console.error("Invalid format for lastInTime. Unable to calculate end time.");
    //     setTotalTime("00:00")
    //     setEndTime("00:00"); // Default or fallback value for endTime
    //   }
    // }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    const tempTime = { ...times, [name]: value };
    setTimes(tempTime);
    calculateTotalTime(tempTime);
    localStorage.setItem("times", JSON.stringify(tempTime));
  };

  const handleTimeClick = (name) => {
    const now = new Date();
    const hours = now.getHours().toString().padStart(2, "0");
    const minutes = now.getMinutes().toString().padStart(2, "0");
    const currentTime = `${hours}:${minutes}`;
    const tempTime = { ...times, [name]: currentTime };
    setTimes(tempTime);
    calculateTotalTime(tempTime);
    localStorage.setItem("times", JSON.stringify(tempTime));
  };

  const handleClear = (name) => {
    const tempTime = { ...times, [name]: "" };
    setTimes(tempTime);
    calculateTotalTime(tempTime);
    localStorage.setItem("times", JSON.stringify(tempTime));
  };

  const clearLocalStorage = () => {
    localStorage.removeItem("times");
    setTimes({
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
    });
    setEndTime("");
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

  useEffect(() => {
    const interval = setInterval(() => {
      const chm = getCurrentHoursMinutes();
      if (chm != currentTime) {
        calculateDurationFromLastIn(times, null);
        setCurrentTime(chm);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [times]);

  useEffect(() => {
    calculateTotalTime(times);
  }, [times]);

  useEffect(() => {
    calculateTotalTime(times);
  }, [leaveType]);

  useEffect(() => {
    const storedTimes = localStorage.getItem("times");
    const storedDate = localStorage.getItem("currentDate");
    const today = new Date().toLocaleDateString();
    setLeaveType(localStorage.getItem("leaveType"));

    if (storedDate === today) {
      if (storedTimes) {
        setTimes(JSON.parse(storedTimes));
        calculateTotalTime(JSON.parse(storedTimes));
      }
    } else {
      clearLocalStorage();
      localStorage.setItem("currentDate", today);
      setCurrentDate(today);
    }
    const interval = setInterval(() => {
      resetTimesIfNewDay();
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div
      className="App"
      style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}
    >
      <div className="dropdown-container">
        <div className="time-label">Date: {currentDate}</div>

        <select
          value={leaveType}
          onChange={handleDayChange}
          className="time-select"
          placeholder="Select an option"
        >
          <option value="">Full Day</option>
          <option value="halfDay">Half Day</option>
          <option value="earlyLeave">Early Leave</option>
        </select>
      </div>

      <div className="timesheet-container">
        {Object.entries(times).map(([key, value], i) => {
          let isDisabled = isFieldEnabled(key);
          return (
            <div
              className={`time-box ${isDisabled ? "disabled_box" : ""} ${
                missingFields[key] ? "missing-field" : ""
              }`}
              key={i}
              style={
                {
                  // backgroundColor: colors[i % colors.length]
                }
              } // Assign colors in a loop
            >
              <h3 style={{ margin: "0px", marginBottom: "0.5rem" }}>{transformTimeLabel(key)}</h3>
              <input
                type="time"
                name={key}
                value={value}
                onChange={handleChange}
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
                  className="add"
                  style={{ display: "flex", alignItems: "center", backgroundColor: "#e1e9f4" }}
                  onClick={() => handleTimeClick(key)}
                  disabled={isDisabled}
                >
                  <FaPlus color="#0085ca" style={{ marginRight: "5px" }} /> Add
                </button>
                <button
                  className="remove"
                  style={{ display: "flex", alignItems: "center", backgroundColor: "#ffe2e2" }}
                  onClick={() => handleClear(key)}
                  disabled={isDisabled}
                >
                  <FaTrashAlt color="#e0364e" style={{ marginRight: "5px" }} /> Clear
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="time-selection-container">
        <div className="time-item">
          <div className="time-label">Total Time</div>
          <div className={`time-value ${totalTimeMet ? "time-value-green" : ""}`}>
            {totalTime ? totalTime : "00:00"}
          </div>
        </div>
        <div className="time-item">
          <div className="time-label">Time Finish On</div>
          <div className="time-value">
            {endTime && endTime.includes(":")
              ? new Date(2024, 0, 1, ...endTime.split(":").map(Number)).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "00:00"}
          </div>
        </div>

        <div className="button-container">
          <button className="calculate-btn" onClick={() => calculateTotalTime(times)}>
            Calculate Total Time
          </button>
          <button className="clear-btn" onClick={clearLocalStorage}>
            Clear Time
          </button>
        </div>
      </div>
    </div>
  );
}

export default App;
