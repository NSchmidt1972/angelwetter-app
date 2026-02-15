function pickFirstFormattedDate(...candidates) {
  for (const candidate of candidates) {
    const formatted = formatDateTime(candidate);
    if (formatted) return formatted;
  }
  return null;
}

function formatDateTime(value) {
  if (value == null || value === '') return null;

  let date = null;
  if (typeof value === 'number') {
    const timestamp = value < 1_000_000_000_000 ? value * 1000 : value;
    date = new Date(timestamp);
  } else if (typeof value === 'string') {
    const asNumber = Number(value);
    if (Number.isFinite(asNumber)) {
      const timestamp = asNumber < 1_000_000_000_000 ? asNumber * 1000 : asNumber;
      date = new Date(timestamp);
    } else {
      date = new Date(value);
    }
  } else if (value instanceof Date) {
    date = value;
  }

  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;

  return date.toLocaleString('de-DE', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function getModelTrainingRows(aiPrediction) {
  if (!aiPrediction || typeof aiPrediction !== 'object') return [];

  const rows = [
    {
      label: 'Hauptmodell',
      value: pickFirstFormattedDate(
        aiPrediction?.trained_at,
        aiPrediction?.model_trained_at,
        aiPrediction?.last_trained_at,
        aiPrediction?.models?.main?.trained_at,
        aiPrediction?.models?.main?.model_trained_at,
        aiPrediction?.models?.main?.last_trained_at,
        aiPrediction?.stats?.trained_at,
        aiPrediction?.stats?.model_trained_at,
        aiPrediction?.stats?.last_trained_at,
        aiPrediction?.metadata?.trained_at,
        aiPrediction?.meta?.trained_at
      ),
    },
    {
      label: 'Fischarten-Modell',
      value: pickFirstFormattedDate(
        aiPrediction?.models?.per_fish_type?.trained_at,
        aiPrediction?.models?.species?.trained_at,
        aiPrediction?.stats?.per_fish_model_trained_at,
        aiPrediction?.stats?.species_model_trained_at,
        aiPrediction?.metadata?.per_fish_model_trained_at
      ),
    },
  ].filter((row) => !!row.value);

  return rows;
}

export function formatMetric(value, unit) {
  const num = Number(value);
  if (!Number.isFinite(num)) return 'n/a';
  return `${num.toFixed(2)} ${unit}`;
}

export function formatSignedMetric(value, unit) {
  const num = Number(value);
  if (!Number.isFinite(num)) return 'n/a';
  const sign = num > 0 ? '+' : '';
  return `${sign}${num.toFixed(2)} ${unit}`;
}
