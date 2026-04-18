// Exports a lookup function that maps WMO codes to the corresponding entry

// This mapping has been AI generated with info to the WMO code mapping
// https://open-meteo.com/en/docs#weather_variable_documentation and the icon
// list from https://erikflowers.github.io/weather-icons/
const data = [
  {
    "codes": [0],
    "description": "Clear sky",
    "isDangerous": false,
    "day": { "iconClass": "wi-day-sunny", "codePoint": "\uF00D" },
    "night": { "iconClass": "wi-night-clear", "codePoint": "\uF02E" }
  },
  {
    "codes": [1],
    "description": "Mainly clear",
    "isDangerous": false,
    "day": { "iconClass": "wi-day-sunny-overcast", "codePoint": "\uF00C" },
    "night": { "iconClass": "wi-night-alt-partly-cloudy", "codePoint": "\uF081" }
  },
  {
    "codes": [2],
    "description": "Partly cloudy",
    "isDangerous": false,
    "day": { "iconClass": "wi-day-cloudy", "codePoint": "\uF002" },
    "night": { "iconClass": "wi-night-alt-cloudy", "codePoint": "\uF086" }
  },
  {
    "codes": [3],
    "description": "Overcast",
    "isDangerous": false,
    "day": { "iconClass": "wi-cloudy", "codePoint": "\uF013" },
    "night": { "iconClass": "wi-cloudy", "codePoint": "\uF013" }
  },
  {
    "codes": [45],
    "description": "Fog",
    "isDangerous": true,
    "day": { "iconClass": "wi-day-fog", "codePoint": "\uF003" },
    "night": { "iconClass": "wi-night-fog", "codePoint": "\uF04A" }
  },
  {
    "codes": [48],
    "description": "Depositing rime fog",
    "isDangerous": true,
    "day": { "iconClass": "wi-day-fog", "codePoint": "\uF003" },
    "night": { "iconClass": "wi-night-fog", "codePoint": "\uF04A" }
  },
  {
    "codes": [51],
    "description": "Drizzle: Light intensity",
    "isDangerous": false,
    "day": { "iconClass": "wi-day-sprinkle", "codePoint": "\uF00B" },
    "night": { "iconClass": "wi-night-alt-sprinkle", "codePoint": "\uF02B" }
  },
  {
    "codes": [53],
    "description": "Drizzle: Moderate intensity",
    "isDangerous": false,
    "day": { "iconClass": "wi-day-sprinkle", "codePoint": "\uF00B" },
    "night": { "iconClass": "wi-night-alt-sprinkle", "codePoint": "\uF02B" }
  },
  {
    "codes": [55],
    "description": "Drizzle: Dense intensity",
    "isDangerous": true,
    "day": { "iconClass": "wi-day-showers", "codePoint": "\uF009" },
    "night": { "iconClass": "wi-night-alt-showers", "codePoint": "\uF029" }
  },
  {
    "codes": [56],
    "description": "Freezing Drizzle: Light intensity",
    "isDangerous": true,
    "day": { "iconClass": "wi-day-sleet", "codePoint": "\uF0B2" },
    "night": { "iconClass": "wi-night-alt-sleet", "codePoint": "\uF0B4" }
  },
  {
    "codes": [57],
    "description": "Freezing Drizzle: Dense intensity",
    "isDangerous": true,
    "day": { "iconClass": "wi-sleet", "codePoint": "\uF0B5" },
    "night": { "iconClass": "wi-sleet", "codePoint": "\uF0B5" }
  },
  {
    "codes": [61],
    "description": "Rain: Slight intensity",
    "isDangerous": false,
    "day": { "iconClass": "wi-day-rain", "codePoint": "\uF008" },
    "night": { "iconClass": "wi-night-alt-rain", "codePoint": "\uF028" }
  },
  {
    "codes": [63],
    "description": "Rain: Moderate intensity",
    "isDangerous": false,
    "day": { "iconClass": "wi-day-rain", "codePoint": "\uF008" },
    "night": { "iconClass": "wi-night-alt-rain", "codePoint": "\uF028" }
  },
  {
    "codes": [65],
    "description": "Rain: Heavy intensity",
    "isDangerous": true,
    "day": { "iconClass": "wi-rain", "codePoint": "\uF019" },
    "night": { "iconClass": "wi-rain", "codePoint": "\uF019" }
  },
  {
    "codes": [66, 67],
    "description": "Freezing Rain: Light and heavy",
    "isDangerous": true,
    "day": { "iconClass": "wi-day-rain-mix", "codePoint": "\uF006" },
    "night": { "iconClass": "wi-night-alt-rain-mix", "codePoint": "\uF026" }
  },
  {
    "codes": [71],
    "description": "Snow fall: Slight intensity",
    "isDangerous": false,
    "day": { "iconClass": "wi-day-snow", "codePoint": "\uF00A" },
    "night": { "iconClass": "wi-night-alt-snow", "codePoint": "\uF02A" }
  },
  {
    "codes": [73],
    "description": "Snow fall: Moderate intensity",
    "isDangerous": true,
    "day": { "iconClass": "wi-day-snow", "codePoint": "\uF00A" },
    "night": { "iconClass": "wi-night-alt-snow", "codePoint": "\uF02A" }
  },
  {
    "codes": [75],
    "description": "Snow fall: Heavy intensity",
    "isDangerous": true,
    "day": { "iconClass": "wi-snow", "codePoint": "\uF01B" },
    "night": { "iconClass": "wi-snow", "codePoint": "\uF01B" }
  },
  {
    "codes": [77],
    "description": "Snow grains",
    "isDangerous": false,
    "day": { "iconClass": "wi-day-snow", "codePoint": "\uF00A" },
    "night": { "iconClass": "wi-night-alt-snow", "codePoint": "\uF02A" }
  },
  {
    "codes": [80, 81],
    "description": "Rain showers: Slight and moderate",
    "isDangerous": false,
    "day": { "iconClass": "wi-day-showers", "codePoint": "\uF009" },
    "night": { "iconClass": "wi-night-alt-showers", "codePoint": "\uF029" }
  },
  {
    "codes": [82],
    "description": "Rain showers: Violent",
    "isDangerous": true,
    "day": { "iconClass": "wi-storm-showers", "codePoint": "\uF01D" },
    "night": { "iconClass": "wi-storm-showers", "codePoint": "\uF01D" }
  },
  {
    "codes": [85, 86],
    "description": "Snow showers: Slight and heavy",
    "isDangerous": true,
    "day": { "iconClass": "wi-day-snow", "codePoint": "\uF00A" },
    "night": { "iconClass": "wi-night-alt-snow", "codePoint": "\uF02A" }
  },
  {
    "codes": [95],
    "description": "Thunderstorm: Slight or moderate",
    "isDangerous": true,
    "day": { "iconClass": "wi-day-thunderstorm", "codePoint": "\uF010" },
    "night": { "iconClass": "wi-night-alt-thunderstorm", "codePoint": "\uF02D" }
  },
  {
    "codes": [96, 99],
    "description": "Thunderstorm with hail",
    "isDangerous": true,
    "day": { "iconClass": "wi-day-sleet-storm", "codePoint": "\uF068" },
    "night": { "iconClass": "wi-night-alt-sleet-storm", "codePoint": "\uF06A" }
  }
];

const map = new Map();
for (const entry of data) {
  if (!entry || !Array.isArray(entry.codes)) continue;
  for (const c of entry.codes) {
    map.set(Number(c), entry);
  }
}

export function lookupWeatherIcon(code) {
  const n = Number(code);
  if (Number.isNaN(n)) return null;
  return map.get(n) || null;
}

// Helper: decide day/night and return codePoint + flags
export function pickCodePoint(entry, date = new Date(), timeZone = 'Europe/Berlin') {
  if (!entry) return { codePoint: null, isNight: false, isDangerous: false };
  // Get hour in given timezone
  const hourStr = new Intl.DateTimeFormat('en-US', { hour: '2-digit', hour12: false, timeZone }).format(date);
  const hour = Number(hourStr);
  const isNight = hour < 6 || hour >= 18;
  const cp = isNight ? (entry.night && entry.night.codePoint) : (entry.day && entry.day.codePoint);
  return { codePoint: cp || null, isNight, isDangerous: !!entry.isDangerous };
}
