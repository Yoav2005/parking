import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, Alert,
  ActivityIndicator, Linking, ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import MapView, { Marker } from "react-native-maps";
import * as Location from "expo-location";
import { reservationsApi } from "../api/reservations";
import { ratingsApi } from "../api/ratings";
import { ChatModal } from "../components/ChatModal";
import { setReservationCompletedHandler } from "../hooks/useWebSocket";
import { useAddress } from "../hooks/useAddress";

// ── Real-world routing via OSRM (free, no API key) ─────────────────────
interface RouteInfo {
  etaMinutes: number | null;   // driving time in minutes
  distanceKm: number | null;   // driving distance in km
  loading: boolean;
}

function useRouteInfo(destLat: number, destLng: number): RouteInfo {
  const [info, setInfo] = useState<RouteInfo>({ etaMinutes: null, distanceKm: null, loading: true });
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchRoute = useCallback(async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setInfo({ etaMinutes: null, distanceKm: null, loading: false });
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const { latitude: dLat, longitude: dLng } = pos.coords;
      const url =
        `https://router.project-osrm.org/route/v1/driving/` +
        `${dLng},${dLat};${destLng},${destLat}?overview=false`;
      const res = await fetch(url);
      const json = await res.json();
      if (json.code === "Ok" && json.routes?.length) {
        const route = json.routes[0];
        setInfo({
          etaMinutes: Math.ceil(route.duration / 60),
          distanceKm: Math.round(route.distance / 100) / 10, // 1 decimal km
          loading: false,
        });
      } else {
        setInfo((prev) => ({ ...prev, loading: false }));
      }
    } catch {
      setInfo((prev) => ({ ...prev, loading: false }));
    }
  }, [destLat, destLng]);

  useEffect(() => {
    fetchRoute();
    intervalRef.current = setInterval(fetchRoute, 15_000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchRoute]);

  return info;
}

interface Props {
  reservationId: string;
  clientSecret: string | null;
  spotAddress: string;
  spotLat: number;
  spotLng: number;
  leaverId: string;
  leaverName?: string;
  leaverRating?: number;
  leaverCarMake?: string;
  leaverCarModel?: string;
  tokenCost?: number;
  driverBalance?: number;
  onCompleted: () => void;
  onBack: () => void;
  onArrivalConfirmed?: () => void;
}

