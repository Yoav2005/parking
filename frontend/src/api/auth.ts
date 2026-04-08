import { apiClient } from "./client";

export const authApi = {
  registerInitiate: (email: string, password: string, full_name: string, phone: string) =>
    apiClient.post("/auth/register/initiate", { email, password, full_name, phone }),

  registerVerify: (email: string, otp: string) =>
    apiClient.post("/auth/register/verify", { email, otp }),

  login: (email: string, password: string) =>
    apiClient.post("/auth/login", { email, password }),

  refresh: (refresh_token: string) =>
    apiClient.post("/auth/refresh", { refresh_token }),
};
