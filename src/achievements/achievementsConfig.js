// src/achievements/achievementsConfig.js

/**
 * Robuste Zählfunktion über Supabase-Header-Count.
 * filters: Array von [key, op, value] mit op ∈ {eq, gte, lte, lt, gt}
 */
export async function getCount(supabase, table, filters = []) {
  let query = supabase.from(table).select("id", { count: "exact", head: true });
  for (const [key, op, val] of filters) {
    if (op === "eq")  query = query.eq(key, val);
    if (op === "gte") query = query.gte(key, val);
    if (op === "lte") query = query.lte(key, val);
    if (op === "lt")  query = query.lt(key, val);
    if (op === "gt")  query = query.gt(key, val);
  }
  const { count, error } = await query;
  if (error) return { count: 0, error };
  return { count: count ?? 0, error: null };
}

/**
 * Liefert Start/Ende des lokalen Kalendertags in Europe/Berlin als UTC-ISO.
 * So stimmen Tages-Achievements trotz UTC-Speicherung in der DB.
 */
function dayBoundsEuropeBerlinUTC(tsISO, offsetDays = 0) {
  const d = tsISO ? new Date(tsISO) : new Date();

  // Datumsteile in Europe/Berlin extrahieren
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("de-DE", {
      timeZone: "Europe/Berlin",
      year: "numeric", month: "2-digit", day: "2-digit",
    })
    .formatToParts(d)
    .map(p => [p.type, p.value])
  );

  const y = Number(parts.year);
  const m = Number(parts.month) - 1; // 0-based
  const day = Number(parts.day);

  // 00:00:00 und 23:59:59.999 des Berlin-Tags als UTC konstruieren
  const startDate = new Date(Date.UTC(y, m, day, 0, 0, 0, 0));
  const endDate = new Date(Date.UTC(y, m, day, 23, 59, 59, 999));

  if (offsetDays !== 0) {
    startDate.setUTCDate(startDate.getUTCDate() + offsetDays);
    endDate.setUTCDate(endDate.getUTCDate() + offsetDays);
  }

  const startUTC = startDate.toISOString();
  const endUTC = endDate.toISOString();
  return { startUTC, endUTC };
}

const normalizeName = (name) => (name || '').trim();

