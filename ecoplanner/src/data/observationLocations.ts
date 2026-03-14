/**
 * Generates 100 observation room locations with accurate geographic pairings.
 * Rivers are matched to towns they actually flow through/near.
 * Consumed by mockData.ts (-> Supabase seed).
 */
import type { Location, EnvironmentType, Rating } from '../types';

function mulberry32(seed: number) {
  return function () {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

type Program = 'River' | 'Lake' | 'Sea' | 'Soil';

// Real GPS coordinates for towns
const TOWN_COORDS: Record<string, [number, number]> = {
  'Murska Sobota': [46.6625, 16.1664], 'Lendava': [46.5649, 16.4509], 'Ljutomer': [46.5208, 16.1975], 'Gornja Radgona': [46.6733, 15.9922],
  'Maribor': [46.5558, 15.6459], 'Ptuj': [46.4201, 15.8702], 'Ruše': [46.5394, 15.5158], 'Lenart': [46.5761, 15.8314],
  'Slovenska Bistrica': [46.3928, 15.5744], 'Ormož': [46.4114, 16.1544],
  'Slovenj Gradec': [46.5103, 15.0806], 'Ravne na Koroškem': [46.5431, 14.9692], 'Dravograd': [46.5881, 15.0192], 'Muta': [46.6114, 15.1658],
  'Celje': [46.2309, 15.2604], 'Velenje': [46.3572, 15.1128], 'Žalec': [46.2515, 15.1648], 'Šentjur': [46.2168, 15.3938], 'Laško': [46.1546, 15.2356], 'Mozirje': [46.3394, 14.9633],
  'Trbovlje': [46.1541, 15.0518], 'Zagorje': [46.1318, 14.9969], 'Hrastnik': [46.1333, 15.0997],
  'Krško': [45.9592, 15.4917], 'Brežice': [45.9033, 15.5911], 'Sevnica': [46.0078, 15.3156], 'Čatež': [45.8911, 15.6023],
  'Novo mesto': [45.8040, 15.1689], 'Črnomelj': [45.5711, 15.1889], 'Metlika': [45.6472, 15.3142], 'Trebnje': [45.9042, 15.0217], 'Šentjernej': [45.8434, 15.3378],
  'Ljubljana': [46.0511, 14.5051], 'Domžale': [46.1377, 14.5937], 'Kamnik': [46.2259, 14.6121], 'Vrhnika': [45.9635, 14.2948], 'Grosuplje': [45.9556, 14.6589], 'Litija': [46.0586, 14.8225],
  'Kranj': [46.2389, 14.3556], 'Jesenice': [46.4324, 14.0623], 'Radovljica': [46.3444, 14.1744], 'Bled': [46.3692, 14.1136], 'Škofja Loka': [46.1655, 14.3063],
  'Postojna': [45.7744, 14.2153], 'Ilirska Bistrica': [45.5788, 14.3065], 'Logatec': [45.9168, 14.2265],
  'Nova Gorica': [45.9560, 13.6484], 'Tolmin': [46.1830, 13.7332], 'Kobarid': [46.2481, 13.5772], 'Bovec': [46.3380, 13.5523], 'Ajdovščina': [45.8860, 13.9095], 'Idrija': [46.0028, 14.0306],
  'Koper': [45.5482, 13.7296], 'Piran': [45.5278, 13.5706], 'Izola': [45.5366, 13.6602], 'Portorož': [45.5143, 13.5921], 'Ankaran': [45.5790, 13.7365], 'Sežana': [45.7092, 13.8733],
  'Osilnica': [45.5294, 14.7011], 'Kočevje': [45.6415, 14.8633], 'Ribnica': [45.7385, 14.7269],
};

// Rivers mapped to the towns they actually flow through/near
interface RiverDef { name: string; towns: string[]; region: string; }
const RIVER_STATIONS: RiverDef[] = [
  // Sava - longest river, flows through many towns
  { name: 'Sava', towns: ['Jesenice', 'Radovljica', 'Kranj', 'Škofja Loka', 'Ljubljana', 'Litija', 'Zagorje', 'Trbovlje', 'Hrastnik', 'Sevnica', 'Krško', 'Brežice'], region: 'multiple' },
  // Drava - second major river
  { name: 'Drava', towns: ['Dravograd', 'Muta', 'Ruše', 'Maribor', 'Ptuj', 'Ormož'], region: 'Podravska' },
  // Savinja
  { name: 'Savinja', towns: ['Mozirje', 'Velenje', 'Žalec', 'Celje', 'Laško'], region: 'Savinjska' },
  // Krka
  { name: 'Krka', towns: ['Trebnje', 'Novo mesto', 'Šentjernej', 'Krško'], region: 'Jugovzhodna' },
  // Soča
  { name: 'Soča', towns: ['Bovec', 'Kobarid', 'Tolmin', 'Nova Gorica'], region: 'Goriška' },
  // Mura
  { name: 'Mura', towns: ['Gornja Radgona', 'Murska Sobota', 'Ljutomer', 'Lendava'], region: 'Pomurska' },
  // Kolpa
  { name: 'Kolpa', towns: ['Osilnica', 'Črnomelj', 'Metlika'], region: 'Jugovzhodna' },
  // Ljubljanica
  { name: 'Ljubljanica', towns: ['Vrhnika', 'Logatec', 'Ljubljana'], region: 'Osrednjeslovenska' },
  // Meža
  { name: 'Meža', towns: ['Ravne na Koroškem', 'Slovenj Gradec'], region: 'Koroška' },
  // Idrijca
  { name: 'Idrijca', towns: ['Idrija', 'Tolmin'], region: 'Goriška' },
  // Vipava
  { name: 'Vipava', towns: ['Ajdovščina', 'Nova Gorica'], region: 'Goriška' },
  // Kamniška Bistrica
  { name: 'Kamniška Bistrica', towns: ['Kamnik', 'Domžale'], region: 'Osrednjeslovenska' },
  // Pesnica
  { name: 'Pesnica', towns: ['Lenart', 'Slovenska Bistrica'], region: 'Podravska' },
  // Pivka
  { name: 'Pivka', towns: ['Postojna'], region: 'Primorsko-notranjska' },
  // Reka
  { name: 'Reka', towns: ['Ilirska Bistrica'], region: 'Primorsko-notranjska' },
  // Voglajna
  { name: 'Voglajna', towns: ['Šentjur', 'Celje'], region: 'Savinjska' },
  // Sotla
  { name: 'Sotla', towns: ['Brežice'], region: 'Posavska' },
  // Ledava
  { name: 'Ledava', towns: ['Lendava', 'Murska Sobota'], region: 'Pomurska' },
  // Rižana
  { name: 'Rižana', towns: ['Koper'], region: 'Obalno-kraška' },
  // Dragonja
  { name: 'Dragonja', towns: ['Piran', 'Sežana'], region: 'Obalno-kraška' },
];

// Lakes mapped to nearby towns
interface LakeDef { name: string; town: string; region: string; lat: number; lng: number; }
const LAKE_STATIONS: LakeDef[] = [
  { name: 'Jezero Bled', town: 'Bled', region: 'Gorenjska', lat: 46.3616, lng: 14.0953 },
  { name: 'Jezero Bohinj', town: 'Bled', region: 'Gorenjska', lat: 46.2787, lng: 13.8868 },
  { name: 'Cerkniško jezero', town: 'Postojna', region: 'Primorsko-notranjska', lat: 45.7584, lng: 14.3884 },
  { name: 'Ptujsko jezero', town: 'Ptuj', region: 'Podravska', lat: 46.3970, lng: 15.9020 },
  { name: 'Velenjsko jezero', town: 'Velenje', region: 'Savinjska', lat: 46.3760, lng: 15.0883 },
  { name: 'Šmartinsko jezero', town: 'Celje', region: 'Savinjska', lat: 46.2812, lng: 15.2677 },
  { name: 'Zbiljsko jezero', town: 'Ljubljana', region: 'Osrednjeslovenska', lat: 46.1347, lng: 14.3738 },
  { name: 'Jezero Jasna', town: 'Kranj', region: 'Gorenjska', lat: 46.4756, lng: 13.7835 },
];

// Sea/coastal stations
interface SeaDef { name: string; town: string; lat: number; lng: number; }
const SEA_STATIONS: SeaDef[] = [
  { name: 'Koper — Luka', town: 'Koper', lat: 45.5482, lng: 13.7296 },
  { name: 'Piran — Tartinijev trg', town: 'Piran', lat: 45.5278, lng: 13.5706 },
  { name: 'Izola — Marina', town: 'Izola', lat: 45.5366, lng: 13.6602 },
  { name: 'Portorož — Plaža', town: 'Portorož', lat: 45.5143, lng: 13.5921 },
  { name: 'Ankaran — Valdoltra', town: 'Ankaran', lat: 45.5790, lng: 13.7365 },
];

// Soil monitoring sites
interface SoilDef { name: string; town: string; region: string; }
const SOIL_SITES: SoilDef[] = [
  { name: 'Celje — industrijska cona', town: 'Celje', region: 'Savinjska' },
  { name: 'Maribor — Tezno', town: 'Maribor', region: 'Podravska' },
  { name: 'Ljubljana — Barje', town: 'Ljubljana', region: 'Osrednjeslovenska' },
  { name: 'Jesenice — Jeklarna', town: 'Jesenice', region: 'Gorenjska' },
  { name: 'Trbovlje — TE', town: 'Trbovlje', region: 'Zasavska' },
  { name: 'Velenje — Premogovnik', town: 'Velenje', region: 'Savinjska' },
  { name: 'Ravne — Železarna', town: 'Ravne na Koroškem', region: 'Koroška' },
  { name: 'Idrija — Rudnik', town: 'Idrija', region: 'Goriška' },
  { name: 'Koper — Industrijsko', town: 'Koper', region: 'Obalno-kraška' },
  { name: 'Kranj — Savska loka', town: 'Kranj', region: 'Gorenjska' },
];

const RATINGS_LIST = ['Very poor', 'Poor', 'Moderate', 'Good', 'Very good'];

export interface ObsLocationSeed {
  id: string;
  name: string;
  lat: number;
  lng: number;
  program: Program;
  region: string;
  rating: string;
}

function programToEnvType(p: Program): EnvironmentType {
  if (p === 'Sea') return 'water';
  if (p === 'River' || p === 'Lake') return 'water';
  return 'soil';
}

function ratingToDbRating(r: string): Rating {
  const map: Record<string, Rating> = {
    'Very poor': 'very_poor', 'Poor': 'poor', 'Moderate': 'moderate',
    'Good': 'good', 'Very good': 'very_good',
  };
  return map[r] || 'moderate';
}

function makeCode(name: string, idx: number): string {
  const parts = name.replace(/—/g, '-').split(/[\s-]+/).filter(Boolean);
  const prefix = parts.slice(0, 3).map(p => p.substring(0, 3).toUpperCase()).join('-');
  return `${prefix}-${String(idx).padStart(2, '0')}`;
}

export function generateObsLocationSeeds(): ObsLocationSeed[] {
  const rng = mulberry32(42);
  const pick = <T,>(arr: T[]) => arr[Math.floor(rng() * arr.length)];
  const seeds: ObsLocationSeed[] = [];
  const usedNames = new Set<string>();

  function addSeed(name: string, lat: number, lng: number, program: Program, region: string) {
    // Ensure unique name
    let finalName = name;
    let counter = 2;
    while (usedNames.has(finalName)) { finalName = `${name} ${counter}`; counter++; }
    usedNames.add(finalName);
    const rating = pick(RATINGS_LIST);
    seeds.push({ id: `l${seeds.length}`, name: finalName, lat, lng, program, region, rating });
  }

  function townCoord(town: string): [number, number] {
    const c = TOWN_COORDS[town];
    // Small random offset (~500m) to avoid overlapping markers
    return c ? [c[0] + (rng() - 0.5) * 0.008, c[1] + (rng() - 0.5) * 0.008] : [46.0 + rng() * 0.8, 14.0 + rng() * 2.5];
  }

  // Generate river stations (~60)
  for (const river of RIVER_STATIONS) {
    for (const town of river.towns) {
      const [lat, lng] = townCoord(town);
      const region = river.region === 'multiple'
        ? (town === 'Jesenice' || town === 'Radovljica' || town === 'Kranj' || town === 'Škofja Loka' ? 'Gorenjska'
          : town === 'Ljubljana' ? 'Osrednjeslovenska'
          : town === 'Litija' || town === 'Zagorje' || town === 'Trbovlje' || town === 'Hrastnik' ? 'Zasavska'
          : 'Posavska')
        : river.region;
      addSeed(`${river.name} — ${town}`, lat, lng, 'River', region);
    }
  }

  // Generate lake stations (~12, some with multiple sampling points)
  for (const lake of LAKE_STATIONS) {
    const numStations = 1 + Math.floor(rng() * 2); // 1-2 stations per lake
    for (let s = 0; s < numStations; s++) {
      const name = numStations > 1 ? `${lake.name} — Stn ${s + 1}` : lake.name;
      addSeed(name, lake.lat + (rng() - 0.5) * 0.005, lake.lng + (rng() - 0.5) * 0.005, 'Lake', lake.region);
    }
  }

  // Generate sea stations (5)
  for (const sea of SEA_STATIONS) {
    addSeed(sea.name, sea.lat + (rng() - 0.5) * 0.003, sea.lng + (rng() - 0.5) * 0.003, 'Sea', 'Obalno-kraška');
  }

  // Generate soil stations (10)
  for (const soil of SOIL_SITES) {
    const [lat, lng] = townCoord(soil.town);
    addSeed(soil.name, lat, lng, 'Soil', soil.region);
  }

  // Fill remaining to reach 100 with additional river stations at key locations
  const extraRiverSpots: { river: string; town: string; region: string }[] = [
    { river: 'Sava', town: 'Bled', region: 'Gorenjska' },
    { river: 'Drava', town: 'Slovenska Bistrica', region: 'Podravska' },
    { river: 'Savinja', town: 'Šentjur', region: 'Savinjska' },
    { river: 'Krka', town: 'Metlika', region: 'Jugovzhodna' },
    { river: 'Mura', town: 'Ljutomer', region: 'Pomurska' },
    { river: 'Sava', town: 'Domžale', region: 'Osrednjeslovenska' },
    { river: 'Sava', town: 'Kamnik', region: 'Osrednjeslovenska' },
    { river: 'Drava', town: 'Lenart', region: 'Podravska' },
    { river: 'Soča', town: 'Ajdovščina', region: 'Goriška' },
    { river: 'Kolpa', town: 'Kočevje', region: 'Jugovzhodna' },
    { river: 'Sava', town: 'Grosuplje', region: 'Osrednjeslovenska' },
    { river: 'Ljubljanica', town: 'Grosuplje', region: 'Osrednjeslovenska' },
    { river: 'Drava', town: 'Ptuj', region: 'Podravska' },
    { river: 'Savinja', town: 'Celje', region: 'Savinjska' },
  ];
  let extraIdx = 0;
  while (seeds.length < 100 && extraIdx < extraRiverSpots.length) {
    const spot = extraRiverSpots[extraIdx++];
    const [lat, lng] = townCoord(spot.town);
    addSeed(`${spot.river} — ${spot.town}`, lat, lng, 'River', spot.region);
  }

  return seeds;
}

/** Convert seeds to full Location objects for the database */
export function obsLocationsForDb(): Location[] {
  return generateObsLocationSeeds().map((s, i) => ({
    id: s.id,
    code: makeCode(s.name, i),
    name: s.name,
    latitude: s.lat,
    longitude: s.lng,
    environment_type: programToEnvType(s.program),
    rating: ratingToDbRating(s.rating),
    description: `${s.program} monitoring station in ${s.region}`,
  }));
}
