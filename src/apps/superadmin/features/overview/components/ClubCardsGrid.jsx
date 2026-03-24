import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { formatDateTime } from '@/utils/dateUtils';
import {
  CLUB_STATUS_OPTIONS,
  formatDayKey,
  getClubStatus,
  getClubStatusBadgeClasses,
} from '@/apps/superadmin/features/overview/utils/overviewUtils';

function hasMultipleAnglers(entries) {
  const anglers = new Set();
  (entries || []).forEach((entry) => {
    const normalized = String(entry?.angler || '').trim().toLowerCase();
    if (normalized) anglers.add(normalized);
  });
  return anglers.size > 1;
}

function ActivityTile({ title, activity, emptyLabel, showFish = false, onOpenPopup }) {
  const entries = Array.isArray(activity?.entries) ? activity.entries : [];
  const primaryEntry = entries[0] || null;
  const multipleAnglers = hasMultipleAnglers(entries);

  return (
    <div className="rounded border border-slate-200 bg-slate-50 p-2">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">{title}</div>
      {primaryEntry ? (
        <>
          <div className="text-xs text-slate-500">{formatDayKey(activity.dayKey)}</div>
          <div className="truncate text-sm font-medium text-slate-800">
            {primaryEntry.angler}
            {showFish ? ` – ${primaryEntry.fish}` : ''}
          </div>
          {multipleAnglers ? (
            <button
              type="button"
              className="mt-1 text-xs font-semibold text-blue-700 hover:underline"
              onClick={(event) => {
                event.stopPropagation();
                onOpenPopup();
              }}
            >
              Liste anzeigen ({entries.length})
            </button>
          ) : null}
        </>
      ) : (
        <div className="mt-1 text-sm text-slate-500">{emptyLabel}</div>
      )}
    </div>
  );
}

