import { apiClient } from "./client";

export const chatApi = {
  getMessages: (reservationId: string) =>
    apiClient.get(`/chat/${reservationId}/messages`),

  sendMessage: (reservationId: string, content: string) =>
    apiClient.post(`/chat/${reservationId}/messages`, { content }),
};
