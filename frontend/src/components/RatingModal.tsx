import React, { useState } from "react";
import {
  Modal, View, Text, StyleSheet, TouchableOpacity, ActivityIndicator,
} from "react-native";
import { ratingsApi } from "../api/ratings";

interface Props {
  visible: boolean;
  reservationId: string;
  ratedId: string;
  ratedName: string;
  onDone: () => void;
}

export function RatingModal({ visible, reservationId, ratedId, ratedName, onDone }: Props) {
  const [score, setScore] = useState(0);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!score) return;
    setLoading(true);
    try {
      await ratingsApi.create(reservationId, ratedId, score);
    } finally {
      setLoading(false);
      onDone();
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>Rate {ratedName}</Text>
          <View style={styles.stars}>
            {[1, 2, 3, 4, 5].map((s) => (
              <TouchableOpacity key={s} onPress={() => setScore(s)}>
                <Text style={[styles.star, s <= score && styles.filled]}>★</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity style={styles.button} onPress={submit} disabled={!score || loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Submit</Text>}
          </TouchableOpacity>
          <TouchableOpacity onPress={onDone}>
            <Text style={styles.skip}>Skip</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  card: { backgroundColor: "#fff", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 32 },
  title: { fontSize: 20, fontWeight: "700", color: "#111827", textAlign: "center", marginBottom: 24 },
  stars: { flexDirection: "row", justifyContent: "center", gap: 8, marginBottom: 24 },
  star: { fontSize: 44, color: "#E5E7EB" },
  filled: { color: "#FBBF24" },
  button: { backgroundColor: "#1E40AF", borderRadius: 12, padding: 14, alignItems: "center" },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  skip: { textAlign: "center", color: "#9CA3AF", marginTop: 16 },
});
