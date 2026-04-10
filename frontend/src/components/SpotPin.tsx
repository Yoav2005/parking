import React from "react";
import { View, Text } from "react-native";

interface Props {
  price: number;
  leavingInMinutes: number;
}

export function SpotPin({ price, leavingInMinutes }: Props) {
  const timeLabel = leavingInMinutes === 0 ? "NOW" : `${leavingInMinutes}m`;
  const label = `$${price.toFixed(0)} · ${timeLabel}`;
  return (
    <View style={{ alignItems: "center" }}>
      <View style={{
        backgroundColor: "#4ADE80",
        borderRadius: 20,
        paddingHorizontal: 10,
        paddingVertical: 5,
        minWidth: 60,
        alignItems: "center",
        justifyContent: "center",
        shadowColor: "#000",
        shadowOpacity: 0.2,
        shadowRadius: 3,
        shadowOffset: { width: 0, height: 1 },
        elevation: 4,
      }}>
        <Text style={{
          color: "#14532D",
          fontWeight: "700",
          fontSize: 12,
          includeFontPadding: false,
        }}>{label}</Text>
      </View>
      {/* Caret pointing down */}
      <View style={{
        width: 0, height: 0,
        borderLeftWidth: 5, borderRightWidth: 5, borderTopWidth: 6,
        borderLeftColor: "transparent", borderRightColor: "transparent",
        borderTopColor: "#4ADE80",
      }} />
    </View>
  );
}
