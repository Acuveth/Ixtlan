// ---------------------------------------------------------------------------
// Shared types, constants, data generation, and helpers for PlanBuilder
// ---------------------------------------------------------------------------

export type Rating = 'very_poor' | 'poor' | 'moderate' | 'good' | 'very_good';
export type Freq = 'quarterly' | 'biannual' | 'annual' | 'biennial';
export type Status = 'planned' | 'completed' | 'in_progress' | 'cancelled';
export type WaterBody = 'river' | 'lake' | 'stream' | 'spring' | 'reservoir';
export type Program = 'river' | 'lake' | 'sea' | 'soil';
export type ViewMode = 'table' | 'location' | 'day' | 'week' | 'month' | 'year';

export interface Worker { id: string; name: string; region: string }
export interface Entry {
  id: string;
  locationId: string;
  locationName: string;
  locationCode: string;
  rating: Rating;
  river: string; // waterway/site name
  program: Program;
  waterBody: WaterBody;
  measurement: string;
  frequency: Freq;
  assigneeId: string;
  status: Status;
  nextDate: string; // YYYY-MM-DD
  cost: number;
}

export interface EmergencyEvent {
  id: string;
  title: string;
  description: string;
  severity: 'critical' | 'high' | 'medium';
  status: 'active' | 'monitoring' | 'resolved';
  createdAt: string;
  affectedWaterways: string[];
  affectedLocations: string[];
  deployedEntries: string[];
}

export type NotificationType = 'assigned' | 'cancelled' | 'rescheduled' | 'emergency' | 'added';

