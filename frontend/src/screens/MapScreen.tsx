import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity,
  ActivityIndicator, TextInput, SafeAreaView, Alert,
} from "react-native";
import MapView, { Marker } from "react-native-maps";
import { useSpotsStore } from "../store/spotsStore";
import { useLocation } from "../hooks/useLocation";
import { SpotPin } from "../components/SpotPin";
import { spotsApi } from "../api/spots";
import { reservationsApi } from "../api/reservations";
import { useFocusEffect } from "@react-navigation/native";

interface Props {
  onSpotPress: (spotId: string) => void;
  onLeaveSpot: () => void;
  onGoToReservations: () => void;
}

export default function MapScreen({ onSpotPress, onLeaveSpot, onGoToReservations }: Props) {
  const { coords, error: locationError, loading } = useLocation();
  const { spots, fetchNearby, isLoading } = useSpotsStore();
  const mapRef = useRef<MapView>(null);

  // "none" | "has_listing" | "has_reservation"
  const [listingState, setListingState] = useState<"none" | "has_listing" | "has_reservation">("none");

  const refreshListingState = useCallback(async () => {
    try {
      const [listingRes, resRes] = await Promise.all([
        spotsApi.getMyListing(),
        reservationsApi.getAll(),
      ]);
      const listing = listingRes.data?.data;
      const reservations: any[] = resRes.data?.data ?? [];
      const hasActiveListing = listing && (listing.status === "AVAILABLE" || listing.status === "RESERVED");
      const hasActiveReservation = reservations.some((r: any) => r.status === "ACTIVE");
      if (hasActiveReservation) setListingState("has_reservation");
      else if (hasActiveListing) setListingState("has_listing");
      else setListingState("none");
    } catch {}
  }, []);

  useFocusEffect(useCallback(() => { refreshListingState(); }, [refreshListingState]));

  useEffect(() => {
    if (coords) fetchNearby(coords.latitude, coords.longitude);
  }, [coords?.latitude, coords?.longitude]);

  return (
    <View style={styles.container}>
      {/* Header */}
      <SafeAreaView style={styles.headerSafe}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.headerBtn}>
            <Text style={styles.headerBtnText}>☰</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>ParkPass</Text>
          <TouchableOpacity style={styles.helpBtn}>
            <Text style={styles.helpBtnText}>?</Text>
          </TouchableOpacity>
        </View>
        {/* Search bar */}
        <View style={styles.searchBar}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search for locations..."
            placeholderTextColor="#9CA3AF"
            editable={false}
          />
          <Text style={styles.micIcon}>🎤</Text>
        </View>
      </SafeAreaView>

      {/* Map */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#1E3DB8" />
          <Text style={styles.loadingText}>Getting your location...</Text>
        </View>
      ) : locationError ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>📍 Location access required</Text>
          <Text style={styles.errorSub}>Enable location in Settings to see nearby spots</Text>
        </View>
      ) : (
        <MapView
          ref={mapRef}
          style={styles.map}
          initialRegion={{
            latitude: coords!.latitude,
            longitude: coords!.longitude,
            latitudeDelta: 0.03,
            longitudeDelta: 0.03,
          }}
          showsUserLocation
          showsMyLocationButton={false}
        >
          {spots.map((spot) => (
            <Marker
              key={spot.id}
              coordinate={{ latitude: spot.latitude, longitude: spot.longitude }}
              onPress={() => onSpotPress(spot.id)}
              tracksViewChanges={false}
            >
              <SpotPin price={spot.price} leavingInMinutes={spot.leaving_in_minutes} />
            </Marker>
          ))}
        </MapView>
      )}

      {/* FABs */}
      <View style={styles.fabs}>
        <TouchableOpacity style={styles.fab}>
          <Text style={styles.fabIcon}>◎</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.fab}>
          <Text style={styles.fabIcon}>◈</Text>
        </TouchableOpacity>
      </View>

      {/* Bottom button */}
      <View style={styles.bottomWrap}>
        {listingState === "has_reservation" ? (
          <TouchableOpacity
            style={[styles.leaveButton, styles.leaveButtonBlocked]}
            onPress={() => Alert.alert("Active Reservation", "You can't list a spot while you have an active reservation.")}
          >
            <Text style={styles.leaveIcon}>🅿</Text>
            <Text style={styles.leaveButtonText}>Active Reservation</Text>
          </TouchableOpacity>
        ) : listingState === "has_listing" ? (
          <TouchableOpacity style={[styles.leaveButton, styles.leaveButtonListing]} onPress={onGoToReservations}>
            <Text style={styles.leaveIcon}>⬡</Text>
            <Text style={styles.leaveButtonText}>My Listing →</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.leaveButton} onPress={onLeaveSpot}>
            <Text style={styles.leaveIcon}>⬡</Text>
            <Text style={styles.leaveButtonText}>I'm leaving my spot</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#EEF1F8" },
  headerSafe: { backgroundColor: "#fff", zIndex: 10 },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 10,
  },
  headerBtn: { padding: 4 },
  headerBtnText: { fontSize: 22, color: "#374151" },
  headerTitle: { fontSize: 20, fontWeight: "800", color: "#1E3DB8" },
  helpBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: "#1E3DB8", alignItems: "center", justifyContent: "center",
  },
  helpBtnText: { color: "#fff", fontWeight: "800", fontSize: 15 },
  searchBar: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#fff", borderRadius: 30,
    marginHorizontal: 16, marginBottom: 10, paddingHorizontal: 14, height: 48,
    shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 6, elevation: 3,
  },
  searchIcon: { fontSize: 16, marginRight: 8 },
  searchInput: { flex: 1, fontSize: 15, color: "#374151" },
  micIcon: { fontSize: 16 },
  map: { flex: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  loadingText: { marginTop: 12, color: "#6B7280" },
  errorText: { fontSize: 16, fontWeight: "600", color: "#374151", marginBottom: 8 },
  errorSub: { fontSize: 13, color: "#9CA3AF", textAlign: "center" },
  fabs: { position: "absolute", right: 16, bottom: 120, gap: 10 },
  fab: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: "#fff",
    alignItems: "center", justifyContent: "center",
    shadowColor: "#000", shadowOpacity: 0.12, shadowRadius: 6, elevation: 4,
  },
  fabIcon: { fontSize: 20, color: "#374151" },
  bottomWrap: {
    backgroundColor: "transparent", paddingHorizontal: 16, paddingBottom: 16, paddingTop: 8,
  },
  leaveButton: {
    backgroundColor: "#1E3DB8", borderRadius: 14,
    height: 56, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
  },
  leaveButtonBlocked: { backgroundColor: "#6B7280" },
  leaveButtonListing: { backgroundColor: "#059669" },
  leaveIcon: { fontSize: 20, color: "#fff" },
  leaveButtonText: { color: "#fff", fontSize: 17, fontWeight: "700" },
});
