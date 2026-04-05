import { apiClient } from "./client";

export const ratingsApi = {
  create: (reservation_id: string, rated_id: string, score: number) =>
    apiClient.post("/ratings", { reservation_id, rated_id, score }),
};
