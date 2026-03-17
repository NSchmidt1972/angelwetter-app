export default function WhitelistSection({
  sectionId,
  showWhitelist,
  onToggleWhitelist,
  showToggle = true,
  newEmail,
  onChangeNewEmail,
  addingEmail,
  whitelist,
  whitelistLoading,
  whitelistError,
  whitelistMessage,
  onAddEmail,
  onRemoveEmail,
  formatDate,
}) {
  const whitelistEmails = Array.isArray(whitelist)
    ? whitelist.map((entry) => String(entry?.email || '').trim()).filter(Boolean)
    : [];
  const bccList = whitelistEmails.join(',');
  const mailtoHref = bccList ? `mailto:?bcc=${encodeURIComponent(bccList)}` : 'mailto:';

  const handleEmailAll = () => {
    if (!bccList) return;
    if (typeof window === 'undefined') return;
    window.location.href = mailtoHref;
  };

  const isOpen = showToggle ? showWhitelist : true;

  return (
    <section id={sectionId} className="scroll-mt-24 bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-blue-700 dark:text-blue-300">Whitelist verwalten</h2>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Nur E-Mail-Adressen auf der Whitelist dürfen neue Accounts erstellen.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleEmailAll}
            disabled={!bccList}
            className={`rounded px-4 py-2 text-sm font-semibold transition ${
              bccList
                ? 'border border-emerald-600 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-400 dark:text-emerald-200 dark:hover:bg-emerald-900/30'
                : 'cursor-not-allowed border border-emerald-200 text-emerald-300 dark:border-emerald-800/40 dark:text-emerald-400/60'
            }`}
          >
            E-Mail an alle
          </button>
          {showToggle ? (
            <button
              type="button"
              onClick={onToggleWhitelist}
              aria-expanded={showWhitelist}
              className={`rounded px-4 py-2 text-sm font-semibold transition ${
                showWhitelist
                  ? 'border border-blue-600 text-blue-600 hover:bg-blue-50 dark:border-blue-400 dark:text-blue-200 dark:hover:bg-blue-900/30'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              {showWhitelist ? 'Liste verbergen' : 'Liste anzeigen'}
            </button>
          ) : null}
        </div>
      </div>

      {isOpen && (
        <>
          <form className="mt-4 flex flex-col gap-2 sm:flex-row" onSubmit={onAddEmail}>
            <input
              type="email"
              value={newEmail}
              onChange={(event) => onChangeNewEmail(event.target.value)}
              placeholder="E-Mail hinzufügen"
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-900 dark:text-white sm:w-60"
              required
            />
            <button
              type="submit"
              disabled={addingEmail}
              className={`rounded px-4 py-2 text-sm font-semibold text-white ${
                addingEmail ? 'bg-blue-300' : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {addingEmail ? 'Speichert...' : 'Hinzufügen'}
            </button>
          </form>

          {(whitelistError || whitelistMessage) && (
            <div
              className={`mt-4 rounded border px-3 py-2 text-sm ${
                whitelistError
                  ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-800/40 dark:bg-red-900/30 dark:text-red-200'
                  : 'border-green-200 bg-green-50 text-green-700 dark:border-green-800/40 dark:bg-green-900/30 dark:text-green-200'
              }`}
            >
              {whitelistError || whitelistMessage}
            </div>
          )}

          <div className="mt-6 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-200">
                <tr>
                  <th className="px-4 py-2 text-left font-semibold">E-Mail</th>
                  <th className="px-4 py-2 text-left font-semibold">Freigeschaltet seit</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody>
                {whitelistLoading ? (
                  <tr>
                    <td colSpan={3} className="px-4 py-4 text-center text-gray-500">
                      Lädt Whitelist...
                    </td>
                  </tr>
                ) : whitelist.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-4 py-4 text-center text-gray-500">
                      Keine E-Mails gespeichert.
                    </td>
                  </tr>
                ) : (
                  whitelist.map((entry) => (
                    <tr key={entry.email} className="border-b border-gray-100 last:border-0 dark:border-gray-700">
                      <td className="px-4 py-2 font-mono text-[13px] text-gray-800 dark:text-gray-200">
                        {entry.email}
                      </td>
                      <td className="px-4 py-2 text-gray-600 dark:text-gray-300">{formatDate(entry.created_at)}</td>
                      <td className="px-4 py-2 text-right">
                        <button
                          type="button"
                          onClick={() => onRemoveEmail(entry.email)}
                          className="rounded px-3 py-1 text-xs font-semibold text-red-600 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-900/30"
                        >
                          Entfernen
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
