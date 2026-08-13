/* Spray-window helpers for Pesticide Logger.
 * Loaded before app.js; also runnable under Node for tests.
 *
 * Trust rules: never mix one field's hours into another field's chart;
 * GPS is not a destination field; fail loud; show evidence (coords, model, age).
 */
(function (root) {
  'use strict';

  const DEVICE_KEY = '__device__';
  const FRESH_MS = 60 * 60 * 1000;
  const AGING_MS = 120 * 60 * 1000;
  const HORIZON_HOURS = 48;
  const BATCH_SIZE = 10;

  function roundCoord(n) {
    const x = Number(n);
    if (!Number.isFinite(x)) return null;
    return Math.round(x * 1e4) / 1e4;
  }

  function coordsMatch(a, b) {
    if (!a || !b) return false;
    const alat = roundCoord(a.lat);
    const alng = roundCoord(a.lng);
    const blat = roundCoord(b.lat);
    const blng = roundCoord(b.lng);
    return alat != null && alng != null && alat === blat && alng === blng;
  }

  // NOAA HRRR CONUS domain (approx). Alaska, Hawaii, territories: not HRRR.
  function isConus(lat, lng) {
    const la = Number(lat);
    const lo = Number(lng);
    return Number.isFinite(la) && Number.isFinite(lo)
      && la >= 24.5 && la <= 49.5 && lo >= -125 && lo <= -66.5;
  }

  // Area-weighted polygon centroid. Shoelace uses lng as x, lat as y.
  // Vertex average is the fallback when the ring has no area (line / duplicate points).
  function ringCentroid(boundary) {
    if (!boundary || boundary.length < 3) return null;
    let area2 = 0;
    let cx = 0;
    let cy = 0;
    const n = boundary.length;
    for (let i = 0; i < n; i++) {
      const y1 = Number(boundary[i][0]);
      const x1 = Number(boundary[i][1]);
      const y2 = Number(boundary[(i + 1) % n][0]);
      const x2 = Number(boundary[(i + 1) % n][1]);
      if (![x1, y1, x2, y2].every(Number.isFinite)) return null;
      const cross = x1 * y2 - x2 * y1;
      area2 += cross;
      cx += (x1 + x2) * cross;
      cy += (y1 + y2) * cross;
    }
    if (Math.abs(area2) < 1e-18) {
      const lat = boundary.reduce((s, p) => s + Number(p[0]), 0) / n;
      const lng = boundary.reduce((s, p) => s + Number(p[1]), 0) / n;
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
      return { lat, lng };
    }
    return { lat: cy / (3 * area2), lng: cx / (3 * area2) };
  }

  function fieldPin(field) {
    if (!field) return null;
    if (Number.isFinite(Number(field.weatherLat)) && Number.isFinite(Number(field.weatherLng))) {
      return {
        lat: Number(field.weatherLat),
        lng: Number(field.weatherLng),
        source: field.weatherPinManual ? 'pin' : 'centroid'
      };
    }
    const c = ringCentroid(field.boundary);
    return c ? { lat: c.lat, lng: c.lng, source: 'centroid' } : null;
  }

  // Manual pin wins. Otherwise the ring centroid. No pin if there is no ring.
  function resolveWeatherPin(field) {
    if (field && field.weatherPinManual
      && Number.isFinite(Number(field.weatherLat))
      && Number.isFinite(Number(field.weatherLng))) {
      return {
        weatherLat: Number(field.weatherLat),
        weatherLng: Number(field.weatherLng),
        weatherPinManual: true
      };
    }
    const c = ringCentroid(field && field.boundary);
    if (c) return { weatherLat: c.lat, weatherLng: c.lng, weatherPinManual: false };
    return { weatherLat: null, weatherLng: null, weatherPinManual: false };
  }

  function cacheMatches(entry, fieldId, pin) {
    if (!entry || !fieldId || entry.fieldId !== fieldId) return false;
    if (!pin) return false;
    return coordsMatch({ lat: entry.lat, lng: entry.lng }, pin);
  }

  function getCached(byField, fieldId, pin) {
    if (!byField || !fieldId) return null;
    const entry = byField[fieldId];
    return cacheMatches(entry, fieldId, pin) ? entry : null;
  }

  function freshnessTier(fetchedAt, nowMs) {
    if (fetchedAt == null || nowMs == null) return 'unknown';
    const now = Number(nowMs);
    const at = Number(fetchedAt);
    if (!Number.isFinite(at) || !Number.isFinite(now)) return 'unknown';
    const age = now - at;
    if (age < 0) return 'unknown';
    if (age <= FRESH_MS) return 'fresh';
    if (age <= AGING_MS) return 'aging';
    return 'stale';
  }

  function freshnessCopy(tier, fetchedAt, online) {
    const when = Number.isFinite(Number(fetchedAt))
      ? new Date(Number(fetchedAt)).toLocaleString()
      : 'unknown time';
    if (online === false) {
      return {
        banner: 'offline',
        text: `Saved outlook from ${when}. Not current. Do not leave for a distant field on this.`
      };
    }
    if (tier === 'fresh') return { banner: null, text: `Updated ${when}.` };
    if (tier === 'aging') return { banner: 'aging', text: 'Getting old — refresh before you drive.' };
    if (tier === 'stale') return { banner: 'stale', text: 'Refresh required to decide on a trip.' };
    return { banner: 'unknown', text: 'Outlook age unknown — refresh.' };
  }

  function isRainWeatherCode(code) {
    const c = Number(code);
    if (!Number.isFinite(c)) return false;
    return (c >= 51 && c <= 67) || (c >= 80 && c <= 82) || (c >= 95 && c <= 99);
  }

  function scoreSprayHour(h, opts) {
    const reasons = [];
    let score = 'good';
    const bump = (level, why) => {
      reasons.push(why);
      if (level === 'bad' || score === 'bad') score = 'bad';
      else score = 'fair';
    };
    if (!h) return { score: 'bad', reasons: ['no forecast hour'] };
    const wind = Number(h.wind);
    const gusts = Number(h.gusts);
    const precip = Number(h.precip) || 0;
    const pop = h.precipProb == null ? null : Number(h.precipProb);
    const labelMax = opts && Number.isFinite(Number(opts.labelWindMax))
      ? Number(opts.labelWindMax)
      : null;

    if (Number.isFinite(wind) && Number.isFinite(gusts) && (wind > 12 || gusts > 18)) {
      bump('bad', `wind ${Math.round(wind)} mph (gusts ${Math.round(gusts)})`);
    } else if (labelMax != null && Number.isFinite(wind) && wind > labelMax) {
      bump('bad', `wind ${Math.round(wind)} mph — above entered label max ${labelMax}`);
    } else if (Number.isFinite(wind) && Number.isFinite(gusts) && (wind > 10 || gusts > 15)) {
      bump('fair', `breezy — ${Math.round(wind)} mph`);
    }
    if (Number.isFinite(wind) && wind < 2) bump('fair', 'near-calm — temperature inversion risk');
    else if (Number.isFinite(wind) && wind < 3 && score !== 'bad') bump('fair', 'light wind — watch for inversion');

    const raining = precip > 0.02 || isRainWeatherCode(h.weatherCode);
    if (raining) {
      bump('bad', precip > 0.02
        ? `rain in the model (${precip} in)`
        : 'rain/showers in the model');
    } else if (pop != null && pop >= 50) {
      bump('fair', `regional rain chance ${pop}% (coarse ensemble, not this field)`);
    } else if (pop != null && pop >= 30) {
      reasons.push(`regional rain chance ${pop}%`);
    }

    if (Number.isFinite(Number(h.temp)) && Number(h.temp) >= 90) {
      bump('fair', `hot (${Math.round(h.temp)} °F) — volatility/evaporation`);
    }
    if (reasons.length === 0) {
      const windTxt = Number.isFinite(wind) ? `${Math.round(wind)} mph` : 'wind n/a';
      const popTxt = pop == null ? 'regional rain chance n/a' : `${pop}% regional rain chance`;
      reasons.push(`${windTxt}, ${popTxt}`);
    }
    return { score, reasons };
  }

  function hoursFromHourly(hourly, nowMs, source, maxHours) {
    const cap = maxHours || HORIZON_HOURS;
    if (!hourly || !Array.isArray(hourly.time)) return [];
    const hours = [];
    const now = new Date(nowMs);
    for (let i = 0; i < hourly.time.length && hours.length < cap; i++) {
      const t = new Date(hourly.time[i]);
      if (Number.isNaN(t.getTime()) || t < now) continue;
      const wind = hourly.wind_speed_10m ? hourly.wind_speed_10m[i] : null;
      const gustRaw = hourly.wind_gusts_10m ? hourly.wind_gusts_10m[i] : null;
      hours.push({
        time: hourly.time[i],
        temp: hourly.temperature_2m ? hourly.temperature_2m[i] : null,
        rh: hourly.relative_humidity_2m ? hourly.relative_humidity_2m[i] : null,
        precipProb: hourly.precipitation_probability ? hourly.precipitation_probability[i] : null,
        precip: hourly.precipitation ? hourly.precipitation[i] : 0,
        wind,
        gusts: gustRaw != null ? gustRaw : wind,
        windDir: hourly.wind_direction_10m ? hourly.wind_direction_10m[i] : null,
        weatherCode: hourly.weather_code ? hourly.weather_code[i] : null,
        source: source || 'best_match'
      });
    }
    return hours;
  }

  function stitchHours(hrrrHours, fallbackHours, maxHours) {
    const cap = maxHours || HORIZON_HOURS;
    const near = Array.isArray(hrrrHours) ? hrrrHours : [];
    const far = Array.isArray(fallbackHours) ? fallbackHours : [];
    const out = near.slice();
    const hrrrEnd = near.length ? near[near.length - 1].time : null;
    far.forEach((h) => {
      if (out.length >= cap) return;
      if (hrrrEnd && h.time <= hrrrEnd) return;
      out.push(h);
    });
    return out.slice(0, cap);
  }

  function parseOpenMeteoPayload(json) {
    if (!json) return [];
    if (Array.isArray(json)) return json;
    if (json.hourly || json.latitude != null) return [json];
    return [];
  }

  function chunk(list, size) {
    const n = size || BATCH_SIZE;
    const out = [];
    const arr = list || [];
    for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
    return out;
  }

  function modelLabel(model) {
    if (model === 'hrrr_conus') return 'NOAA HRRR (~3 km)';
    if (model === 'hrrr_conus+best_match') return 'NOAA HRRR near-term, longer-range after that';
    if (model === 'best_match') return 'Open-Meteo best match';
    return model || 'forecast model unknown';
  }

  function hrrrEndLabel(hours) {
    const last = (hours || []).filter((h) => h.source === 'hrrr').pop();
    if (!last) return null;
    const t = new Date(last.time);
    if (Number.isNaN(t.getTime())) return null;
    return t.toLocaleString(undefined, { weekday: 'short', hour: 'numeric' });
  }

  function nextWindowSummary(hours, nowMs) {
    const now = new Date(nowMs);
    const horizon = new Date(now.getTime() + 24 * 3600000);
    const upcoming = (hours || []).filter((h) => {
      const t = new Date(h.time);
      return t >= now && t <= horizon;
    });
    if (!upcoming.length) return 'No hours in the next 24 hours in this outlook.';
    let runStart = null;
    let runEnd = null;
    for (let i = 0; i < upcoming.length; i++) {
      const scored = scoreSprayHour(upcoming[i]);
      if (scored.score === 'good') {
        if (!runStart) runStart = upcoming[i];
        runEnd = upcoming[i];
      } else if (runStart) {
        break;
      }
    }
    const fmt = (iso) => new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric' });
    if (runStart) {
      if (runStart.time === runEnd.time) return `next decent window ${fmt(runStart.time)}`;
      const endPlus = new Date(new Date(runEnd.time).getTime() + 3600000);
      return `next decent window ${fmt(runStart.time)}–${endPlus.toLocaleTimeString(undefined, { hour: 'numeric' })}`;
    }
    const rain = upcoming.some((h) => {
      const s = scoreSprayHour(h);
      return s.score === 'bad' && s.reasons.some((r) => /rain/i.test(r));
    });
    if (rain) return 'rain in the model — check before you drive';
    return 'no open window in the next 24 hours (wind/rain/heat)';
  }

  function stripForecastMeta(meta) {
    const out = Object.assign({}, meta || {});
    delete out.forecastByField;
    delete out.forecastCache;
    return out;
  }

  function backupClone(data) {
    const payload = JSON.parse(JSON.stringify(data || {}));
    payload.meta = stripForecastMeta(payload.meta);
    return payload;
  }

  function buildEntry(fieldId, pin, hrrrJson, fallbackJson, nowMs) {
    const fallbackHours = hoursFromHourly(
      fallbackJson && fallbackJson.hourly,
      nowMs,
      'best_match',
      HORIZON_HOURS
    );
    const hrrrHours = hoursFromHourly(
      hrrrJson && hrrrJson.hourly,
      nowMs,
      'hrrr',
      HORIZON_HOURS
    );
    const hours = stitchHours(hrrrHours, fallbackHours, HORIZON_HOURS);
    let model = 'best_match';
    if (hrrrHours.length && fallbackHours.some((h) => !hrrrHours.length || h.time > hrrrHours[hrrrHours.length - 1].time)) {
      model = 'hrrr_conus+best_match';
    } else if (hrrrHours.length) {
      model = 'hrrr_conus';
    }
    return {
      fieldId,
      lat: roundCoord(pin.lat),
      lng: roundCoord(pin.lng),
      gridLat: fallbackJson && fallbackJson.latitude != null ? fallbackJson.latitude : (hrrrJson && hrrrJson.latitude),
      gridLng: fallbackJson && fallbackJson.longitude != null ? fallbackJson.longitude : (hrrrJson && hrrrJson.longitude),
      model,
      fetchedAt: Number(nowMs),
      hours
    };
  }

  const api = {
    DEVICE_KEY,
    FRESH_MS,
    AGING_MS,
    HORIZON_HOURS,
    BATCH_SIZE,
    roundCoord,
    coordsMatch,
    isConus,
    ringCentroid,
    fieldPin,
    resolveWeatherPin,
    cacheMatches,
    getCached,
    freshnessTier,
    freshnessCopy,
    isRainWeatherCode,
    scoreSprayHour,
    hoursFromHourly,
    stitchHours,
    parseOpenMeteoPayload,
    chunk,
    modelLabel,
    hrrrEndLabel,
    nextWindowSummary,
    stripForecastMeta,
    backupClone,
    buildEntry
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.SprayWindow = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
