/**
 * Yandex Maps Service
 * Handles map initialization and geocoding
 */

import { ENV } from '@/config/env';
import { getNearestCity, RUSSIAN_CITIES } from '@/constants/cities';
import type { GeoPoint } from '@/types';

// ============================================================================
// Types
// ============================================================================

export interface GeocodingResult {
  address: string;
  city: string;
  placeName?: string;
  location: GeoPoint;
}

export interface PlaceSuggestion {
  title: string;
  subtitle: string;
  address: string;
  location: GeoPoint;
}

// ============================================================================
// Map Initialization
// ============================================================================

let isInitialized = false;

/**
 * Initialize Yandex Maps SDK
 * Should be called once at app startup
 */
export async function initializeYandexMaps(): Promise<boolean> {
  if (isInitialized) {
    return true;
  }

  const apiKey = ENV.yandexMaps.apiKey;

  if (!apiKey) {
    console.warn('Yandex Maps API key not configured');
    return false;
  }

  try {
    // In real implementation, this would initialize the native SDK
    // For now, we'll just mark as initialized
    // YaMap.init(apiKey);
    isInitialized = true;
    return true;
  } catch (error) {
    console.error('Failed to initialize Yandex Maps:', error);
    return false;
  }
}

/**
 * Check if Yandex Maps is initialized
 */
export function isYandexMapsReady(): boolean {
  return isInitialized;
}

// ============================================================================
// Geocoding API
// ============================================================================

const GEOCODER_API = 'https://geocode-maps.yandex.ru/1.x/';

/**
 * Reverse geocode coordinates to address
 */
export async function reverseGeocode(location: GeoPoint): Promise<GeocodingResult | null> {
  const apiKey = ENV.yandexMaps.apiKey;

  if (!apiKey) {
    // Return mock data in development
    return {
      address: 'Тверская улица, 1',
      city: 'Москва',
      placeName: 'Центр города',
      location,
    };
  }

  try {
    const response = await fetch(
      `${GEOCODER_API}?apikey=${apiKey}&geocode=${location.longitude},${location.latitude}&format=json&lang=ru_RU`
    );

    if (!response.ok) {
      throw new Error('Geocoding request failed');
    }

    const data = await response.json();
    const result = data.response?.GeoObjectCollection?.featureMember?.[0]?.GeoObject;

    if (!result) {
      return null;
    }

    const address = result.metaDataProperty?.GeocoderMetaData?.text ?? '';
    const components = result.metaDataProperty?.GeocoderMetaData?.Address?.Components ?? [];

    const cityComponent = components.find(
      (c: { kind: string }) => c.kind === 'locality' || c.kind === 'province'
    );

    return {
      address,
      city: cityComponent?.name ?? 'Москва',
      placeName: result.name,
      location,
    };
  } catch (error) {
    console.error('Reverse geocoding error:', error);
    return null;
  }
}

/**
 * Forward geocode address to coordinates
 */
export async function forwardGeocode(address: string): Promise<GeocodingResult | null> {
  const apiKey = ENV.yandexMaps.apiKey;

  if (!apiKey) {
    // Return mock data in development
    return {
      address,
      city: 'Москва',
      location: { latitude: 55.7558, longitude: 37.6173 },
    };
  }

  try {
    const response = await fetch(
      `${GEOCODER_API}?apikey=${apiKey}&geocode=${encodeURIComponent(address)}&format=json&lang=ru_RU`
    );

    if (!response.ok) {
      throw new Error('Geocoding request failed');
    }

    const data = await response.json();
    const result = data.response?.GeoObjectCollection?.featureMember?.[0]?.GeoObject;

    if (!result) {
      return null;
    }

    const [lon, lat] = result.Point.pos.split(' ').map(Number);
    const components = result.metaDataProperty?.GeocoderMetaData?.Address?.Components ?? [];

    const cityComponent = components.find(
      (c: { kind: string }) => c.kind === 'locality' || c.kind === 'province'
    );

    return {
      address: result.metaDataProperty?.GeocoderMetaData?.text ?? address,
      city: cityComponent?.name ?? 'Москва',
      placeName: result.name,
      location: { latitude: lat, longitude: lon },
    };
  } catch (error) {
    console.error('Forward geocoding error:', error);
    return null;
  }
}

// ============================================================================
// Place Suggestions API
// ============================================================================

const SUGGEST_API = 'https://suggest-maps.yandex.ru/v1/suggest';

/**
 * Get place suggestions for autocomplete
 */
