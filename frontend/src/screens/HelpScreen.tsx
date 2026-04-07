import React, { useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Modal, SafeAreaView, Dimensions,
} from "react-native";

const { width } = Dimensions.get("window");

interface Props {
  visible: boolean;
  onClose: () => void;
}

// ── Mini app-screen mockups for each step ─────────────────────────────
function MockMap() {
  return (
    <View style={mock.phone}>
      <View style={[mock.bg, { backgroundColor: "#d1d5db" }]}>
        <View style={mock.mapGrid} />
        {/* Spot pins */}
        <View style={[mock.pin, { top: 28, left: 40 }]}><Text style={mock.pinText}>$4</Text></View>
        <View style={[mock.pin, { top: 50, right: 30 }, mock.pinHighlight]}><Text style={mock.pinText}>$2</Text></View>
        <View style={[mock.pin, { bottom: 30, left: 55 }]}><Text style={mock.pinText}>$3</Text></View>
        {/* User dot */}
        <View style={mock.userDot} />
        <View style={mock.bottomBar}>
          <View style={mock.leaveBtn}><Text style={mock.leaveBtnText}>I'm leaving my spot</Text></View>
        </View>
      </View>
    </View>
  );
}

function MockSpotDetail() {
  return (
    <View style={mock.phone}>
      <View style={[mock.bg, { backgroundColor: "#f3f4f6", paddingHorizontal: 8, paddingTop: 8 }]}>
        <View style={mock.card}>
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 6 }}>
            <View style={mock.pinSmall}><Text style={mock.pinTextSm}>$2</Text></View>
            <Text style={mock.cardTitle}>Oak St & 3rd Ave</Text>
          </View>
          <Text style={mock.cardSub}>★ 4.8  ·  Leaving in 5 min</Text>
        </View>
        <View style={[mock.confirmBtn, { marginTop: 8 }]}>
          <Text style={mock.confirmBtnText}>Reserve · 2 tokens</Text>
        </View>
      </View>
    </View>
  );
}

function MockNavigate() {
  return (
    <View style={mock.phone}>
      <View style={[mock.bg, { backgroundColor: "#d1d5db", alignItems: "center", justifyContent: "center" }]}>
        <View style={mock.mapGrid} />
        <View style={mock.routeLine} />
        <View style={[mock.userDot, { position: "relative", margin: 0, bottom: 0, right: 0 }]} />
        <View style={mock.arrivalChip}><Text style={mock.arrivalChipText}>3 min away</Text></View>
      </View>
    </View>
  );
}

function MockArrived() {
  return (
    <View style={mock.phone}>
      <View style={[mock.bg, { backgroundColor: "#f3f4f6", paddingHorizontal: 8, paddingTop: 10 }]}>
        <View style={[mock.card, { alignItems: "center", paddingVertical: 10 }]}>
          <Text style={{ fontSize: 18 }}>🚗</Text>
          <Text style={mock.cardTitle}>You've arrived!</Text>
          <Text style={mock.cardSub}>Let the leaver know</Text>
        </View>
        <View style={[mock.confirmBtn, { marginTop: 8, backgroundColor: "#16a34a" }]}>
          <Text style={mock.confirmBtnText}>I've Arrived ✓</Text>
        </View>
      </View>
    </View>
  );
}

function MockComplete() {
  return (
    <View style={mock.phone}>
      <View style={[mock.bg, { backgroundColor: "#f3f4f6", alignItems: "center", justifyContent: "center", gap: 6 }]}>
        <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: "#16a34a", alignItems: "center", justifyContent: "center" }}>
          <Text style={{ color: "#fff", fontSize: 18, fontWeight: "800" }}>✓</Text>
        </View>
        <Text style={[mock.cardTitle, { textAlign: "center" }]}>Swap Complete!</Text>
        <View style={mock.starRow}>
          {[1,2,3,4,5].map(i => <Text key={i} style={{ fontSize: 12, color: "#f59e0b" }}>★</Text>)}
        </View>
      </View>
    </View>
  );
}

function MockLeaveBtn() {
  return (
    <View style={mock.phone}>
      <View style={[mock.bg, { backgroundColor: "#d1d5db", justifyContent: "flex-end" }]}>
        <View style={mock.mapGrid} />
        <View style={mock.bottomBar}>
          <View style={[mock.leaveBtn, mock.leaveBtnPulse]}><Text style={mock.leaveBtnText}>I'm leaving my spot</Text></View>
        </View>
      </View>
    </View>
  );
}

