// Generates 30 years (1996-2026) of realistic measurement data for all 15 locations
import type { HistoricalMeasurement } from './index';
import type { Location } from '../types';

function seededRandom(seed: number) {
  let s = seed;
  return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
}

// Measurement type definitions with parameter ranges
const MEASUREMENT_DEFS: Record<string, { params: { key: string; label: string; unit: string; base: number; variance: number; seasonalAmp: number; trendPerYear: number }[] }> = {
  'Basic Chemistry': {
    params: [
      { key: 'ph', label: 'pH', unit: '', base: 7.2, variance: 0.4, seasonalAmp: 0.15, trendPerYear: -0.01 },
      { key: 'oxygen', label: 'Dissolved Oxygen', unit: 'mg/L', base: 9.0, variance: 1.5, seasonalAmp: 2.0, trendPerYear: -0.02 },
      { key: 'conductivity', label: 'Conductivity', unit: 'uS/cm', base: 380, variance: 80, seasonalAmp: 40, trendPerYear: 1.5 },
      { key: 'temperature', label: 'Temperature', unit: 'C', base: 12, variance: 2, seasonalAmp: 8, trendPerYear: 0.03 },
    ],
  },
  'Heavy Metals': {
    params: [
      { key: 'lead', label: 'Lead (Pb)', unit: 'ug/L', base: 3.0, variance: 2.0, seasonalAmp: 0.5, trendPerYear: -0.05 },
      { key: 'mercury', label: 'Mercury (Hg)', unit: 'ug/L', base: 0.3, variance: 0.2, seasonalAmp: 0.05, trendPerYear: -0.005 },
      { key: 'cadmium', label: 'Cadmium (Cd)', unit: 'ug/L', base: 0.8, variance: 0.5, seasonalAmp: 0.1, trendPerYear: -0.01 },
      { key: 'zinc', label: 'Zinc (Zn)', unit: 'ug/L', base: 45, variance: 20, seasonalAmp: 8, trendPerYear: -0.3 },
    ],
  },
  'Pesticides': {
    params: [
      { key: 'atrazine', label: 'Atrazine', unit: 'ug/L', base: 0.8, variance: 0.5, seasonalAmp: 0.4, trendPerYear: -0.02 },
      { key: 'glyphosate', label: 'Glyphosate', unit: 'ug/L', base: 1.2, variance: 0.8, seasonalAmp: 0.6, trendPerYear: 0.01 },
    ],
  },
  'Nutrients': {
    params: [
      { key: 'nitrate', label: 'Nitrate (NO3)', unit: 'mg/L', base: 18, variance: 8, seasonalAmp: 5, trendPerYear: 0.15 },
      { key: 'phosphate', label: 'Phosphate (PO4)', unit: 'mg/L', base: 1.2, variance: 0.6, seasonalAmp: 0.3, trendPerYear: 0.01 },
      { key: 'ammonia', label: 'Ammonia (NH3)', unit: 'mg/L', base: 0.3, variance: 0.2, seasonalAmp: 0.1, trendPerYear: -0.003 },
    ],
  },
};

// Per-location modifiers to make data unique and realistic
const LOCATION_PROFILES: Record<string, { phMod: number; pollutionFactor: number; sampleFrequency: number }> = {
  'l1':  { phMod: 0,    pollutionFactor: 1.0,  sampleFrequency: 4 },  // Sava Ljubljana — moderate urban
  'l2':  { phMod: -0.3, pollutionFactor: 1.4,  sampleFrequency: 4 },  // Sava Litija — poor, downstream industry
  'l3':  { phMod: 0.2,  pollutionFactor: 0.7,  sampleFrequency: 2 },  // Drava Maribor — good
  'l4':  { phMod: -0.8, pollutionFactor: 1.8,  sampleFrequency: 4 },  // Savinja Celje — poor, zinc smelter legacy
  'l5':  { phMod: 0.3,  pollutionFactor: 0.5,  sampleFrequency: 2 },  // Krka Novo Mesto — good, karst
  'l6':  { phMod: 0.5,  pollutionFactor: 0.3,  sampleFrequency: 1 },  // Soca Nova Gorica — very good, pristine
  'l7':  { phMod: -0.1, pollutionFactor: 1.1,  sampleFrequency: 4 },  // Mura Murska Sobota — moderate, agriculture
  'l8':  { phMod: 0.2,  pollutionFactor: 0.6,  sampleFrequency: 2 },  // Kolpa Metlika — good, border river
  'l9':  { phMod: -0.1, pollutionFactor: 1.0,  sampleFrequency: 4 },  // Ljubljanica Ljubljana — moderate, karst outflow
  'l10': { phMod: 0.4,  pollutionFactor: 0.4,  sampleFrequency: 2 },  // Lake Bled — good, tourist lake
  'l11': { phMod: 0.6,  pollutionFactor: 0.2,  sampleFrequency: 1 },  // Lake Bohinj — very good, alpine
  'l12': { phMod: 0,    pollutionFactor: 0.9,  sampleFrequency: 2 },  // Lake Cerknica — moderate, intermittent
  'l13': { phMod: 0.3,  pollutionFactor: 0.6,  sampleFrequency: 2 },  // Sava Jesenice — good, upper reach
  'l14': { phMod: 0,    pollutionFactor: 0.9,  sampleFrequency: 4 },  // Drava Ptuj — moderate, downstream
  'l15': { phMod: 0.6,  pollutionFactor: 0.2,  sampleFrequency: 1 },  // Soca Tolmin — very good, alpine
};

