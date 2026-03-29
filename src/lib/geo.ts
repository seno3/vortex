export function latLngToLocal(
  lat: number,
  lng: number,
  centerLat: number,
  centerLng: number
): [number, number] {
  const x = (lng - centerLng) * 111320 * Math.cos(centerLat * (Math.PI / 180));
  const z = -(lat - centerLat) * 110540; // negate Z so north is "up" in scene
  return [x, z];
}

export function distanceMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const dlat = (lat2 - lat1) * 110540;
  const dlng = (lng2 - lng1) * 111320 * Math.cos(lat1 * (Math.PI / 180));
  return Math.sqrt(dlat * dlat + dlng * dlng);
}

/**
 * Converts a lat/lng label position to Three.js scene coordinates for a
 * Gaussian splat. The scale factor maps real-world meters to splat units.
 *
 * For World Labs-generated neighbourhood scenes (50-100m radius),
 * a scale of 0.1 means 1 meter ≈ 0.1 splat units — tune per splat.
 */
export function latLngToSplatSpace(
  lat: number,
  lng: number,
  centerLat: number,
  centerLng: number,
  scale = 0.1,
  yHeight = 2.0
): [number, number, number] {
  const [x, z] = latLngToLocal(lat, lng, centerLat, centerLng);
  return [x * scale, yHeight, z * scale];
}
