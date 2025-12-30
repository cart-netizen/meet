/**
 * Russian cities data for MeetUp.local
 * Includes coordinates for default map centering
 */

import type { GeoPoint } from '@/types';

export interface City {
  id: string;
  name: string;
  region: string;
  population: number;
  location: GeoPoint;
  timezone: string;
}

/**
 * Major Russian cities supported by the platform
 * Sorted by population for easy display
 */
export const RUSSIAN_CITIES: City[] = [
  {
    id: 'moscow',
    name: 'Москва',
    region: 'Москва',
    population: 12_655_050,
    location: { latitude: 55.7558, longitude: 37.6173 },
    timezone: 'Europe/Moscow',
  },
  {
    id: 'saint-petersburg',
    name: 'Санкт-Петербург',
    region: 'Санкт-Петербург',
    population: 5_384_342,
    location: { latitude: 59.9343, longitude: 30.3351 },
    timezone: 'Europe/Moscow',
  },
  {
    id: 'novosibirsk',
    name: 'Новосибирск',
    region: 'Новосибирская область',
    population: 1_625_631,
    location: { latitude: 55.0084, longitude: 82.9357 },
    timezone: 'Asia/Novosibirsk',
  },
  {
    id: 'yekaterinburg',
    name: 'Екатеринбург',
    region: 'Свердловская область',
    population: 1_493_749,
    location: { latitude: 56.8389, longitude: 60.6057 },
    timezone: 'Asia/Yekaterinburg',
  },
  {
    id: 'kazan',
    name: 'Казань',
    region: 'Республика Татарстан',
    population: 1_257_391,
    location: { latitude: 55.7887, longitude: 49.1221 },
    timezone: 'Europe/Moscow',
  },
  {
    id: 'nizhny-novgorod',
    name: 'Нижний Новгород',
    region: 'Нижегородская область',
    population: 1_252_236,
    location: { latitude: 56.2965, longitude: 43.9361 },
    timezone: 'Europe/Moscow',
  },
  {
    id: 'chelyabinsk',
    name: 'Челябинск',
    region: 'Челябинская область',
    population: 1_196_680,
    location: { latitude: 55.1644, longitude: 61.4368 },
    timezone: 'Asia/Yekaterinburg',
  },
  {
    id: 'samara',
    name: 'Самара',
    region: 'Самарская область',
    population: 1_156_659,
    location: { latitude: 53.1959, longitude: 50.1002 },
    timezone: 'Europe/Samara',
  },
  {
    id: 'omsk',
    name: 'Омск',
    region: 'Омская область',
    population: 1_154_507,
    location: { latitude: 54.9885, longitude: 73.3242 },
    timezone: 'Asia/Omsk',
  },
  {
    id: 'rostov-on-don',
    name: 'Ростов-на-Дону',
    region: 'Ростовская область',
    population: 1_137_904,
    location: { latitude: 47.2357, longitude: 39.7015 },
    timezone: 'Europe/Moscow',
  },
  {
    id: 'ufa',
    name: 'Уфа',
    region: 'Республика Башкортостан',
    population: 1_128_787,
    location: { latitude: 54.7388, longitude: 55.9721 },
    timezone: 'Asia/Yekaterinburg',
  },
  {
    id: 'krasnoyarsk',
    name: 'Красноярск',
    region: 'Красноярский край',
    population: 1_092_851,
    location: { latitude: 56.0153, longitude: 92.8932 },
    timezone: 'Asia/Krasnoyarsk',
  },
  {
    id: 'voronezh',
    name: 'Воронеж',
    region: 'Воронежская область',
    population: 1_058_261,
    location: { latitude: 51.6755, longitude: 39.2089 },
    timezone: 'Europe/Moscow',
  },
  {
    id: 'perm',
    name: 'Пермь',
    region: 'Пермский край',
    population: 1_055_397,
    location: { latitude: 58.0105, longitude: 56.2502 },
    timezone: 'Asia/Yekaterinburg',
  },
  {
    id: 'volgograd',
    name: 'Волгоград',
    region: 'Волгоградская область',
    population: 1_008_998,
    location: { latitude: 48.7080, longitude: 44.5133 },
    timezone: 'Europe/Volgograd',
  },
  {
    id: 'krasnodar',
    name: 'Краснодар',
    region: 'Краснодарский край',
    population: 948_827,
    location: { latitude: 45.0355, longitude: 38.9753 },
    timezone: 'Europe/Moscow',
  },
  {
    id: 'saratov',
    name: 'Саратов',
    region: 'Саратовская область',
    population: 838_042,
    location: { latitude: 51.5336, longitude: 46.0343 },
    timezone: 'Europe/Saratov',
  },
  {
    id: 'tyumen',
    name: 'Тюмень',
    region: 'Тюменская область',
    population: 816_700,
    location: { latitude: 57.1553, longitude: 65.5619 },
    timezone: 'Asia/Yekaterinburg',
  },
  {
    id: 'tolyatti',
    name: 'Тольятти',
    region: 'Самарская область',
    population: 699_429,
    location: { latitude: 53.5078, longitude: 49.4204 },
    timezone: 'Europe/Samara',
  },
  {
    id: 'izhevsk',
    name: 'Ижевск',
    region: 'Удмуртская Республика',
    population: 648_944,
    location: { latitude: 56.8519, longitude: 53.2114 },
    timezone: 'Europe/Samara',
  },
  {
    id: 'barnaul',
    name: 'Барнаул',
    region: 'Алтайский край',
    population: 632_391,
    location: { latitude: 53.3548, longitude: 83.7698 },
    timezone: 'Asia/Barnaul',
  },
  {
    id: 'vladivostok',
    name: 'Владивосток',
    region: 'Приморский край',
    population: 605_049,
    location: { latitude: 43.1155, longitude: 131.8855 },
    timezone: 'Asia/Vladivostok',
  },
  {
    id: 'irkutsk',
    name: 'Иркутск',
    region: 'Иркутская область',
    population: 623_736,
    location: { latitude: 52.2978, longitude: 104.2964 },
    timezone: 'Asia/Irkutsk',
  },
  {
    id: 'khabarovsk',
    name: 'Хабаровск',
    region: 'Хабаровский край',
    population: 616_372,
    location: { latitude: 48.4827, longitude: 135.0837 },
    timezone: 'Asia/Vladivostok',
  },
  {
    id: 'yaroslavl',
    name: 'Ярославль',
    region: 'Ярославская область',
    population: 601_403,
    location: { latitude: 57.6261, longitude: 39.8845 },
    timezone: 'Europe/Moscow',
  },
];

