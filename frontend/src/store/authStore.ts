import { create } from "zustand";
import * as SecureStore from "expo-secure-store";
import { authApi } from "../api/auth";
import { apiClient } from "../api/client";

interface User {
  id: string;
  email: string;
  full_name: string;
  stripe_account_id: string | null;
  avg_rating: number;
  token_balance: number;
  car_make?: string | null;
  car_model?: string | null;
}

interface AuthState {
  user: User | null;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  registerInitiate: (email: string, password: string, full_name: string) => Promise<void>;
  registerVerify: (email: string, otp: string) => Promise<void>;
  logout: () => Promise<void>;
  loadFromStorage: () => Promise<void>;
  updateProfile: (patch: { car_make?: string; car_model?: string }) => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isLoading: false,
  error: null,

  loadFromStorage: async () => {
    const token = await SecureStore.getItemAsync("access_token");
    const userStr = await SecureStore.getItemAsync("user");
    if (token && userStr) {
      try {
        // Validate token is still accepted by the server
        await apiClient.get("/users/me");
        set({ user: JSON.parse(userStr) });
      } catch {
        // Token invalid/expired — clear storage so auth screen is shown
        await SecureStore.deleteItemAsync("access_token");
        await SecureStore.deleteItemAsync("refresh_token");
        await SecureStore.deleteItemAsync("user");
      }
    }
  },

  login: async (email, password) => {
    set({ isLoading: true, error: null });
    try {
      const { data } = await authApi.login(email, password);
      const { access_token, refresh_token, user } = data.data;
      await SecureStore.setItemAsync("access_token", access_token);
      await SecureStore.setItemAsync("refresh_token", refresh_token);
      await SecureStore.setItemAsync("user", JSON.stringify(user));
      set({ user, isLoading: false });
    } catch (e: any) {
      set({ error: e.response?.data?.detail || "Login failed", isLoading: false });
      throw e;
    }
  },

  registerInitiate: async (email, password, full_name) => {
    set({ isLoading: true, error: null });
    try {
      await authApi.registerInitiate(email, password, full_name);
      set({ isLoading: false });
    } catch (e: any) {
      set({ error: e.response?.data?.detail || "Registration failed", isLoading: false });
      throw e;
    }
  },

  registerVerify: async (email, otp) => {
    set({ isLoading: true, error: null });
    try {
      const { data } = await authApi.registerVerify(email, otp);
      const { access_token, refresh_token, user } = data.data;
      await SecureStore.setItemAsync("access_token", access_token);
      await SecureStore.setItemAsync("refresh_token", refresh_token);
      await SecureStore.setItemAsync("user", JSON.stringify(user));
      set({ user, isLoading: false });
    } catch (e: any) {
      set({ error: e.response?.data?.detail || "Verification failed", isLoading: false });
      throw e;
    }
  },

  logout: async () => {
    await SecureStore.deleteItemAsync("access_token");
    await SecureStore.deleteItemAsync("refresh_token");
    await SecureStore.deleteItemAsync("user");
    set({ user: null });
  },

  updateProfile: async (patch) => {
    const { data } = await apiClient.patch("/users/me", patch);
    const updated = data.data;
    const merged = { ...get().user, ...updated };
    await SecureStore.setItemAsync("user", JSON.stringify(merged));
    set({ user: merged });
  },
}));
