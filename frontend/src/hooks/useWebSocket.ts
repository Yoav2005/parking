import { useEffect, useRef } from "react";
import { useSpotsStore } from "../store/spotsStore";
import { useAuthStore } from "../store/authStore";

const WS_URL = (process.env.EXPO_PUBLIC_API_URL || "http://localhost:8000")
  .replace(/^http/, "ws");

// ── Leaver alert ───────────────────────────────────────────────────────
export type LeaverAlertData = {
  spot_id: string;
  reservation_id?: string;
  leaver_id?: string;
  driver_name?: string;
  driver_car_make?: string;
  driver_car_model?: string;
  distance_km?: number;
  spot_address?: string;
};

type LeaverAlertHandler = (data: LeaverAlertData) => void;
let globalLeaverHandler: LeaverAlertHandler | null = null;
export function setLeaverAlertHandler(handler: LeaverAlertHandler | null) {
  globalLeaverHandler = handler;
}

// ── Reservation cancelled (driver cancelled) ───────────────────────────
export type ReservationCancelledData = {
  spot_id: string;
  reservation_id: string;
  leaver_id: string;
  cancelled_by: string;
};

type ReservationCancelledHandler = (data: ReservationCancelledData) => void;
let globalReservationCancelledHandler: ReservationCancelledHandler | null = null;
export function setReservationCancelledHandler(handler: ReservationCancelledHandler | null) {
  globalReservationCancelledHandler = handler;
}

// ── Chat message ───────────────────────────────────────────────────────
export type ChatMessageData = {
  id: string;
  reservation_id: string;
  sender_id: string;
  sender_name: string;
  content: string;
  created_at: string;
};

type ChatMessageHandler = (data: ChatMessageData) => void;
let globalChatHandler: ChatMessageHandler | null = null;
export function setChatMessageHandler(handler: ChatMessageHandler | null) {
  globalChatHandler = handler;
}

// ── Driver arrived (leaver must confirm swap) ──────────────────────────
export type DriverArrivedData = {
  reservation_id: string;
  leaver_id: string;
  driver_name: string;
  spot_address: string;
};
type DriverArrivedHandler = (data: DriverArrivedData) => void;
let globalDriverArrivedHandler: DriverArrivedHandler | null = null;
export function setDriverArrivedHandler(handler: DriverArrivedHandler | null) {
  globalDriverArrivedHandler = handler;
}

// ── Reservation completed (both parties notified) ──────────────────────
export type ReservationCompletedData = {
  reservation_id: string;
  driver_id: string;
  leaver_id: string;
};
type ReservationCompletedHandler = (data: ReservationCompletedData) => void;
let globalReservationCompletedHandler: ReservationCompletedHandler | null = null;
export function setReservationCompletedHandler(handler: ReservationCompletedHandler | null) {
  globalReservationCompletedHandler = handler;
}

// Chat open flag — suppresses notifications while chat modal is open
let chatIsOpen = false;
export function setChatOpenFlag(open: boolean) { chatIsOpen = open; }

// Notification handler — called for incoming messages from others when chat is closed
type ChatNotifyHandler = (data: ChatMessageData) => void;
let globalChatNotifyHandler: ChatNotifyHandler | null = null;
export function setChatNotifyHandler(handler: ChatNotifyHandler | null) {
  globalChatNotifyHandler = handler;
}

// ── Hook ───────────────────────────────────────────────────────────────
export function useSpotWebSocket() {
  const ws = useRef<WebSocket | null>(null);
  const alive = useRef(true);

  const addOrUpdateSpot = useRef(useSpotsStore.getState().addOrUpdateSpot);
  const removeSpot = useRef(useSpotsStore.getState().removeSpot);

  useEffect(() => {
    const unsubSpots = useSpotsStore.subscribe((state) => {
      addOrUpdateSpot.current = state.addOrUpdateSpot;
      removeSpot.current = state.removeSpot;
    });
    return () => { unsubSpots(); };
  }, []);

  useEffect(() => {
    alive.current = true;

    const connect = () => {
      if (!alive.current) return;

      const socket = new WebSocket(`${WS_URL}/ws/spots`);
      ws.current = socket;

      socket.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          const userId = useAuthStore.getState().user?.id;

          if (msg.event === "spot_created") {
            addOrUpdateSpot.current(msg.data);
          } else if (msg.event === "spot_reserved") {
            removeSpot.current(msg.data.spot_id);
            console.log("[WS] spot_reserved — leaver_id:", msg.data.leaver_id, "my id:", userId);
            if (globalLeaverHandler) {
              globalLeaverHandler({
                spot_id: msg.data.spot_id,
                reservation_id: msg.data.reservation_id,
                leaver_id: msg.data.leaver_id,
                driver_name: msg.data.driver_name,
                driver_car_make: msg.data.driver_car_make,
                driver_car_model: msg.data.driver_car_model,
                distance_km: msg.data.distance_km,
                spot_address: msg.data.spot_address,
              });
            }
          } else if (msg.event === "spot_cancelled" || msg.event === "spot_expired") {
            removeSpot.current(msg.data.spot_id);
            const myId = useAuthStore.getState().user?.id;
            // Notify leaver when driver cancels
            if (msg.data.cancelled_by === "driver" && msg.data.leaver_id === myId) {
              if (globalReservationCancelledHandler) globalReservationCancelledHandler(msg.data);
            }
            // Notify driver when leaver cancels
            if (msg.data.cancelled_by === "leaver" && msg.data.driver_id === myId) {
              if (globalReservationCancelledHandler) globalReservationCancelledHandler(msg.data);
            }
          } else if (msg.event === "driver_arrived") {
            const myId = useAuthStore.getState().user?.id;
            if (msg.data.leaver_id === myId && globalDriverArrivedHandler) {
              globalDriverArrivedHandler(msg.data as DriverArrivedData);
            }
          } else if (msg.event === "reservation_completed") {
            const myId = useAuthStore.getState().user?.id;
            if (
              (msg.data.driver_id === myId || msg.data.leaver_id === myId) &&
              globalReservationCompletedHandler
            ) {
              globalReservationCompletedHandler(msg.data as ReservationCompletedData);
            }
          } else if (msg.event === "chat_message") {
            if (globalChatHandler) {
              globalChatHandler(msg.data as ChatMessageData);
            }
            // Notify if message is from the other person and chat modal isn't open
            const myId = useAuthStore.getState().user?.id;
            if (msg.data.sender_id !== myId && !chatIsOpen && globalChatNotifyHandler) {
              globalChatNotifyHandler(msg.data as ChatMessageData);
            }
          }
        } catch {}
      };

      socket.onclose = () => {
        if (alive.current) setTimeout(connect, 3000);
      };

      socket.onerror = () => {
        socket.close();
      };
    };

    connect();

    return () => {
      alive.current = false;
      ws.current?.close();
    };
  }, []);
}
