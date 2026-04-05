import React, { useState, useEffect } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ScrollView, Alert, ActivityIndicator, Image, SafeAreaView,
} from "react-native";
import MapView, { Marker } from "react-native-maps";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { spotsApi } from "../api/spots";
import { useLocation } from "../hooks/useLocation";

const LEAVING_OPTIONS = [
  { label: "Now", value: 0 },
  { label: "5m", value: 5 },
  { label: "10m", value: 10 },
  { label: "15m", value: 15 },
];

interface Props {
  onCreated: () => void;
  onCancel: () => void;
}

export default function CreateSpotScreen({ onCreated, onCancel }: Props) {
  const { coords } = useLocation();
  const [displayAddress, setDisplayAddress] = useState<string | null>(null);
  const [price, setPrice] = useState("1");

  useEffect(() => {
    if (!coords) return;
    let cancelled = false;
    (async () => {
      const fallback = `${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)}`;
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/reverse?lat=${coords.latitude}&lon=${coords.longitude}&format=json`,
          { headers: { "Accept-Language": "en", "User-Agent": "ParkPass/1.0" } },
        );
        const json = await res.json();
        if (!cancelled) {
          const a = json?.address;
          const parts = [a?.road, a?.city ?? a?.town ?? a?.village].filter(Boolean);
          setDisplayAddress(parts.length > 0 ? parts.join(", ") : fallback);
        }
      } catch {
        if (!cancelled) setDisplayAddress(fallback);
      }
    })();
    return () => { cancelled = true; };
  }, [coords?.latitude, coords?.longitude]);
  const [leavingIn, setLeavingIn] = useState(0);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission required", "Camera access is needed to take a photo.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: "images",
      quality: 0.7,
    });
    if (!result.canceled && result.assets[0]) {
      setPhotoUri(result.assets[0].uri);
    }
  };

  const handleSubmit = async () => {
    if (!coords) { Alert.alert("Error", "Unable to get your location."); return; }
    const priceNum = parseFloat(price);
    if (isNaN(priceNum) || priceNum < 1) { Alert.alert("Error", "Price must be at least $1.00"); return; }
    setIsLoading(true);
    try {
      // Reverse-geocode to get a real address
      let address = `${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)}`;
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/reverse?lat=${coords.latitude}&lon=${coords.longitude}&format=json`,
          { headers: { "Accept-Language": "en", "User-Agent": "ParkPass/1.0" } },
        );
        const json = await res.json();
        const a = json?.address;
        const parts = [a?.road, a?.city ?? a?.town ?? a?.village, a?.state].filter(Boolean);
        if (parts.length > 0) address = parts.join(", ");
      } catch {}

      let photo_url: string | undefined;
      if (photoUri) {
        photo_url = await spotsApi.uploadPhoto(photoUri);
      }

      await spotsApi.create({
        latitude: coords.latitude,
        longitude: coords.longitude,
        address,
        price: priceNum,
        leaving_in_minutes: leavingIn,
        photo_url,
      });
      Alert.alert("Listed!", "Your spot is now visible to drivers.", [{ text: "OK", onPress: onCreated }]);
    } catch (e: any) {
      Alert.alert("Error", e.response?.data?.detail || "Failed to create spot");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onCancel} style={styles.backBtn}>
          <Text style={styles.backBtnText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>List Your Spot</Text>
        <TouchableOpacity style={styles.helpBtn}>
          <Text style={styles.helpBtnText}>?</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Map preview */}
        <View style={styles.mapWrap}>
          {coords ? (
            <MapView
              style={styles.mapPreview}
              initialRegion={{
                latitude: coords.latitude,
                longitude: coords.longitude,
                latitudeDelta: 0.005,
                longitudeDelta: 0.005,
              }}
              scrollEnabled={false}
              zoomEnabled={false}
            >
              <Marker coordinate={{ latitude: coords.latitude, longitude: coords.longitude }} />
            </MapView>
          ) : (
            <View style={[styles.mapPreview, styles.mapPlaceholder]}>
              <ActivityIndicator color="#1E3DB8" />
            </View>
          )}
          <View style={styles.addressChip}>
            <Text style={styles.addressChipIcon}>📍</Text>
            <Text style={styles.addressChipText}>
              {coords ? (displayAddress || "Loading...") : "Loading..."}
            </Text>
          </View>
        </View>

        <View style={styles.content}>
          <Text style={styles.sectionTitle}>Confirm location & time</Text>
          <Text style={styles.sectionSub}>Help others find your spot quickly.</Text>

          {/* Leaving in */}
          <View style={styles.card}>
            <Text style={styles.cardLabel}>LEAVING IN</Text>
            <View style={styles.pillRow}>
              {LEAVING_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt.value}
                  style={[styles.pill, leavingIn === opt.value && styles.pillActive]}
                  onPress={() => setLeavingIn(opt.value)}
                >
                  <Text style={[styles.pillText, leavingIn === opt.value && styles.pillTextActive]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Price + Photo row */}
          <View style={styles.twoCol}>
            <View style={[styles.card, styles.halfCard]}>
              <Text style={styles.cardLabel}>PRICE</Text>
              <View style={styles.priceRow}>
                <Text style={styles.dollarSign}>$</Text>
                <TextInput
                  style={styles.priceInput}
                  value={price}
                  onChangeText={setPrice}
                  keyboardType="decimal-pad"
                  placeholder="1"
                />
              </View>
            </View>
            <TouchableOpacity style={[styles.card, styles.halfCard, styles.photoCard]} onPress={pickImage}>
              {photoUri ? (
                <Image source={{ uri: photoUri }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
              ) : (
                <>
                  <Text style={styles.photoIcon}>📷</Text>
                  <Text style={styles.photoLabel}>TAKE PHOTO</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* Boost tip */}
          <View style={styles.boostCard}>
            <Text style={styles.boostIcon}>✅</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.boostTitle}>Boost your visibility</Text>
              <Text style={styles.boostSub}>High-rated leavers usually provide a photo of the surrounding area.</Text>
            </View>
          </View>

          {/* Submit */}
          <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit} disabled={isLoading}>
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Text style={styles.submitText}>List My Spot</Text>
                <Text style={styles.submitIcon}> ⚡</Text>
              </>
            )}
          </TouchableOpacity>
          <Text style={styles.submitHint}>LISTING WILL BE ACTIVE FOR 30 MINUTES</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#EEF1F8" },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 12, backgroundColor: "#EEF1F8",
  },
  backBtn: { padding: 4 },
  backBtnText: { fontSize: 22, color: "#1E3DB8", fontWeight: "600" },
  headerTitle: { fontSize: 18, fontWeight: "800", color: "#1E3DB8" },
  helpBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: "#6B7280", alignItems: "center", justifyContent: "center",
  },
  helpBtnText: { color: "#fff", fontWeight: "800", fontSize: 15 },
  scroll: { flex: 1 },
  mapWrap: { marginHorizontal: 16, borderRadius: 16, overflow: "hidden", height: 180 },
  mapPreview: { width: "100%", height: "100%" },
  mapPlaceholder: { backgroundColor: "#D1D5DB", alignItems: "center", justifyContent: "center" },
  addressChip: {
    position: "absolute", bottom: 12, left: 12,
    backgroundColor: "#fff", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6,
    flexDirection: "row", alignItems: "center", gap: 4,
    shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 4, elevation: 3,
  },
  addressChipIcon: { fontSize: 13 },
  addressChipText: { fontSize: 12, fontWeight: "700", color: "#111827" },
  content: { padding: 16 },
  sectionTitle: { fontSize: 22, fontWeight: "800", color: "#111827", marginTop: 8 },
  sectionSub: { fontSize: 14, color: "#6B7280", marginTop: 2, marginBottom: 16 },
  card: {
    backgroundColor: "#fff", borderRadius: 14, padding: 16, marginBottom: 12,
    shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 4, elevation: 2,
  },
  cardLabel: { fontSize: 11, fontWeight: "700", color: "#9CA3AF", letterSpacing: 0.8, marginBottom: 10 },
  pillRow: { flexDirection: "row", gap: 8 },
  pill: {
    flex: 1, paddingVertical: 10, borderRadius: 10,
    backgroundColor: "#F3F4F6", alignItems: "center",
    borderWidth: 1.5, borderColor: "transparent",
  },
  pillActive: { backgroundColor: "#1E3DB8", borderColor: "#1E3DB8" },
  pillText: { fontSize: 14, fontWeight: "600", color: "#374151" },
  pillTextActive: { color: "#fff" },
  twoCol: { flexDirection: "row", gap: 12, marginBottom: 12 },
  halfCard: { flex: 1, marginBottom: 0 },
  photoCard: { alignItems: "center", justifyContent: "center", minHeight: 90, overflow: "hidden" },
  photoIcon: { fontSize: 28, marginBottom: 4 },
  photoLabel: { fontSize: 11, fontWeight: "700", color: "#9CA3AF", letterSpacing: 0.8 },
  photoThumb: { width: "100%", height: 90, borderRadius: 8 },
  priceRow: { flexDirection: "row", alignItems: "flex-end" },
  dollarSign: { fontSize: 22, fontWeight: "800", color: "#374151", marginBottom: 2 },
  priceInput: { fontSize: 28, fontWeight: "800", color: "#111827", minWidth: 50, marginLeft: 2 },
  boostCard: {
    backgroundColor: "#F0FDF4", borderRadius: 14, padding: 14,
    flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 16,
  },
  boostIcon: { fontSize: 20 },
  boostTitle: { fontSize: 14, fontWeight: "700", color: "#166534" },
  boostSub: { fontSize: 12, color: "#4B7C59", marginTop: 2, lineHeight: 18 },
  submitBtn: {
    backgroundColor: "#1E3DB8", borderRadius: 14, height: 56,
    flexDirection: "row", alignItems: "center", justifyContent: "center",
  },
  submitText: { color: "#fff", fontSize: 17, fontWeight: "700" },
  submitIcon: { color: "#fff", fontSize: 17 },
  submitHint: { fontSize: 11, color: "#9CA3AF", textAlign: "center", marginTop: 8, letterSpacing: 0.5 },
});
