export const baseNav = [
  { label: "Wetter", path: "/" },
  { label: "+   🐠", path: "/new-catch" },
  { label: "Fangliste", path: "/catches" },
  { label: "Rangliste", path: "/leaderboard" },
  { label: "Regeln", path: "/regeln" },
  {
    label: "Statistik",
    children: [
      { label: "Analyse", path: "/analysis" },
      { label: "Top 10", path: "/top-fishes" },
      { label: "Fun-Facts", path: "/fun" },
      { label: "Prognose", path: "/forecast" },
      { label: "Kalender", path: "/calendar" },
      { label: "Karte", path: "/map" },
    ],
  },
];

export function navItemsFor({ isAdmin = false, canAccessBoard = false } = {}) {
  const items = [...baseNav];
  if (canAccessBoard) {
    items.push({ label: "👥 Vorstand", path: "/vorstand" });
  }
  if (isAdmin) items.push({ label: "🔧 Admin", path: "/admin" });
  return items;
}
