// src/achievements/localRemember.js
const KEY = "triggered_achievements_v1";

function load() {
  try { return JSON.parse(localStorage.getItem(KEY) || "{}"); } catch { return {}; }
}
function save(obj) { localStorage.setItem(KEY, JSON.stringify(obj)); }

export const localRemember = {
  async has(achId, catchId) {
    const data = load();
    const key = `${achId}::${catchId ?? "unknown"}`;
    return !!data[key];
  },
  async add(achId, catchId) {
    const data = load();
    const key = `${achId}::${catchId ?? "unknown"}`;
    data[key] = true;
    save(data);
  },
};
