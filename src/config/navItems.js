export const baseNav = [
  { label: "Wetter", path: "/" },
  { label: "+   🐠", path: "/new-catch" },
  // Krebsformular wird gezielt in navItemsFor ergänzt (nur für Nicol)
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

export function navItemsFor({ isAdmin = false, canAccessBoard = false, anglerName = '' } = {}) {
  const items = [...baseNav];

  // Krebsformular für Vorstand sowie Admins
  const canSeeCrayfishForm = canAccessBoard || isAdmin;
  if (canSeeCrayfishForm) {
    items.splice(2, 0, { label: "+   🦞", path: "/crayfish" });
  }

  items.push({ label: "Downloads", path: "/downloads" });
  if (canAccessBoard) {
    items.push({ label: "👥 Vorstand", path: "/vorstand" });
  }
  return items;
}