/**
 * Cities map for O(1) lookup by ID
 */
export const CITIES_BY_ID: Map<string, City> = new Map(
  RUSSIAN_CITIES.map((city) => [city.id, city])
);

/**
 * Cities map for O(1) lookup by name
 */
export const CITIES_BY_NAME: Map<string, City> = new Map(
  RUSSIAN_CITIES.map((city) => [city.name, city])
);

/**
 * Get city by ID with O(1) lookup
 */
export const getCityById = (id: string): City | undefined => {
  return CITIES_BY_ID.get(id);
};

/**
 * Get city by name with O(1) lookup
 */
export const getCityByName = (name: string): City | undefined => {
  return CITIES_BY_NAME.get(name);
};

/**
 * Search cities by partial name match (case-insensitive)
 */
export const searchCities = (query: string): City[] => {
  const normalizedQuery = query.toLowerCase().trim();
  if (!normalizedQuery) {
    return RUSSIAN_CITIES;
  }
  return RUSSIAN_CITIES.filter((city) =>
    city.name.toLowerCase().includes(normalizedQuery)
  );
};

/**
 * Get nearest city to a given location
 */
export const getNearestCity = (location: GeoPoint): City | undefined => {
  let nearestCity: City | undefined;
  let minDistance = Infinity;

  for (const city of RUSSIAN_CITIES) {
    const distance = calculateDistance(location, city.location);
    if (distance < minDistance) {
      minDistance = distance;
      nearestCity = city;
    }
  }

  return nearestCity;
};

/**
 * Calculate distance between two points in kilometers (Haversine formula)
 */
function calculateDistance(point1: GeoPoint, point2: GeoPoint): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = toRad(point2.latitude - point1.latitude);
  const dLon = toRad(point2.longitude - point1.longitude);
  const lat1 = toRad(point1.latitude);
  const lat2 = toRad(point2.latitude);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

function toRad(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Default city for new users
 */
export const DEFAULT_CITY = RUSSIAN_CITIES[0]; // Moscow

/**
 * City names list for form dropdowns
 */
export const CITY_NAMES = RUSSIAN_CITIES.map((city) => city.name);
