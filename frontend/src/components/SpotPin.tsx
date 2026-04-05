import React from "react";
import { View, Text, StyleSheet } from "react-native";

interface Props {
  price: number;
  leavingInMinutes: number;
}

export function SpotPin({ price, leavingInMinutes }: Props) {
  const timeLabel = leavingInMinutes === 0 ? "NOW" : `${leavingInMinutes}M`;
  return (
    <View style={styles.pill}>
      <Text style={styles.text}>${price.toFixed(0)} • {timeLabel}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    backgroundColor: "#4ADE80",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    flexDirection: "row",
    alignItems: "center",
  },
  text: {
    color: "#14532D",
    fontWeight: "700",
    fontSize: 13,
    includeFontPadding: false,
  },
});
