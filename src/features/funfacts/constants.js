// Shared constants for fun facts computations and presentation
export const PREDATOR_SET = new Set(['barsch', 'aal', 'hecht', 'zander', 'wels']);

export const PREDATOR_LABELS = {
  barsch: 'Barsch',
  aal: 'Aal',
  hecht: 'Hecht',
  zander: 'Zander',
  wels: 'Wels',
};

export const MIN_EFFICIENCY_DAYS = 3;

export const PLACE_ALIASES = [
  [/lob+er+ich/i, 'Ferkensbruch'],
  [/ferkens?bruch/i, 'Ferkensbruch'],
  [/^\s*(null|undefined|-)\s*$/i, 'Ferkensbruch'],
];

export const WEATHER_KEYWORD_SCORES = [
  { regex: /(gewitter|thunder|storm|sturm|orkan|blitz)/i, score: 25, label: 'Gewitter/Sturm' },
  { regex: /(hagel|hail)/i, score: 18, label: 'Hagel' },
  { regex: /(schnee|snow|eisregen|sleet|glatteis)/i, score: 14, label: 'Schnee/Eis' },
  { regex: /(starke[rn]? regen|heftiger regen|downpour|wolkenbruch|heavy rain)/i, score: 12, label: 'Heftiger Regen (Text)' },
  { regex: /(böe|böen|gust|gale|orkanartig)/i, score: 10, label: 'Sturmböen' },
  { regex: /(nebel|fog|dunst)/i, score: 6, label: 'Dichter Nebel' },
];

export const COMFORT_TEMP_C = 18;
export const TEMP_TOLERANCE = 2; // kleiner Korridor ohne Strafpunkte
export const WIND_COMFORT = 4; // m/s – darüber wird's ungemütlicher
