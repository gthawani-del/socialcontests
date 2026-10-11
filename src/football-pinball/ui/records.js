const key = (mode) => `football-records-${mode}-v1`;
export function readRecords(mode) {
  try {
    return JSON.parse(localStorage.getItem(key(mode)) || "[]")
      .filter((v) => Number.isSafeInteger(v.points) && v.points >= 0)
      .slice(0, 5);
  } catch {
    return [];
  }
}
export function saveRecord(mode, points) {
  if (!Number.isSafeInteger(points) || points < 0) return [];
  const records = [
    ...readRecords(mode),
    { points, at: new Date().toISOString() },
  ]
    .sort((a, b) => b.points - a.points)
    .slice(0, 5);
  try {
    localStorage.setItem(key(mode), JSON.stringify(records));
  } catch {}
  return records;
}
export function renderRecords(root, mode) {
  const records = readRecords(mode);
  if (!records.length) return;
  const section = document.createElement("section");
  section.className = "fp-records";
  const heading = document.createElement("h3");
  heading.textContent = "High scores on this device";
  section.append(heading);
  const list = document.createElement("ol");
  for (const record of records) {
    const li = document.createElement("li");
    li.textContent = `${record.points.toLocaleString()} points · ${new Date(record.at).toLocaleDateString()}`;
    list.append(li);
  }
  section.append(list);
  root.append(section);
}
