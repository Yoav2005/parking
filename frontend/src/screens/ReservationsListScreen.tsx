import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator,
  RefreshControl, SafeAreaView, Alert, ScrollView,
} from "react-native";
import MapView, { Marker } from "react-native-maps";
import { reservationsApi } from "../api/reservations";
import { spotsApi } from "../api/spots";
import { useAuthStore } from "../store/authStore";
import { ChatModal } from "../components/ChatModal";
import ReservationScreen from "./ReservationScreen";
import { useAddress } from "../hooks/useAddress";

// ── OSRM ETA for leaver (driver coords → spot) ────────────────────────
function useLeaverEta(
  driverLat: number | null,
  driverLng: number | null,
  spotLat: number,
  spotLng: number,
) {
  const [eta, setEta] = useState<{ minutes: number | null; distanceKm: number | null; loading: boolean }>(
    { minutes: null, distanceKm: null, loading: false }
  );
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetch_ = useCallback(async () => {
    if (driverLat == null || driverLng == null) return;
    setEta((p) => ({ ...p, loading: true }));
    try {
      const url =
        `https://router.project-osrm.org/route/v1/driving/` +
        `${driverLng},${driverLat};${spotLng},${spotLat}?overview=false`;
      const res = await fetch(url);
      const json = await res.json();
      if (json.code === "Ok" && json.routes?.length) {
        const route = json.routes[0];
        setEta({
          minutes: Math.ceil(route.duration / 60),
          distanceKm: Math.round(route.distance / 100) / 10,
          loading: false,
        });
      } else {
        setEta((p) => ({ ...p, loading: false }));
      }
    } catch {
      setEta((p) => ({ ...p, loading: false }));
    }
  }, [driverLat, driverLng, spotLat, spotLng]);

  useEffect(() => {
    fetch_();
    intervalRef.current = setInterval(fetch_, 15_000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [fetch_]);

  return eta;
}

interface Props {
  onGoToMap: () => void;
  refreshKey?: number;
}

export default function ReservationsListScreen({ onGoToMap, refreshKey }: Props) {
  // Driver side
  const [active, setActive] = useState<any>(null);
  // Snapshot kept alive during rating step so unmount doesn't kill it
  const [arrivedSnapshot, setArrivedSnapshot] = useState<any>(null);
  // Leaver side
  const [myListing, setMyListing] = useState<any>(null);
  // Active leaver reservation (has driver_current_lat/lng from API)
  const [activeLeaverRes, setActiveLeaverRes] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const { user } = useAuthStore();

  // Must be called unconditionally before any early returns (Rules of Hooks)
  const listingAddress = useAddress(myListing?.address);

  const fetchAll = useCallback(async () => {
    try {
      const [resData, listingData] = await Promise.all([
        reservationsApi.getAll(),
        spotsApi.getMyListing(),
      ]);
      const all: any[] = resData.data.data ?? [];
      setActive(all.find((r) => r.status === "ACTIVE" && r.role === "driver") ?? null);
      setActiveLeaverRes(all.find((r) => r.status === "ACTIVE" && r.role === "leaver") ?? null);
      setMyListing(listingData.data.data ?? null);
    } catch {}
  }, []);

  useEffect(() => {
    fetchAll().finally(() => setLoading(false));
  }, []);

  // Refresh when parent signals a cancellation event
  useEffect(() => {
    if (refreshKey) {
      setMyListing(null);
      fetchAll();
    }
  }, [refreshKey]);


  const onRefresh = async () => {
    setRefreshing(true);
    await fetchAll();
    setRefreshing(false);
  };

  const handleCancelListing = () => {
    if (!myListing) return;
    Alert.alert("Cancel Listing", "Cancel your spot listing?", [
      { text: "No" },
      {
        text: "Yes, Cancel", style: "destructive",
        onPress: async () => {
          try {
            await spotsApi.cancel(myListing.id);
            setMyListing(null);
          } catch (e: any) {
            Alert.alert("Error", e.response?.data?.detail || "Failed to cancel listing");
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#1E3DB8" />
        </View>
      </SafeAreaView>
    );
  }

  // Driver check is ABSOLUTE — if this user has an active reservation they placed,
  // they are acting as a driver right now and must never see the leaver screen.
  const driverData = active ?? arrivedSnapshot;
  if (driverData) {
    return (
      <ReservationScreen
        reservationId={driverData.id}
        clientSecret={null}
        spotAddress={driverData.spot_address || "Parking spot"}
        spotLat={driverData.spot_lat ?? 0}
        spotLng={driverData.spot_lng ?? 0}
        leaverId={driverData.leaver_id || ""}
        leaverName={driverData.leaver_name}
        leaverRating={driverData.leaver_rating}
        leaverCarMake={driverData.leaver_car_make}
        leaverCarModel={driverData.leaver_car_model}
        tokenCost={driverData.spot_price}
        onArrivalConfirmed={() => setArrivedSnapshot(active)}
        onCompleted={() => { setArrivedSnapshot(null); fetchAll(); }}
        onBack={() => { setArrivedSnapshot(null); fetchAll(); }}
      />
    );
  }

  // Only show leaver view if:
  // 1. Their listing is RESERVED (a driver booked it), AND
  // 2. The user themselves is not the driver (active is null — guaranteed above)
  const isLeaver = myListing?.status === "RESERVED" && myListing?.leaver_id === user?.id;
  const isListingAvailable = myListing?.status === "AVAILABLE" && myListing?.leaver_id === user?.id;

  // Real ETA from driver's last known position → leaver's spot
  const leaverEta = useLeaverEta(
    activeLeaverRes?.driver_current_lat ?? null,
    activeLeaverRes?.driver_current_lng ?? null,
    myListing?.latitude ?? 0,
    myListing?.longitude ?? 0,
  );

  const driverInitial = (myListing?.driver_name ?? "D").charAt(0).toUpperCase();
  const carLine = myListing?.driver_car_make
    ? `${myListing.driver_car_make}${myListing.driver_car_model ? " " + myListing.driver_car_model : ""}`
    : null;

  if (isLeaver) {
    return (
      <SafeAreaView style={styles.safe}>
        {/* Header */}
        <View style={styles.leaverHeader}>
          <Text style={styles.leaverHeaderBrand}>Urban Flow</Text>
          <TouchableOpacity style={styles.bellBtn}>
            <Text style={styles.bellIcon}>🔔</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={styles.leaverScroll}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#1E3DB8" />}
          showsVerticalScrollIndicator={false}
        >
          {/* Page heading */}
          <Text style={styles.leaverPageTitle}>Your Spot: Reserved</Text>
          <Text style={styles.leaverPageSubtitle}>A driver is navigating to your location.</Text>

          {/* Status card */}
          <View style={styles.statusCard}>
            <View style={styles.statusPCircle}>
              <Text style={styles.statusPText}>P</Text>
            </View>
            <Text style={styles.statusSpotReserved}>Spot Reserved</Text>
            <View style={styles.activeSessionBadge}>
              <View style={styles.activeSessionDot} />
              <Text style={styles.activeSessionText}>ACTIVE SESSION</Text>
            </View>
          </View>

          {/* Arrival card */}
          <View style={styles.arrivalCard}>
            <View style={styles.arrivalTop}>
              <Text style={styles.arrivalLabel}>ESTIMATED ARRIVAL</Text>
              <Text style={styles.arrivalMins}>
                {activeLeaverRes?.driver_current_lat == null
                  ? "Waiting…"
                  : leaverEta.loading
                  ? "..."
                  : leaverEta.minutes != null
                  ? `${leaverEta.minutes} min`
                  : "—"}
              </Text>
            </View>
            <View style={styles.arrivalDivider} />
            <View style={styles.arrivalBottom}>
              <Text style={styles.arrivalDistIcon}>↕</Text>
              <Text style={styles.arrivalDist}>
                {leaverEta.distanceKm != null ? `${leaverEta.distanceKm} km away` : "Locating driver…"}
              </Text>
            </View>
          </View>

          {/* Driver card */}
          <View style={styles.driverCard}>
            <View style={styles.driverCardTop}>
              <View style={styles.driverAvatarCircle}>
                <Text style={styles.driverAvatarText}>{driverInitial}</Text>
              </View>
              <View style={styles.driverInfo}>
                <Text style={styles.driverAssignedLabel}>DRIVER ASSIGNED</Text>
                <Text style={styles.driverName}>{myListing.driver_name ?? "Your Driver"}</Text>
                {carLine && (
                  <View style={styles.carRow}>
                    <Text style={styles.carIcon}>🚘</Text>
                    <Text style={styles.carText}>{carLine}</Text>
                  </View>
                )}
              </View>
            </View>
            {/* Chat button inside driver card */}
            {myListing.active_reservation_id && (
              <TouchableOpacity style={styles.chatInsideCard} onPress={() => setChatOpen(true)}>
                <Text style={styles.chatInsideCardText}>
                  Chat with {myListing.driver_name?.split(" ")[0] ?? "Driver"}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Map */}
          <View style={styles.mapWrap}>
            <MapView
              style={styles.map}
              initialRegion={{
                latitude: myListing.latitude,
                longitude: myListing.longitude,
                latitudeDelta: 0.012,
                longitudeDelta: 0.012,
              }}
              scrollEnabled={false}
              zoomEnabled={false}
            >
              <Marker coordinate={{ latitude: myListing.latitude, longitude: myListing.longitude }}>
                <View style={styles.mapPMarker}>
                  <Text style={styles.mapPMarkerText}>P</Text>
                </View>
              </Marker>
            </MapView>
            <View style={styles.liveChip}>
              <Text style={styles.liveChipArrow}>➤</Text>
              <Text style={styles.liveChipText}>Live Tracking Active</Text>
            </View>
          </View>

          {/* Info banner */}
          <View style={styles.infoBanner}>
            <View style={styles.infoBannerAccent} />
            <Text style={styles.infoBannerIcon}>ℹ</Text>
            <Text style={styles.infoBannerText}>
              Please stay near your spot and be ready to vacate when the driver arrives.
            </Text>
          </View>

          {/* Cancel link */}
          <TouchableOpacity style={styles.cancelListingWrap} onPress={handleCancelListing}>
            <Text style={styles.cancelListingText}>⊗  Cancel Listing</Text>
          </TouchableOpacity>
        </ScrollView>

        {myListing?.active_reservation_id && (
          <ChatModal
            visible={chatOpen}
            reservationId={myListing.active_reservation_id}
            otherName={myListing.driver_name?.split(" ")[0] ?? "Driver"}
            onClose={() => setChatOpen(false)}
          />
        )}
      </SafeAreaView>
    );
  }

  // ── DEFAULT VIEW (listing available / empty) ─────────────────────────
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>ParkPass</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#1E3DB8" />}
      >
        <Text style={styles.pageTitle}>Reservation</Text>

        {/* ── LEAVER VIEW: listing is still available ── */}
        {isListingAvailable && (
          <View style={styles.listingCard}>
            <View style={styles.listingCardTop}>
              <View style={styles.activePulse} />
              <Text style={styles.listingLabel}>YOUR ACTIVE LISTING</Text>
            </View>
            <Text style={styles.listingAddress}>{listingAddress}</Text>
            <Text style={styles.listingPrice}>🪙 {Math.ceil(myListing.price)} tokens · Waiting for a driver</Text>
            <TouchableOpacity onPress={handleCancelListing}>
              <Text style={styles.cancelLeaverLink}>Cancel Listing</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Empty state ── */}
        {!active && !isLeaver && !isListingAvailable && (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>🅿️</Text>
            <Text style={styles.emptyTitle}>No active reservation</Text>
            <Text style={styles.emptySub}>
              Find an available spot near you and reserve it in seconds.
            </Text>
            <TouchableOpacity style={styles.findSpotBtn} onPress={onGoToMap}>
              <Text style={styles.findSpotBtnText}>Reserve a Spot</Text>
            </TouchableOpacity>
          </View>
        )}

        <Text style={styles.historyHint}>View your reservation history in the Profile tab.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#EEF1F8" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },

  // ── Default view (driver / available listing / empty) ──
  header: { alignItems: "center", paddingVertical: 12 },
  headerTitle: { fontSize: 20, fontWeight: "800", color: "#1E3DB8" },
  scroll: { paddingHorizontal: 16, paddingBottom: 32 },
  pageTitle: { fontSize: 24, fontWeight: "900", color: "#111827", marginBottom: 16 },

  // Listing still available
  listingCard: {
    backgroundColor: "#F0FDF4", borderRadius: 20, padding: 20, marginBottom: 16,
    borderWidth: 1.5, borderColor: "#BBF7D0",
  },
  listingCardTop: { flexDirection: "row", alignItems: "center", marginBottom: 10 },
  activePulse: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#22C55E", marginRight: 8 },
  listingLabel: { fontSize: 11, fontWeight: "700", color: "#16A34A", letterSpacing: 1 },
  listingAddress: { fontSize: 17, fontWeight: "800", color: "#111827", marginBottom: 4 },
  listingPrice: { fontSize: 13, color: "#6B7280", marginBottom: 14 },
  cancelLeaverLink: { color: "#EF4444", fontSize: 13, textDecorationLine: "underline", textAlign: "center", fontWeight: "600" },

  // Empty state
  emptyCard: {
    backgroundColor: "#fff", borderRadius: 20, padding: 28,
    alignItems: "center", marginBottom: 16,
    shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 8, elevation: 3,
  },
  emptyIcon: { fontSize: 44, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: "800", color: "#111827", marginBottom: 6 },
  emptySub: { fontSize: 13, color: "#9CA3AF", textAlign: "center", lineHeight: 20, marginBottom: 20 },
  findSpotBtn: {
    backgroundColor: "#1E3DB8", borderRadius: 12, paddingHorizontal: 28, paddingVertical: 14,
  },
  findSpotBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  historyHint: { fontSize: 12, color: "#9CA3AF", textAlign: "center", marginTop: 4 },

  // ── LEAVER "Your Spot: Reserved" full view ──────────────────────────
  leaverHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingVertical: 14,
    backgroundColor: "#EEF1F8",
  },
  leaverHeaderBrand: { fontSize: 18, fontWeight: "900", color: "#1E3DB8" },
  bellBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  bellIcon: { fontSize: 20 },

  leaverScroll: { paddingHorizontal: 16, paddingBottom: 40 },

  leaverPageTitle: {
    fontSize: 26, fontWeight: "900", color: "#111827",
    marginBottom: 4, marginTop: 4,
  },
  leaverPageSubtitle: {
    fontSize: 14, color: "#6B7280", marginBottom: 20, lineHeight: 20,
  },

  // Status card (white, centered)
  statusCard: {
    backgroundColor: "#fff", borderRadius: 20, padding: 24,
    alignItems: "center", marginBottom: 12,
    shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 12, elevation: 3,
  },
  statusPCircle: {
    width: 64, height: 64, borderRadius: 32, backgroundColor: "#22C55E",
    alignItems: "center", justifyContent: "center", marginBottom: 12,
  },
  statusPText: { fontSize: 28, fontWeight: "900", color: "#fff" },
  statusSpotReserved: { fontSize: 18, fontWeight: "800", color: "#111827", marginBottom: 8 },
  activeSessionBadge: {
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: "#DCFCE7", borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4,
  },
  activeSessionDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#22C55E" },
  activeSessionText: { fontSize: 10, fontWeight: "800", color: "#16A34A", letterSpacing: 1 },

  // Arrival card (dark blue)
  arrivalCard: {
    backgroundColor: "#1E3DB8", borderRadius: 20, padding: 20, marginBottom: 12,
  },
  arrivalTop: { alignItems: "center", marginBottom: 12 },
  arrivalLabel: { fontSize: 10, fontWeight: "700", color: "rgba(255,255,255,0.6)", letterSpacing: 1.2, marginBottom: 6 },
  arrivalMins: { fontSize: 32, fontWeight: "900", color: "#fff" },
  arrivalDivider: { height: 1, backgroundColor: "rgba(255,255,255,0.2)", marginBottom: 12 },
  arrivalBottom: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  arrivalDistIcon: { fontSize: 18, color: "#93C5FD" },
  arrivalDist: { fontSize: 15, fontWeight: "700", color: "#fff" },

  // Driver card
  driverCard: {
    backgroundColor: "#fff", borderRadius: 20, padding: 16, marginBottom: 12,
    shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 12, elevation: 3,
  },
  driverCardTop: { flexDirection: "row", alignItems: "center", marginBottom: 14 },
  driverAvatarCircle: {
    width: 52, height: 52, borderRadius: 26, backgroundColor: "#1E3DB8",
    alignItems: "center", justifyContent: "center", marginRight: 14,
  },
  driverAvatarText: { color: "#fff", fontSize: 22, fontWeight: "800" },
  driverInfo: { flex: 1 },
  driverAssignedLabel: {
    fontSize: 9, fontWeight: "800", color: "#9CA3AF",
    letterSpacing: 1.2, marginBottom: 3,
  },
  driverName: { fontSize: 16, fontWeight: "800", color: "#111827", marginBottom: 4 },
  carRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  carIcon: { fontSize: 13 },
  carText: { fontSize: 13, color: "#6B7280", fontWeight: "600" },
  chatInsideCard: {
    backgroundColor: "#1E3DB8", borderRadius: 12, height: 46,
    alignItems: "center", justifyContent: "center",
  },
  chatInsideCardText: { color: "#fff", fontSize: 15, fontWeight: "700" },

  // Map
  mapWrap: {
    borderRadius: 20, overflow: "hidden", height: 180, marginBottom: 12, position: "relative",
  },
  map: { width: "100%", height: "100%" },
  mapPMarker: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: "#22C55E",
    alignItems: "center", justifyContent: "center",
    shadowColor: "#000", shadowOpacity: 0.25, shadowRadius: 4,
  },
  mapPMarkerText: { fontSize: 16, fontWeight: "900", color: "#fff" },
  liveChip: {
    position: "absolute", bottom: 10, left: "50%",
    transform: [{ translateX: -68 }],
    backgroundColor: "rgba(0,0,0,0.65)", borderRadius: 20,
    flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 6,
    gap: 6,
  },
  liveChipArrow: { fontSize: 12, color: "#4ADE80" },
  liveChipText: { fontSize: 12, color: "#fff", fontWeight: "700" },

  // Info banner
  infoBanner: {
    backgroundColor: "#F0FDF4", borderRadius: 12, padding: 14,
    flexDirection: "row", alignItems: "flex-start", marginBottom: 20,
    borderLeftWidth: 4, borderLeftColor: "#22C55E",
  },
  infoBannerAccent: { position: "absolute" },
  infoBannerIcon: { fontSize: 16, color: "#16A34A", marginRight: 10, marginTop: 1 },
  infoBannerText: { flex: 1, fontSize: 13, color: "#15803D", lineHeight: 19 },

  // Cancel listing link
  cancelListingWrap: { alignItems: "center" },
  cancelListingText: {
    fontSize: 14, color: "#6B7280", fontWeight: "600",
  },
});
