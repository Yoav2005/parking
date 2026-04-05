import { create } from "zustand";
import { spotsApi } from "../api/spots";

export interface Spot {
  id: string;
  leaver_id: string;
  latitude: number;
  longitude: number;
  address: string;
  price: number;
  status: "AVAILABLE" | "RESERVED" | "COMPLETED" | "CANCELLED" | "EXPIRED";
  leaving_in_minutes: number;
  photo_url: string | null;
  created_at: string;
  expires_at: string;
  distance_km?: number;
  leaver_avg_rating?: number;
}

interface SpotsState {
  spots: Spot[];
  selectedSpot: Spot | null;
  isLoading: boolean;
  error: string | null;
  fetchNearby: (lat: number, lng: number, radius_km?: number) => Promise<void>;
  fetchById: (id: string) => Promise<void>;
  addOrUpdateSpot: (spot: Spot) => void;
  removeSpot: (id: string) => void;
  setSelected: (spot: Spot | null) => void;
}

export const useSpotsStore = create<SpotsState>((set, get) => ({
  spots: [],
  selectedSpot: null,
  isLoading: false,
  error: null,

  fetchNearby: async (lat, lng, radius_km = 2) => {
    set({ isLoading: true, error: null });
    try {
      const { data } = await spotsApi.getNearby(lat, lng, radius_km);
      set({ spots: data.data, isLoading: false });
    } catch (e: any) {
      set({ error: "Failed to load spots", isLoading: false });
    }
  },

  fetchById: async (id) => {
    set({ isLoading: true });
    try {
      const { data } = await spotsApi.getById(id);
      set({ selectedSpot: data.data, isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  addOrUpdateSpot: (spot) => {
    set((state) => {
      const idx = state.spots.findIndex((s) => s.id === spot.id);
      if (idx >= 0) {
        const updated = [...state.spots];
        updated[idx] = spot;
        return { spots: updated };
      }
      return { spots: [spot, ...state.spots] };
    });
  },

  removeSpot: (id) => {
    set((state) => ({ spots: state.spots.filter((s) => s.id !== id) }));
  },

  setSelected: (spot) => set({ selectedSpot: spot }),
}));
