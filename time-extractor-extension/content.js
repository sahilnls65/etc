function extractPunchData() {
  const rows = document.querySelectorAll(".MuiTableBody-root tr");
  const extracted = [];

  rows.forEach((row) => {
    const cells = row.querySelectorAll("td");
    if (cells.length < 4) return;

    extracted.push({
      in: cells[1]?.innerText.trim() !== "--" ? cells[1]?.innerText.trim() : "",
      out: cells[2]?.innerText.trim() !== "--" ? cells[2]?.innerText.trim() : "",
    });
  });

  const ordered = extracted.reverse();

  const formatted = {};

  ordered.forEach((item, index) => {
    const i = index + 1;
    formatted[`in${i}`] = item.in || "";
    formatted[`out${i}`] = item.out || "";
  });

  return formatted;
}

function extractNetHours() {
  const target = [...document.querySelectorAll("p")]
    .map((p) => p.textContent.trim())
    .find((text) => text.includes("Net Hours"));

  if (!target) return null;

  const match = target.match(/\d{2}:\d{2}:\d{2}/);
  if (!match) return null;

  const [h, m] = match[0].split(":");
  return `${h}:${m}`;
}

chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {
  if (req.type === "GET_ALL_DATA") {
    sendResponse({
      punchData: extractPunchData(),
      netHours: extractNetHours(),
    });
  }
});
