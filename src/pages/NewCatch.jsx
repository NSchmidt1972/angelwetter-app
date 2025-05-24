// ✅ NewCatch.jsx
import FishCatchForm from '../components/FishCatchForm';

export default function NewCatch({ anglerName, weatherData, setWeatherData }) {
  return (
    <div style={{ padding: '1rem' }}>
      {!weatherData ? (
        <p className="text-gray-500 text-center">Lade Wetterdaten…</p>
      ) : (
        <FishCatchForm
          weatherData={weatherData}
          anglerName={anglerName}
          setWeatherData={setWeatherData}
        />
      )}
    </div>
  );
}