# FunFacts & Prognose: Portierungs-README

## Ziel
Diese README beschreibt die umgesetzte Logik für:
- `FunFactsCards` (Statistiken + Rankings aus Fangdaten)
- `Forecast` (KI-Prognose für jetzt + 7-Tage-Ausblick)

Damit kannst du die Fachlogik in einer anderen App nachbauen, ohne an UI oder Routing dieses Projekts gebunden zu sein.

## Relevante Dateien
- FunFacts-Seite: `src/pages/FunFacts.jsx`
- FunFacts-UI: `src/features/funfacts/FunFactsCards.jsx`
- FunFacts-Logik: `src/features/funfacts/useFunFactsData.js`
- FunFacts-Konstanten: `src/features/funfacts/constants.js`
- FunFacts-Helfer: `src/features/funfacts/utils.js`
- Wetter-Normalisierung: `src/utils/weatherParsing.js`
- Datenquelle Fänge: `src/hooks/useValidFishes.js`
- Forecast-Hook: `src/features/forecast/hooks/useForecast.js`
- Forecast-API-Wrapper: `src/features/forecast/services/forecastApi.js`
- KI-Service: `src/services/aiService.js`
- Wetterquelle Forecast: `src/services/weatherService.js`
- Modellzeitstempel-Merge: `src/features/forecast/services/predictionModelInfo.js`

## Teil 1: FunFacts

## 1. Datenbasis und Vorfilter
`useFunFactsData` arbeitet auf drei Ebenen:
1. `fishes`: sichtbare Rohdaten inkl. Blanks.
2. `validFishes`: nur echte Fänge (kein Blank, bekannte Art, Größe > 0).
3. `statsFishes`: zusätzlich Ausschluss via `count_in_stats=false`, `under_min_size=true`, `out_of_season=true`.

Zusätzliche Ortsgruppen:
- `ferkensbruchFishes`: nur Fänge am Ferkensbruch (via `normalizePlace` + Alias-Regeln).
- `ferkensbruchAllFishes`: wie oben, aber inkl. Blanks.

Sichtbarkeitslogik kommt aus `useValidFishes`:
- Nicht-Vertraute: nur Daten ab `PUBLIC_FROM`.
- Vertraute: optional kompletter Verlauf (`dataFilter=all`).

## 2. Wetter-Normalisierung für Auswertungen
`parseWeather(fish)` macht heterogene Wetterstrukturen vergleichbar und liefert:
- `textLower`
- `moonPhase`
- `tempC`
- `rainMm`
- `windSpeed`
- `windGust`

Wichtige Punkte:
- JSON-String in `fish.weather` wird geparst.
- Temperatur wird auf °C normalisiert (Kelvin/Fahrenheit-Erkennung).
- Regen kann aus Text oder mm-Werten kommen.

Darauf bauen auf:
- `isRainyCatch`
- `isSunnyCatch`
- `extractTempC`
- `extractMoonPhase`

## 3. Kennzahlen in `useFunFactsData`
Es werden viele unabhängige `useMemo`-Rankings berechnet. Kernbeispiele:
- Rekorde: größter/kleinster/schwerster Fisch, meiste Fänge pro Tag/Stunde
- Vielfalt: meiste Arten pro Tag/Stunde, Top-3 Arten
- Zeitmuster: Wochentag, Nachtfänge, Early-Bird, längste Serie/Pause
- Wetter: Regen/Sonne, Vollmond/Neumond, heißester/kältester/extremster Wetterfang
- Spezialtitel: Raubfisch-König, Hecht-Meister, Zander-Queen, Aal-Magier, Grundel-Champion
- Community: Angel-Queen, Rekordjäger, Foto-Künstler
- Meta: `funCardChampion` zählt Namensnennungen aus allen Gewinnerlisten

Wichtige Konstanten:
- `MIN_EFFICIENCY_DAYS = 3`
- `PREDATOR_SET = {barsch, aal, hecht, zander, wels}`
- Wetter-Extremscore über `WEATHER_KEYWORD_SCORES`, `COMFORT_TEMP_C`, `TEMP_TOLERANCE`, `WIND_COMFORT`