function MockPhoto() {
  return (
    <View style={mock.phone}>
      <View style={[mock.bg, { backgroundColor: "#111827", alignItems: "center", justifyContent: "center" }]}>
        <View style={mock.cameraFrame} />
        <View style={mock.shutter} />
      </View>
    </View>
  );
}

function MockListing() {
  return (
    <View style={mock.phone}>
      <View style={[mock.bg, { backgroundColor: "#f3f4f6", paddingHorizontal: 8, paddingTop: 8 }]}>
        <View style={mock.card}>
          <Text style={[mock.cardSub, { color: "#16a34a", fontWeight: "700" }]}>● YOUR ACTIVE LISTING</Text>
          <Text style={mock.cardTitle}>Oak St & 3rd Ave</Text>
          <Text style={mock.cardSub}>🪙 2 tokens · Waiting for driver…</Text>
        </View>
      </View>
    </View>
  );
}

function MockDriverComing() {
  return (
    <View style={mock.phone}>
      <View style={[mock.bg, { backgroundColor: "#f3f4f6", paddingHorizontal: 8, paddingTop: 8 }]}>
        <View style={[mock.card, { backgroundColor: "#1e3db8" }]}>
          <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 8, fontWeight: "700", letterSpacing: 0.8 }}>DRIVER ASSIGNED</Text>
          <Text style={[mock.cardTitle, { color: "#fff" }]}>Alex M.</Text>
          <Text style={[mock.cardSub, { color: "rgba(255,255,255,0.8)" }]}>🚘 Toyota Camry · 4 min</Text>
        </View>
        <View style={[mock.confirmBtn, { marginTop: 6, backgroundColor: "#374151" }]}>
          <Text style={mock.confirmBtnText}>Chat with Alex</Text>
        </View>
      </View>
    </View>
  );
}

function MockLeaverConfirm() {
  return (
    <View style={mock.phone}>
      <View style={[mock.bg, { backgroundColor: "#f3f4f6", alignItems: "center", justifyContent: "center", gap: 6 }]}>
        <Text style={{ fontSize: 20 }}>🅿️</Text>
        <Text style={[mock.cardTitle, { textAlign: "center" }]}>Driver Arrived!</Text>
        <View style={[mock.confirmBtn, { backgroundColor: "#16a34a", width: "80%" }]}>
          <Text style={mock.confirmBtnText}>I've Vacated ✓</Text>
        </View>
        <Text style={[mock.cardSub, { textAlign: "center" }]}>+2 🪙 tokens earned</Text>
      </View>
    </View>
  );
}

const DRIVER_STEPS = [
  { title: "Browse the Map", desc: "Open the Explorer tab. Nearby available spots appear as price pins. Blue = cheap, the darker the more expensive.", Preview: MockMap },
  { title: "Tap a Spot Pin", desc: "Tap any pin to open the spot detail sheet. You'll see the price in tokens, the leaver's rating, and how soon they're leaving.", Preview: MockSpotDetail },
  { title: "Reserve It", desc: "Hit Reserve. Tokens are deducted from your balance instantly. No driver can steal the spot while you're navigating.", Preview: MockSpotDetail },
  { title: "Navigate There", desc: "Head to the spot. You can see how far away you are. Use any maps app — the address is shown in the reservation screen.", Preview: MockNavigate },
  { title: "Tap 'I've Arrived'", desc: "Once you're at the spot, tap the arrived button. This notifies the leaver that you're there and waiting.", Preview: MockArrived },
  { title: "Complete the Swap", desc: "The leaver vacates and taps confirm. The spot is yours! Rate the leaver after to help the community.", Preview: MockComplete },
];

