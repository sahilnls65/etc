function calculateTotalMinutes(data) {
  let total = 0;
  let lastInKey = null;

  // Sum completed in/out ranges
  Object.keys(data).forEach((key) => {
    if (key.startsWith("in")) {
      const index = key.replace("in", "");
      const inTime = data[`in${index}`];
      const outTime = data[`out${index}`];

      if (inTime && outTime) {
        const [inH, inM] = inTime.split(":").map(Number);
        const [outH, outM] = outTime.split(":").map(Number);

        const inMinutes = inH * 60 + inM;
        const outMinutes = outH * 60 + outM;

        if (outMinutes > inMinutes) {
          total += outMinutes - inMinutes;
        }
      } else if (inTime && !outTime) {
        // Track latest open "in" punch
        lastInKey = `in${index}`;
      }
    }
  });

  // If last punch is an "in" without matching "out",
  // add time from that punch until now (like your React app).
  if (lastInKey) {
    const inTime = data[lastInKey];
    if (inTime) {
      const [inH, inM] = inTime.split(":").map(Number);
      const inMinutes = inH * 60 + inM;

      const now = new Date();
      const nowMinutes = now.getHours() * 60 + now.getMinutes();

      if (nowMinutes > inMinutes) {
        total += nowMinutes - inMinutes;
      }
    }
  }

  return total;
}

function formatMinutes(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function calculateFinishTime(dayType, completed) {
  const [h, m] = completed.split(":").map(Number);
  const completedMinutes = h * 60 + m;
  const remaining = dayType - completedMinutes;

  if (remaining <= 0) return "Completed 🎉";

  const now = new Date();
  const finish = new Date(now.getTime() + remaining * 60000);

  return finish.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}
