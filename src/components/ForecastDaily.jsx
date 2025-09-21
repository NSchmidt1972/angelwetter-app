// src/components/ForecastDaily.jsx
function getMoonDescription(phase) {
  if (phase === 0 || phase === 1) return '🌑 Neumond';
  if (phase < 0.25) return '🌒 zunehmend';
  if (phase === 0.25) return '🌓 erstes Viertel';
  if (phase < 0.5) return '🌔 zunehmend';
  if (phase === 0.5) return '🌕 Vollmond';
  if (phase < 0.75) return '🌖 abnehmend';
  if (phase === 0.75) return '🌗 letztes Viertel';
  return '🌘 abnehmend';
}

function windDirection(deg) {
  const dirs = ['N', 'NO', 'O', 'SO', 'S', 'SW', 'W', 'NW'];
  return dirs[Math.round(deg / 45) % 8];
}

export default function ForecastDaily({ data }) {
  if (!data?.daily) return null;

  const nextDays = data.daily.slice(0, 7);

  return (
    <div style={{ marginTop: '2rem' }}>
      <h2>Vorhersage für die nächsten 7 Tage</h2>
      <div style={{
        display: 'flex',
        gap: '1rem',
        flexWrap: 'wrap',
        padding: '1rem 0'
      }}>
        {nextDays.map((day, index) => {
          const date = new Date(day.dt * 1000);
          const weekday = date.toLocaleDateString('de-DE', { weekday: 'short' });
          const icon = day.weather[0].icon;
          const desc = day.weather[0].description;
          const temp = Math.round(day.temp.day);
          const pop = Math.round((day.pop || 0) * 100);
          const rain = day.rain ?? 0;
          const moon = getMoonDescription(day.moon_phase);
          const pressure = day.pressure;
          const wind = day.wind_speed;
          const windDeg = day.wind_deg;

          return (
            <div key={index} style={{
              flex: '1 1 140px',
              textAlign: 'center',
              padding: '0.5rem',
              border: '1px solid #ddd',
              borderRadius: '8px',
              backgroundColor: '#f0f0f0'
            }}>
              <strong>{weekday}</strong>
              <br />
              <img
                src={`https://openweathermap.org/img/wn/${icon}@2x.png`}
                alt={desc}
                style={{ width: '50px', height: '50px' }}
              />
              <div>{temp} °C</div>
              <small>{desc}</small>
              <div style={{ marginTop: '0.5rem' }}>
                🌧️ {pop}%
                {pop > 1 && (
                  <>
                    <br />💧 {rain} mm
                  </>
                )}
              </div>
              <div style={{ marginTop: '0.5rem' }}>
                🧪 {pressure} hPa<br />
                🧭 {windDirection(windDeg)} ({wind} m/s)
              </div>
              <div style={{ marginTop: '0.5rem' }}>{moon}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