const LEAVER_STEPS = [
  { title: "Tap 'I'm Leaving'", desc: "On the main map screen, tap the blue 'I'm leaving my spot' button at the bottom. This starts listing your spot.", Preview: MockLeaveBtn },
  { title: "Photo Your Spot", desc: "Take a clear photo so the driver can find you easily. Include street signs or landmarks if possible.", Preview: MockPhoto },
  { title: "Confirm Your Listing", desc: "Set roughly when you're leaving. Your spot will appear on the map for nearby drivers immediately.", Preview: MockListing },
  { title: "Get Reserved", desc: "When a driver reserves your spot, you'll get a notification. Your listing card shows their name and car.", Preview: MockDriverComing },
  { title: "Driver is Coming", desc: "Watch them approach in real-time. Chat if you need to coordinate — tap the chat button on the listing card.", Preview: MockDriverComing },
  { title: "Confirm the Swap", desc: "When the driver arrives and taps 'I've Arrived', vacate your spot and tap 'I've Vacated'. Tokens land in your balance!", Preview: MockLeaverConfirm },
];

// ── Step card ─────────────────────────────────────────────────────────
function StepCard({ step, index }: { step: typeof DRIVER_STEPS[0]; index: number }) {
  const { Preview } = step;
  return (
    <View style={styles.stepCard}>
      <View style={styles.stepLeft}>
        <View style={styles.stepNumCircle}>
          <Text style={styles.stepNum}>{index + 1}</Text>
        </View>
        <View style={styles.stepConnector} />
      </View>
      <View style={styles.stepRight}>
        <Text style={styles.stepTitle}>{step.title}</Text>
        <Text style={styles.stepDesc}>{step.desc}</Text>
        <Preview />
      </View>
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────
export default function HelpScreen({ visible, onClose }: Props) {
  const [tab, setTab] = useState<"driver" | "leaver">("driver");
  const steps = tab === "driver" ? DRIVER_STEPS : LEAVER_STEPS;

  return (
    <Modal visible={visible} animationType="slide" statusBarTranslucent>
      <SafeAreaView style={styles.safe}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>How It Works</Text>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeBtnText}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* Tab switcher */}
        <View style={styles.tabBar}>
          <TouchableOpacity
            style={[styles.tabBtn, tab === "driver" && styles.tabBtnActive]}
            onPress={() => setTab("driver")}
          >
            <Text style={[styles.tabBtnText, tab === "driver" && styles.tabBtnTextActive]}>🚗  I'm a Driver</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabBtn, tab === "leaver" && styles.tabBtnActive]}
            onPress={() => setTab("leaver")}
          >
            <Text style={[styles.tabBtnText, tab === "leaver" && styles.tabBtnTextActive]}>🅿️  I'm a Leaver</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          <Text style={styles.sectionIntro}>
            {tab === "driver"
              ? "Find a spot being vacated nearby, reserve it with tokens, and navigate there before anyone else."
              : "Going somewhere? List your parking spot for nearby drivers and earn tokens when the swap is complete."}
          </Text>

          {steps.map((step, i) => (
            <StepCard key={i} step={step} index={i} />
          ))}

          <View style={styles.tipCard}>
            <Text style={styles.tipIcon}>{tab === "driver" ? "💡" : "💰"}</Text>
            <Text style={styles.tipText}>
              {tab === "driver"
                ? "You start with 100 free tokens. Spots typically cost 1–5 tokens depending on location."
                : "Each completed swap earns you tokens. Build your rating to attract more drivers to your listings."}
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

// ── Mock screen styles ────────────────────────────────────────────────
const mock = StyleSheet.create({
  phone: {
    width: "100%", height: 120, borderRadius: 12, overflow: "hidden",
    marginTop: 10, borderWidth: 1.5, borderColor: "#e5e7eb",
  },
  bg: { flex: 1, position: "relative" },
  mapGrid: {
    position: "absolute", inset: 0,
    borderWidth: 0.5, borderColor: "rgba(0,0,0,0.08)",
  },
  pin: {
    position: "absolute", backgroundColor: "#1e3db8",
    borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2,
  },
  pinHighlight: { backgroundColor: "#059669" },
  pinText: { color: "#fff", fontSize: 9, fontWeight: "800" },
  pinSmall: { backgroundColor: "#1e3db8", borderRadius: 6, paddingHorizontal: 4, paddingVertical: 1, marginRight: 6 },
  pinTextSm: { color: "#fff", fontSize: 8, fontWeight: "800" },
  userDot: {
    position: "absolute", bottom: 40, right: 50,
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: "#1e3db8", borderWidth: 2, borderColor: "#fff",
  },
  bottomBar: { position: "absolute", bottom: 0, left: 0, right: 0, padding: 8 },
  leaveBtn: { backgroundColor: "#1e3db8", borderRadius: 8, paddingVertical: 7, alignItems: "center" },
  leaveBtnPulse: { backgroundColor: "#1e3db8", shadowColor: "#1e3db8", shadowOpacity: 0.6, shadowRadius: 8, elevation: 6 },
  leaveBtnText: { color: "#fff", fontSize: 9, fontWeight: "700" },
  card: { backgroundColor: "#fff", borderRadius: 10, padding: 10, shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  cardTitle: { fontSize: 11, fontWeight: "800", color: "#111827", marginBottom: 2 },
  cardSub: { fontSize: 9, color: "#6b7280" },
  confirmBtn: { backgroundColor: "#1e3db8", borderRadius: 8, paddingVertical: 7, alignItems: "center" },
  confirmBtnText: { color: "#fff", fontSize: 9, fontWeight: "700" },
  routeLine: {
    position: "absolute", width: 2, height: 50, backgroundColor: "#1e3db8",
    top: 20, left: "50%",
  },
  arrivalChip: {
    backgroundColor: "#1e3db8", borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3,
    marginTop: 8,
  },
  arrivalChipText: { color: "#fff", fontSize: 9, fontWeight: "700" },
  starRow: { flexDirection: "row", gap: 2 },
  cameraFrame: {
    width: 70, height: 70, borderWidth: 2, borderColor: "rgba(255,255,255,0.6)",
    borderRadius: 4,
  },
  shutter: {
    marginTop: 10, width: 24, height: 24, borderRadius: 12,
    backgroundColor: "#fff", borderWidth: 3, borderColor: "#374151",
  },
});

// ── Main styles ───────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#EEF1F8" },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingVertical: 14, backgroundColor: "#fff",
    borderBottomWidth: 1, borderBottomColor: "#f3f4f6",
  },
  headerTitle: { fontSize: 20, fontWeight: "800", color: "#1E3DB8", fontFamily: "System" },
  closeBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: "#f3f4f6", alignItems: "center", justifyContent: "center" },
  closeBtnText: { fontSize: 15, color: "#374151", fontWeight: "700" },
  tabBar: {
    flexDirection: "row", backgroundColor: "#fff", padding: 6, gap: 6,
    borderBottomWidth: 1, borderBottomColor: "#f3f4f6",
  },
  tabBtn: {
    flex: 1, paddingVertical: 10, borderRadius: 10,
    alignItems: "center", backgroundColor: "#f3f4f6",
  },
  tabBtnActive: { backgroundColor: "#1E3DB8" },
  tabBtnText: { fontSize: 13, fontWeight: "700", color: "#6b7280" },
  tabBtnTextActive: { color: "#fff" },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 40, paddingTop: 16 },
  sectionIntro: {
    fontSize: 14, color: "#6b7280", lineHeight: 21, marginBottom: 20,
    backgroundColor: "#fff", borderRadius: 12, padding: 14,
  },
  stepCard: {
    flexDirection: "row", marginBottom: 4,
  },
  stepLeft: { alignItems: "center", marginRight: 14, paddingTop: 2 },
  stepNumCircle: {
    width: 30, height: 30, borderRadius: 15, backgroundColor: "#1E3DB8",
    alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  stepNum: { color: "#fff", fontSize: 13, fontWeight: "800" },
  stepConnector: { flex: 1, width: 2, backgroundColor: "#e5e7eb", marginTop: 4, marginBottom: -16 },
  stepRight: {
    flex: 1, backgroundColor: "#fff", borderRadius: 14, padding: 14,
    marginBottom: 12,
    shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 6, elevation: 2,
  },
  stepTitle: { fontSize: 15, fontWeight: "800", color: "#111827", marginBottom: 4 },
  stepDesc: { fontSize: 13, color: "#6b7280", lineHeight: 19, marginBottom: 2 },
  tipCard: {
    flexDirection: "row", backgroundColor: "#FEF3C7", borderRadius: 14,
    padding: 14, gap: 10, alignItems: "flex-start", marginTop: 4,
  },
  tipIcon: { fontSize: 20 },
  tipText: { flex: 1, fontSize: 13, color: "#78350F", lineHeight: 19 },
});
