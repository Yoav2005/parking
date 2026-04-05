import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, Image } from "react-native";
import { Spot } from "../store/spotsStore";

interface Props {
  spot: Spot;
  onPress: () => void;
}

export function SpotCard({ spot, onPress }: Props) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress}>
      {spot.photo_url && (
        <Image source={{ uri: spot.photo_url }} style={styles.image} />
      )}
      <View style={styles.info}>
        <Text style={styles.price}>${spot.price.toFixed(2)}</Text>
        <Text style={styles.address} numberOfLines={1}>{spot.address}</Text>
        <View style={styles.row}>
          <Text style={styles.tag}>
            {spot.leaving_in_minutes === 0 ? "Leaving now" : `In ${spot.leaving_in_minutes} min`}
          </Text>
          {spot.distance_km != null && (
            <Text style={styles.distance}>{spot.distance_km.toFixed(2)} km away</Text>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row", backgroundColor: "#fff", borderRadius: 12,
    marginHorizontal: 16, marginVertical: 6, overflow: "hidden",
    shadowColor: "#000", shadowOpacity: 0.07, shadowRadius: 6, elevation: 3,
  },
  image: { width: 90, height: 90 },
  info: { flex: 1, padding: 12, justifyContent: "center" },
  price: { fontSize: 20, fontWeight: "800", color: "#111827" },
  address: { fontSize: 13, color: "#6B7280", marginTop: 2 },
  row: { flexDirection: "row", justifyContent: "space-between", marginTop: 6 },
  tag: { fontSize: 12, color: "#1E40AF", fontWeight: "600" },
  distance: { fontSize: 12, color: "#9CA3AF" },
});
