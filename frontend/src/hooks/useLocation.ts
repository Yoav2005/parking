import { useState, useEffect } from "react";
import * as Location from "expo-location";

interface LocationState {
  coords: { latitude: number; longitude: number } | null;
  error: string | null;
  loading: boolean;
}

export function useLocation(): LocationState {
  const [state, setState] = useState<LocationState>({
    coords: null,
    error: null,
    loading: true,
  });

  useEffect(() => {
    let sub: Location.LocationSubscription | null = null;

    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setState({ coords: null, error: "Location permission denied", loading: false });
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setState({
        coords: { latitude: loc.coords.latitude, longitude: loc.coords.longitude },
        error: null,
        loading: false,
      });
      sub = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, timeInterval: 10000 },
        (l) =>
          setState((s) => ({
            ...s,
            coords: { latitude: l.coords.latitude, longitude: l.coords.longitude },
          }))
      );
    })();

    return () => { sub?.remove(); };
  }, []);

  return state;
}