export function generateHistoricalData(locations: Location[]): HistoricalMeasurement[] {
  const records: HistoricalMeasurement[] = [];
  const rng = seededRandom(123456);
  let id = 0;

  const START_YEAR = 1996;
  const END_YEAR = 2026;

  for (const loc of locations) {
    const profile = LOCATION_PROFILES[loc.id] || { phMod: 0, pollutionFactor: 1.0, sampleFrequency: 2 };

    for (const [measType, def] of Object.entries(MEASUREMENT_DEFS)) {
      // Determine how many samples per year based on location profile
      let samplesPerYear: number;
      if (measType === 'Basic Chemistry') {
        samplesPerYear = profile.sampleFrequency;
      } else if (measType === 'Heavy Metals') {
        samplesPerYear = Math.max(1, Math.floor(profile.sampleFrequency / 2));
      } else if (measType === 'Pesticides') {
        // Only agricultural / moderate+ pollution locations get pesticide testing
        if (profile.pollutionFactor < 0.5) continue;
        samplesPerYear = Math.max(1, Math.floor(profile.sampleFrequency / 2));
      } else {
        samplesPerYear = Math.max(1, Math.floor(profile.sampleFrequency / 2));
      }

      for (let year = START_YEAR; year <= END_YEAR; year++) {
        // Early years might have fewer samples
        const actualSamples = year < 2000 ? Math.max(1, samplesPerYear - 1) : samplesPerYear;
        const yearOffset = year - 2010; // center around 2010

        for (let s = 0; s < actualSamples; s++) {
          // Spread samples across the year
          const monthBase = Math.floor((12 / actualSamples) * s) + 1;
          const month = Math.min(12, Math.max(1, monthBase + Math.floor(rng() * 2) - 1));
          const day = 1 + Math.floor(rng() * 27);
          const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

          // Day of year for seasonal effect (0-1 cycle)
          const dayOfYear = (month - 1) * 30 + day;
          const seasonalPhase = (dayOfYear / 365) * 2 * Math.PI;

          const results: Record<string, number> = {};

          for (const param of def.params) {
            // Base value with location modifier
            let val = param.base;

            // Location-specific modifications
            if (param.key === 'ph') {
              val += profile.phMod;
            } else if (['lead', 'mercury', 'cadmium', 'zinc', 'atrazine', 'glyphosate', 'nitrate', 'phosphate'].includes(param.key)) {
              val *= profile.pollutionFactor;
            }

            // Long-term trend
            val += param.trendPerYear * yearOffset;

            // Seasonal variation (oxygen higher in winter, temperature peaks in summer, etc.)
            if (param.key === 'oxygen') {
              val += param.seasonalAmp * Math.cos(seasonalPhase); // peaks in winter
            } else if (param.key === 'temperature') {
              val += param.seasonalAmp * Math.sin(seasonalPhase - Math.PI / 6); // peaks in July
            } else if (['atrazine', 'glyphosate', 'nitrate'].includes(param.key)) {
              val += param.seasonalAmp * Math.sin(seasonalPhase); // peaks in spring/summer
            } else {
              val += param.seasonalAmp * Math.sin(seasonalPhase) * (0.5 + 0.5 * rng());
            }

            // Random noise
            val += (rng() - 0.5) * 2 * param.variance;

            // Occasional anomaly spikes (~2% chance)
            if (rng() < 0.02) {
              val *= 1.3 + rng() * 0.7;
            }

            // Clamp non-negative (except pH which can go low, and temperature)
            if (param.key !== 'temperature') {
              val = Math.max(0, val);
            }
            if (param.key === 'ph') {
              val = Math.max(3, Math.min(10, val));
            }

            results[param.key] = Math.round(val * 100) / 100;
          }

          records.push({
            id: `hm${id++}`,
            location_id: loc.id,
            measurement_type: measType,
            date: dateStr,
            year,
            results,
          });
        }
      }
    }
  }

  return records;
}