export default function ReservationScreen({
  reservationId, spotAddress, spotLat, spotLng,
  leaverId, leaverName, leaverRating, leaverCarMake, leaverCarModel,
  onCompleted, onBack, onArrivalConfirmed,
}: Props) {
  const [step, setStep] = useState<"navigating" | "waitingLeaver" | "rating">("navigating");
  const [isLoading, setIsLoading] = useState(false);
  const [rating, setRating] = useState(0);
  const [chatOpen, setChatOpen] = useState(false);

  const resolvedAddress = useAddress(spotAddress);
  const { etaMinutes, distanceKm, loading: routeLoading } = useRouteInfo(spotLat, spotLng);

  // When leaver confirms the swap via WS, move to rating
  useEffect(() => {
    setReservationCompletedHandler((data) => {
      if (data.reservation_id === reservationId) {
        onArrivalConfirmed?.();
        setStep("rating");
      }
    });
    return () => setReservationCompletedHandler(null);
  }, [reservationId]);

  const etaDisplay = routeLoading
    ? "..."
    : etaMinutes !== null
    ? `${etaMinutes} min`
    : "N/A";
  const distDisplay = distanceKm !== null ? `${distanceKm} km` : null;

  const openNavigation = () => {
    Linking.openURL(`https://maps.google.com/?q=${spotLat},${spotLng}`);
  };

  const handleConfirmArrival = async () => {
    setIsLoading(true);
    try {
      await reservationsApi.confirmArrival(reservationId);
      setStep("waitingLeaver");
    } catch (e: any) {
      Alert.alert("Error", e.response?.data?.detail || "Failed to confirm arrival");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmitRating = async () => {
    if (rating === 0) { Alert.alert("Please select a rating"); return; }
    try { await ratingsApi.create(reservationId, leaverId, rating); } catch {}
    onCompleted();
  };

  const handleCancel = () => {
    Alert.alert("Cancel Reservation", "Cancel and get a full refund?", [
      { text: "No" },
      {
        text: "Yes, Cancel", style: "destructive",
        onPress: async () => {
          try {
            await reservationsApi.cancel(reservationId);
            onBack();
          } catch (e: any) {
            Alert.alert("Error", e.response?.data?.detail || "Failed to cancel");
          }
        },
      },
    ]);
  };

  // ── Rating step ──────────────────────────────────────────────────────
  if (step === "rating") {
    return (
      <SafeAreaView style={styles.ratingSafe}>
        <View style={styles.ratingContainer}>
          <View style={styles.ratingIconCircle}>
            <Text style={styles.ratingIconText}>★</Text>
          </View>
          <Text style={styles.ratingTitle}>Rate Your Experience</Text>
          <Text style={styles.ratingSubtitle}>How was {leaverName ?? "the leaver"}?</Text>
          <View style={styles.starsRow}>
            {[1, 2, 3, 4, 5].map((s) => (
              <TouchableOpacity key={s} onPress={() => setRating(s)}>
                <Text style={[styles.star, s <= rating && styles.starFilled]}>★</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity style={styles.submitBtn} onPress={handleSubmitRating}>
            <Text style={styles.submitBtnText}>Submit Rating</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onCompleted}>
            <Text style={styles.skipText}>Skip</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── Waiting for leaver confirmation ─────────────────────────────────
  const leaverInitial = (leaverName ?? "L").charAt(0).toUpperCase();
  const leaverCarLine = leaverCarMake
    ? `${leaverCarMake}${leaverCarModel ? " " + leaverCarModel : ""}`
    : null;
  const shortAddress = resolvedAddress.split(",")[0] || resolvedAddress;
  const cityLine = resolvedAddress.split(",").slice(1).join(",").trim() || "";

  if (step === "waitingLeaver") {
    return (
      <SafeAreaView style={styles.ratingSafe}>
        <View style={styles.ratingContainer}>
          <View style={[styles.ratingIconCircle, { backgroundColor: "#22C55E" }]}>
            <Text style={styles.ratingIconText}>✓</Text>
          </View>
          <Text style={styles.ratingTitle}>You've Arrived!</Text>
          <Text style={styles.ratingSubtitle}>
            Waiting for {leaverName?.split(" ")[0] ?? "the leaver"} to confirm the swap and vacate the spot.
          </Text>
          <ActivityIndicator color="#1E3DB8" size="large" style={{ marginTop: 24, marginBottom: 16 }} />
          <Text style={{ fontSize: 13, color: "#9CA3AF", textAlign: "center" }}>
            The leaver has been notified. This will complete automatically once they confirm.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── Navigating step ──────────────────────────────────────────────────
  return (
    <View style={styles.root}>
      {/* Header */}
      <SafeAreaView style={styles.headerSafe}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={onBack}>
            <Text style={styles.backIcon}>←</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Active Reservation</Text>
          <Text style={styles.headerBrand}>Urban Flow</Text>
        </View>
      </SafeAreaView>

      {/* Map */}
      <View style={styles.mapContainer}>
        <MapView
          style={styles.map}
          initialRegion={{
            latitude: spotLat,
            longitude: spotLng,
            latitudeDelta: 0.012,
            longitudeDelta: 0.012,
          }}
        >
          <Marker coordinate={{ latitude: spotLat, longitude: spotLng }}>
            <View style={styles.destMarker}>
              <Text style={styles.destMarkerText}>P</Text>
            </View>
          </Marker>
        </MapView>

        {/* Stats bar overlaid on map bottom */}
        <View style={styles.statsBar}>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>ETA</Text>
            <Text style={styles.statValue}>{etaDisplay}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>DISTANCE</Text>
            {distDisplay
              ? <Text style={styles.statValue}>{distDisplay}</Text>
              : <View style={styles.statusPill}><View style={styles.statusDot} /><Text style={styles.statusText}>Reserved</Text></View>
            }
          </View>
        </View>
      </View>

      {/* Bottom sheet */}
      <ScrollView
        style={styles.sheet}
        contentContainerStyle={styles.sheetContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Address */}
        <Text style={styles.addressStreet}>{shortAddress}</Text>
        {cityLine ? <Text style={styles.addressCity}>{cityLine}</Text> : null}

        {/* Leaver sub-card */}
        <View style={styles.leaverSubCard}>
          <View style={styles.leaverAvatarCircle}>
            <Text style={styles.leaverAvatarText}>{leaverInitial}</Text>
          </View>
          <View style={styles.leaverSubInfo}>
            <View style={styles.leaverBadge}>
              <Text style={styles.leaverBadgeText}>LEAVER</Text>
            </View>
            <Text style={styles.leaverSubName}>{leaverName ?? "Your leaver"}</Text>
            {leaverCarLine && (
              <View style={styles.carRow}>
                <Text style={styles.carIcon}>🚘</Text>
                <Text style={styles.carText}>{leaverCarLine}</Text>
              </View>
            )}
          </View>
          <Text style={styles.leaverRating}>★ {(leaverRating ?? 0).toFixed(1)}</Text>
        </View>

        {/* Disclaimer */}
        <Text style={styles.disclaimer}>
          Your spot is being held. Navigate and confirm arrival when you're there.
        </Text>

        {/* Navigate button */}
        <TouchableOpacity style={styles.navigateBtn} onPress={openNavigation}>
          <Text style={styles.navigateBtnText}>Navigate (Google Maps)  →</Text>
        </TouchableOpacity>

        {/* Chat button */}
        <TouchableOpacity style={styles.chatBtn} onPress={() => setChatOpen(true)}>
          <Text style={styles.chatBtnText}>Chat with {leaverName?.split(" ")[0] ?? "Leaver"}  💬</Text>
        </TouchableOpacity>

        {/* Arrived button */}
        <TouchableOpacity
          style={styles.arrivedBtn}
          onPress={handleConfirmArrival}
          disabled={isLoading}
        >
          {isLoading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.arrivedBtnText}>✓  I've Arrived</Text>
          }
        </TouchableOpacity>

        {/* Cancel */}
        <TouchableOpacity onPress={handleCancel} style={styles.cancelWrap}>
          <Text style={styles.cancelText}>Cancel reservation</Text>
        </TouchableOpacity>
      </ScrollView>

      <ChatModal
        visible={chatOpen}
        reservationId={reservationId}
        otherName={leaverName ?? "Leaver"}
        onClose={() => setChatOpen(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#fff" },

  // Header
  headerSafe: { backgroundColor: "#fff" },
  header: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: "#F3F4F6",
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center",
    marginRight: 12,
  },
  backIcon: { fontSize: 18, color: "#374151", fontWeight: "700", marginTop: -1 },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: "800", color: "#111827" },
  headerBrand: { fontSize: 14, fontWeight: "900", color: "#1E3DB8" },

  // Map
  mapContainer: { height: 240, position: "relative" },
  map: { width: "100%", height: "100%" },
  destMarker: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: "#22C55E", alignItems: "center", justifyContent: "center",
    shadowColor: "#000", shadowOpacity: 0.3, shadowRadius: 4, elevation: 4,
  },
  destMarkerText: { fontSize: 18, fontWeight: "900", color: "#fff" },

  // Stats bar overlaid on map bottom
  statsBar: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    flexDirection: "row",
    backgroundColor: "rgba(17,24,39,0.82)",
    paddingVertical: 12, paddingHorizontal: 24,
  },
  statItem: { flex: 1, alignItems: "center" },
  statLabel: { fontSize: 9, fontWeight: "700", color: "rgba(255,255,255,0.55)", letterSpacing: 1, marginBottom: 3 },
  statValue: { fontSize: 20, fontWeight: "900", color: "#fff" },
  statusPill: { flexDirection: "row", alignItems: "center", gap: 5 },
  statusDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#4ADE80" },
  statusText: { fontSize: 15, fontWeight: "700", color: "#fff" },
  statDivider: { width: 1, backgroundColor: "rgba(255,255,255,0.2)", marginVertical: 4 },

  // Bottom sheet
  sheet: { flex: 1, backgroundColor: "#fff" },
  sheetContent: { padding: 20, paddingBottom: 36 },

  addressStreet: {
    fontSize: 22, fontWeight: "900", color: "#111827", marginBottom: 2,
  },
  addressCity: { fontSize: 14, color: "#6B7280", marginBottom: 16 },

  // Leaver sub-card (grey bg inside white sheet)
  leaverSubCard: {
    backgroundColor: "#F9FAFB", borderRadius: 14, padding: 14,
    flexDirection: "row", alignItems: "center", marginBottom: 14,
  },
  leaverAvatarCircle: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: "#1E3DB8", alignItems: "center", justifyContent: "center", marginRight: 12,
  },
  leaverAvatarText: { color: "#fff", fontSize: 18, fontWeight: "800" },
  leaverSubInfo: { flex: 1 },
  leaverBadge: {
    backgroundColor: "#DBEAFE", borderRadius: 4,
    paddingHorizontal: 6, paddingVertical: 2, alignSelf: "flex-start", marginBottom: 3,
  },
  leaverBadgeText: { fontSize: 9, fontWeight: "800", color: "#1E3DB8", letterSpacing: 0.6 },
  leaverSubName: { fontSize: 15, fontWeight: "700", color: "#111827" },
  leaverRating: { fontSize: 14, fontWeight: "700", color: "#F59E0B" },
  carRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 3 },
  carIcon: { fontSize: 12 },
  carText: { fontSize: 12, color: "#6B7280", fontWeight: "600" },

  disclaimer: {
    fontSize: 13, color: "#9CA3AF", fontStyle: "italic",
    lineHeight: 18, marginBottom: 20,
  },

  // Buttons
  navigateBtn: {
    backgroundColor: "#1E3DB8", borderRadius: 14, height: 54,
    alignItems: "center", justifyContent: "center", marginBottom: 10,
  },
  navigateBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  chatBtn: {
    backgroundColor: "#F3F4F6", borderRadius: 14, height: 54,
    alignItems: "center", justifyContent: "center", marginBottom: 10,
  },
  chatBtnText: { color: "#374151", fontSize: 15, fontWeight: "700" },
  arrivedBtn: {
    backgroundColor: "#22C55E", borderRadius: 14, height: 54,
    alignItems: "center", justifyContent: "center", marginBottom: 10,
  },
  arrivedBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  cancelWrap: { alignItems: "center", paddingTop: 4 },
  cancelText: { color: "#9CA3AF", fontSize: 13, textDecorationLine: "underline" },

  // Rating
  ratingSafe: { flex: 1, backgroundColor: "#EEF1F8" },
  ratingContainer: {
    flex: 1, alignItems: "center", justifyContent: "center", padding: 32,
  },
  ratingIconCircle: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: "#1E3DB8",
    alignItems: "center", justifyContent: "center", marginBottom: 20,
  },
  ratingIconText: { fontSize: 36, color: "#fff" },
  ratingTitle: { fontSize: 26, fontWeight: "900", color: "#111827", marginBottom: 6 },
  ratingSubtitle: { fontSize: 15, color: "#6B7280", marginBottom: 28 },
  starsRow: { flexDirection: "row", gap: 10, marginBottom: 32 },
  star: { fontSize: 44, color: "#D1D5DB" },
  starFilled: { color: "#FBBF24" },
  submitBtn: {
    width: "100%", backgroundColor: "#1E3DB8", borderRadius: 14,
    height: 54, alignItems: "center", justifyContent: "center", marginBottom: 14,
  },
  submitBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  skipText: { color: "#9CA3AF", fontSize: 14 },
});
