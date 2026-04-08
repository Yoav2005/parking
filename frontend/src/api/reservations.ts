import { apiClient } from "./client";

export const reservationsApi = {
  create: (spot_id: string) => apiClient.post("/reservations", { spot_id }),

  getAll: () => apiClient.get("/reservations"),

  confirmArrival: (id: string) =>
    apiClient.post(`/reservations/${id}/confirm-arrival`),

  leaverConfirm: (id: string) =>
    apiClient.post(`/reservations/${id}/leaver-confirm`),

  cancel: (id: string) => apiClient.post(`/reservations/${id}/cancel`),

  updateDriverLocation: (id: string, lat: number, lng: number) =>
    apiClient.patch(`/reservations/${id}/driver-location?lat=${lat}&lng=${lng}`),
};
