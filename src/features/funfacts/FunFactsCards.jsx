import React, { useMemo } from 'react';
import { formatDayLabelDE } from '../../utils/formatters';
import { monthLabel } from '../../utils/dateUtils';
import { PREDATOR_LABELS, MIN_EFFICIENCY_DAYS } from './constants';
import {
  formatDateSafe,
  formatDateTimeSafe,
  formatDayShortSafe,
  formatTimeSafe,
} from './utils';

const Card = React.memo(function Card({ title, children }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-4">
      <h3 className="text-lg font-semibold text-blue-700 dark:text-blue-300 mb-2">
        {title}
      </h3>
      {children}
    </div>
  );
});

const Pill = ({ children }) => (
  <span className="px-2 py-0.5 rounded-full text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200">
    {children}
  </span>
);

const SectionCard = ({ number, title, children }) => (
  <Card title={`${String(number).padStart(2, '0')} · ${title}`}>
    {children}
  </Card>
);

const GROUP_LABELS = {
  HIGHLIGHTS: 'Highlights & Rekorde',
  CALENDAR: 'Kalender & Hotspots',
  WEATHER: 'Zeit & Wetter',
  SPECIES: 'Arten & Spezialisten',
  ENDURANCE: 'Serien & Ausdauer',
  BLANKS: 'Blanks & Rückschläge',
  COMMUNITY: 'Community Awards',
};

const CARD_GROUPS = {
  day: GROUP_LABELS.HIGHLIGHTS,
  biggest: GROUP_LABELS.HIGHLIGHTS,
  smallest: GROUP_LABELS.HIGHLIGHTS,
  hour: GROUP_LABELS.HIGHLIGHTS,
  speciesDay: GROUP_LABELS.HIGHLIGHTS,
  monster: GROUP_LABELS.HIGHLIGHTS,
  predator: GROUP_LABELS.HIGHLIGHTS,
  heavy: GROUP_LABELS.HIGHLIGHTS,
  efficiency: GROUP_LABELS.HIGHLIGHTS,
  topTenAnglers: GROUP_LABELS.HIGHLIGHTS,
  mostFishesDay: GROUP_LABELS.CALENDAR,
  monthMax: GROUP_LABELS.CALENDAR,
  monthTopTen: GROUP_LABELS.CALENDAR,
  monthAvgSize: GROUP_LABELS.CALENDAR,
  weekday: GROUP_LABELS.CALENDAR,
  places: GROUP_LABELS.CALENDAR,
  speciesHour: GROUP_LABELS.WEATHER,
  fullmoon: GROUP_LABELS.WEATHER,
  newmoon: GROUP_LABELS.WEATHER,
  'night-count': GROUP_LABELS.WEATHER,
  early: GROUP_LABELS.WEATHER,
  rain: GROUP_LABELS.WEATHER,
  sunny: GROUP_LABELS.WEATHER,
  hottestCatch: GROUP_LABELS.WEATHER,
  frostCatch: GROUP_LABELS.WEATHER,
  extremeWeather: GROUP_LABELS.WEATHER,
  rotauge: GROUP_LABELS.SPECIES,
  top3: GROUP_LABELS.SPECIES,
  'avg-size': GROUP_LABELS.SPECIES,
  zander: GROUP_LABELS.SPECIES,
  hecht: GROUP_LABELS.SPECIES,
  eel: GROUP_LABELS.SPECIES,
  grundel: GROUP_LABELS.SPECIES,
  foreign: GROUP_LABELS.SPECIES,
  pause: GROUP_LABELS.ENDURANCE,
  streak: GROUP_LABELS.ENDURANCE,
  buddies: GROUP_LABELS.ENDURANCE,
  overallAvg: GROUP_LABELS.ENDURANCE,
  'avg-per-month': GROUP_LABELS.ENDURANCE,
  schneiderKing: GROUP_LABELS.BLANKS,
  worstBlankMonth: GROUP_LABELS.BLANKS,
  queen: GROUP_LABELS.COMMUNITY,
  'record-hunter': GROUP_LABELS.COMMUNITY,
  'photo-artist': GROUP_LABELS.COMMUNITY,
  funCardChampion: GROUP_LABELS.COMMUNITY,
};