export default function ClubCardsGrid({
  filteredClubs,
  stats,
  supportsWeatherMetrics,
  latestClubActivityByClub,
}) {
  const navigate = useNavigate();
  const [popupData, setPopupData] = useState(null);

  useEffect(() => {
    if (!popupData) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setPopupData(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [popupData]);

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2">
        {filteredClubs.map((club) => {
          const clubId = club.id;
          const logoUrl = String(club.logo_url || '').trim();
          const totalMembers = stats.memberCount[clubId] || 0;
          const activeMembers = stats.activeMemberCount[clubId] || 0;
          const fishTotal = stats.fishCount[clubId] || 0;
          const openWeatherRequests = supportsWeatherMetrics ? (stats.requestCount[clubId] || 0) : null;
          const status = getClubStatus(club, { memberCount: totalMembers, fishCount: fishTotal });
          const statusLabel =
            CLUB_STATUS_OPTIONS.find((option) => option.key === status)?.label || 'Unbekannt';
          const clubActivity = latestClubActivityByClub?.[clubId] || null;

          const openPopupFor = (title, activity, showFish) => {
            if (!activity || !Array.isArray(activity.entries) || activity.entries.length === 0) return;
            setPopupData({
              clubName: club.name || 'Club',
              title,
              dayKey: activity.dayKey,
              entries: activity.entries,
              showFish,
            });
          };

          return (
            <div
              key={clubId}
              className="min-w-0 rounded-lg border bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
              role="link"
              tabIndex={0}
              onClick={() => navigate(`/superadmin/clubs/${clubId}`)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  navigate(`/superadmin/clubs/${clubId}`);
                }
              }}
            >
              <div className="mb-2 flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <Link to={`/superadmin/clubs/${clubId}`} className="flex min-w-0 items-center gap-3">
                  <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full border border-gray-200 bg-white">
                    {logoUrl ? (
                      <img
                        src={logoUrl}
                        alt={`${club.name || 'Club'} Logo`}
                        className="h-full w-full object-cover"
                        loading="lazy"
                        onError={(event) => {
                          event.currentTarget.style.display = 'none';
                        }}
                      />
                    ) : null}
                  </div>

                  <div className="min-w-0">
                    <h2 className="break-words text-lg font-semibold text-gray-800">{club.name}</h2>
                    <div className="break-all text-sm text-gray-500 sm:truncate">
                      Slug: {club.slug} | Host: {club.host || '—'}
                    </div>
                  </div>
                </Link>

                <div className="flex shrink-0 flex-col items-end gap-2 text-right">
                  <div className="break-all text-[11px] leading-tight text-gray-500 sm:text-xs">{clubId}</div>
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${getClubStatusBadgeClasses(status)}`}
                  >
                    {statusLabel}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                <div className="rounded border border-blue-100 bg-blue-50 p-2 text-center">
                  <div className="text-xs text-gray-500">Mitglieder</div>
                  <div className="text-lg font-semibold text-blue-700">{totalMembers}</div>
                </div>
                <div className="rounded border border-green-100 bg-green-50 p-2 text-center">
                  <div className="text-xs text-gray-500">Aktiv</div>
                  <div className="text-lg font-semibold text-green-700">{activeMembers}</div>
                </div>
                <div className="rounded border border-indigo-100 bg-indigo-50 p-2 text-center">
                  <div className="text-xs text-gray-500">Fänge</div>
                  <div className="text-lg font-semibold text-indigo-700">{fishTotal}</div>
                </div>
                <div className="rounded border border-emerald-100 bg-emerald-50 p-2 text-center">
                  <div className="text-xs text-gray-500">OWM-Req.</div>
                  <div className="text-lg font-semibold text-emerald-700">
                    {supportsWeatherMetrics ? openWeatherRequests : '—'}
                  </div>
                </div>
              </div>

              <div className="mt-3 grid gap-2 xl:grid-cols-3">
                <ActivityTile
                  title="Letzter Fangtag"
                  activity={clubActivity?.latestCatchDay}
                  emptyLabel="Kein Fang"
                  showFish
                  onOpenPopup={() => openPopupFor('Letzter Fangtag', clubActivity?.latestCatchDay, true)}
                />
                <ActivityTile
                  title="Letzter Schneidertag"
                  activity={clubActivity?.latestBlankDay}
                  emptyLabel="Kein Schneider"
                  onOpenPopup={() => openPopupFor('Letzter Schneidertag', clubActivity?.latestBlankDay, false)}
                />
                <ActivityTile
                  title="Letzter entnommener Fisch"
                  activity={clubActivity?.latestTakenDay}
                  emptyLabel="Kein entnommener Fisch"
                  showFish
                  onOpenPopup={() =>
                    openPopupFor('Letzter entnommener Fisch', clubActivity?.latestTakenDay, true)
                  }
                />
              </div>
            </div>
          );
        })}
      </div>

      {filteredClubs.length === 0 ? (
        <div className="rounded border border-dashed border-gray-300 px-4 py-6 text-center text-sm text-gray-500 dark:border-gray-700 dark:text-gray-300">
          Keine Vereine für den gewählten Filter.
        </div>
      ) : null}

      {popupData ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4"
          role="presentation"
          onClick={() => setPopupData(null)}
        >
          <div
            className="w-full max-w-xl rounded-lg bg-white p-4 shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-label={`${popupData.title} Liste`}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-gray-800">{popupData.title}</h3>
                <p className="text-sm text-gray-500">
                  {popupData.clubName} · {formatDayKey(popupData.dayKey)}
                </p>
              </div>
              <button
                type="button"
                className="rounded border border-gray-300 px-2 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-100"
                onClick={() => setPopupData(null)}
              >
                Schließen
              </button>
            </div>

            <ul className="max-h-80 space-y-2 overflow-y-auto text-sm text-gray-700">
              {popupData.entries.map((entry, index) => (
                <li key={`${entry.angler}-${entry.timestamp}-${index}`} className="rounded border border-gray-200 p-2">
                  <div className="font-medium">
                    {entry.angler}
                    {popupData.showFish ? ` – ${entry.fish}` : ''}
                  </div>
                  <div className="text-xs text-gray-500">{formatDateTime(entry.timestamp)}</div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
    </>
  );
}