## 4. UI-Struktur der FunCards
`FunFactsCards.jsx` ist rein präsentational:
- Erwartet ein großes `data`-Objekt aus `useFunFactsData`.
- Baut ein `cards`-Array mit allen Themen.
- Ordnet Cards über `CARD_GROUPS` in Sektionen.
- Rendert pro Sektion ein Grid mit nummerierten `SectionCard`s.

Portierungstipp:
- Fachlogik in einen service/hook auslagern.
- UI nur an das Ergebnisobjekt binden.
- So kannst du dieselbe Logik in React Native, Next.js oder Vue wiederverwenden.

## Teil 2: Prognose-Logik

## 1. Datenquellen
- Wetter: `weather_cache` (`id = latest`) via `getLatestWeather()`.
- KI-Endpunkt: `${VITE_AI_BASE_URL}/predict` (Fallback: `https://ai.asv-rotauge.de`).

## 2. Input-Mapping fürs Modell
`toModelInput(source)` mappt auf:
- `temp`
- `pressure`
- `wind`
- `humidity`
- `wind_deg`
- `moon_phase`
- `dt`
- `timestamp` (ISO)

Für "jetzt" wird `moon_phase` aus `daily[0]` ergänzt.

## 3. Ablauf in `useForecast`
1. Wetter laden (`getLatestForecastWeather`).
2. Sofort Basestate setzen:
- `weatherData` für die "Jetzt"-Karte
- `dailyPredictions` mit Wetterdaten, aber `aiPrediction: null`
3. Parallel starten:
- Einzelprognose für "jetzt"
- Batch/Fallback-Prognosen für die restlichen Tage
4. Ergebnisse in `dailyPredictions[index].aiPrediction` einhängen.

## 4. Robustheit
- Retry-Mechanismus bei transienten Fehlern:
- Status `408`, `429`, `>=500`
- Netzwerk/Timeout/Fetch-Fehler
- Konfigurierbar via:
- `VITE_FORECAST_RETRY_ATTEMPTS` (0-3)
- `VITE_FORECAST_RETRY_DELAY_MS` (0-5000)

- `AbortController` + `requestId` vermeiden Race-Conditions und stale Updates.
- Fehlerzustand ist scoped:
- `scope: "weather"` (Wetterausfall)
- `scope: "ai"` (nur KI-Ausfall)

## 5. Erwartete KI-Response (minimal)
Für Forecast-UI benötigt:
- `probability` (0-100)
- `prediction` (1 = Fang wahrscheinlich, 0 = eher Blank)
- `per_fish_type` (Map `Fischart -> Prozent`)
- optional `trend`, `stats`, Modell-Zeitstempel

Zusatz:
- `withModelTimestamps(...)` füllt fehlende Zeitstempel aus mehreren möglichen Feldern auf.

## Portierung in eine andere App (empfohlen)
1. Wetter- und Fangdatenquellen anbinden.
2. `weatherParsing`-Logik übernehmen, damit Alt-/Mischdaten stabil laufen.
3. FunFacts-Berechnung als reinen Service/Hook übernehmen.
4. Forecast-Hook mit Retry/Abort 1:1 übernehmen.
5. UI separat bauen, nur gegen folgende Datenverträge:
- `funFactsResult` (alle Rankings + Kennzahlen)
- `forecastState = { loading, weatherData, aiPrediction, dailyPredictions, forecastError, reload }`

## Schnell-Check nach Portierung
- Kommt bei fehlender KI trotzdem Wetter-UI?
- Bleiben alte Requests ohne Einfluss bei schnellem Reload?
- Sind Blanks/Min-Size/Out-of-Season korrekt aus den Stats gefiltert?
- Funktionieren Mond-/Regen-/Sonnen-Erkennung bei alten Datensätzen?
- Ist `per_fish_type` im 7-Tage-Ausblick korrekt sortiert und darstellbar?