export async function getPlaceSuggestions(
  query: string,
  userLocation?: GeoPoint
): Promise<PlaceSuggestion[]> {
  if (query.length < 3) {
    return [];
  }

  const apiKey = ENV.yandexMaps.apiKey;

  // Return mock data in development without API key
  if (!apiKey) {
    // Determine city based on user location or default to Moscow
    const city = userLocation
      ? getNearestCity(userLocation) ?? RUSSIAN_CITIES[0]
      : RUSSIAN_CITIES[0];

    const cityName = city?.name ?? 'Москва';
    const cityLat = city?.location.latitude ?? 55.7558;
    const cityLon = city?.location.longitude ?? 37.6173;

    // Generate mock addresses for the determined city
    const mockAddresses = [
      { street: 'Центральная улица', num: '1' },
      { street: 'Ленина проспект', num: '15' },
      { street: 'Советская улица', num: '42' },
      { street: 'Мира улица', num: '7' },
      { street: 'Парковая улица', num: '23' },
      { street: 'Кирова улица', num: '10' },
      { street: 'Гагарина улица', num: '5' },
      { street: 'Пушкина улица', num: '18' },
    ];

    const mockSuggestions: PlaceSuggestion[] = mockAddresses.map((addr, idx) => ({
      title: `${addr.street}, ${addr.num}`,
      subtitle: `${cityName}, Россия`,
      address: `${cityName}, ${addr.street}, ${addr.num}`,
      location: {
        latitude: cityLat + (Math.random() - 0.5) * 0.02,
        longitude: cityLon + (Math.random() - 0.5) * 0.02,
      },
    }));

    // Filter by query
    const lowerQuery = query.toLowerCase();
    return mockSuggestions.filter(
      (s) =>
        s.title.toLowerCase().includes(lowerQuery) ||
        s.address.toLowerCase().includes(lowerQuery) ||
        s.subtitle.toLowerCase().includes(lowerQuery) ||
        cityName.toLowerCase().includes(lowerQuery)
    );
  }

  try {
    const params = new URLSearchParams({
      apikey: apiKey,
      text: query,
      lang: 'ru',
      results: '5',
      types: 'geo,biz',
    });

    if (userLocation) {
      params.append('ll', `${userLocation.longitude},${userLocation.latitude}`);
      params.append('spn', '0.5,0.5');
    }

    const response = await fetch(`${SUGGEST_API}?${params}`);

    if (!response.ok) {
      throw new Error('Suggestions request failed');
    }

    const data = await response.json();

    return (data.results ?? []).map((item: Record<string, unknown>) => ({
      title: (item.title as { text: string })?.text ?? '',
      subtitle: (item.subtitle as { text: string })?.text ?? '',
      address: (item.address as { formatted_address: string })?.formatted_address ?? '',
      location: {
        latitude: (item.position as number[])?.[1] ?? 0,
        longitude: (item.position as number[])?.[0] ?? 0,
      },
    }));
  } catch (error) {
    console.error('Place suggestions error:', error);
    return [];
  }
}

// ============================================================================
// Distance & Bounds Helpers
// ============================================================================

/**
 * Calculate distance between two points in kilometers
 */
export function calculateDistance(point1: GeoPoint, point2: GeoPoint): number {
  const R = 6371; // Earth's radius in km
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
 * Calculate map bounds to fit all points
 */
export function calculateBounds(points: GeoPoint[]): {
  center: GeoPoint;
  delta: { latitudeDelta: number; longitudeDelta: number };
} {
  if (points.length === 0) {
    return {
      center: { latitude: 55.7558, longitude: 37.6173 }, // Moscow
      delta: { latitudeDelta: 0.1, longitudeDelta: 0.1 },
    };
  }

  if (points.length === 1) {
    return {
      center: points[0]!,
      delta: { latitudeDelta: 0.02, longitudeDelta: 0.02 },
    };
  }

  let minLat = points[0]!.latitude;
  let maxLat = points[0]!.latitude;
  let minLon = points[0]!.longitude;
  let maxLon = points[0]!.longitude;

  for (const point of points) {
    minLat = Math.min(minLat, point.latitude);
    maxLat = Math.max(maxLat, point.latitude);
    minLon = Math.min(minLon, point.longitude);
    maxLon = Math.max(maxLon, point.longitude);
  }

  const padding = 0.1; // 10% padding

  return {
    center: {
      latitude: (minLat + maxLat) / 2,
      longitude: (minLon + maxLon) / 2,
    },
    delta: {
      latitudeDelta: (maxLat - minLat) * (1 + padding) || 0.02,
      longitudeDelta: (maxLon - minLon) * (1 + padding) || 0.02,
    },
  };
}
