import React, { useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, Modal,
  ScrollView, Alert, SafeAreaView,
} from "react-native";
import MapView, { Marker } from "react-native-maps";
import { spotsApi } from "../api/spots";
import { ChatModal } from "../components/ChatModal";

interface Props {
  visible: boolean;
  spotId?: string;
  reservationId?: string;
  spotAddress?: string;
  spotLat?: number;
  spotLng?: number;
  driverName?: string;
  driverCarMake?: string;
  driverCarModel?: string;
  distanceKm?: number;
  onDismiss: () => void;
}

export function LeaverActiveSpotScreen({
  visible, spotId, reservationId, spotAddress, spotLat, spotLng,
  driverName, driverCarMake, driverCarModel, distanceKm, onDismiss,
}: Props) {
  const [cancelling, setCancelling] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);

  const handleCancelListing = () => {
    Alert.alert(
      "Cancel Listing",
      "Are you sure? The driver will be notified and you'll lose this booking.",
      [
        { text: "Keep it" },
        {
          text: "Cancel listing", style: "destructive",
          onPress: async () => {
            if (!spotId) return;
            setCancelling(true);
            try {
              await spotsApi.cancel(spotId);
              onDismiss();
            } catch (e: any) {
              Alert.alert("Error", e.response?.data?.detail || "Failed to cancel");
            } finally {
              setCancelling(false);
            }
          },
        },
      ]
    );
  };

  const driverInitial = (driverName ?? "D").charAt(0).toUpperCase();
  const estMins = distanceKm != null ? Math.ceil(distanceKm * 3) : 8;
  const distDisplay = distanceKm != null ? `${distanceKm.toFixed(1)} km away` : "Nearby";
  const hasCoords = spotLat != null && spotLng != null;
  const carDisplay = driverCarMake && driverCarModel
    ? `${driverCarMake} ${driverCarModel}`
    : null;

  return (
    <>
      <Modal visible={visible} animationType="slide" statusBarTranslucent>
        <SafeAreaView style={styles.safe}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity style={styles.headerBtn}>
              <Text style={styles.headerBtnText}>☰</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>ParkPass</Text>
            <TouchableOpacity style={styles.bellBtn}>
              <Text style={styles.bellIcon}>🔔</Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
            <Text style={styles.title}>Your Spot: Reserved</Text>
            <Text style={styles.subtitle}>A driver is navigating to your location</Text>

            {/* Spot status card */}
            <View style={styles.statusCard}>
              <View style={styles.pCircle}>
                <Text style={styles.pCircleText}>P</Text>
              </View>
              <View style={styles.statusInfo}>
                <Text style={styles.statusTitle}>Spot Reserved</Text>
                <View style={styles.activeBadge}>
                  <View style={styles.activeDot} />
                  <Text style={styles.activeBadgeText}>ACTIVE SESSION</Text>
                </View>
              </View>
            </View>

            {/* Arrival card */}
            <View style={styles.arrivalCard}>
              <View style={styles.arrivalItem}>
                <Text style={styles.arrivalLabel}>ESTIMATED ARRIVAL</Text>
                <Text style={styles.arrivalValue}>{estMins} mins</Text>
              </View>
              <View style={styles.arrivalDivider} />
              <View style={styles.arrivalItem}>
                <Text style={styles.arrivalLabel}>DISTANCE</Text>
                <Text style={styles.arrivalValue}>{distDisplay}</Text>
              </View>
            </View>

            {/* Driver card */}
            <View style={styles.driverCard}>
              <View style={styles.driverAvatarCircle}>
                <Text style={styles.driverAvatarText}>{driverInitial}</Text>
              </View>
              <View style={styles.driverInfo}>
                <View style={styles.driverBadge}>
                  <Text style={styles.driverBadgeText}>DRIVER ASSIGNED</Text>
                </View>
                <Text style={styles.driverName}>{driverName ?? "A driver"}</Text>
                {carDisplay ? (
                  <View style={styles.carRow}>
                    <Text style={styles.carIcon}>🚗</Text>
                    <Text style={styles.carText}>{carDisplay}</Text>
                  </View>
                ) : (
                  <Text style={styles.driverSub}>Verified Driver</Text>
                )}
              </View>
              {reservationId && (
                <TouchableOpacity style={styles.chatBtnSmall} onPress={() => setChatOpen(true)}>
                  <Text style={styles.chatBtnSmallText}>💬 Chat</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Mini map */}
            {hasCoords ? (
              <View style={styles.miniMapWrap}>
                <MapView
                  style={styles.miniMap}
                  initialRegion={{
                    latitude: spotLat!,
                    longitude: spotLng!,
                    latitudeDelta: 0.012,
                    longitudeDelta: 0.012,
                  }}
                  scrollEnabled={false}
                  zoomEnabled={false}
                  pitchEnabled={false}
                  rotateEnabled={false}
                >
                  <Marker coordinate={{ latitude: spotLat!, longitude: spotLng! }} />
                </MapView>
                <View style={styles.trackingChip}>
                  <View style={styles.trackingDot} />
                  <Text style={styles.trackingChipText}>Live Tracking Active</Text>
                </View>
              </View>
            ) : (
              <View style={[styles.miniMapWrap, styles.miniMapPlaceholder]}>
                <Text style={styles.miniMapPlaceholderText}>📍 {spotAddress ?? "Your spot"}</Text>
              </View>
            )}

            {/* Vacate banner */}
            <View style={styles.vacateBanner}>
              <Text style={styles.vacateIcon}>✓</Text>
              <Text style={styles.vacateText}>
                Please vacate the spot as the driver arrives. The driver will confirm once parked.
              </Text>
            </View>

            {/* Chat button (full width) */}
            {reservationId && (
              <TouchableOpacity style={styles.chatBtnFull} onPress={() => setChatOpen(true)}>
                <Text style={styles.chatBtnFullText}>💬  Chat with {driverName ?? "Driver"}</Text>
              </TouchableOpacity>
            )}

            {/* Cancel button */}
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={handleCancelListing}
              disabled={cancelling}
            >
              <Text style={styles.cancelBtnText}>
                {cancelling ? "Cancelling..." : "Cancel Listing"}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {reservationId && (
        <ChatModal
          visible={chatOpen}
          reservationId={reservationId}
          otherName={driverName ?? "Driver"}
          onClose={() => setChatOpen(false)}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#EEF1F8" },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 12,
  },
  headerBtn: { padding: 4 },
  headerBtnText: { fontSize: 22, color: "#374151" },
  headerTitle: { fontSize: 20, fontWeight: "800", color: "#1E3DB8" },
  bellBtn: { padding: 4 },
  bellIcon: { fontSize: 22 },
  scroll: { paddingHorizontal: 16, paddingBottom: 32 },
  title: { fontSize: 26, fontWeight: "900", color: "#111827", marginBottom: 6 },
  subtitle: { fontSize: 14, color: "#6B7280", marginBottom: 20, lineHeight: 20 },

  statusCard: {
    backgroundColor: "#fff", borderRadius: 16, padding: 16,
    flexDirection: "row", alignItems: "center", marginBottom: 12,
    shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 6, elevation: 3,
  },
  pCircle: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: "#22C55E", alignItems: "center", justifyContent: "center", marginRight: 14,
  },
  pCircleText: { fontSize: 24, fontWeight: "900", color: "#fff" },
  statusInfo: { flex: 1 },
  statusTitle: { fontSize: 17, fontWeight: "800", color: "#111827", marginBottom: 5 },
  activeBadge: { flexDirection: "row", alignItems: "center", gap: 5 },
  activeDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#22C55E" },
  activeBadgeText: { fontSize: 10, fontWeight: "700", color: "#22C55E", letterSpacing: 0.8 },

  arrivalCard: {
    backgroundColor: "#1E3DB8", borderRadius: 16, padding: 16,
    flexDirection: "row", alignItems: "center", marginBottom: 12,
  },
  arrivalItem: { flex: 1, alignItems: "center" },
  arrivalLabel: { fontSize: 10, fontWeight: "700", color: "#93C5FD", letterSpacing: 0.8, marginBottom: 4 },
  arrivalValue: { fontSize: 20, fontWeight: "900", color: "#fff" },
  arrivalDivider: { width: 1, height: 36, backgroundColor: "rgba(255,255,255,0.2)" },

  driverCard: {
    backgroundColor: "#fff", borderRadius: 16, padding: 16,
    flexDirection: "row", alignItems: "center", marginBottom: 12,
    shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 6, elevation: 3,
  },
  driverAvatarCircle: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: "#374151", alignItems: "center", justifyContent: "center", marginRight: 14,
  },
  driverAvatarText: { color: "#fff", fontSize: 20, fontWeight: "800" },
  driverInfo: { flex: 1 },
  driverBadge: {
    backgroundColor: "#DBEAFE", borderRadius: 4,
    paddingHorizontal: 6, paddingVertical: 2, alignSelf: "flex-start", marginBottom: 4,
  },
  driverBadgeText: { fontSize: 9, fontWeight: "800", color: "#1E3DB8", letterSpacing: 0.6 },
  driverName: { fontSize: 16, fontWeight: "700", color: "#111827", marginBottom: 3 },
  driverSub: { fontSize: 12, color: "#6B7280" },
  carRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  carIcon: { fontSize: 13 },
  carText: { fontSize: 13, color: "#374151", fontWeight: "600" },
  chatBtnSmall: {
    backgroundColor: "#EFF6FF", borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 7,
    borderWidth: 1, borderColor: "#BAE6FD",
  },
  chatBtnSmallText: { fontSize: 13, fontWeight: "700", color: "#0369A1" },

  miniMapWrap: {
    borderRadius: 16, overflow: "hidden", height: 150, marginBottom: 12,
    shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 6, elevation: 3,
  },
  miniMap: { width: "100%", height: "100%" },
  miniMapPlaceholder: {
    backgroundColor: "#D1D5DB", alignItems: "center", justifyContent: "center",
  },
  miniMapPlaceholderText: { fontSize: 14, color: "#6B7280" },
  trackingChip: {
    position: "absolute", bottom: 10, left: 10,
    backgroundColor: "#fff", borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 5,
    flexDirection: "row", alignItems: "center", gap: 5,
  },
  trackingDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#22C55E" },
  trackingChipText: { fontSize: 11, fontWeight: "700", color: "#111827" },

  vacateBanner: {
    backgroundColor: "#DCFCE7", borderRadius: 12, padding: 14,
    flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 14,
  },
  vacateIcon: { fontSize: 16, color: "#16A34A", fontWeight: "800", marginTop: 1 },
  vacateText: { flex: 1, fontSize: 13, color: "#15803D", lineHeight: 18 },

  chatBtnFull: {
    backgroundColor: "#F0F9FF", borderRadius: 14, height: 52,
    alignItems: "center", justifyContent: "center", marginBottom: 12,
    borderWidth: 1.5, borderColor: "#BAE6FD",
  },
  chatBtnFullText: { color: "#0369A1", fontSize: 15, fontWeight: "700" },

  cancelBtn: { alignItems: "center", paddingVertical: 8 },
  cancelBtnText: { fontSize: 14, color: "#EF4444", textDecorationLine: "underline", fontWeight: "600" },
});