export const achievements = [
  // ========= Zähl-Meilensteine (nutzen needsCount -> Hook übernimmt die Zählung) =========
  {
    id: "fish_10",
    title: "10 Fische!",
    message: "Stark! Du hast deinen 10. Fisch gefangen 🎉",
    icon: "🐟",
    // ❌ keine eigene check-Funktion nötig; wir zählen über needsCount:
    needsCount: {
      table: "fishes",
      threshold: 10,
      filters: ({ lastCatch }) => {
        const name = normalizeName(lastCatch?.angler);
        if (!name) return [];
        return [["angler", "eq", name]];
      },
    },
  },
  {
    id: "fish_50",
    title: "50 Fische!",
    message: "Maschine! 50 Fänge sind im Sack 💪",
    icon: "🏆",
    needsCount: {
      table: "fishes",
      threshold: 50,
      filters: ({ lastCatch }) => {
        const name = normalizeName(lastCatch?.angler);
        if (!name) return [];
        return [["angler", "eq", name]];
      },
    },
  },
  {
    id: "fish_100",
    title: "100 Fische!!!",
    message: "Legendär! 100 Fänge – Applaus! 👑",
    icon: "👑",
    needsCount: {
      table: "fishes",
      threshold: 100,
      filters: ({ lastCatch }) => {
        const name = normalizeName(lastCatch?.angler);
        if (!name) return [];
        return [["angler", "eq", name]];
      },
    },
  },

  // ========= Erste gefangene Art (pro User) =========
  {
    id: "first_species",
    title: "Neue Art!",
    message: (ctx) => `Erster ${ctx?.fish} in deiner Liste – weiter so! 🌟`,
    icon: "🧭",
    check: async ({ supabase, lastCatch }) => {
      const name = normalizeName(lastCatch?.angler);
      if (!name || !lastCatch?.fish) return false;
      const { count } = await getCount(supabase, "fishes", [
        ["angler", "eq", name],
        ["fish", "eq", lastCatch.fish],
      ]);
      // Wenn der aktuelle Insert schon drin ist, ist es genau dann die erste Art, wenn count === 1
      return count === 1;
    },
  },

  // ========= Persönliche Bestlänge je Fischart =========
  {
    id: "personal_best_species",
    title: "Persönliche Bestlänge!",
    message: (ctx) => `Neuer Rekord ${ctx?.fish}: ${ctx?.size} cm! 🚀`,
    icon: "📏",
    check: async ({ supabase, lastCatch }) => {
      const name = normalizeName(lastCatch?.angler);
      if (!name || !lastCatch?.fish || !lastCatch?.size || !lastCatch?.timestamp) return false;

      // Bisheriger persönlicher Rekord (nur frühere Fänge, gleiche Art)
      const { data: prev, error } = await supabase
        .from("fishes")
        .select("size")
        .eq("angler", name)
        .eq("fish", lastCatch.fish)
        .lt("timestamp", lastCatch.timestamp)   // nur frühere
        .order("size", { ascending: false })
        .limit(1);

      if (error) return false;

      const prevMax = prev?.[0]?.size ?? null;
      const cur = parseFloat(lastCatch.size);
      return prevMax === null ? true : cur > parseFloat(prevMax); // streng größer
    },
  },

  // ========= Erster Fang des Tages (vereinsweit) =========
  {
    id: "first_catch_today",
    title: "Tagesstarter!",
    message: "Erster Fang des Tages im Verein – du hast den Anfang gemacht! ⏰",
    icon: "🌅",
    check: async ({ supabase, lastCatch }) => {
      if (!lastCatch?.timestamp) return false;
      const { startUTC, endUTC } = dayBoundsEuropeBerlinUTC(lastCatch.timestamp);
      const { count } = await getCount(supabase, "fishes", [
        ["timestamp", "gte", startUTC],
        ["timestamp", "lte", endUTC],
      ]);
      // Falls der aktuelle Insert gespeichert ist, ist #1 des Tages genau count === 1
      return count === 1;
    },
  },

  // ========= Drei Arten an einem Tag =========
  {
    id: "multi_species_day_3",
    title: "Artenjäger!",
    message: "Drei verschiedene Fischarten an einem Tag – starke Vielfalt! 🐠",
    icon: "🎯",
    check: async ({ supabase, lastCatch }) => {
      const name = normalizeName(lastCatch?.angler);
      if (!name || !lastCatch?.timestamp) return false;

      const { startUTC, endUTC } = dayBoundsEuropeBerlinUTC(lastCatch.timestamp);
      const { data, error } = await supabase
        .from("fishes")
        .select("fish")
        .eq("angler", name)
        .gte("timestamp", startUTC)
        .lte("timestamp", endUTC);

      if (error || !Array.isArray(data)) return false;
      const speciesCount = new Set(
        data
          .map((row) => row?.fish)
          .filter((fish) => typeof fish === "string" && fish.trim().length > 0)
      ).size;

      // Exakt beim dritten unterschiedlichen Fisch auslösen, damit der Toast nicht mehrfach erscheint.
      return speciesCount === 3;
    },
  },

  // ========= Tagesfang-Mengen =========
  {
    id: "daily_catch_3",
    title: "Dreierpack!",
    message: "Heute schon drei Fische im Kescher – läuft bei dir! 🎣",
    icon: "🥉",
    needsCount: {
      table: "fishes",
      threshold: 3,
      filters: ({ lastCatch }) => {
        const name = normalizeName(lastCatch?.angler);
        if (!name || !lastCatch?.timestamp) return [];
        const { startUTC, endUTC } = dayBoundsEuropeBerlinUTC(lastCatch.timestamp);
        return [
          ["angler", "eq", name],
          ["timestamp", "gte", startUTC],
          ["timestamp", "lte", endUTC],
        ];
      },
    },
  },
  {
    id: "daily_catch_5",
    title: "Fünfer-Serie!",
    message: "Fünf Fische an einem Tag – du bist im Flow! ⚡️",
    icon: "🥈",
    needsCount: {
      table: "fishes",
      threshold: 5,
      filters: ({ lastCatch }) => {
        const name = normalizeName(lastCatch?.angler);
        if (!name || !lastCatch?.timestamp) return [];
        const { startUTC, endUTC } = dayBoundsEuropeBerlinUTC(lastCatch.timestamp);
        return [
          ["angler", "eq", name],
          ["timestamp", "gte", startUTC],
          ["timestamp", "lte", endUTC],
        ];
      },
    },
  },
  {
    id: "daily_catch_10",
    title: "Zweistellig!",
    message: "Zehn Tagesfänge – was für ein Angeltag! 🏅",
    icon: "🥇",
    needsCount: {
      table: "fishes",
      threshold: 10,
      filters: ({ lastCatch }) => {
        const name = normalizeName(lastCatch?.angler);
        if (!name || !lastCatch?.timestamp) return [];
        const { startUTC, endUTC } = dayBoundsEuropeBerlinUTC(lastCatch.timestamp);
        return [
          ["angler", "eq", name],
          ["timestamp", "gte", startUTC],
          ["timestamp", "lte", endUTC],
        ];
      },
    },
  },

  // ========= Fangserie (5 Tage in Folge) =========
  {
    id: "streak_5_days",
    title: "Serienmeister!",
    message: "Fünf Fangtage in Folge – konsequent durchgezogen! 🔥",
    icon: "📆",
    check: async ({ supabase, lastCatch }) => {
      const name = normalizeName(lastCatch?.angler);
      if (!name || !lastCatch?.timestamp) return false;

      for (let offset = 0; offset < 5; offset += 1) {
        const { startUTC, endUTC } = dayBoundsEuropeBerlinUTC(lastCatch.timestamp, -offset);
        const { count } = await getCount(supabase, "fishes", [
          ["angler", "eq", name],
          ["timestamp", "gte", startUTC],
          ["timestamp", "lte", endUTC],
        ]);
        if (count === 0) {
          return false;
        }
      }

      // Nur auslösen, wenn der Vortag vor der Serie leer war – verhindert tägliche Wiederholungen.
      const { count: prevDayCount } = await getCount(supabase, "fishes", [
        ["angler", "eq", name],
        ...(() => {
          const { startUTC, endUTC } = dayBoundsEuropeBerlinUTC(lastCatch.timestamp, -5);
          return [
            ["timestamp", "gte", startUTC],
            ["timestamp", "lte", endUTC],
          ];
        })(),
      ]);

      return prevDayCount === 0;
    },
  },
];
