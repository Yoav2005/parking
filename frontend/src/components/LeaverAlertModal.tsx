import React from "react";
import { Modal, View, Text, StyleSheet, TouchableOpacity } from "react-native";

interface Props {
  visible: boolean;
  driverName?: string;
  distanceKm?: number;
  onDismiss: () => void;
  onViewDetails: () => void;
}

export function LeaverAlertModal({ visible, driverName, distanceKm, onDismiss, onViewDetails }: Props) {
  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent>
      <View style={styles.overlay}>
        <View style={styles.card}>
          {/* Checkmark */}
          <View style={styles.iconCircle}>
            <Text style={styles.iconCheck}>✓</Text>
          </View>

          <Text style={styles.title}>Spot Reserved!</Text>
          <Text style={styles.subtitle}>A driver is on their way to your location.</Text>

          {/* Driver info */}
          <View style={styles.driverCard}>
            <View style={styles.driverAvatar}>
              <Text style={styles.driverAvatarText}>🚗</Text>
            </View>
            <View style={styles.driverInfo}>
              <Text style={styles.driverName}>{driverName ?? "A driver"}</Text>
              <Text style={styles.driverSub}>Verified Driver</Text>
            </View>
            <View style={styles.ratingBadge}>
              <Text style={styles.ratingBadgeText}>★ 4.8</Text>
            </View>
          </View>

          {/* Stats */}
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>ESTIMATED ARRIVAL</Text>
              <Text style={styles.statValue}>
                {distanceKm != null ? `${Math.ceil(distanceKm * 3)} minutes` : "En route"}
              </Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>DISTANCE</Text>
              <Text style={styles.statValue}>
                {distanceKm != null ? `${distanceKm.toFixed(1)} km` : "Nearby"}
              </Text>
            </View>
          </View>

          {/* Info banner */}
          <View style={styles.infoBanner}>
            <Text style={styles.infoBannerIcon}>ℹ</Text>
            <Text style={styles.infoBannerText}>
              Please stay at your spot until the driver arrives to confirm.
            </Text>
          </View>

          {/* View details */}
          <TouchableOpacity style={styles.detailsBtn} onPress={onViewDetails}>
            <Text style={styles.detailsBtnText}>View Reservation Details</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.dismissBtn} onPress={onDismiss}>
            <Text style={styles.dismissBtnText}>Got it, I'll wait</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
    paddingBottom: 32,
    paddingHorizontal: 16,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 24,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
  },
  iconCircle: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: "#1E3DB8",
    alignItems: "center", justifyContent: "center",
    marginBottom: 16,
    shadowColor: "#1E3DB8", shadowOpacity: 0.35, shadowRadius: 12, elevation: 6,
  },
  iconCheck: { color: "#fff", fontSize: 30, fontWeight: "800" },
  title: { fontSize: 24, fontWeight: "900", color: "#111827", marginBottom: 6 },
  subtitle: { fontSize: 14, color: "#6B7280", textAlign: "center", marginBottom: 20, lineHeight: 20 },
  driverCard: {
    width: "100%", backgroundColor: "#F9FAFB", borderRadius: 14,
    padding: 14, flexDirection: "row", alignItems: "center", marginBottom: 16,
  },
  driverAvatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: "#E5E7EB", alignItems: "center", justifyContent: "center", marginRight: 12,
  },
  driverAvatarText: { fontSize: 22 },
  driverInfo: { flex: 1 },
  driverName: { fontSize: 15, fontWeight: "700", color: "#111827" },
  driverSub: { fontSize: 12, color: "#6B7280", marginTop: 2 },
  ratingBadge: {
    backgroundColor: "#D1FAE5", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4,
  },
  ratingBadgeText: { fontSize: 13, fontWeight: "700", color: "#065F46" },
  statsRow: {
    width: "100%", flexDirection: "row", alignItems: "center",
    backgroundColor: "#F9FAFB", borderRadius: 14, padding: 14, marginBottom: 14,
  },
  statItem: { flex: 1, alignItems: "center" },
  statLabel: { fontSize: 10, fontWeight: "700", color: "#9CA3AF", letterSpacing: 0.8, marginBottom: 4 },
  statValue: { fontSize: 18, fontWeight: "800", color: "#1E3DB8" },
  statDivider: { width: 1, height: 36, backgroundColor: "#E5E7EB" },
  infoBanner: {
    width: "100%", backgroundColor: "#EFF6FF", borderRadius: 12,
    padding: 12, flexDirection: "row", alignItems: "flex-start",
    gap: 8, marginBottom: 14,
  },
  infoBannerIcon: { fontSize: 16, color: "#1E3DB8" },
  infoBannerText: { flex: 1, fontSize: 13, color: "#1E3DB8", lineHeight: 18 },
  detailsBtn: {
    width: "100%", backgroundColor: "#EFF6FF", borderRadius: 14,
    height: 48, alignItems: "center", justifyContent: "center", marginBottom: 10,
  },
  detailsBtnText: { color: "#1E3DB8", fontSize: 15, fontWeight: "700" },
  dismissBtn: {
    width: "100%", backgroundColor: "#1E3DB8", borderRadius: 14,
    height: 54, alignItems: "center", justifyContent: "center",
  },
  dismissBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
