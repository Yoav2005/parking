import { apiClient } from "./client";

const API_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:8000";

export const spotsApi = {
  uploadPhoto: async (uri: string): Promise<string> => {
    const filename = uri.split("/").pop() || "photo.jpg";
    const ext = (filename.split(".").pop() || "jpg").toLowerCase();
    const formData = new FormData();
    formData.append("file", { uri, name: filename, type: `image/${ext}` } as any);
    const { data } = await apiClient.post("/upload", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return `${API_URL}${data.data.url}`;
  },

  create: (data: {
    latitude: number;
    longitude: number;
    address: string;
    price: number;
    leaving_in_minutes: number;
    photo_url?: string;
  }) => apiClient.post("/spots", data),

  getNearby: (lat: number, lng: number, radius_km = 2) =>
    apiClient.get("/spots/nearby", { params: { lat, lng, radius_km } }),

  getById: (id: string) => apiClient.get(`/spots/${id}`),

  cancel: (id: string) => apiClient.patch(`/spots/${id}/cancel`),

  getMyListing: () => apiClient.get("/spots/my-listing"),
};
