'use client';
import { useEffect, useState } from 'react';

export interface UserLocation {
  lat: number;
  lng: number;
}

export function useUserLocation(): UserLocation | null {
  const [location, setLocation] = useState<UserLocation | null>(null);

  useEffect(() => {
    if (!navigator?.geolocation) return;
    // Fast one-shot to populate immediately, then watch for updates
    navigator.geolocation.getCurrentPosition(
      (pos) => setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {},
      { enableHighAccuracy: false, maximumAge: 60_000, timeout: 5_000 },
    );
    const id = navigator.geolocation.watchPosition(
      (pos) => setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {},
      { enableHighAccuracy: true },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, []);

  return location;
}
