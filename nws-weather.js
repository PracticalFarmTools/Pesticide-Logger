/* National Weather Service (api.weather.gov) parsing for Pesticide Logger.
 * Pure functions — no fetch, no DOM — so tests run under Node.
 *
 * NWS data is U.S. government work (public domain), free for commercial use,
 * and CORS-open. Browsers send their own User-Agent; do not set one here
 * (a custom User-Agent header fails the CORS preflight).
 *
 * Grid layers arrive as ISO-8601 intervals ("2026-09-24T04:00:00+00:00/PT2H")
 * with equal consecutive hours merged, in metric units. They are expanded
 * back to hourly rows in °F / mph / inches so the spray-window scorer and
 * stored records keep US customary units.
 */
(function (root) {
  'use strict';

  const BASE = 'https://api.weather.gov';
  const HOUR_MS = 3600000;

  function pointsUrl(lat, lng) {
    return `${BASE}/points/${Number(lat).toFixed(4)},${Number(lng).toFixed(4)}`;
  }

  function observationUrl(stationId) {
    return `${BASE}/stations/${encodeURIComponent(stationId)}/observations/latest`;
  }

  function parsePoint(json) {
    const p = json && json.properties;
    if (!p || !p.forecastGridData) return null;
    return {
      gridUrl: p.forecastGridData,
      stationsUrl: p.observationStations || null,
      timeZone: p.timeZone || null,
      gridId: p.gridId && p.gridX != null && p.gridY != null ? `${p.gridId} ${p.gridX},${p.gridY}` : null
    };
  }

  // "PT1H", "PT2H", "P1DT21H", "P7DT21H" -> whole hours (minimum 1).
  function durationHours(iso) {
    const m = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?)?$/.exec(String(iso || ''));
    if (!m) return 1;
    const h = (Number(m[1]) || 0) * 24 + (Number(m[2]) || 0) + (Number(m[3]) || 0) / 60;
    return Math.max(1, Math.round(h));
  }

  function toF(v, uom) {
    if (v == null || !Number.isFinite(Number(v))) return null;
    const n = Number(v);
    return /degF/.test(uom || '') ? n : n * 9 / 5 + 32;
  }

  function toMph(v, uom) {
    if (v == null || !Number.isFinite(Number(v))) return null;
    const n = Number(v);
    const u = uom || '';
    if (/m_s-1/.test(u)) return n * 2.236936;
    if (/mi_h-1|mph/.test(u)) return n;
    if (/kt|knot/.test(u)) return n * 1.150779;
    return n / 1.609344; // km_h-1 (NWS default)
  }

  function toInches(v, uom) {
    if (v == null || !Number.isFinite(Number(v))) return null;
    const n = Number(v);
    if (/in/.test(uom || '')) return n;
    if (/cm/.test(uom || '')) return n / 2.54;
    return n / 25.4; // mm
  }

  // Expand one grid layer to Map<hourStartMs, value>. perHour divides an
  // interval total (precipitation amount) across its hours.
  function expandLayer(layer, convert, perHour) {
    const out = new Map();
    if (!layer || !Array.isArray(layer.values)) return out;
    const uom = layer.uom || '';
    layer.values.forEach((entry) => {
      const [startIso, dur] = String(entry.validTime || '').split('/');
      const start = Date.parse(startIso);
      if (!Number.isFinite(start)) return;
      const hours = durationHours(dur);
      let value = convert ? convert(entry.value, uom) : entry.value;
      if (perHour && value != null) value = value / hours;
      for (let k = 0; k < hours; k++) out.set(start + k * HOUR_MS, value);
    });
    return out;
  }

  // NWS "weather" layer -> a WMO-style code the scorer already reads.
  // Only confident coverage counts as rain in the model; "chance" and
  // "slight_chance" are left to the precipitation probability, the same way
  // a coarse probability is treated today.
  const CONFIDENT = new Set(['likely', 'definite', 'occasional', 'numerous', 'widespread', 'periods', 'frequent']);
  const WEATHER_CODE = {
    thunderstorms: 95,
    rain_showers: 80,
    snow_showers: 85,
    freezing_rain: 66,
    freezing_drizzle: 56,
    rain: 61,
    drizzle: 51,
    snow: 71,
    sleet: 79,
    fog: 45,
    freezing_fog: 48
  };
  function weatherCode(entries) {
    if (!Array.isArray(entries)) return null;
    let best = null;
    entries.forEach((e) => {
      if (!e || !e.weather) return;
      const code = WEATHER_CODE[e.weather];
      if (code == null) return;
      const precip = code !== 45 && code !== 48;
      if (precip && e.coverage && !CONFIDENT.has(e.coverage)) return;
      if (best == null || code > best) best = code;
    });
    return best;
  }

  function pad(n) { return String(n).padStart(2, '0'); }

  // Wall-clock "YYYY-MM-DDTHH:00" in the field's time zone (what the
  // forecast UI groups by day and labels by hour).
  function localHourString(ms, timeZone) {
    const d = new Date(ms);
    if (timeZone && typeof Intl !== 'undefined') {
      try {
        const parts = new Intl.DateTimeFormat('en-US', {
          timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23'
        }).formatToParts(d).reduce((acc, p) => { acc[p.type] = p.value; return acc; }, {});
        return `${parts.year}-${parts.month}-${parts.day}T${parts.hour === '24' ? '00' : parts.hour}:00`;
      } catch (e) { /* unknown zone: device local below */ }
    }
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:00`;
  }

  function round1(n) { return n == null ? null : Math.round(n * 10) / 10; }

  // Gridpoint JSON -> hourly rows shaped like the spray-window scorer expects.
  function gridHours(json, nowMs, opts) {
    const p = json && json.properties;
    if (!p) return [];
    const maxHours = (opts && opts.maxHours) || 48;
    const timeZone = opts && opts.timeZone;
    const temp = expandLayer(p.temperature, toF);
    const rh = expandLayer(p.relativeHumidity);
    const wind = expandLayer(p.windSpeed, toMph);
    const gust = expandLayer(p.windGust, toMph);
    const dir = expandLayer(p.windDirection);
    const pop = expandLayer(p.probabilityOfPrecipitation);
    const qpf = expandLayer(p.quantitativePrecipitation, toInches, true);
    const sky = expandLayer(p.skyCover);
    const wx = expandLayer(p.weather, weatherCode);
    const keys = Array.from(wind.size ? wind.keys() : temp.keys()).sort((a, b) => a - b);
    const hours = [];
    for (const t of keys) {
      if (hours.length >= maxHours) break;
      if (t < nowMs) continue;
      const w = wind.get(t);
      const g = gust.get(t);
      hours.push({
        time: localHourString(t, timeZone),
        temp: temp.has(t) ? Math.round(temp.get(t)) : null,
        rh: rh.has(t) ? Math.round(rh.get(t)) : null,
        precipProb: pop.has(t) ? pop.get(t) : null,
        precip: qpf.has(t) ? Math.round(qpf.get(t) * 100) / 100 : 0,
        wind: round1(w),
        gusts: g != null ? round1(g) : round1(w),
        windDir: dir.has(t) ? dir.get(t) : null,
        skyCover: sky.has(t) ? sky.get(t) : null,
        weatherCode: wx.has(t) ? wx.get(t) : null,
        source: 'nws'
      });
    }
    return hours;
  }

  function haversineMiles(lat1, lng1, lat2, lng2) {
    const r = 3958.8;
    const rad = (d) => d * Math.PI / 180;
    const dLat = rad(lat2 - lat1);
    const dLng = rad(lng2 - lng1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2;
    return 2 * r * Math.asin(Math.sqrt(a));
  }

  // Stations list (already ordered nearest-first by NWS) -> [{ id, name, miles }].
  function parseStations(json, lat, lng) {
    const feats = json && Array.isArray(json.features) ? json.features : [];
    return feats.map((f) => {
      const c = f.geometry && f.geometry.coordinates;
      const props = f.properties || {};
      return {
        id: props.stationIdentifier,
        name: props.name || '',
        miles: Array.isArray(c) ? Math.round(haversineMiles(lat, lng, c[1], c[0])) : null
      };
    }).filter((s) => s.id);
  }

  function qv(q) { return q && q.value != null ? q.value : null; }

  // Latest station observation -> °F / mph / degrees / %RH, or null when the
  // station reported nothing usable (wind and temperature both missing).
  function parseObservation(json) {
    const p = json && json.properties;
    if (!p) return null;
    const tempF = toF(qv(p.temperature), p.temperature && p.temperature.unitCode);
    const windMph = toMph(qv(p.windSpeed), p.windSpeed && p.windSpeed.unitCode);
    if (tempF == null && windMph == null) return null;
    const rh = qv(p.relativeHumidity);
    return {
      tempF: tempF == null ? null : Math.round(tempF),
      windMph: round1(windMph),
      windDeg: qv(p.windDirection),
      rh: rh == null ? null : Math.round(rh),
      text: p.textDescription || '',
      observedAt: p.timestamp || null
    };
  }

  function skyFromCover(pct) {
    if (pct == null) return '';
    if (pct < 10) return 'Clear';
    if (pct < 50) return 'Partly cloudy';
    if (pct < 88) return 'Mostly cloudy';
    return 'Overcast';
  }

  const ATTRIBUTION = 'Weather: U.S. National Weather Service (weather.gov)';

  const api = {
    BASE,
    ATTRIBUTION,
    pointsUrl,
    observationUrl,
    parsePoint,
    durationHours,
    toF,
    toMph,
    toInches,
    expandLayer,
    weatherCode,
    localHourString,
    gridHours,
    haversineMiles,
    parseStations,
    parseObservation,
    skyFromCover
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.NwsWeather = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
