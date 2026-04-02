const cardsContainer = document.getElementById("cardsContainer");
const totalTimeEl = document.getElementById("totalTime");
const punchFinishTimeEl = document.getElementById("punchFinishTime");
const completedInput = document.getElementById("completedDuration");
const finishTimeEl = document.getElementById("finishTime");
const dayTypeSelect = document.getElementById("dayType");
const modePunchBtn = document.getElementById("modePunch");
const modeNetBtn = document.getElementById("modeNet");
const summaryPanel = document.querySelector(".summary-panel");
const completedPanel = document.querySelector(".completed-panel");
const pageNote = document.getElementById("pageNote");

let currentData = {};
let currentMode = "net"; // 'punch' or 'net'
let lastCheckedTime = null;

function createCard(index, inVal, outVal) {
  const div = document.createElement("div");
  div.className = "card";

  const inLabel = document.createElement("label");
  inLabel.textContent = `In ${index}`;

  const inInput = document.createElement("input");
  inInput.type = "time";
  inInput.value = inVal || "";
  inInput.dataset.key = `in${index}`;

  const outLabel = document.createElement("label");
  outLabel.textContent = `Out ${index}`;

  const outInput = document.createElement("input");
  outInput.type = "time";
  outInput.value = outVal || "";
  outInput.dataset.key = `out${index}`;

  div.appendChild(inLabel);
  div.appendChild(inInput);
  div.appendChild(outLabel);
  div.appendChild(outInput);

  cardsContainer.appendChild(div);
}

function renderCards(data) {
  cardsContainer.replaceChildren();

  const pairs = Object.keys(data).length / 2;

  for (let i = 1; i <= pairs; i++) {
    createCard(i, data[`in${i}`], data[`out${i}`]);
  }
}

function calculate() {
  const totalMinutes = calculateTotalMinutes(currentData);
  totalTimeEl.textContent = formatMinutes(totalMinutes);

  // Predict finish time based on current punches & selected day type
  const finishFromPunch = calculateFinishTime(
    Number(dayTypeSelect.value),
    formatMinutes(totalMinutes)
  );
  punchFinishTimeEl.textContent = finishFromPunch;
}

function handleCalculateClick() {
  calculate();

  if (completedInput.value) {
    finishTimeEl.textContent = calculateFinishTime(
      Number(dayTypeSelect.value),
      completedInput.value
    );
  }
}

chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  chrome.tabs.sendMessage(tabs[0].id, { type: "GET_ALL_DATA" }, (response) => {
    if (chrome.runtime.lastError || !response) {
      if (pageNote) {
        pageNote.textContent = "You are not on the supported timesheet page.";
        pageNote.classList.remove("hidden");
      }
      cardsContainer.classList.add("hidden");
      summaryPanel.classList.add("hidden");
      completedPanel.classList.add("hidden");
      return;
    }

    currentData = response.punchData || {};
    const hasPunch = currentData && Object.keys(currentData).length > 0;
    const hasNet = !!response.netHours;

    if (!hasPunch && !hasNet) {
      if (pageNote) {
        pageNote.textContent = "No time data found on this page.";
        pageNote.classList.remove("hidden");
      }
      cardsContainer.classList.add("hidden");
      summaryPanel.classList.add("hidden");
      completedPanel.classList.add("hidden");
      return;
    }

    if (pageNote) {
      pageNote.classList.add("hidden");
    }

    if (hasPunch) {
      renderCards(currentData);
      summaryPanel.classList.remove("hidden");
    } else {
      cardsContainer.classList.add("hidden");
      summaryPanel.classList.add("hidden");
    }

    if (hasNet) {
      completedInput.value = response.netHours;
      completedPanel.classList.remove("hidden");
    } else {
      completedPanel.classList.add("hidden");
    }

    handleCalculateClick();

    // Auto-recalculate once per minute (based on HH:mm)
    setInterval(() => {
      const now = new Date();
      const hours = String(now.getHours()).padStart(2, "0");
      const minutes = String(now.getMinutes()).padStart(2, "0");
      const current = `${hours}:${minutes}`;

      if (current !== lastCheckedTime) {
        lastCheckedTime = current;
        handleCalculateClick();
      }
    }, 1000);
  });
});

function setMode(mode) {
  currentMode = mode;

  if (mode === "punch") {
    modePunchBtn.classList.add("active");
    modeNetBtn.classList.remove("active");
    cardsContainer.classList.remove("hidden");
    summaryPanel.classList.remove("hidden");
    completedPanel.classList.add("hidden");
  } else {
    modePunchBtn.classList.remove("active");
    modeNetBtn.classList.add("active");
    cardsContainer.classList.add("hidden");
    summaryPanel.classList.add("hidden");
    completedPanel.classList.remove("hidden");
  }
}

modePunchBtn.addEventListener("click", () => setMode("punch"));
modeNetBtn.addEventListener("click", () => setMode("net"));

// default view
setMode("net");
