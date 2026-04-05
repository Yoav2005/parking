import { useState, useEffect } from "react";
import * as Location from "expo-location";

/** Detects "lat, lng" strings and reverse-geocodes them. Returns the original string for real addresses. */
export function useAddress(raw: string | null | undefined): string {
  const [resolved, setResolved] = useState<string>(raw ?? "");

  useEffect(() => {
    if (!raw) { setResolved(""); return; }

    // If it doesn't look like coordinates, use as-is immediately
    const match = raw.match(/^(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)$/);
    if (!match) { setResolved(raw); return; }

    const lat = parseFloat(match[1]);
    const lng = parseFloat(match[2]);

    (async () => {
      try {
        // Android requires permission to be granted before reverse geocoding
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") { setResolved(raw); return; }

        const results = await Location.reverseGeocodeAsync(
          { latitude: lat, longitude: lng },
          { useGoogleMaps: false }, // avoid requiring Google Maps API key on Android
        );
        if (results && results.length > 0) {
          const r = results[0];
          const parts = [r.street, r.city, r.region].filter(Boolean);
          setResolved(parts.length > 0 ? parts.join(", ") : raw);
        } else {
          setResolved(raw);
        }
      } catch {
        setResolved(raw);
      }
    })();
  }, [raw]);

  return resolved;
}
