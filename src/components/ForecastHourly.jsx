// src/components/ForecastHourly.jsx
export default function ForecastHourly({ data }) {
  if (!data?.hourly) return null;

  const nextHours = data.hourly.slice(0, 12); // nächste 12 Stunden

  function windDirection(deg) {
    const dirs = ['N', 'NO', 'O', 'SO', 'S', 'SW', 'W', 'NW'];
    return dirs[Math.round(deg / 45) % 8];
  }

  return (
    <div style={{ marginTop: '2rem' }}>
      <h2>Stündliche Vorhersage (24h)</h2>
      <div style={{
        display: 'flex',
        overflowX: 'auto',
        gap: '1rem',
        padding: '1rem 0'
      }}>
        {nextHours.map((hour, index) => {
          const time = new Date(hour.dt * 1000).getHours();
          const icon = hour.weather[0].icon;
          const desc = hour.weather[0].description;
          const temp = Math.round(hour.temp);
          const pop = Math.round((hour.pop || 0) * 100);
          const rain = hour.rain?.['1h'] ?? 0;
          const pressure = hour.pressure;
          const wind = hour.wind_speed;
          const windDeg = hour.wind_deg;

          return (
            <div key={index} style={{
              minWidth: '140px',
              textAlign: 'center',
              padding: '0.5rem',
              border: '1px solid #ddd',
              borderRadius: '8px',
              backgroundColor: '#f9f9f9'
            }}>
              <strong>{time} Uhr</strong>
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
              <div style={{ marginTop: '0.5rem', fontSize: '0.85em' }}>
                🧭 {windDirection(windDeg)} ({wind} m/s)<br />
                🧪 {pressure} hPa
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
