import { useEffect, useRef } from 'react';
import PageContainer from '../components/PageContainer';
import AnalysisSummaryCard from '@/features/analysis/components/AnalysisSummaryCard';
import StatListCard from '@/features/analysis/components/StatListCard';
import WeatherFishFilter from '@/features/analysis/components/WeatherFishFilter';
import YearMonthOverview from '@/features/analysis/components/YearMonthOverview';
import useAnalysisData from '@/features/analysis/hooks/useAnalysisData';
import { ANALYSIS_YEAR_FILTER_ALL, MONTH_NAMES } from '@/features/analysis/utils';
import { usePermissions } from '@/permissions/usePermissions';
import { FEATURES } from '@/permissions/features';

export default function Analysis({ anglerName }) {
  const { hasFeatureForRole } = usePermissions();
  const canSeeWaterTemperature = hasFeatureForRole(FEATURES.WATER_TEMPERATURE);
  const {
    selectedYear,
    setSelectedYear,
    onlyMine,
    setOnlyMine,
    selectedFish,
    setSelectedFish,
    totalFishes,
    catchSessions,
    blankSessions,
    blankSessionRatio,
    sortedYears,
    yearMonthStats,
    yearTotalStats,
    yearTotalCount,
    fishOptions,
    tempStats,
    waterTempStats,
    pressureStats,
    windStats,
    windDirStats,
    humidityStats,
    descStats,
    moonStats,
    hourStats,
    activeKeys,
    descIconMap,
  } = useAnalysisData({ anglerName });

  const currentMonthIndex = new Date().getMonth();
  const monthRefs = useRef([]);

  useEffect(() => {
    if (monthRefs.current[currentMonthIndex]) {
      monthRefs.current[currentMonthIndex]?.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'center',
      });
    }
  }, [selectedYear, currentMonthIndex]);

  return (
    <PageContainer>
      <h2 className="text-3xl font-bold mb-6 text-center text-blue-700 dark:text-blue-300">📊 Statistik & Analyse</h2>

      <div className="flex justify-center items-center gap-4 mb-4 text-sm text-gray-600 dark:text-gray-300">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={onlyMine}
            onChange={() => setOnlyMine((prev) => !prev)}
            className="accent-blue-600"
          />
          Nur meine Fänge
        </label>
      </div>

      <AnalysisSummaryCard
        totalFishes={totalFishes}
        catchSessions={catchSessions}
        blankSessions={blankSessions}
        blankSessionRatio={blankSessionRatio}
      />

      <div className="flex flex-wrap gap-2 mb-6 justify-center">
        {[ANALYSIS_YEAR_FILTER_ALL, ...sortedYears].map((year) => {
          const isAll = year === ANALYSIS_YEAR_FILTER_ALL;
          return (
            <button
              key={isAll ? 'all-years' : year}
              onClick={() => setSelectedYear(year)}
              className={`px-4 py-1 rounded-full border transition ${year === selectedYear
                ? 'bg-blue-600 text-white font-semibold'
                : 'bg-white dark:bg-gray-800 text-blue-700 dark:text-blue-300 border-blue-400 hover:bg-blue-100 dark:hover:bg-gray-700'
              }`}
              aria-pressed={year === selectedYear}
            >
              {isAll ? 'Alle' : year}
            </button>
          );
        })}
      </div>

      <YearMonthOverview
        selectedYear={selectedYear}
        yearMonthStats={yearMonthStats}
        currentMonthIndex={currentMonthIndex}
        monthRefs={monthRefs}
        monthNames={MONTH_NAMES}
        yearTotalCount={yearTotalCount}
        yearTotalStats={yearTotalStats}
      />

      <WeatherFishFilter
        selectedFish={selectedFish}
        setSelectedFish={setSelectedFish}
        fishOptions={fishOptions}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto mt-6">
        <StatListCard title="🌡 Temperaturbereiche" stats={tempStats} activeKey={activeKeys.temp} descIconMap={descIconMap} />
        {canSeeWaterTemperature && (
          <StatListCard title="🌊 Wassertemperatur" stats={waterTempStats} activeKey={activeKeys.waterTemp} descIconMap={descIconMap} />
        )}
        <StatListCard title="🧪 Luftdruck" stats={pressureStats} activeKey={activeKeys.pressure} descIconMap={descIconMap} />
        <StatListCard title="💨 Windstärken" stats={windStats} activeKey={activeKeys.wind} descIconMap={descIconMap} />
        <StatListCard title="🧭 Windrichtungen" stats={windDirStats} activeKey={activeKeys.windDir} descIconMap={descIconMap} />
        <StatListCard title="💦 Luftfeuchtigkeit" stats={humidityStats} activeKey={activeKeys.humidity} descIconMap={descIconMap} />
        <StatListCard title="🌦 Wetterbeschreibung" stats={descStats} activeKey={activeKeys.description} descIconMap={descIconMap} />
        <StatListCard title="🌙 Mondphasen" stats={moonStats} activeKey={activeKeys.moon} descIconMap={descIconMap} />
        <StatListCard title="⏰ Fangzeiten" stats={hourStats} activeKey={activeKeys.time} descIconMap={descIconMap} />
      </div>
    </PageContainer>
  );
}
