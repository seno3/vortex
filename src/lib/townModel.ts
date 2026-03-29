import { TownModel } from '@/types';
import { geocodeAddress } from './geocode';
import { fetchBuildings, fetchRoads, fetchInfrastructure } from './overpass';
import { DEMO_TOWN_MODEL } from './fallback';

const RADIUS_M = 800;

const MOORE_OK_ALIASES = ['moore', 'oklahoma'];

export async function buildTownModel(address: string): Promise<TownModel> {
  // Short-circuit for the demo address — real data is already saved locally.
  const lower = address.toLowerCase();
  if (MOORE_OK_ALIASES.every((w) => lower.includes(w))) {
    return DEMO_TOWN_MODEL;
  }

  // Geocode
  const location = await geocodeAddress(address);

  // Fetch OSM data (with fallback)
  let buildings, roads, infrastructure;
  try {
    [buildings, roads, infrastructure] = await Promise.all([
      fetchBuildings(location.lat, location.lng, RADIUS_M),
      fetchRoads(location.lat, location.lng, RADIUS_M),
      fetchInfrastructure(location.lat, location.lng, RADIUS_M),
    ]);
  } catch (err) {
    console.error('OSM fetch failed, using fallback data:', err);
    return DEMO_TOWN_MODEL;
  }

  // If we got too few buildings, use fallback
  if (buildings.length < 5) {
    console.warn('Too few buildings from OSM, using fallback');
    return DEMO_TOWN_MODEL;
  }

  const lats = buildings.map((b) => b.centroid.lat);
  const lngs = buildings.map((b) => b.centroid.lng);

  const residentialCount = buildings.filter((b) => b.type === 'residential').length;
  const population_estimate = Math.round(residentialCount * 2.5);

  const model: TownModel = {
    center: { lat: location.lat, lng: location.lng },
    bounds: {
      north: Math.max(...lats, location.lat + 0.007),
      south: Math.min(...lats, location.lat - 0.007),
      east: Math.max(...lngs, location.lng + 0.008),
      west: Math.min(...lngs, location.lng - 0.008),
    },
    buildings,
    roads,
    infrastructure,
    population_estimate,
  };

  return model;
}
