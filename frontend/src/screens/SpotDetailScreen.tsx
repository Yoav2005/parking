import React, { useEffect, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, Image, TouchableOpacity,
  ActivityIndicator, Alert, Linking, SafeAreaView,
} from "react-native";
import MapView, { Marker } from "react-native-maps";
import { spotsApi } from "../api/spots";
import { reservationsApi } from "../api/reservations";
import { useAuthStore } from "../store/authStore";

interface Props {
  spotId: string;
  onReserved: (params: {
    reservationId: string;
    clientSecret: string | null;
    tokenCost?: number;
    driverBalance?: number;
    leaverName?: string;
    leaverRating?: number;
    spotAddress: string;
    spotLat: number;
    spotLng: number;
    leaverId: string;
  }) => void;
  onBack: () => void;
}

export default function SpotDetailScreen({ spotId, onReserved, onBack }: Props) {
  const [spot, setSpot] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [reserving, setReserving] = useState(false);
  const { user } = useAuthStore();

  useEffect(() => {
    spotsApi.getById(spotId).then(({ data }) => {
      setSpot(data.data);
      setLoading(false);
    });
  }, [spotId]);

  const handleReserve = async () => {
    setReserving(true);
    try {
      const { data } = await reservationsApi.create(spot.id);
      const { reservation, client_secret, tokens_spent, driver_balance } = data.data;
      onReserved({
        reservationId: reservation.id,
        clientSecret: client_secret,
        tokenCost: tokens_spent,
        driverBalance: driver_balance,
        leaverName: spot.leaver_name,
        leaverRating: spot.leaver_avg_rating,
        spotAddress: spot.address,
        spotLat: spot.latitude,
        spotLng: spot.longitude,
        leaverId: spot.leaver_id,
      });
    } catch (e: any) {
      Alert.alert("Error", e.response?.data?.detail || "Failed to reserve spot");
    } finally {
      setReserving(false);
    }
  };

  const handleNavigate = () => {
    Linking.openURL(`https://maps.google.com/?q=${spot.latitude},${spot.longitude}`);
  };

  if (loading) return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color="#1E3DB8" />
    </View>
  );
  if (!spot) return null;

  const isOwner = user?.id === spot.leaver_id;
  const isAvailable = spot.status === "AVAILABLE";
  const tokenCost = Math.ceil(spot.price);

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backBtnText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>ParkPass</Text>
        <TouchableOpacity style={styles.helpBtn}>
          <Text style={styles.helpBtnText}>?</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Hero */}
        <View style={styles.heroWrap}>
          {spot.photo_url ? (
            <Image source={{ uri: spot.photo_url }} style={styles.heroImage} />
          ) : (
            <View style={[styles.heroImage, styles.heroPlaceholder]}>
              <Text style={styles.heroPlaceholderText}>🅿️</Text>
            </View>
          )}
          <View style={styles.heroBadge}>
            <Text style={styles.heroBadgeText}>
              {isAvailable ? "✓ AVAILABLE NOW" : spot.status}
            </Text>
          </View>
          <View style={styles.heroAddress}>
            <Text style={styles.heroAddressMain}>{spot.address}</Text>
          </View>
        </View>

        <View style={styles.content}>
          {/* Info cards */}
          <View style={styles.infoRow}>
            <View style={styles.infoCard}>
              <Text style={styles.infoLabel}>ESTIMATED COST</Text>
              <Text style={styles.infoValue}>
                <Text style={styles.infoValueBig}>${spot.price.toFixed(2)}</Text>
              </Text>
            </View>
            <View style={styles.infoCard}>
              <Text style={styles.infoLabel}>LEAVER READY</Text>
              <Text style={styles.infoValue}>
                <Text style={styles.infoValueSub}>~</Text>
                <Text style={styles.infoValueBig}>{spot.leaving_in_minutes === 0 ? "0" : spot.leaving_in_minutes}</Text>
                <Text style={styles.infoValueSub}> mins</Text>
              </Text>
            </View>
          </View>

          {/* Leaver card */}
          <View style={styles.leaverCard}>
            <View style={styles.leaverAvatar}>
              <Text style={styles.leaverAvatarText}>🌿</Text>
            </View>
            <View style={styles.leaverInfo}>
              <Text style={styles.leaverName}>{spot.leaver_name || "Leaver"}</Text>
              <Text style={styles.leaverVerified}>Verified Leaver</Text>
            </View>
            <View style={styles.leaverRating}>
              {[1,2,3,4,5].map(s => (
                <Text key={s} style={[styles.ratingStar, s <= Math.round(spot.leaver_avg_rating || 0) && styles.ratingStarFilled]}>★</Text>
              ))}
              <Text style={styles.ratingNum}>{(spot.leaver_avg_rating || 0).toFixed(1)} RATING</Text>
            </View>
          </View>

          {/* Mini map */}
          <TouchableOpacity style={styles.miniMapWrap} onPress={handleNavigate} activeOpacity={0.9}>
            <MapView
              style={styles.miniMap}
              initialRegion={{
                latitude: spot.latitude,
                longitude: spot.longitude,
                latitudeDelta: 0.008,
                longitudeDelta: 0.008,
              }}
              scrollEnabled={false}
              zoomEnabled={false}
              pitchEnabled={false}
              rotateEnabled={false}
            >
              <Marker coordinate={{ latitude: spot.latitude, longitude: spot.longitude }} />
            </MapView>
            <View style={styles.navigateChip}>
              <Text style={styles.navigateChipText}>TAP TO NAVIGATE</Text>
            </View>
          </TouchableOpacity>

          {/* Disclaimer */}
          <View style={styles.disclaimer}>
            <Text style={styles.disclaimerIcon}>ⓘ</Text>
            <Text style={styles.disclaimerText}>
              {isAvailable
                ? "10-minute hold for arrival. The leaver will be notified of your ETA immediately."
                : `This spot is currently ${spot.status.toLowerCase()}.`}
            </Text>
          </View>

          {/* Token balance hint */}
          {isAvailable && !isOwner && (
            <View style={styles.tokenHint}>
              <Text style={styles.tokenHintText}>🪙 Cost: {tokenCost} tokens · You have {user?.token_balance ?? 0}</Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Bottom CTA */}
      {!isOwner && isAvailable && (
        <View style={styles.bottomCTA}>
          <TouchableOpacity style={styles.reserveBtn} onPress={handleReserve} disabled={reserving}>
            {reserving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.reserveBtnText}>Reserve & Pay</Text>
            )}
          </TouchableOpacity>
          <Text style={styles.paymentHint}>SAFE PAYMENT VIA TOKENS (DEV MODE)</Text>
        </View>
      )}
      {isOwner && isAvailable && (
        <View style={styles.bottomCTA}>
          <TouchableOpacity
            style={styles.cancelListingBtn}
            onPress={() => Alert.alert("Cancel Listing", "Remove your spot?", [
              { text: "No" },
              { text: "Yes", style: "destructive", onPress: async () => { await spotsApi.cancel(spot.id); onBack(); } },
            ])}
          >
            <Text style={styles.cancelListingText}>Cancel My Listing</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#EEF1F8" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 12,
  },
  backBtn: { padding: 4 },
  backBtnText: { fontSize: 22, color: "#1E3DB8", fontWeight: "600" },
  headerTitle: { fontSize: 18, fontWeight: "800", color: "#1E3DB8" },
  helpBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: "#1E3DB8", alignItems: "center", justifyContent: "center",
  },
  helpBtnText: { color: "#fff", fontWeight: "800", fontSize: 15 },
  scroll: { flex: 1 },
  heroWrap: { marginHorizontal: 16, borderRadius: 16, overflow: "hidden", height: 200, marginBottom: 16 },
  heroImage: { width: "100%", height: "100%" },
  heroPlaceholder: { backgroundColor: "#D1D5DB", alignItems: "center", justifyContent: "center" },
  heroPlaceholderText: { fontSize: 48 },
  heroBadge: {
    position: "absolute", top: 12, left: 12,
    backgroundColor: "#22C55E", borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5,
  },
  heroBadgeText: { color: "#fff", fontWeight: "700", fontSize: 12 },
  heroAddress: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    backgroundColor: "rgba(0,0,0,0.45)", padding: 14,
  },
  heroAddressMain: { color: "#fff", fontSize: 20, fontWeight: "800" },
  content: { paddingHorizontal: 16 },
  infoRow: { flexDirection: "row", gap: 12, marginBottom: 12 },
  infoCard: {
    flex: 1, backgroundColor: "#fff", borderRadius: 14, padding: 14,
    shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 4, elevation: 2,
  },
  infoLabel: { fontSize: 10, fontWeight: "700", color: "#9CA3AF", letterSpacing: 0.8, marginBottom: 6 },
  infoValue: { flexDirection: "row", alignItems: "flex-end" },
  infoValueBig: { fontSize: 24, fontWeight: "800", color: "#111827" },
  infoValueSub: { fontSize: 15, color: "#6B7280", fontWeight: "500" },
  leaverCard: {
    backgroundColor: "#fff", borderRadius: 14, padding: 14,
    flexDirection: "row", alignItems: "center", marginBottom: 12,
    shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 4, elevation: 2,
  },
  leaverAvatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: "#D1FAE5", alignItems: "center", justifyContent: "center", marginRight: 12,
  },
  leaverAvatarText: { fontSize: 22 },
  leaverInfo: { flex: 1 },
  leaverName: { fontSize: 15, fontWeight: "700", color: "#111827" },
  leaverVerified: { fontSize: 12, color: "#6B7280" },
  leaverRating: { alignItems: "flex-end" },
  ratingStar: { fontSize: 14, color: "#E5E7EB", includeFontPadding: false },
  ratingStarFilled: { color: "#F59E0B" },
  ratingNum: { fontSize: 11, color: "#9CA3AF", marginTop: 2, fontWeight: "600" },
  miniMapWrap: {
    borderRadius: 14, overflow: "hidden", height: 140, marginBottom: 12,
    shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 4, elevation: 2,
  },
  miniMap: { width: "100%", height: "100%" },
  navigateChip: {
    position: "absolute", bottom: 10, right: 10,
    backgroundColor: "#fff", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5,
  },
  navigateChipText: { fontSize: 11, fontWeight: "700", color: "#1E3DB8", letterSpacing: 0.5 },
  disclaimer: {
    backgroundColor: "#FEF2F2", borderRadius: 12, padding: 12,
    flexDirection: "row", alignItems: "flex-start", gap: 8, marginBottom: 12,
  },
  disclaimerIcon: { fontSize: 16, color: "#EF4444" },
  disclaimerText: { flex: 1, fontSize: 13, color: "#EF4444", lineHeight: 18 },
  tokenHint: {
    backgroundColor: "#FEF3C7", borderRadius: 12, padding: 10,
    alignItems: "center", marginBottom: 12,
  },
  tokenHintText: { fontSize: 13, color: "#92400E", fontWeight: "600" },
  bottomCTA: {
    backgroundColor: "#fff", paddingHorizontal: 16, paddingTop: 12, paddingBottom: 24,
    shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: -2 },
  },
  reserveBtn: {
    backgroundColor: "#1E3DB8", borderRadius: 14, height: 56,
    alignItems: "center", justifyContent: "center",
  },
  reserveBtnText: { color: "#fff", fontSize: 17, fontWeight: "700" },
  paymentHint: { fontSize: 11, color: "#9CA3AF", textAlign: "center", marginTop: 6, letterSpacing: 0.5 },
  cancelListingBtn: {
    borderWidth: 1.5, borderColor: "#EF4444", borderRadius: 14, height: 52,
    alignItems: "center", justifyContent: "center",
  },
  cancelListingText: { color: "#EF4444", fontSize: 16, fontWeight: "600" },
});
