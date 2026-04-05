import React from "react";
import { Modal, View, Text, StyleSheet, TouchableOpacity } from "react-native";

interface Props {
  visible: boolean;
  spotAddress?: string;
  leaverName?: string;
  leaverRating?: number;
  tokenCost?: number;
  driverBalance?: number;
  onDismiss: () => void;
  onGoToReservation: () => void;
}

export function DriverConfirmModal({
  visible, spotAddress, leaverName, leaverRating,
  tokenCost, driverBalance, onDismiss, onGoToReservation,
}: Props) {
  const leaverInitial = (leaverName ?? "L").charAt(0).toUpperCase();

  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent>
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onDismiss} />
        <View style={styles.card}>
          {/* Icon */}
          <View style={styles.iconCircle}>
            <Text style={styles.iconText}>🅿</Text>
          </View>

          <Text style={styles.title}>Spot Reserved!</Text>
          <Text style={styles.subtitle}>
            {spotAddress ? spotAddress.split(",")[0] : "Your spot is confirmed."}
          </Text>

          {/* Leaver info */}
          <View style={styles.leaverCard}>
            <View style={styles.leaverAvatar}>
              <Text style={styles.leaverAvatarText}>{leaverInitial}</Text>
            </View>
            <View style={styles.leaverInfo}>
              <Text style={styles.leaverLabel}>LEAVER</Text>
              <Text style={styles.leaverName}>{leaverName ?? "Your leaver"}</Text>
              {leaverRating != null && (
                <Text style={styles.leaverRating}>★ {leaverRating.toFixed(1)}</Text>
              )}
            </View>
          </View>

          {/* Token info */}
          {tokenCost != null && (
            <View style={styles.tokenRow}>
              <View style={styles.tokenItem}>
                <Text style={styles.tokenLabel}>TOKENS SPENT</Text>
                <Text style={styles.tokenValue}>🪙 {tokenCost}</Text>
              </View>
              <View style={styles.tokenDivider} />
              <View style={styles.tokenItem}>
                <Text style={styles.tokenLabel}>BALANCE LEFT</Text>
                <Text style={styles.tokenValue}>🪙 {driverBalance}</Text>
              </View>
            </View>
          )}

          {/* Info */}
          <View style={styles.infoBanner}>
            <Text style={styles.infoBannerIcon}>ℹ</Text>
            <Text style={styles.infoBannerText}>
              Navigate to the spot and confirm arrival when you're there.
            </Text>
          </View>

          {/* Go to reservation */}
          <TouchableOpacity style={styles.primaryBtn} onPress={onGoToReservation}>
            <Text style={styles.primaryBtnText}>Navigate to Spot</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.dismissBtn} onPress={onDismiss}>
            <Text style={styles.dismissBtnText}>I'll go later</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  card: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    alignItems: "center",
    shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 20, elevation: 10,
  },
  iconCircle: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: "#1E3DB8",
    alignItems: "center", justifyContent: "center",
    marginBottom: 16,
  },
  iconText: { fontSize: 28, color: "#fff" },
  title: { fontSize: 24, fontWeight: "900", color: "#111827", marginBottom: 4 },
  subtitle: { fontSize: 14, color: "#6B7280", textAlign: "center", marginBottom: 16, lineHeight: 20 },
  leaverCard: {
    width: "100%", backgroundColor: "#F9FAFB", borderRadius: 14,
    padding: 14, flexDirection: "row", alignItems: "center", marginBottom: 14,
  },
  leaverAvatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: "#1E3DB8", alignItems: "center", justifyContent: "center", marginRight: 12,
  },
  leaverAvatarText: { color: "#fff", fontSize: 18, fontWeight: "800" },
  leaverInfo: { flex: 1 },
  leaverLabel: { fontSize: 10, fontWeight: "700", color: "#9CA3AF", letterSpacing: 0.8, marginBottom: 2 },
  leaverName: { fontSize: 15, fontWeight: "700", color: "#111827" },
  leaverRating: { fontSize: 13, color: "#F59E0B", fontWeight: "600", marginTop: 2 },
  tokenRow: {
    width: "100%", backgroundColor: "#F9FAFB", borderRadius: 14,
    padding: 14, flexDirection: "row", alignItems: "center", marginBottom: 14,
  },
  tokenItem: { flex: 1, alignItems: "center" },
  tokenLabel: { fontSize: 10, fontWeight: "700", color: "#9CA3AF", letterSpacing: 0.8, marginBottom: 4 },
  tokenValue: { fontSize: 18, fontWeight: "800", color: "#111827" },
  tokenDivider: { width: 1, height: 32, backgroundColor: "#E5E7EB" },
  infoBanner: {
    width: "100%", backgroundColor: "#EFF6FF", borderRadius: 12,
    padding: 12, flexDirection: "row", alignItems: "flex-start",
    gap: 8, marginBottom: 16,
  },
  infoBannerIcon: { fontSize: 16, color: "#1E3DB8" },
  infoBannerText: { flex: 1, fontSize: 13, color: "#1E3DB8", lineHeight: 18 },
  primaryBtn: {
    width: "100%", backgroundColor: "#1E3DB8", borderRadius: 14,
    height: 54, alignItems: "center", justifyContent: "center", marginBottom: 10,
  },
  primaryBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  dismissBtn: {
    width: "100%", height: 46, alignItems: "center", justifyContent: "center",
    marginBottom: 8,
  },
  dismissBtnText: { color: "#9CA3AF", fontSize: 15, fontWeight: "600" },
});