export default function FunFactsCards({ data }) {
  const {
    mostInOneDay,
    biggest,
    smallest,
    mostInOneHour,
    mostSpeciesInOneDay,
    mostMonsterFishes,
    mostFishesDay,
    mostFishesMonth,
    mostTopTenFishesMonth,
    topTenAnglers,
    topMonthsByAvgSize,
    mostFishesWeekday,
    mostSpeciesInOneHour,
    mostPlacesAngler,
    predatorKing,
    heaviestFish,
    mostEfficientAngler,
    mostRotaugen,
    pikeMaster,
    mostAtFullMoon,
    mostAtNewMoon,
    nightOwls,
    earlyBird,
    mostInRain,
    sunshineOnly,
    topThreeSpecies,
    averageSizeByAngler,
    longestBreakBetweenCatchDays,
    longestCatchStreak,
    fishPairs,
    zanderQueen,
    eelWizard,
    grundelChampion,
    foreignAnglers,
    schneiderKoenig,
    worstBlankMonth,
    hottestCatch,
    frostCatch,
    extremeWeatherCatch,
    activitySummary,
    avgPerAnglerDayByMonth,
    angelQueen,
    recordHunter,
    photoArtist,
    funCardChampion,
  } = data;

  const cards = useMemo(
    () => [
          <Card key="heavy" title="🏋️ Wer hat das dickste Ding gefangen? (max Gewicht)">
            {heaviestFish ? (
              <>
                <p className="mb-2">
                  Schwerster Fang:{' '}
                  <b className="text-green-700 dark:text-green-300">
                    {heaviestFish.weight.toFixed(1)} kg
                  </b>
                </p>
                <ul className="space-y-2">
                  {heaviestFish.items.map((f) => (
                    <li key={f.id} className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-medium text-green-700 dark:text-green-300">{f.angler}</div>
                        <div className="text-sm text-gray-600 dark:text-gray-300">
                          {f.fish}
                          {parseFloat(f.size) > 0 ? ` • ${parseFloat(f.size).toFixed(0)} cm` : ''} •{' '}
                          {formatDateTimeSafe(f.timestamp)}
                        </div>
                      </div>
                      <div className="text-xl font-bold text-green-700 dark:text-green-300">
                        {parseFloat(f.weight).toFixed(1)} kg
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p>Keine Gewichtsangaben vorhanden.</p>
            )}
          </Card>,

          <Card
            key="predator"
            title="👑 Wer ist der Raubfisch-König? (Gesamtlänge: Barsch, Aal, Hecht, Zander, Wels)"
          >
            {predatorKing.winners.length > 0 ? (
              <ul className="space-y-2">
                {predatorKing.winners.map((it, idx) => (
                  <li key={idx} className="flex items-start justify-between gap-3">
                    <div className="max-w-[70%]">
                      <div className="font-medium text-green-700 dark:text-green-300">{it.angler}</div>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {Object.entries(it.perSpecies)
                          .sort((a, b) => b[1].sum - a[1].sum)
                          .map(([sp, data]) => {
                            const avg = data.count > 0 ? Math.round(data.sum / data.count) : 0;
                            const countLabel = data.count === 1 ? '1 Fang' : `${data.count} Fänge`;
                            return (
                              <Pill key={sp}>
                                {PREDATOR_LABELS[sp] ?? sp} · {countLabel} · Ø {avg} cm
                              </Pill>
                            );
                          })}
                      </div>
                    </div>
                    <div className="text-xl font-bold text-green-700 dark:text-green-300">
                      {Math.round(it.sum)} cm
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p>Keine Daten</p>
            )}
          </Card>,

          <Card key="efficiency" title="🏅 Wer angelt am effizientesten? (Fische pro Fangtag)">
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">
              Nur Angler mit mindestens {MIN_EFFICIENCY_DAYS} Fangtagen zählen.
            </p>
            {mostEfficientAngler.winners.length > 0 ? (
              <ul className="space-y-2">
                {mostEfficientAngler.winners.map((it, idx) => (
                  <li key={idx} className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-medium text-green-700 dark:text-green-300">{it.angler}</div>
                      <div className="text-sm text-gray-600 dark:text-gray-300">
                        {it.fish} Fische auf {it.days} Fangtage
                      </div>
                    </div>
                    <div className="text-xl font-bold text-green-700 dark:text-green-300">
                      {it.ratio.toLocaleString('de-DE', { maximumFractionDigits: 2 })} / Tag
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p>Keine Daten</p>
            )}
          </Card>,

          // 2) Größter Fisch
          <Card key="biggest" title="Wer hat den größten Fisch gefangen?">
            {biggest ? (
              <>
                <p className="mb-2">
                  <strong>{biggest.size.toFixed(0)} cm</strong> – Rekordfang
                </p>
                <ul className="space-y-2">
                  {biggest.items.map((f) => (
                    <li key={f.id} className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-medium text-green-700 dark:text-green-300">{f.angler}</div>
                        <div className="text-sm text-gray-600 dark:text-gray-300">
                          {f.fish} • {formatDateTimeSafe(f.timestamp)}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p>Keine Daten</p>
            )}
          </Card>,

          // 3) Kleinster Fisch
          <Card key="smallest" title="Wer hat den kleinsten Fisch gefangen?">
            {smallest ? (
              <>
                <p className="mb-2">
                  <strong>{smallest.size.toFixed(0)} cm</strong> – kleinster gemeldeter Fang
                </p>
                <ul className="space-y-2">
                  {smallest.items.map((f) => (
                    <li key={f.id} className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-medium text-green-700 dark:text-green-300">{f.angler}</div>
                        <div className="text-sm text-gray-600 dark:text-gray-300">
                          {f.fish} • {formatDateTimeSafe(f.timestamp)}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p>Keine Daten</p>
            )}
          </Card>,

          // 4) Meiste Fische in einer Stunde
          <Card key="hour" title="Wer hat die meisten Fische in einer Stunde gefangen?">
            <p className="mb-2">
              <strong>{mostInOneHour.count}</strong> Fänge innerhalb einer Stunde – Rekordhalter:
            </p>
            <ul className="space-y-2">
              {mostInOneHour.items.map((it, idx) => (
                <li key={idx} className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-medium text-green-700 dark:text-green-300">{it.angler}</div>
                    <div className="text-sm text-gray-600 dark:text-gray-300">{it.hourLabel} Uhr</div>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {it.examples.map((e) => (
                        <Pill key={e.id}>
                          {e.fish} • {parseFloat(e.size).toFixed(0)} cm
                        </Pill>
                      ))}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </Card>,

          // 5) Meiste Fischarten an einem Tag
          <Card key="speciesDay" title="Wer hat die meisten Fischarten an einem Tag gefangen?">
            {mostSpeciesInOneDay.count > 0 ? (
              <>
                <p className="mb-2">
                  <strong>{mostSpeciesInOneDay.count}</strong> verschiedene Arten – Rekordhalter:
                </p>
                <ul className="space-y-2">
                  {mostSpeciesInOneDay.items.map((it, idx) => (
                    <li key={idx} className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-medium text-green-700 dark:text-green-300">{it.angler}</div>
                        <div className="text-sm text-gray-600 dark:text-gray-300">
                          {formatDateSafe(`${it.day}T00:00:00`)}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                          Insgesamt an diesem Tag: <b>{it.totalThatDay}</b> Fänge
                        </div>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {it.species.map((s) => (
                            <Pill key={s}>{s}</Pill>
                          ))}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p>Keine Daten</p>
            )}
          </Card>,

          // 6) Meiste Monsterfische
          <Card key="monster" title="Wer hat die meisten Monsterfische (>80 cm) gefangen?">
            {mostMonsterFishes.count > 0 ? (
              <ul className="space-y-2">
                {mostMonsterFishes.items.map((it, idx) => (
                  <li key={idx} className="flex items-center justify-between">
                    <div className="font-medium text-green-700 dark:text-green-300">{it.angler}</div>
                    <div className="text-xl font-bold text-green-700 dark:text-green-300">
                      {it.count}x
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p>Keine Monsterfische gefangen.</p>
            )}
          </Card>,

          <Card key="topTenAnglers" title="🎣 Wer hat die meisten Top-10-Fische?">
            {topTenAnglers.top3.length > 0 ? (
              <>
                <p className="mb-2">
                  <strong>{topTenAnglers.max}</strong> Top-10-Fisch{topTenAnglers.max === 1 ? '' : 'e'} – Spitze:{' '}
                  {topTenAnglers.leaders.map((entry) => entry.angler).join(', ')}
                </p>
                <ol className="space-y-2">
                  {topTenAnglers.top3.map((entry, idx) => (
                    <li key={entry.angler} className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-3">
                          <span className="w-6 text-sm tabular-nums text-gray-500 dark:text-gray-400">
                            {idx + 1}.
                          </span>
                          <span className="font-medium text-green-700 dark:text-green-300">
                            {entry.angler}
                          </span>
                        </div>
                        {entry.positions.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {entry.positions.slice(0, 5).map((pos, i) => (
                              <Pill key={`${pos.species}-${pos.rank}-${i}`}>
                                {pos.species} #{pos.rank}
                              </Pill>
                            ))}
                            {entry.positions.length > 5 && (
                              <Pill>+{entry.positions.length - 5}</Pill>
                            )}
                          </div>
                        )}
                        {entry.bestFish && entry.bestSize != null && entry.bestFish.timestamp && (
                          <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                            Bester Fang: {entry.bestFish.fish} • {Math.round(entry.bestSize)} cm •{' '}
                            {formatDateTimeSafe(entry.bestFish.timestamp)}
                          </div>
                        )}
                      </div>
                      <div className="text-xl font-bold text-green-700 dark:text-green-300">
                        {entry.count}x
                      </div>
                    </li>
                  ))}
                </ol>
                {topTenAnglers.ranking.length > 3 && (
                  <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                    Weitere Platzierungen:{' '}
                    {topTenAnglers.ranking
                      .slice(3, 8)
                      .map((entry) => entry.angler)
                      .join(', ')}
                  </p>
                )}
              </>
            ) : (
              <p>Zu wenig Top-10-Fänge vorhanden.</p>
            )}
          </Card>,

          // Meiste Fische an einem Tag (ans Ende der Highlights verschoben)
          <Card key="day" title="Wer hat die meisten Fische an einem Tag gefangen?">
            <p className="mb-2">
              <strong>{mostInOneDay.count}</strong> Fänge – Rekordhalter:
            </p>
            <ul className="space-y-2">
              {mostInOneDay.items.map((it, idx) => (
                <li key={idx} className="flex items-start justify-between gap-3">
                  <div className="space-y-0.5">
                    <div className="font-medium text-green-700 dark:text-green-300">
                      {it.angler}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-300">
                      {formatDateSafe(`${it.day}T00:00:00`)}
                    </div>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {it.examples.map((e) => (
                        <Pill key={e.id}>
                          {e.fish} • {parseFloat(e.size).toFixed(0)} cm • {formatTimeSafe(e.timestamp)} Uhr
                        </Pill>
                      ))}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </Card>,

          // 7) Tag mit den meisten Fischen
          <Card key="mostFishesDay" title="📅 An welchem Tag wurden die meisten Fische gefangen?">
            {mostFishesDay.count > 0 ? (
              <>
                <p className="mb-2">
                  Insgesamt <b className="text-green-700 dark:text-green-300">{mostFishesDay.count}</b> Fänge.
                </p>
                <ul className="space-y-2">
                  {mostFishesDay.days.map((d, i) => (
                    <li key={i} className="p-2 rounded bg-gray-50 dark:bg-gray-800 flex flex-col">
                      <div className="flex justify-between items-center">
                        <span className="font-medium">{formatDayLabelDE(d.day)}</span>
                        <span className="font-bold text-green-700 dark:text-green-300">{d.count}x</span>
                      </div>
                      {d.anglers && d.anglers.length > 0 && (
                        <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                          👤 {d.anglers.join(', ')}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p>Keine Daten</p>
            )}
          </Card>,

          // 8) Monat mit den meisten Fischen
          <Card key="monthMax" title="📅 In welchem Monat gab es die meisten Fische?">
            {mostFishesMonth.count > 0 ? (
              <>
                <p className="mb-2">
                  Insgesamt <b className="text-green-700 dark:text-green-300">{mostFishesMonth.count}</b> Fänge.
                </p>
                <ul className="space-y-1">
                  {mostFishesMonth.months.map((m, i) => (
                    <li key={i} className="flex justify-between">
                      <span className="font-medium">{monthLabel(m.month)}</span>
                      <span className="font-bold text-green-700 dark:text-green-300">{m.count}x</span>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p>Keine Daten</p>
            )}
          </Card>,

          // 8a) Monat mit den meisten Top-10-Fischen
          <Card key="monthTopTen" title="🏅 In welchem Monat wurden die meisten Top-10-Fische gefangen?">
            {mostTopTenFishesMonth.bestCount > 0 ? (
              <>
                <p className="mb-2">
                  Spitzenmonat{mostTopTenFishesMonth.bestMonths.length > 1 ? 'e' : ''} mit <b className="text-green-700 dark:text-green-300">{mostTopTenFishesMonth.bestCount}</b> Top-10-Fisch{mostTopTenFishesMonth.bestCount === 1 ? '' : 'e'}.
                </p>
                <ul className="space-y-1">
                  {mostTopTenFishesMonth.bestMonths.map((entry) => (
                    <li key={entry.month} className="flex justify-between">
                      <span className="font-medium">{monthLabel(entry.month)}</span>
                      <span className="font-bold text-green-700 dark:text-green-300">{entry.count}x</span>
                    </li>
                  ))}
                </ul>
                {mostTopTenFishesMonth.ranking.length > mostTopTenFishesMonth.bestMonths.length && (
                  <div className="mt-3 text-xs text-gray-500 dark:text-gray-400">
                    Weitere Monate:
                    <ul className="mt-1 space-y-1">
                      {mostTopTenFishesMonth.ranking
                        .filter((entry) => entry.count < mostTopTenFishesMonth.bestCount)
                        .slice(0, 3)
                        .map((entry) => (
                          <li key={entry.month} className="flex justify-between">
                            <span>{monthLabel(entry.month)}</span>
                            <span>{entry.count}x</span>
                          </li>
                        ))}
                    </ul>
                  </div>
                )}
              </>
            ) : (
              <p>Zu wenig Top-10-Fänge (mit Größenangabe) vorhanden.</p>
            )}
          </Card>,

          // 8b) Monate mit den größten Durchschnitts-Fischen
          <Card key="monthAvgSize" title="📏 Welche Monate bringen die größten Ø-Fische?">
            {topMonthsByAvgSize.items.length > 0 ? (
              <ul className="space-y-2">
                {topMonthsByAvgSize.items.map((item, idx) => (
                  <li
                    key={item.month}
                    className="p-2 rounded bg-gray-50 dark:bg-gray-800"
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="font-medium">
                        {idx + 1}. {monthLabel(item.month)}
                      </span>
                      <span className="font-bold text-green-700 dark:text-green-300">
                        Ø {item.avgSize.toFixed(1)} cm
                      </span>
                    </div>
                   
                    {item.species && item.species.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {item.species.map((speciesEntry) => (
                          <Pill key={`${item.month}-${speciesEntry.species}`}>
                            {speciesEntry.species} • Ø {speciesEntry.avgSize.toFixed(1)} cm
                            {speciesEntry.count > 0 ? ` (${speciesEntry.count}x)` : ''}
                          </Pill>
                        ))}
                      </div>
                    )}
                    
                  </li>
                ))}
              </ul>
            ) : (
              <p>Keine Größenangaben vorhanden.</p>
            )}
          </Card>,

          // 9) Wochentage
          <Card key="weekday" title="🗓️ Welcher Wochentag bringt die meisten Fänge?">
            {mostFishesWeekday.items.length > 0 ? (
              <ul className="space-y-1">
                {mostFishesWeekday.items.map((it, i) => (
                  <li key={i} className="flex justify-between">
                    <span
                      className={`font-medium ${
                        it.isBest ? 'text-green-700 dark:text-green-300' : ''
                      }`}
                    >
                      {it.label}
                    </span>
                    <span
                      className={`font-bold ${
                        it.isBest ? 'text-green-700 dark:text-green-300' : ''
                      }`}
                    >
                      {it.count}x
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p>Keine Daten</p>
            )}
          </Card>,

          // 11) Orte
          <Card key="places" title="🧭 Wer hat an den meisten unterschiedlichen Orten geangelt?">
            {mostPlacesAngler.count > 0 ? (
              <>
                <p className="mb-2">
                  <strong className="text-green-700 dark:text-green-300">
                    {mostPlacesAngler.count}
                  </strong>{' '}
                  unterschiedliche Orte – Rekordhalter:
                </p>
                <ul className="space-y-2">
                  {mostPlacesAngler.winners.map((it, idx) => (
                    <li key={idx} className="flex items-start justify-between gap-3">
                      <div className="max-w-[70%]">
                        <div className="font-medium text-green-700 dark:text-green-300">{it.angler}</div>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {it.places.map((p) => (
                            <Pill key={p}>{p}</Pill>
                          ))}
                        </div>
                      </div>
                      <div className="text-xl font-bold text-green-700 dark:text-green-300">
                        {it.count}
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p>Keine Daten</p>
            )}
          </Card>,
          <Card key="speciesHour" title="Wer hat die meisten Fischarten in 1 Stunde gefangen?">
            {mostSpeciesInOneHour.count > 0 ? (
              <>
                <p className="mb-2">
                  <strong>{mostSpeciesInOneHour.count}</strong> verschiedene Arten – Rekordhalter:
                </p>
                <ul className="space-y-2">
                  {mostSpeciesInOneHour.items.map((it, idx) => (
                    <li key={idx} className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-medium text-green-700 dark:text-green-300">{it.angler}</div>
                        <div className="text-sm text-gray-600 dark:text-gray-300">{it.hourLabel}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                          Insgesamt in dieser Stunde: <b>{it.totalThatHour}</b> Fänge
                        </div>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {it.species.map((s) => (
                            <Pill key={s}>{s}</Pill>
                          ))}
                        </div>
                      </div>
                      <div className="text-xl font-bold text-green-700 dark:text-green-300">
                        {mostSpeciesInOneHour.count} Arten
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p>Keine Daten</p>
            )}
          </Card>,

          // 16) Vollmond
          <Card key="fullmoon" title="🌕 Wer fängt am meisten bei Vollmond?">
            {mostAtFullMoon.winners.length > 0 ? (
              <ul className="space-y-2">
                {mostAtFullMoon.winners.map((it, idx) => (
                  <li key={idx} className="flex items-center justify-between">
                    <div className="font-medium text-green-700 dark:text-green-300">{it.angler}</div>
                    <div className="text-xl font-bold text-green-700 dark:text-green-300">
                      {it.count}x
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p>Keine (auswertbaren) Vollmond-Fänge.</p>
            )}
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              Hinweis: Es werden nur Fänge gezählt, bei denen in den Wetterdaten eine Mondphase gespeichert ist (Vollmond ≈ 0.5 ± 0.06).
            </p>
          </Card>,

          <Card key="newmoon" title="🌑 Wer fängt am meisten bei Neumond?">
            {mostAtNewMoon.winners.length > 0 ? (
              <ul className="space-y-2">
                {mostAtNewMoon.winners.map((it, idx) => (
                  <li key={idx} className="flex items-center justify-between">
                    <div className="font-medium text-green-700 dark:text-green-300">{it.angler}</div>
                    <div className="text-xl font-bold text-green-700 dark:text-green-300">
                      {it.count}x
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p>Keine (auswertbaren) Neumond-Fänge.</p>
            )}
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              Hinweis: Es werden nur Fänge gezählt, bei denen in den Wetterdaten eine Mondphase gespeichert ist (Neumond ≈ 0.0 ± 0.06 bzw. 1.0 ± 0.06).
            </p>
          </Card>,

          // 17) Nachteule – Meiste Nachtfänge
          <Card key="night-count" title="🦉 Wer ist unsere Nachteule?">
            {nightOwls.winners.length > 0 ? (
              <ul className="space-y-2">
                {nightOwls.winners.map((it, idx) => (
                  <li key={idx} className="flex items-start justify-between gap-3">
                    <div className="max-w-[70%]">
                      <div className="font-medium text-green-700 dark:text-green-300">{it.angler}</div>
                      <div className="text-sm text-gray-600 dark:text-gray-300">
                        {it.count} Nachtfang{it.count === 1 ? '' : 'e'} (22–04 Uhr)
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="mt-1">
                        <Pill>🌙 Gesamt: {it.count}</Pill>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p>Keine Daten</p>
            )}

            {nightOwls.ranking.length > 0 && (
              <div className="mt-4">
                <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">
                  Ranking (Top 5)
                </div>
                <ul className="divide-y divide-gray-200/60 dark:divide-white/10 rounded-lg border border-gray-200/60 dark:border-white/10 overflow-hidden">
                  {nightOwls.ranking.slice(0, 5).map((r, i) => (
                    <li key={r.angler} className="flex items-center justify-between px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span className="w-6 text-sm tabular-nums text-gray-500 dark:text-gray-400">
                          {i + 1}.
                        </span>
                        <span className="font-medium">{r.angler}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <Pill>🌙 {r.count}</Pill>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Card>,

          // 18) Early Bird
          <Card key="early" title="🌅 Wer fängt den frühen Wurm? (4:00 - 9:00 Uhr)">
            {earlyBird.winners.length > 0 ? (
              <ul className="space-y-2">
                {earlyBird.winners.map((it, idx) => (
                  <li key={idx} className="flex items-start justify-between gap-3">
                    <div className="max-w-[70%]">
                      <div className="font-medium text-green-700 dark:text-green-300">{it.angler}</div>
                      <div className="text-sm text-gray-600 dark:text-gray-300">
                        {/* timeLabel wird im Memo bereits erzeugt – dort auf formatTimeDE umgestellt */}
                        Frühester Fang um {it.timeLabel} Uhr
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xl font-bold text-green-700 dark:text-green-300">{it.early} x</div>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p>Keine Daten</p>
            )}
          </Card>,

          // 19) Regen
          <Card key="rain" title="🌧️ Wer fängt am meisten bei Regen?">
            {mostInRain.winners.length > 0 ? (
              <ul className="space-y-2">
                {mostInRain.winners.map((it, idx) => (
                  <li key={idx} className="flex items-start justify-between gap-3">
                    <div className="max-w-[70%]">
                      <div className="font-medium text-green-700 dark:text-green-300">{it.angler}</div>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {it.examples.map((e) => (
                          <Pill key={e.id}>
                            {formatTimeSafe(e.timestamp)} • {e.fish}
                          </Pill>
                        ))}
                      </div>
                    </div>
                    <div className="text-xl font-bold text-green-700 dark:text-green-300">
                      {it.count}x
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p>Keine auswertbaren Regen-Fänge.</p>
            )}
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              Zählt nur Fänge mit erkennbarer Regen-Info in den Wetterdaten (Rain/Drizzle/Schauer oder gemeldete Niederschlagsmenge).
            </p>
          </Card>,

          // 20) Sonnenschein only
          <Card key="sunny" title="☀️ Wer angelt ausschließlich bei Sonnenschein?">
            {sunshineOnly.winners.length > 0 ? (
              <ul className="space-y-2">
                {sunshineOnly.winners.map((it, idx) => (
                  <li key={idx} className="flex items-center justify-between">
                    <div className="font-medium text-green-700 dark:text-green-300">{it.angler}</div>
                  </li>
                ))}
              </ul>
            ) : (
              <p>Niemand hat ausschließlich bei Sonnenschein gefangen (oder es fehlen Wetterangaben).</p>
            )}
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              Hinweis: Gewertet werden nur Fänge mit erkennbarer Wetterbeschreibung. „ein paar wolken/leicht bewölkt“ zählt <b>nicht</b> als Sonnenschein.
            </p>
          </Card>,

          // 21) 🔥 Heißester Fang (größter Fisch bei höchster Temperatur)
          <Card key="hottestCatch" title="🔥 Heißester Fang (größter Fisch bei höchster Temperatur)">
            {hottestCatch ? (
              <>
                <p className="mb-2">
                  Höchste Temperatur:{' '}
                  <b className="text-green-700 dark:text-green-300">
                    {hottestCatch.tempC.toFixed(1)}°C
                  </b>
                </p>
                <ul className="space-y-2">
                  {hottestCatch.items.map((f) => (
                    <li key={f.id} className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-medium text-green-700 dark:text-green-300">
                          {f.angler}
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-300">
                          {f.fish} • {formatDateTimeSafe(f.timestamp)}
                        </div>
                      </div>
                      <div className="text-xl font-bold text-green-700 dark:text-green-300">
                        {parseFloat(f.size).toFixed(0)} cm
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p>Keine Temperaturdaten vorhanden.</p>
            )}
          </Card>,

          // 22) ❄️ Kältester Fang (Frost)
          <Card key="frostCatch" title="❄️ Kältester Fang: Wer hat bei Frost gefangen? (≤ 0 °C)">
            {frostCatch.ranking.length > 0 ? (
              <>
                <ul className="space-y-2">
                  {frostCatch.winners.map((it, idx) => (
                    <li key={idx} className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-medium text-green-700 dark:text-green-300">
                          {it.angler}
                        </div>
                        {it.sample && (
                          <div className="text-xs text-gray-600 dark:text-gray-300">
                            Beispiel: {it.sample.fish} • {parseFloat(it.bestSize).toFixed(0)} cm • {formatDateTimeSafe(it.sample.timestamp)}
                          </div>
                        )}
                      </div>
                      <div className="text-right">
                        <div className="text-xl font-bold text-green-700 dark:text-green-300">
                          {it.count}x
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          Frost-Fänge
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>

                <div className="mt-3 text-xs text-gray-500 dark:text-gray-400">
                  Rangliste (Top 5):
                </div>
                <ul className="space-y-1">
                  {frostCatch.ranking.slice(0, 5).map((it, i) => (
                    <li key={i} className="flex justify-between text-sm">
                      <span>
                        {i + 1}. {it.angler}
                      </span>
                      <span className="font-semibold">{it.count}x</span>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p>Keine Frost-Fänge gefunden.</p>
            )}
          </Card>,

          // 22b) 🌩️ Extremster Wetterfang
          <Card key="extremeWeather" title="🌩️ Extremster Wetterfang">
            {extremeWeatherCatch ? (
              <>
                <p className="mb-2 text-sm text-gray-600 dark:text-gray-300">
                  Score basiert auf Temperatur, Wind, Niederschlag & Wetterbeschreibung – je höher, desto ungemütlicher.
                </p>
                <ul className="space-y-3">
                  {extremeWeatherCatch.ranking.slice(0, 3).map((item, idx) => {
                    const isWinner = Math.abs(item.score - extremeWeatherCatch.bestScore) < 1e-6;
                    return (
                      <li key={item.fish.id ?? idx} className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <div
                            className={`font-medium ${
                              isWinner
                                ? 'text-pink-700 dark:text-pink-300'
                                : 'text-green-700 dark:text-green-300'
                            }`}
                          >
                            {item.fish.angler || 'Unbekannt'} {isWinner ? '👑' : ''}
                          </div>
                          <div className="text-sm text-gray-600 dark:text-gray-300">
                            {item.fish.fish} • {parseFloat(item.fish.size).toFixed(0)} cm • {formatDateTimeSafe(item.fish.timestamp)}
                          </div>
                          {item.weatherDesc && (
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              Wetter: {item.weatherDesc}
                            </div>
                          )}
                          {item.highlights.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {item.highlights.map((text, i) => (
                                <Pill key={i}>{text}</Pill>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="text-right">
                          <div className="text-xl font-bold text-green-700 dark:text-green-300">
                            Score {Math.round(item.score)}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            höher = ungemütlicher
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </>
            ) : (
              <p className="text-gray-600 dark:text-gray-300">Noch keine Wetterdaten verfügbar.</p>
            )}
          </Card>,

          <Card key="rotauge" title="🐟 Wer fängt beim ASV Rotauge die meisten Rotaugen?">
            {mostRotaugen.winners.length > 0 ? (
              <ul className="space-y-2">
                {mostRotaugen.winners.map((it, idx) => (
                  <li key={idx} className="flex items-center justify-between">
                    <div className="font-medium text-green-700 dark:text-green-300">{it.angler}</div>
                    <div className="text-xl font-bold text-green-700 dark:text-green-300">
                      {it.count}x
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p>Keine Rotaugen gefangen.</p>
            )}
          </Card>,

          // 21) Top 3 Arten
          <Card key="top3" title="🐟 Welche drei Fischarten werden am meisten gefangen?">
            {topThreeSpecies.items.length > 0 ? (
              <ol className="space-y-2">
                {topThreeSpecies.items.map((it, idx) => (
                  <li key={it.species} className="flex items-center gap-3">
                    <span className="w-6 text-right font-semibold">{idx + 1}.</span>
                    <div className="flex-1">
                      <div className="flex justify-between text-sm font-medium">
                        <span>{it.species}</span>
                        <span className="text-green-700 dark:text-green-300">{it.count}x</span>
                      </div>
                      <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded">
                        <div
                          className="h-2 rounded bg-green-600 dark:bg-green-400"
                          style={{ width: `${(it.count / (topThreeSpecies.max || 1)) * 100}%` }}
                        />
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <p>Keine Daten</p>
            )}
          </Card>,

          // 21b) Durchschnittliche Größe je Angler
          <Card
            key="avg-size"
            title="📏 Wer fängt im Schnitt die größten Fische? (Top 3)"
          >
            {averageSizeByAngler.top3.length > 0 ? (
              <ol className="space-y-2">
                {averageSizeByAngler.top3.map((it, idx) => (
                  <li
                    key={it.angler}
                    className="flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-6 text-sm tabular-nums text-gray-500 dark:text-gray-400">
                        {idx + 1}.
                      </span>
                      <span className="font-medium text-green-700 dark:text-green-300">
                        {it.angler}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Pill>Ø {it.average.toFixed(1)} cm</Pill>
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <p>Keine auswertbaren Fänge.</p>
            )}
          </Card>,

          // 25) Wer ist der Hecht-Meister?
          <Card key="hecht" title="🛶 Wer ist der Hecht-Meister?">
            {pikeMaster.winners.length > 0 && pikeMaster.maxSize ? (
              <>
                <p className="mb-2 text-sm text-gray-600 dark:text-gray-300">
                  Größter Hecht:{' '}
                  <b className="text-green-700 dark:text-green-300">
                    {pikeMaster.maxSize.toFixed(0)} cm
                  </b>
                </p>
                <ul className="space-y-2">
                  {pikeMaster.winners.map((it, idx) => (
                    <li key={idx} className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-medium text-green-700 dark:text-green-300">{it.angler}</div>
                        <div className="text-xs text-gray-600 dark:text-gray-300">
                          {formatDateTimeSafe(it.fish.timestamp)}
                        </div>
                      </div>
                      <div className="text-xl font-bold text-green-700 dark:text-green-300">
                        {it.size.toFixed(0)} cm
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="text-gray-600 dark:text-gray-300">Noch kein Hecht in Sicht.</p>
            )}
          </Card>,

          // 26) Wer ist die Zander-Queen?
          <Card key="zander" title="🐊 Wer ist die Zander-Queen?">
            {zanderQueen.winners.length > 0 && zanderQueen.maxSize ? (
              <>
                <p className="mb-2 text-sm text-gray-600 dark:text-gray-300">
                  Größter Zander: <b className="text-green-700 dark:text-green-300">{zanderQueen.maxSize.toFixed(0)} cm</b>
                </p>
                <ul className="space-y-2">
                  {zanderQueen.winners.map((it, idx) => (
                    <li key={idx} className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-medium text-green-700 dark:text-green-300">{it.angler}</div>
                        <div className="text-xs text-gray-600 dark:text-gray-300">
                          {formatDateTimeSafe(it.fish.timestamp)}
                        </div>
                      </div>
                      <div className="text-xl font-bold text-green-700 dark:text-green-300">
                        {it.size.toFixed(0)} cm
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="text-gray-600 dark:text-gray-300">Noch kein Zander in Sicht.</p>
            )}
          </Card>,

          // 26) Aal-Magier
          <Card key="eel" title="🧙‍♂️ Aal-Magier">
            {eelWizard ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-green-700 dark:text-green-300 font-medium">
                    {eelWizard.angler}
                  </span>
                  <span className="font-bold text-xl text-green-700 dark:text-green-300">
                    {eelWizard.count}{' '}
                    {eelWizard.count === 1 ? 'Aal' : 'Aale'}
                  </span>
                </div>
                <Pill>
                  Aal · {eelWizard.count === 1 ? '1 Fang' : `${eelWizard.count} Fänge`} · Ø{' '}
                  {eelWizard.averageSizeRounded !== null ? eelWizard.averageSizeRounded : '—'} cm
                </Pill>
              </div>
            ) : (
              <p className="text-gray-600 dark:text-gray-400">Noch kein Aal gefangen.</p>
            )}
          </Card>,

          // 27) Grundel-Champion
          <Card key="grundel" title="🏆 Grundel-Champion">
            {grundelChampion ? (
              <div className="flex items-center justify-between">
                <span className="text-green-700 dark:text-green-300 font-medium">
                  {grundelChampion.angler}
                </span>
                <span className="font-bold text-xl text-green-700 dark:text-green-300">
                  {grundelChampion.count}{' '}
                  {grundelChampion.count === 1 ? 'Grundel' : 'Grundeln'}
                </span>
              </div>
            ) : (
              <p className="text-gray-600 dark:text-gray-400">Noch keine Grundeln gefangen.</p>
            )}
          </Card>,

          // 28) Fremdangeln
          <Card key="foreign" title="🌍 Wer angelt gern woanders?">
            {foreignAnglers.top3.length > 0 ? (
              <ul className="space-y-4">
                {foreignAnglers.top3.map((p, idx) => (
                  <li key={idx} className="p-3 bg-white dark:bg-gray-800 rounded-lg shadow">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-blue-700 dark:text-blue-300">
                        #{idx + 1} {p.angler}
                      </span>
                      <span className="text-green-700 dark:text-green-300 font-bold">
                        {p.total} {p.total === 1 ? 'Fisch' : 'Fische'}
                      </span>
                    </div>
                    <div className="mb-2 text-xs text-gray-600 dark:text-gray-400">
                      📍{' '}
                      {Object.entries(p.byLocation)
                        .map(([loc, cnt]) => `${loc} (${cnt})`)
                        .join(', ')}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(p.byFish)
                        .sort((a, b) => b[1] - a[1])
                        .map(([fish, count]) => (
                          <span
                            key={fish}
                            className="px-2 py-1 text-xs rounded-full bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200"
                          >
                            {fish} {count}×
                          </span>
                        ))}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p>Alle bleiben brav am Ferkensbruch 😉</p>
            )}
          </Card>,

          // 22) Längste Pause
          <Card key="pause" title="⏳ Wer muss sich am längsten zwischen den Fangtagen ausruhen?">
            {longestBreakBetweenCatchDays.winners.length > 0 ? (
              <ul className="space-y-2">
                {longestBreakBetweenCatchDays.winners.map((it, idx) => (
                  <li key={idx} className="flex items-start justify-between gap-3">
                    <div className="max-w-[70%]">
                      <div className="font-medium text-green-700 dark:text-green-300">{it.angler}</div>
                      <div className="text-sm text-gray-600 dark:text-gray-300">
                        Pause von {formatDayShortSafe(`${it.from}T00:00:00`)} bis {formatDayShortSafe(`${it.to}T00:00:00`)}
                      </div>
                    </div>
                    <div className="text-xl font-bold text-green-700 dark:text-green-300">
                      {Math.round(it.gap)} Tage
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p>Keine auswertbaren Pausen (zu wenige Fangtage je Angler).</p>
            )}
          </Card>,

          // 23) Längste Serie
          <Card key="streak" title="🔥 Wer hat die längste Fangserie hingelegt? (aufeinanderfolgende Fangtage)">
            {longestCatchStreak.winners.length > 0 ? (
              <ul className="space-y-2">
                {longestCatchStreak.winners.map((it, idx) => (
                  <li key={idx} className="flex items-start justify-between gap-3">
                    <div className="max-w-[70%]">
                      <div className="font-medium text-green-700 dark:text-green-300">{it.angler}</div>
                      <div className="text-sm text-gray-600 dark:text-gray-300">
                        Serie von {it.len} Tag{it.len === 1 ? '' : 'en'}: {formatDayShortSafe(`${it.from}T00:00:00`)} – {formatDayShortSafe(`${it.to}T00:00:00`)}
                      </div>
                    </div>
                    <div className="text-xl font-bold text-green-700 dark:text-green-300">
                      {it.len} Tage
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p>Keine auswertbaren Serien.</p>
            )}
          </Card>,

          // 24) Paare
          <Card key="buddies" title="👥 Wer fängt gern zusammen? (Top 3 Paare)">
            {fishPairs.lauraNicol ? (
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-3 italic">
                😉 Referenz: Laura & Nicol – {fishPairs.lauraNicol.count} Fische
              </p>
            ) : (
              <p className="text-xs text-gray-400 mb-3 italic">
                😉 Referenz: Laura & Nicol – noch keine gemeinsamen Fänge
              </p>
            )}

            {fishPairs.top3.length > 0 ? (
              <ul className="space-y-3">
                {fishPairs.top3.map((p, idx) => (
                  <li key={idx} className="flex items-start justify-between gap-3">
                    <div className="max-w-[70%]">
                      <div className="text-green-700 dark:text-green-300 font-medium">
                        {p.a} &amp; {p.b}
                      </div>
                    </div>
                    <div className="text-xl font-bold text-green-700 dark:text-green-300">
                      {p.count}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p>Keine gemeinsamen Fänge gefunden.</p>
            )}
          </Card>,

          <Card key="overallAvg" title="📊 Ø Fische pro Fangtag">
            {activitySummary.catchSessions > 0 ? (
              <div className="space-y-2">
                <div className="flex items-baseline justify-between">
                  <div>
                    <div className="text-3xl font-bold text-green-700 dark:text-green-300">
                      {activitySummary.avgCatchesPerCatchDay.toFixed(2)}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      Ø Fische pro Fangtag
                    </div>
                  </div>
                  <div className="text-xs text-right text-gray-500 dark:text-gray-400">
                    Basis: {activitySummary.catchSessions} Fangtage, {activitySummary.blankSessions} Schneider
                    <br />
                    {activitySummary.totalCatchCount} Fänge gesamt
                  </div>
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  Schneider-Anteil: {(activitySummary.blankShare * 100).toFixed(1)}%
                </div>
              </div>
            ) : (
              <p>Keine Daten</p>
            )}
          </Card>,

          <Card key="avg-per-month" title="📈 Ø Fische pro Angler-Tag nach Monat">
            {avgPerAnglerDayByMonth.months.length > 0 ? (
              <div className="space-y-3">
                {avgPerAnglerDayByMonth.months.map((entry) => {
                  const ratio =
                    avgPerAnglerDayByMonth.maxAvg > 0
                      ? (entry.avg / avgPerAnglerDayByMonth.maxAvg) * 100
                      : 0;
                  const width =
                    entry.avg > 0
                      ? Math.min(100, Math.max(6, ratio))
                      : 0;
                  return (
                    <div key={entry.month} className="space-y-1">
                      <div className="flex items-center justify-between text-sm font-medium text-gray-700 dark:text-gray-200">
                        <span>{monthLabel(entry.month)}</span>
                        <span className="tabular-nums text-xs text-gray-500 dark:text-gray-400">
                          {entry.avg.toLocaleString('de-DE', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}{' '}
                          Ø
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-green-500 dark:bg-green-400 transition-all"
                          style={{ width: `${width}%` }}
                        />
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        Basis: {entry.totalAnglerDays} Angler-Tage · {entry.totalFishes} Fänge
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p>Keine monatlichen Daten.</p>
            )}
          </Card>,

          // 29) Schneiderkönig
          <Card key="schneiderKing" title="❌ Wer ist der Schneiderkönig?">
            {schneiderKoenig.winners.length > 0 ? (
              <ul className="space-y-2">
                {schneiderKoenig.winners.map((it, idx) => (
                  <li key={idx} className="flex items-center justify-between">
                    <span className="font-medium text-green-700 dark:text-green-300">
                      {it.angler}
                    </span>
                    <span className="font-bold text-xl text-green-700 dark:text-green-300">
                      {it.count}x
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p>Keine Schneidersessions erfasst.</p>
            )}
          </Card>,

          // 30) 📉 Schlechtester Monat (meiste Schneidersessions)
          <Card key="worstBlankMonth" title="📉 Schlechtester Monat (meiste Schneidersessions)">
            {worstBlankMonth.max > 0 ? (
              <>
                <p className="mb-2">
                  Meiste Schneidersessions:{' '}
                  <b className="text-green-700 dark:text-green-300">
                    {worstBlankMonth.max}
                  </b>
                </p>
                <ul className="space-y-1 mb-3">
                  {worstBlankMonth.winners.map((m, i) => (
                    <li key={i} className="flex justify-between">
                      <span className="font-medium">{monthLabel(m.month)}</span>
                      <span className="font-bold text-green-700 dark:text-green-300">
                        {m.count}x
                      </span>
                    </li>
                  ))}
                </ul>
                <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                  Rangliste (Top 5):
                </div>
                <ul className="space-y-1">
                  {worstBlankMonth.ranking.slice(0, 5).map((m, i) => (
                    <li key={i} className="flex justify-between text-sm">
                      <span>
                        {i + 1}. {monthLabel(m.month)}
                      </span>
                      <span className="font-semibold">{m.count}x</span>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p>Keine Schneidersessions erfasst.</p>
            )}
          </Card>,

          // ---------- Card: Angel-Queen
<Card key="queen" title="Wer ist unsere Angel-Queen?">
  {angelQueen.ranking.length === 0 ? (
    <p className="text-gray-600 dark:text-gray-300">
      Noch keine Fänge von Laura, Marilou oder Julia erfasst.
    </p>
  ) : (
    <>
      <p className="mb-2">
        <strong>{angelQueen.winners[0].total}</strong> Fänge – Queen
        {angelQueen.winners.length > 1 ? "s:" : ":"}{" "}
        {angelQueen.winners.map((w) => w.angler).join(" & ")} 👑
      </p>

      <ul className="space-y-2">
        {angelQueen.ranking.map((it, idx) => {
          const isWinner =
            angelQueen.winners.length > 0 &&
            it.total === angelQueen.winners[0].total;
          return (
            <li key={idx} className="flex items-start justify-between gap-3">
              <div className="space-y-0.5">
                <div
                  className={`font-medium ${
                    isWinner
                      ? "text-pink-700 dark:text-pink-300"
                      : "text-green-700 dark:text-green-300"
                  }`}
                >
                  {it.angler} {isWinner ? "👑" : ""}
                </div>
                <div className="flex flex-wrap gap-1 mt-1">
                  {/* optionaler Badge im gleichen Stil wie deine Pills */}
                  <Pill>{it.total} {it.total === 1 ? "Fang" : "Fänge"}</Pill>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </>
  )}
</Card>,

//--------34--Card:Record-Hunter--
<Card key="record-hunter" title="Wer ist unser Rekordjäger?">
  {recordHunter.ranking.length === 0 ? (
    <p className="text-gray-600 dark:text-gray-300">
      Noch keine Rekorde ermittelt (größte Fische pro Art).
    </p>
  ) : (
    <>
      <p className="mb-2">
        <strong>{recordHunter.winners[0].total}</strong> Rekorde – Spitze:{' '}
        {recordHunter.winners.map((w) => w.angler).join(' & ')} 🏆
      </p>

      <ul className="space-y-2">
        {recordHunter.ranking.map((it, idx) => {
          const isWinner = it.total === recordHunter.winners[0].total;
          const shown = it.species.slice(0, 6);
          const more = Math.max(it.species.length - shown.length, 0);
          return (
            <li key={idx} className="flex items-start justify-between gap-3">
              <div className="space-y-0.5">
                <div
                  className={`font-medium ${
                    isWinner
                      ? 'text-pink-700 dark:text-pink-300'
                      : 'text-green-700 dark:text-green-300'
                  }`}
                >
                  {it.angler} {isWinner ? '👑' : ''}
                </div>

                <div className="flex flex-wrap gap-1 mt-1">
                  <Pill>{it.total} {it.total === 1 ? 'Rekord' : 'Rekorde'}</Pill>
                  {shown.map((s, i) => (
                    <Pill key={i}>
                      {s.name} • {Number.isFinite(s.max) ? `${Math.round(s.max)} cm` : '—'}
                    </Pill>
                  ))}
                  {more > 0 && <Pill>+{more} mehr</Pill>}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-xs opacity-70">
        Grundlage: größte gemessene Länge pro Fischart; Gleichstand → geteilte Rekorde.
      </p>
    </>
  )}
</Card>,

// ---------- Card: Foto-Künstler
<Card key="photo-artist" title="Wer ist unser Foto-Künstler?">
  {photoArtist.ranking.length === 0 ? (
    <p className="text-gray-600 dark:text-gray-300">Noch keine Fangfotos vorhanden.</p>
  ) : (
    <>
      <p className="mb-2">
        <strong>{photoArtist.winners[0].total}</strong> Fotos – Sieger:{' '}
        {photoArtist.winners.map((w) => w.angler).join(' & ')} 📸
      </p>

      <ul className="space-y-2">
        {photoArtist.ranking.slice(0, 5).map((it, idx) => {
          const isWinner = it.total === photoArtist.winners[0].total;
          return (
            <li key={idx} className="flex items-start justify-between gap-3">
              <div className="space-y-0.5">
                <div
                  className={`font-medium ${
                    isWinner
                      ? 'text-pink-700 dark:text-pink-300'
                      : 'text-green-700 dark:text-green-300'
                  }`}
                >
                  {it.angler} {isWinner ? '👑' : ''}
                </div>
                <div className="flex flex-wrap gap-1 mt-1">
                  <Pill>{it.total} {it.total === 1 ? 'Foto' : 'Fotos'}</Pill>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </>
  )}
</Card>,

// ---------- Card: FunCard-Champion
<Card key="funCardChampion" title="🏆 Wer ist der FunCard-Champion?">
  {funCardChampion.top3.length > 0 && funCardChampion.max > 0 ? (
    <>
      <p className="mb-2">
        <strong>{funCardChampion.max}</strong> Nennungen – Spitze:{' '}
        {funCardChampion.ranking
          .filter((entry) => entry.count === funCardChampion.max)
          .map((entry) => entry.angler)
          .join(', ')}
      </p>

      <ol className="space-y-2">
        {funCardChampion.top3.map((entry, idx) => {
          const isWinner = entry.count === funCardChampion.max;
          const share =
            funCardChampion.totalMentions > 0
              ? Math.round((entry.count / funCardChampion.totalMentions) * 100)
              : 0;
          return (
            <li key={entry.angler} className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="w-6 text-sm tabular-nums text-gray-500 dark:text-gray-400">
                  {idx + 1}.
                </span>
                <span
                  className={`font-medium ${
                    isWinner
                      ? 'text-pink-700 dark:text-pink-300'
                      : 'text-green-700 dark:text-green-300'
                  }`}
                >
                  {entry.angler} {isWinner ? '👑' : ''}
                </span>
              </div>
              <div className="text-right">
                <div className="text-xl font-bold text-green-700 dark:text-green-300">
                  {entry.count}x
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {share}% der Nennungen
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      {funCardChampion.ranking.length > 3 && (
        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
          Auf den Plätzen:{' '}
          {funCardChampion.ranking
            .slice(3, 7)
            .map((entry) => entry.angler)
            .join(', ')}
        </p>
      )}

      <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
        Basis: {funCardChampion.totalMentions} Namensnennungen (exkl. Champion-Karte).
      </p>
    </>
  ) : (
    <p className="text-gray-600 dark:text-gray-300">Keine auswertbaren Nennungen.</p>
  )}
          </Card>,



        ],
    [
      mostInOneDay,
      biggest,
      smallest,
      mostInOneHour,
      mostSpeciesInOneDay,
      mostMonsterFishes,
      mostFishesDay,
      mostFishesMonth,
      mostTopTenFishesMonth,
      topTenAnglers,
      topMonthsByAvgSize,
      mostFishesWeekday,
      mostSpeciesInOneHour,
      mostPlacesAngler,
      predatorKing,
      heaviestFish,
      mostEfficientAngler,
      mostRotaugen,
      pikeMaster,
      mostAtFullMoon,
      mostAtNewMoon,
      nightOwls,
      earlyBird,
      mostInRain,
      sunshineOnly,
      topThreeSpecies,
      activitySummary,
      avgPerAnglerDayByMonth,
      longestBreakBetweenCatchDays,
      longestCatchStreak,
      fishPairs,
      zanderQueen,
      eelWizard,
      grundelChampion,
      foreignAnglers,
      schneiderKoenig,
      worstBlankMonth,
      hottestCatch,
      frostCatch,
      extremeWeatherCatch,
      angelQueen,
      recordHunter,
      photoArtist,
      funCardChampion,
      averageSizeByAngler.top3
    ]
  );

  const sections = useMemo(() => {
    const grouped = [];
    const byGroup = new Map();
    let counter = 0;

    cards.forEach((card, idx) => {
      if (!React.isValidElement(card)) return;

      const cardKey = card.key ?? `card-${idx}`;
      const groupTitle = CARD_GROUPS[cardKey] || GROUP_LABELS.HIGHLIGHTS;

      let section = byGroup.get(groupTitle);
      if (!section) {
        section = { title: groupTitle, cards: [] };
        byGroup.set(groupTitle, section);
        grouped.push(section);
      }

      counter += 1;
      section.cards.push(
        <SectionCard key={cardKey} number={counter} title={card.props.title}>
          {card.props.children}
        </SectionCard>
      );
    });

    return grouped;
  }, [cards]);
  return (
    <div className="space-y-10 max-w-5xl mx-auto">
      {sections.map((section) => (
        <section key={section.title} className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-2xl font-semibold text-green-700 dark:text-green-300">
              {section.title}
            </h3>
            <span className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
              {section.cards.length} Themen
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {section.cards}
          </div>
        </section>
      ))}
    </div>
  );
}
