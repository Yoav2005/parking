import { apiClient } from "./client";

export const paymentsApi = {
  createConnectAccount: () => apiClient.post("/payments/create-connect-account"),
  getConnectStatus: () => apiClient.get("/payments/connect-status"),
};