export interface Notification {
  id: string;
  type: NotificationType;
  workerId: string;        // recipient
  workerName: string;
  entryId: string;
  locationName: string;
  measurement: string;
  message: string;
  timestamp: string;       // ISO
  read: boolean;
  /** For reschedule: old date */
  oldDate?: string;
  /** For reschedule: new date */
  newDate?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const WORKERS: Worker[] = [
  { id: 'w1', name: 'Marko Novak', region: 'Osrednjeslovenska' },
  { id: 'w2', name: 'Jan Krajnc', region: 'Podravska' },
  { id: 'w3', name: 'Nina Kovač', region: 'Gorenjska' },
  { id: 'w4', name: 'Peter Vidmar', region: 'Savinjska' },
  { id: 'w5', name: 'Tina Rupar', region: 'Dolenjska' },
  { id: 'w6', name: 'Luka Primožič', region: 'Primorska' },
  { id: 'w7', name: 'Ana Medved', region: 'Pomurska' },
  { id: 'w8', name: 'Miha Zupančič', region: 'Koroška' },
  { id: 'w9', name: 'Eva Hočevar', region: 'Zasavska' },
  { id: 'w10', name: 'Rok Šuštar', region: 'Posavska' },
  { id: '', name: 'Unassigned', region: '' },
];

// Rivers mapped to towns they actually flow through/near
export const WATERWAY_TOWNS: Record<string, string[]> = {
  'Sava': ['Jesenice', 'Radovljica', 'Bled', 'Kranj', 'Škofja Loka', 'Ljubljana', 'Domžale', 'Litija', 'Zagorje', 'Trbovlje', 'Hrastnik', 'Radeče', 'Sevnica', 'Krško', 'Brežice'],
  'Drava': ['Dravograd', 'Muta', 'Podvelka', 'Radlje ob Dravi', 'Ruše', 'Lovrenc na Pohorju', 'Maribor', 'Starše', 'Kidričevo', 'Ptuj', 'Ormož'],
  'Savinja': ['Luče', 'Solčava', 'Nazarje', 'Mozirje', 'Velenje', 'Šoštanj', 'Žalec', 'Celje', 'Laško'],
  'Krka': ['Trebnje', 'Mokronog', 'Novo mesto', 'Šentjernej', 'Kostanjevica', 'Krško'],
  'Soča': ['Bovec', 'Kobarid', 'Tolmin', 'Most na Soči', 'Kanal ob Soči', 'Nova Gorica'],
  'Mura': ['Gornja Radgona', 'Murska Sobota', 'Ljutomer', 'Lendava'],
  'Kolpa': ['Črnomelj', 'Metlika'],
  'Ljubljanica': ['Vrhnika', 'Logatec', 'Ljubljana'],
  'Kamniška Bistrica': ['Kamnik', 'Domžale'],
  'Meža': ['Mežica', 'Prevalje', 'Ravne na Koroškem', 'Slovenj Gradec'],
  'Pesnica': ['Lenart', 'Maribor'],
  'Sotla': ['Rogatec', 'Podčetrtek', 'Bistrica ob Sotli', 'Brežice'],
  'Ledava': ['Lendava', 'Murska Sobota'],
  'Vipava': ['Ajdovščina', 'Nova Gorica'],
  'Idrijca': ['Idrija', 'Cerkno', 'Tolmin'],
  'Hubelj': ['Ajdovščina'],
  'Tržiška Bistrica': ['Tržič'],
  'Kokra': ['Kranj'],
  'Pšata': ['Domžale', 'Kamnik'],
  'Rača': ['Fram', 'Maribor'],
  'Dravinja': ['Slovenska Bistrica', 'Videm', 'Ptuj'],
  'Polskava': ['Slovenska Bistrica', 'Miklavž'],
  'Voglajna': ['Šentjur', 'Celje'],
  'Ložnica': ['Žalec', 'Celje'],
  'Hudinja': ['Velenje', 'Celje'],
  'Bolska': ['Velenje', 'Žalec'],
  'Mirna': ['Trebnje', 'Mokronog', 'Mirna Peč'],
  'Temenica': ['Trebnje'],
  'Rinža': ['Kočevje'],
  'Lahinja': ['Črnomelj'],
  'Nadiža': ['Kobarid'],
  'Bača': ['Tolmin', 'Most na Soči'],
  'Tolminka': ['Tolmin'],
  'Učja': ['Bovec'],
  'Koritnica': ['Bovec'],
  'Radovna': ['Bled'],
  'Bohinjska Bistrica': ['Bohinj'],
  'Mostnica': ['Bohinj'],
  'Jezernica': ['Bled'],
  'Tržičanka': ['Tržič'],
  'Lipnica': ['Radovljica'],
  'Žirovnica': ['Jesenice', 'Radovljica'],
  'Sora': ['Škofja Loka'],
  'Selška Sora': ['Škofja Loka', 'Cerkno'],
  'Poljanska Sora': ['Škofja Loka'],
  'Gradaščica': ['Ljubljana', 'Vrhnika'],
  'Iška': ['Ljubljana'],
  'Želimeljščica': ['Ljubljana'],
  'Ščavnica': ['Ljutomer', 'Murska Sobota'],
  'Lendava potok': ['Lendava'],
};

export const WATERWAYS = Object.keys(WATERWAY_TOWNS);

// Flat list for backward compat (used by AddEntryModal etc.)
export const SETTLEMENTS = Array.from(new Set(Object.values(WATERWAY_TOWNS).flat())).sort();

export const MEASUREMENTS = [
  { name: 'Basic Chemistry', cost: 120 },
  { name: 'Heavy Metals', cost: 350 },
  { name: 'Pesticides', cost: 280 },
  { name: 'Nutrients', cost: 180 },
  { name: 'Microplastics', cost: 420 },
  { name: 'BOD/COD', cost: 95 },
  { name: 'Bacteriology', cost: 160 },
  { name: 'Sediment Analysis', cost: 310 },
];

// Lake/sea/soil specific measurements
export const LAKE_MEASUREMENTS = [
  { name: 'Chlorophyll-a', cost: 140 },
  { name: 'Phytoplankton', cost: 260 },
  { name: 'Transparency (Secchi)', cost: 40 },
  { name: 'Thermocline Profile', cost: 90 },
  { name: 'Basic Chemistry', cost: 120 },
  { name: 'Nutrients', cost: 180 },
  { name: 'Heavy Metals', cost: 350 },
  { name: 'Microplastics', cost: 420 },
];

export const SEA_MEASUREMENTS = [
  { name: 'Salinity', cost: 60 },
  { name: 'Marine Litter', cost: 180 },
  { name: 'Chlorophyll-a', cost: 140 },
  { name: 'Benthic Fauna', cost: 380 },
  { name: 'Phytoplankton', cost: 260 },
  { name: 'Basic Chemistry', cost: 120 },
  { name: 'Nutrients', cost: 180 },
  { name: 'Heavy Metals', cost: 350 },
];

export const SOIL_MEASUREMENTS = [
  { name: 'Soil pH & EC', cost: 80 },
  { name: 'Soil Heavy Metals', cost: 340 },
  { name: 'Soil Organic Matter', cost: 120 },
  { name: 'PAH Compounds', cost: 450 },
  { name: 'Soil Pesticides', cost: 290 },
  { name: 'Soil Nutrients (NPK)', cost: 150 },
  { name: 'Soil Bacteriology', cost: 190 },
];

export const LAKES = [
  'Jezero Bled', 'Jezero Bohinj', 'Cerkniško jezero', 'Šmartinsko jezero',
  'Velenjsko jezero', 'Zbiljsko jezero', 'Ptujsko jezero', 'Družmirsko jezero',
  'Kočevsko jezero', 'Blaguško jezero', 'Perniško jezero', 'Podpeško jezero',
  'Ledavsko jezero', 'Škalsko jezero', 'Jezero Jasna', 'Jezero Planšar',
  'Fiesa', 'Trbojsko jezero', 'Slivniško jezero', 'Jezero Rakitna',
];

export const SEA_STATIONS = [
  'Koper — Luka', 'Koper — Žusterna', 'Izola — Marina', 'Izola — Simonov zaliv',
  'Piran — Tartinijev trg', 'Piran — Fiesa', 'Piran — Strunjan',
  'Portorož — Marina', 'Portorož — Plaža', 'Portorož — Bernardin',
  'Sečovlje — Soline', 'Sečovlje — Dragonja ustje',
  'Ankaran — Valdoltra', 'Ankaran — Debeli rtič',
  'Strunjan — Naravni rezervat', 'Strunjan — Stjuža',
  'Mesečev zaliv', 'Tržaški zaliv — S1', 'Tržaški zaliv — S2', 'Tržaški zaliv — S3',
];

export const SOIL_SITES = [
  'Celje — industrijska cona', 'Celje — Bukovžlak', 'Celje — Trnovlje',
  'Maribor — Tezno', 'Maribor — Studenci', 'Ljubljana — Moste',
  'Ljubljana — Črnuče', 'Ljubljana — Barje', 'Ljubljana — BTC',
  'Jesenice — Jeklarna', 'Trbovlje — TE', 'Zasavje — Hrastnik',
  'Velenje — Premogovnik', 'Kidričevo — Talum', 'Ruše — TAM',
  'Novo mesto — Revoz', 'Kočevje — Gozdno', 'Ptuj — Dravsko polje',
  'Murska Sobota — Agro', 'Lendava — Nafta', 'Idrija — Rudnik',
  'Mežica — Rudnik', 'Žerjav — Topilnica', 'Anhovo — Cementarna',
  'Kranj — Savska loka', 'Domžale — Jarše', 'Litija — Sitarjevec',
  'Škofja Loka — Trata', 'Kamnik — Duplica', 'Ribnica — Kmetijsko',
];

export const PROGRAMS: { key: Program; label: string }[] = [
  { key: 'river', label: 'River monitoring' },
  { key: 'lake', label: 'Lake monitoring' },
  { key: 'sea', label: 'Sea monitoring' },
  { key: 'soil', label: 'Soil monitoring' },
];

export const RATINGS: Rating[] = ['very_poor', 'poor', 'moderate', 'good', 'very_good'];
export const FREQS: Freq[] = ['quarterly', 'biannual', 'annual', 'biennial'];
const STATUSES: Status[] = ['planned', 'planned', 'planned', 'completed', 'in_progress'];
const WATER_BODIES: WaterBody[] = ['river', 'river', 'river', 'stream', 'lake', 'spring', 'reservoir'];

export const RATING_COLORS: Record<Rating, string> = { very_poor: '#E24B4A', poor: '#D85A30', moderate: '#EF9F27', good: '#639922', very_good: '#1D9E75' };
export const RATING_LABELS: Record<Rating, string> = { very_poor: 'Very Poor', poor: 'Poor', moderate: 'Moderate', good: 'Good', very_good: 'Very Good' };
export const FREQ_LABELS: Record<Freq, string> = { quarterly: '4x/yr', biannual: '2x/yr', annual: '1x/yr', biennial: '1x/2yr' };
export const STATUS_COLORS: Record<Status, string> = { planned: '#378ADD', completed: '#639922', in_progress: '#BA7517', cancelled: '#9ca3af' };

// Measurement type color indicators (no emojis)
export const MEAS_ICONS: Record<string, { color: string }> = {
  'Basic Chemistry':       { color: '#378ADD' },
  'Heavy Metals':          { color: '#8B5CF6' },
  'Pesticides':            { color: '#D85A30' },
  'Nutrients':             { color: '#639922' },
  'Microplastics':         { color: '#0891B2' },
  'BOD/COD':               { color: '#2563EB' },
  'Bacteriology':          { color: '#E24B4A' },
  'Sediment Analysis':     { color: '#92400E' },
  'Chlorophyll-a':         { color: '#16A34A' },
  'Phytoplankton':         { color: '#0D9488' },
  'Transparency (Secchi)': { color: '#6366F1' },
  'Thermocline Profile':   { color: '#DC2626' },
  'Salinity':              { color: '#64748B' },
  'Marine Litter':         { color: '#B45309' },
  'Benthic Fauna':         { color: '#BE185D' },
  'Soil pH & EC':          { color: '#7C3AED' },
  'Soil Heavy Metals':     { color: '#8B5CF6' },
  'Soil Organic Matter':   { color: '#92400E' },
  'PAH Compounds':         { color: '#DC2626' },
  'Soil Pesticides':       { color: '#D85A30' },
  'Soil Nutrients (NPK)':  { color: '#16A34A' },
  'Soil Bacteriology':     { color: '#E24B4A' },
};

// ---------------------------------------------------------------------------
// Data generation
// ---------------------------------------------------------------------------

function seededRandom(seed: number) {
  let s = seed;
  return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
}

function generateEntries(): Entry[] {
  const rng = seededRandom(42);
  const entries: Entry[] = [];
  let entryId = 0;
  let locId = 0;
  const locNames = new Set<string>();

  for (const waterway of WATERWAYS) {
    const towns = WATERWAY_TOWNS[waterway] || ['Unknown'];
    const stationCount = Math.max(towns.length, 3 + Math.floor(rng() * (towns.length * 2)));
    const wb = WATER_BODIES[Math.floor(rng() * WATER_BODIES.length)];

    for (let s = 0; s < stationCount; s++) {
      let locName: string;
      // Pick from the river's actual towns, or use km markers for extra stations
      if (s < towns.length) {
        const settlement = towns[s];
        const suffix = locNames.has(`${waterway} — ${settlement}`) ? ` Stn ${s + 1}` : '';
        locName = `${waterway} — ${settlement}${suffix}`;
      } else {
        // Additional stations use km markers or repeat towns with station numbers
        const useKm = rng() > 0.5;
        if (useKm) {
          const km = Math.round(rng() * 200 * 10) / 10;
          locName = `${waterway} — km ${km}`;
        } else {
          const settlement = towns[Math.floor(rng() * towns.length)];
          locName = `${waterway} — ${settlement} Stn ${s + 1}`;
        }
      }

      if (locNames.has(locName)) {
        locName += ` (${s + 1})`;
      }
      locNames.add(locName);

      const rid = `L${locId++}`;
      const locCode = `${waterway.slice(0, 3).toUpperCase()}-${String(locId).padStart(4, '0')}`;
      const rating = RATINGS[Math.floor(rng() * RATINGS.length)];

      const measCount = 1 + Math.floor(rng() * 4);
      const usedMeas = new Set<number>();

      for (let m = 0; m < measCount; m++) {
        let mi: number;
        do { mi = Math.floor(rng() * MEASUREMENTS.length); } while (usedMeas.has(mi));
        usedMeas.add(mi);

        const meas = MEASUREMENTS[mi];
        const freq: Freq = rating === 'very_poor' ? 'quarterly'
          : rating === 'poor' ? 'biannual'
          : FREQS[Math.floor(rng() * FREQS.length)];
        const assignedWorker = WORKERS[Math.floor(rng() * (WORKERS.length - 1))];
        const status = STATUSES[Math.floor(rng() * STATUSES.length)];
        const month = 1 + Math.floor(rng() * 12);
        const day = 1 + Math.floor(rng() * 28);

        entries.push({
          id: `e${entryId++}`,
          locationId: rid,
          locationName: locName,
          locationCode: locCode,
          rating,
          river: waterway,
          program: wb === 'lake' ? 'lake' : 'river',
          waterBody: wb,
          measurement: meas.name,
          frequency: freq,
          assigneeId: rng() > 0.15 ? assignedWorker.id : '',
          status,
          nextDate: `2026-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
          cost: meas.cost,
        });
      }
    }
  }

  // --- LAKE entries ---
  for (const lake of LAKES) {
    locId++;
    const locCode = `LK-${String(locId).padStart(4, '0')}`;
    const rating = RATINGS[1 + Math.floor(rng() * 4)]; // lakes tend better
    const stationsPerLake = 2 + Math.floor(rng() * 4);

    for (let s = 0; s < stationsPerLake; s++) {
      const locName = stationsPerLake > 1 ? `${lake} — Stn ${s + 1}` : lake;
      const sId = `L${locId++}`;
      const measCount = 2 + Math.floor(rng() * 3);
      const usedMeas = new Set<number>();

      for (let m = 0; m < measCount; m++) {
        let mi: number;
        do { mi = Math.floor(rng() * LAKE_MEASUREMENTS.length); } while (usedMeas.has(mi));
        usedMeas.add(mi);
        const meas = LAKE_MEASUREMENTS[mi];
        const freq: Freq = rating === 'poor' ? 'biannual' : FREQS[Math.floor(rng() * FREQS.length)];
        const assignedWorker = WORKERS[Math.floor(rng() * (WORKERS.length - 1))];
        const status = STATUSES[Math.floor(rng() * STATUSES.length)];
        const month = 1 + Math.floor(rng() * 12);
        const day = 1 + Math.floor(rng() * 28);

        entries.push({
          id: `e${entryId++}`, locationId: sId, locationName: locName, locationCode: locCode,
          rating, river: lake, program: 'lake', waterBody: 'lake', measurement: meas.name,
          frequency: freq, assigneeId: rng() > 0.15 ? assignedWorker.id : '', status,
          nextDate: `2026-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`, cost: meas.cost,
        });
      }
    }
  }

  // --- SEA entries ---
  for (const station of SEA_STATIONS) {
    const sId = `L${locId++}`;
    const locCode = `SEA-${String(locId).padStart(4, '0')}`;
    const rating = RATINGS[2 + Math.floor(rng() * 3)]; // sea tends moderate-good
    const measCount = 2 + Math.floor(rng() * 4);
    const usedMeas = new Set<number>();

    for (let m = 0; m < measCount; m++) {
      let mi: number;
      do { mi = Math.floor(rng() * SEA_MEASUREMENTS.length); } while (usedMeas.has(mi));
      usedMeas.add(mi);
      const meas = SEA_MEASUREMENTS[mi];
      const freq: Freq = FREQS[Math.floor(rng() * FREQS.length)];
      const assignedWorker = WORKERS[Math.floor(rng() * (WORKERS.length - 1))];
      const status = STATUSES[Math.floor(rng() * STATUSES.length)];
      const month = 1 + Math.floor(rng() * 12);
      const day = 1 + Math.floor(rng() * 28);

      entries.push({
        id: `e${entryId++}`, locationId: sId, locationName: station, locationCode: locCode,
        rating, river: station, program: 'sea', waterBody: 'reservoir', measurement: meas.name,
        frequency: freq, assigneeId: rng() > 0.1 ? assignedWorker.id : '', status,
        nextDate: `2026-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`, cost: meas.cost,
      });
    }
  }

  // --- SOIL entries ---
  for (const site of SOIL_SITES) {
    const sId = `L${locId++}`;
    const locCode = `SOL-${String(locId).padStart(4, '0')}`;
    const rating = RATINGS[Math.floor(rng() * RATINGS.length)];
    const measCount = 2 + Math.floor(rng() * 4);
    const usedMeas = new Set<number>();

    for (let m = 0; m < measCount; m++) {
      let mi: number;
      do { mi = Math.floor(rng() * SOIL_MEASUREMENTS.length); } while (usedMeas.has(mi));
      usedMeas.add(mi);
      const meas = SOIL_MEASUREMENTS[mi];
      const freq: Freq = rating === 'very_poor' ? 'quarterly' : rating === 'poor' ? 'biannual' : FREQS[Math.floor(rng() * FREQS.length)];
      const assignedWorker = WORKERS[Math.floor(rng() * (WORKERS.length - 1))];
      const status = STATUSES[Math.floor(rng() * STATUSES.length)];
      const month = 1 + Math.floor(rng() * 12);
      const day = 1 + Math.floor(rng() * 28);

      entries.push({
        id: `e${entryId++}`, locationId: sId, locationName: site, locationCode: locCode,
        rating, river: site, program: 'soil', waterBody: 'river', measurement: meas.name,
        frequency: freq, assigneeId: rng() > 0.15 ? assignedWorker.id : '', status,
        nextDate: `2026-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`, cost: meas.cost,
      });
    }
  }

  return entries;
}

export const ALL_ENTRIES: Entry[] = generateEntries();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function workerName(id: string): string {
  return WORKERS.find(w => w.id === id)?.name || 'Unassigned';
}

export function formatDate(d: string): string {
  const dt = new Date(d);
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ---------------------------------------------------------------------------
// Date utilities
// ---------------------------------------------------------------------------

export function dateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function addDays(dateString: string, days: number): string {
  const dt = new Date(dateString + 'T00:00:00');
  dt.setDate(dt.getDate() + days);
  return dateStr(dt);
}

export function getWeekStart(dateString: string): string {
  const dt = new Date(dateString + 'T00:00:00');
  const day = dt.getDay();
  const diff = day === 0 ? -6 : 1 - day; // Monday start
  dt.setDate(dt.getDate() + diff);
  return dateStr(dt);
}

export function groupEntriesByDate(entries: Entry[]): Map<string, Entry[]> {
  const map = new Map<string, Entry[]>();
  for (const e of entries) {
    const existing = map.get(e.nextDate);
    if (existing) existing.push(e);
    else map.set(e.nextDate, [e]);
  }
  return map;
}
