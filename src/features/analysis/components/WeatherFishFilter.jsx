export default function WeatherFishFilter({ selectedFish, setSelectedFish, fishOptions }) {
  return (
    <div className="max-w-4xl mx-auto mt-10 mb-4">
      <label className="block text-sm font-medium text-blue-700 dark:text-blue-300 mb-2">
        Wetterauswertungen filtern nach Fisch
      </label>
      <div className="flex items-center gap-3">
        <select
          value={selectedFish}
          onChange={(event) => setSelectedFish(event.target.value)}
          className="w-full md:w-80 px-3 py-2 rounded-lg border border-blue-300 dark:border-blue-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="Alle">Alle</option>
          {fishOptions.map((fishOption) => (
            <option key={fishOption} value={fishOption}>
              {fishOption}
            </option>
          ))}
        </select>
        {selectedFish !== 'Alle' && (
          <button
            type="button"
            onClick={() => setSelectedFish('Alle')}
            className="px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-sm hover:bg-gray-200 dark:hover:bg-gray-700"
            title="Filter zurücksetzen"
          >
            Zurücksetzen
          </button>
        )}
      </div>
    </div>
  );
}
