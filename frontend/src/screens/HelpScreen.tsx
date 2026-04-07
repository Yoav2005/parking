import React, { useEffect, useRef, useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Modal, SafeAreaView, Animated, Easing, Dimensions,
} from "react-native";

const W = Dimensions.get("window").width - 48; // card inner width

// ── Tap ripple ────────────────────────────────────────────────────────
function TapRipple({ x, y, trigger }: { x: number; y: number; trigger: Animated.Value }) {
  const scale  = trigger.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 1.2, 1.4] });
  const opacity = trigger.interpolate({ inputRange: [0, 0.1, 0.8, 1], outputRange: [0, 0.55, 0.3, 0] });
  return (
    <Animated.View pointerEvents="none" style={{
      position: "absolute", left: x - 22, top: y - 22,
      width: 44, height: 44, borderRadius: 22,
      backgroundColor: "#fff", opacity, transform: [{ scale }], zIndex: 99,
    }} />
  );
}

// ── Loop hook: progress 0→1 every `ms` ms ─────────────────────────────
function useLoop(ms: number) {
  const p = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const anim = Animated.loop(
      Animated.timing(p, { toValue: 1, duration: ms, easing: Easing.linear, useNativeDriver: true })
    );
    anim.start();
    return () => anim.stop();
  }, []);
  return p;
}

// ── Phone frame ───────────────────────────────────────────────────────
function Phone({ children, height = 220 }: { children: React.ReactNode; height?: number }) {
  return (
    <View style={[sim.phone, { height }]}>
      <View style={sim.statusBar}>
        <Text style={sim.statusTime}>9:41</Text>
        <View style={sim.statusRight}>
          <Text style={sim.statusIcon}>●●●</Text>
        </View>
      </View>
      <View style={{ flex: 1, overflow: "hidden" }}>{children}</View>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// DRIVER SIMULATIONS
// ═══════════════════════════════════════════════════════════════════════

function SimBrowseMap() {
  const p = useLoop(3200);
  const tap = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const drive = Animated.loop(Animated.sequence([
      Animated.delay(1100),
      Animated.timing(tap, { toValue: 1, duration: 700, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(tap, { toValue: 0, duration: 100, useNativeDriver: true }),
      Animated.delay(1300),
    ]));
    drive.start();
    return () => drive.stop();
  }, []);
  const pinScale = tap.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 1.25, 1.1] });
  return (
    <Phone>
      <View style={sim.mapBg}>
        {/* Roads */}
        <View style={[sim.road, { top: "40%", left: 0, right: 0, height: 6 }]} />
        <View style={[sim.road, { left: "55%", top: 0, bottom: 0, width: 6 }]} />
        <View style={[sim.road, { top: "70%", left: 0, right: 0, height: 4 }]} />
        <View style={[sim.road, { left: "25%", top: 0, bottom: 0, width: 4 }]} />
        {/* Buildings */}
        <View style={[sim.building, { top: 18, left: 10, width: 44, height: 32 }]} />
        <View style={[sim.building, { top: 18, left: 65, width: 30, height: 40 }]} />
        <View style={[sim.building, { top: 18, right: 10, width: 38, height: 28 }]} />
        <View style={[sim.building, { bottom: 40, left: 10, width: 40, height: 30 }]} />
        <View style={[sim.building, { bottom: 40, right: 15, width: 50, height: 35 }]} />
        {/* Price pins */}
        <View style={[sim.pricePin, { top: 28, left: 30 }]}><Text style={sim.priceTxt}>$4</Text></View>
        <View style={[sim.pricePin, { top: 55, right: 28 }]}><Text style={sim.priceTxt}>$3</Text></View>
        <Animated.View style={[sim.pricePin, sim.pricePinGreen, { bottom: 48, left: 60 }, { transform: [{ scale: pinScale }] }]}>
          <Text style={sim.priceTxt}>$2</Text>
        </Animated.View>
        {/* User dot */}
        <View style={sim.userDot} />
        <TapRipple x={75} y={142} trigger={tap} />
        {/* Header */}
        <View style={sim.mapHeader}>
          <Text style={sim.mapHeaderTitle}>ParkPass</Text>
        </View>
        {/* Bottom bar */}
        <View style={sim.mapBottom}>
          <View style={sim.leaveBtn}><Text style={sim.leaveBtnTxt}>I'm leaving my spot</Text></View>
        </View>
      </View>
    </Phone>
  );
}

function SimSpotDetail() {
  const p = useLoop(3400);
  const slideY = p.interpolate({ inputRange: [0, 0.15, 0.85, 1], outputRange: [200, 0, 0, 200] });
  const tap = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.delay(1800),
      Animated.timing(tap, { toValue: 1, duration: 600, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(tap, { toValue: 0, duration: 100, useNativeDriver: true }),
      Animated.delay(1000),
    ])).start();
  }, []);
  return (
    <Phone>
      <View style={sim.mapBg}>
        <View style={[sim.road, { top: "45%", left: 0, right: 0, height: 6 }]} />
        <View style={[sim.road, { left: "50%", top: 0, bottom: 0, width: 6 }]} />
        <View style={[sim.building, { top: 18, left: 10, width: 44, height: 32 }]} />
        <View style={[sim.building, { top: 18, right: 10, width: 38, height: 28 }]} />
        <View style={[sim.pricePin, sim.pricePinGreen, { top: 30, left: 55 }]}><Text style={sim.priceTxt}>$2</Text></View>
        <View style={sim.userDot} />
        <View style={sim.mapHeader}><Text style={sim.mapHeaderTitle}>ParkPass</Text></View>
        {/* Spot detail sheet */}
        <Animated.View style={[sim.sheet, { transform: [{ translateY: slideY }] }]}>
          <View style={sim.sheetHandle} />
          <Text style={sim.sheetAddr}>Oak St & 3rd Ave</Text>
          <View style={sim.sheetRow}>
            <View style={sim.sheetBadge}><Text style={sim.sheetBadgeTxt}>$2 · 2 tokens</Text></View>
            <Text style={sim.sheetSub}>★ 4.8 · Leaving in 3 min</Text>
          </View>
          <View style={sim.reserveBtn}>
            <Text style={sim.reserveBtnTxt}>Reserve Spot →</Text>
          </View>
          <TapRipple x={W / 2} y={112} trigger={tap} />
        </Animated.View>
      </View>
    </Phone>
  );
}

function SimReserve() {
  const p = useLoop(3600);
  const tap = useRef(new Animated.Value(0)).current;
  const success = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.delay(1200),
      Animated.timing(tap, { toValue: 1, duration: 500, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(tap, { toValue: 0, duration: 100, useNativeDriver: true }),
      Animated.timing(success, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.delay(1600),
      Animated.timing(success, { toValue: 0, duration: 300, useNativeDriver: true }),
      Animated.delay(100),
    ])).start();
  }, []);
  return (
    <Phone height={240}>
      <View style={[sim.screen, { padding: 14, gap: 10 }]}>
        <Text style={sim.screenTitle}>Confirm Reservation</Text>
        <View style={sim.confirmCard}>
          <Text style={sim.confirmAddr}>📍 Oak St & 3rd Ave</Text>
          <View style={sim.confirmRow}>
            <Text style={sim.confirmLabel}>Cost</Text>
            <Text style={sim.confirmVal}>🪙 2 tokens</Text>
          </View>
          <View style={sim.confirmRow}>
            <Text style={sim.confirmLabel}>Your balance</Text>
            <Text style={sim.confirmVal}>100 → 98 🪙</Text>
          </View>
          <View style={sim.confirmRow}>
            <Text style={sim.confirmLabel}>Leaver rating</Text>
            <Text style={sim.confirmVal}>★ 4.8</Text>
          </View>
        </View>
        <View style={sim.reserveBtn}>
          <Text style={sim.reserveBtnTxt}>Confirm & Reserve</Text>
          <TapRipple x={W / 2 - 14} y={22} trigger={tap} />
        </View>
        <Animated.View style={[sim.successBanner, { opacity: success }]}>
          <Text style={sim.successTxt}>✓  Reserved! Navigating…</Text>
        </Animated.View>
      </View>
    </Phone>
  );
}

function SimNavigate() {
  const p = useLoop(3000);
  const dotX = p.interpolate({ inputRange: [0, 1], outputRange: [30, W - 50] });
  const eta   = p.interpolate({ inputRange: [0, 1], outputRange: [5, 0] });
  return (
    <Phone>
      <View style={sim.mapBg}>
        <View style={[sim.road, { top: "55%", left: 0, right: 0, height: 8, backgroundColor: "#93c5fd" }]} />
        <View style={[sim.building, { top: 18, left: 10, width: 44, height: 32 }]} />
        <View style={[sim.building, { top: 18, right: 10, width: 38, height: 28 }]} />
        <View style={[sim.building, { bottom: 38, right: 15, width: 50, height: 35 }]} />
        {/* Destination */}
        <View style={[sim.destPin, { top: 42, right: 28 }]}><Text style={sim.destPinTxt}>P</Text></View>
        {/* Moving car */}
        <Animated.View style={[sim.carDot, { transform: [{ translateX: dotX }] }]}>
          <Text style={{ fontSize: 14 }}>🚗</Text>
        </Animated.View>
        <View style={sim.mapHeader}><Text style={sim.mapHeaderTitle}>ParkPass</Text></View>
        {/* ETA chip */}
        <View style={sim.etaChip}>
          <Text style={sim.etaTxt}>🧭  Navigating to spot…</Text>
        </View>
      </View>
    </Phone>
  );
}

function SimArrived() {
  const tap = useRef(new Animated.Value(0)).current;
  const success = useRef(new Animated.Value(0)).current;
  const colorAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.delay(1300),
      Animated.timing(tap, { toValue: 1, duration: 600, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(tap, { toValue: 0, duration: 100, useNativeDriver: true }),
      Animated.parallel([
        Animated.timing(success, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(colorAnim, { toValue: 1, duration: 400, useNativeDriver: false }),
      ]),
      Animated.delay(1500),
      Animated.parallel([
        Animated.timing(success, { toValue: 0, duration: 300, useNativeDriver: true }),
        Animated.timing(colorAnim, { toValue: 0, duration: 300, useNativeDriver: false }),
      ]),
      Animated.delay(100),
    ])).start();
  }, []);
  const btnBg = colorAnim.interpolate({ inputRange: [0, 1], outputRange: ["#1E3DB8", "#16a34a"] });
  const labelOpacity = success.interpolate({ inputRange: [0, 0.4, 1], outputRange: [1, 1, 0] });
  const confirmedOpacity = success.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0, 0, 1] });
  return (
    <Phone height={240}>
      <View style={[sim.screen, { padding: 14, gap: 10 }]}>
        <View style={sim.confirmCard}>
          <Text style={sim.confirmAddr}>📍 Oak St & 3rd Ave</Text>
          <Text style={[sim.confirmLabel, { marginTop: 4 }]}>Leaver is waiting for you</Text>
          <View style={[sim.confirmRow, { marginTop: 6 }]}>
            <View style={[sim.sheetBadge, { backgroundColor: "#dcfce7" }]}>
              <Text style={[sim.sheetBadgeTxt, { color: "#16a34a" }]}>ACTIVE RESERVATION</Text>
            </View>
          </View>
        </View>
        <Animated.View style={[sim.reserveBtn, { backgroundColor: btnBg, position: "relative" }]}>
          <View style={{ alignItems: "center" }}>
            <Animated.View style={{ opacity: labelOpacity }}>
              <Text style={sim.reserveBtnTxt}>I've Arrived  ✓</Text>
            </Animated.View>
            <Animated.View style={{ position: "absolute", opacity: confirmedOpacity }}>
              <Text style={sim.reserveBtnTxt}>Leaver Notified!</Text>
            </Animated.View>
          </View>
          <TapRipple x={W / 2 - 14} y={22} trigger={tap} />
        </Animated.View>
      </View>
    </Phone>
  );
}

function SimComplete() {
  const p = useLoop(3000);
  const checkScale = p.interpolate({ inputRange: [0, 0.2, 0.35, 1], outputRange: [0, 1.15, 1, 1] });
  const star1 = p.interpolate({ inputRange: [0, 0.35, 0.45, 1], outputRange: [0, 0, 1, 1] });
  const star2 = p.interpolate({ inputRange: [0, 0.42, 0.52, 1], outputRange: [0, 0, 1, 1] });
  const star3 = p.interpolate({ inputRange: [0, 0.49, 0.59, 1], outputRange: [0, 0, 1, 1] });
  const star4 = p.interpolate({ inputRange: [0, 0.56, 0.66, 1], outputRange: [0, 0, 1, 1] });
  const star5 = p.interpolate({ inputRange: [0, 0.63, 0.73, 1], outputRange: [0, 0, 1, 1] });
  const stars = [star1, star2, star3, star4, star5];
  return (
    <Phone>
      <View style={[sim.screen, { alignItems: "center", justifyContent: "center", gap: 10 }]}>
        <Animated.View style={[sim.successCircle, { transform: [{ scale: checkScale }] }]}>
          <Text style={sim.successCheck}>✓</Text>
        </Animated.View>
        <Text style={[sim.screenTitle, { textAlign: "center" }]}>Swap Complete!</Text>
        <Text style={[sim.confirmLabel, { textAlign: "center" }]}>Rate your experience</Text>
        <View style={{ flexDirection: "row", gap: 8 }}>
          {stars.map((s, i) => (
            <Animated.Text key={i} style={[sim.star, { opacity: s, transform: [{ scale: s.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }) }] }]}>★</Animated.Text>
          ))}
        </View>
      </View>
    </Phone>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// LEAVER SIMULATIONS
// ═══════════════════════════════════════════════════════════════════════

function SimLeaveButton() {
  const tap = useRef(new Animated.Value(0)).current;
  const btnScale = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.delay(1200),
      Animated.parallel([
        Animated.timing(tap, { toValue: 1, duration: 600, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.sequence([
          Animated.timing(btnScale, { toValue: 0.94, duration: 150, useNativeDriver: true }),
          Animated.timing(btnScale, { toValue: 1, duration: 200, useNativeDriver: true }),
        ]),
      ]),
      Animated.timing(tap, { toValue: 0, duration: 100, useNativeDriver: true }),
      Animated.delay(1700),
    ])).start();
  }, []);
  return (
    <Phone>
      <View style={sim.mapBg}>
        <View style={[sim.road, { top: "40%", left: 0, right: 0, height: 6 }]} />
        <View style={[sim.road, { left: "55%", top: 0, bottom: 0, width: 6 }]} />
        <View style={[sim.building, { top: 18, left: 10, width: 44, height: 32 }]} />
        <View style={[sim.building, { top: 18, right: 10, width: 38, height: 28 }]} />
        <View style={[sim.building, { bottom: 50, left: 8, width: 36, height: 26 }]} />
        <View style={[sim.pricePin, { top: 28, left: 30 }]}><Text style={sim.priceTxt}>$4</Text></View>
        <View style={[sim.pricePin, { top: 55, right: 28 }]}><Text style={sim.priceTxt}>$3</Text></View>
        <View style={sim.userDot} />
        <View style={sim.mapHeader}><Text style={sim.mapHeaderTitle}>ParkPass</Text></View>
        <View style={sim.mapBottom}>
          <Animated.View style={[sim.leaveBtn, { transform: [{ scale: btnScale }] }]}>
            <Text style={sim.leaveBtnTxt}>⬡  I'm leaving my spot</Text>
            <TapRipple x={W / 2 - 8} y={22} trigger={tap} />
          </Animated.View>
        </View>
      </View>
    </Phone>
  );
}

function SimCamera() {
  const tap = useRef(new Animated.Value(0)).current;
  const flash = useRef(new Animated.Value(0)).current;
  const thumb = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.delay(1200),
      Animated.timing(tap, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(tap, { toValue: 0, duration: 100, useNativeDriver: true }),
      Animated.timing(flash, { toValue: 1, duration: 120, useNativeDriver: true }),
      Animated.timing(flash, { toValue: 0, duration: 300, useNativeDriver: true }),
      Animated.timing(thumb, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.delay(1200),
      Animated.timing(thumb, { toValue: 0, duration: 200, useNativeDriver: true }),
      Animated.delay(200),
    ])).start();
  }, []);
  return (
    <Phone>
      <View style={[sim.screen, { backgroundColor: "#111827", alignItems: "center", justifyContent: "center" }]}>
        {/* Viewfinder */}
        <View style={sim.viewfinder}>
          <View style={[sim.corner, { top: 0, left: 0 }]} />
          <View style={[sim.corner, { top: 0, right: 0, transform: [{ scaleX: -1 }] }]} />
          <View style={[sim.corner, { bottom: 0, left: 0, transform: [{ scaleY: -1 }] }]} />
          <View style={[sim.corner, { bottom: 0, right: 0, transform: [{ scaleX: -1 }, { scaleY: -1 }] }]} />
          <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 10 }}>Point at your spot</Text>
        </View>
        {/* Shutter */}
        <View style={sim.shutterRow}>
          <Animated.View style={[sim.thumbPreview, { opacity: thumb }]}>
            <Text style={{ fontSize: 8, color: "#9ca3af" }}>✓</Text>
          </Animated.View>
          <View style={sim.shutterRing}>
            <TapRipple x={20} y={20} trigger={tap} />
            <View style={sim.shutterInner} />
          </View>
          <View style={{ width: 36 }} />
        </View>
        {/* Flash */}
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFillObject, { backgroundColor: "#fff", opacity: flash }]} />
      </View>
    </Phone>
  );
}

function SimListingActive() {
  const p = useLoop(3200);
  const pulse = p.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 1.4, 1] });
  const pulseOpacity = p.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 0.3, 1] });
  return (
    <Phone height={240}>
      <View style={[sim.screen, { padding: 14, gap: 10 }]}>
        <View style={sim.activeListingCard}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 }}>
            <Animated.View style={[sim.pulseDot, { transform: [{ scale: pulse }], opacity: pulseOpacity }]} />
            <Text style={sim.activeListingLabel}>YOUR LISTING IS LIVE</Text>
          </View>
          <Text style={sim.confirmAddr}>📍 Oak St & 3rd Ave</Text>
          <View style={[sim.confirmRow, { marginTop: 4 }]}>
            <Text style={sim.confirmLabel}>Earning</Text>
            <Text style={[sim.confirmVal, { color: "#16a34a" }]}>🪙 2 tokens on swap</Text>
          </View>
          <View style={sim.confirmRow}>
            <Text style={sim.confirmLabel}>Visible to</Text>
            <Text style={sim.confirmVal}>Nearby drivers</Text>
          </View>
          <Text style={[sim.confirmLabel, { marginTop: 6, color: "#16a34a" }]}>Waiting for a driver…</Text>
        </View>
      </View>
    </Phone>
  );
}

function SimDriverReserved() {
  const p = useLoop(3600);
  const cardSlide = p.interpolate({ inputRange: [0, 0.25, 0.4, 0.95, 1], outputRange: [60, 60, 0, 0, 60] });
  const cardOpacity = p.interpolate({ inputRange: [0, 0.25, 0.4, 0.95, 1], outputRange: [0, 0, 1, 1, 0] });
  const waitOpacity = p.interpolate({ inputRange: [0, 0.3, 0.45, 1], outputRange: [1, 1, 0, 0] });
  return (
    <Phone height={240}>
      <View style={[sim.screen, { padding: 14, gap: 10 }]}>
        <Animated.View style={[sim.activeListingCard, { opacity: waitOpacity }]}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 }}>
            <View style={sim.pulseDot} />
            <Text style={sim.activeListingLabel}>WAITING FOR DRIVER</Text>
          </View>
          <Text style={sim.confirmAddr}>📍 Oak St & 3rd Ave</Text>
        </Animated.View>
        <Animated.View style={[sim.driverCard, { transform: [{ translateY: cardSlide }], opacity: cardOpacity }]}>
          <View style={sim.driverAvatar}><Text style={sim.driverAvatarTxt}>A</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={sim.driverAssigned}>DRIVER RESERVED YOUR SPOT</Text>
            <Text style={sim.driverName}>Alex M.</Text>
            <Text style={sim.driverCar}>🚘 Toyota Camry · 5 min away</Text>
          </View>
        </Animated.View>
      </View>
    </Phone>
  );
}

function SimLeaverConfirm() {
  const tap = useRef(new Animated.Value(0)).current;
  const success = useRef(new Animated.Value(0)).current;
  const colorAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.delay(1300),
      Animated.timing(tap, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(tap, { toValue: 0, duration: 100, useNativeDriver: true }),
      Animated.parallel([
        Animated.timing(success, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.timing(colorAnim, { toValue: 1, duration: 500, useNativeDriver: false }),
      ]),
      Animated.delay(1500),
      Animated.parallel([
        Animated.timing(success, { toValue: 0, duration: 300, useNativeDriver: true }),
        Animated.timing(colorAnim, { toValue: 0, duration: 300, useNativeDriver: false }),
      ]),
      Animated.delay(100),
    ])).start();
  }, []);
  const btnBg = colorAnim.interpolate({ inputRange: [0, 1], outputRange: ["#1E3DB8", "#16a34a"] });
  const tokensY = success.interpolate({ inputRange: [0, 1], outputRange: [10, 0] });
  const labelOpacity = success.interpolate({ inputRange: [0, 0.4, 1], outputRange: [1, 1, 0] });
  const completedOpacity = success.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0, 0, 1] });
  return (
    <Phone height={240}>
      <View style={[sim.screen, { padding: 14, gap: 10 }]}>
        <View style={sim.arrivedBanner}>
          <Text style={sim.arrivedBannerTxt}>🚗  Driver has arrived at your spot!</Text>
        </View>
        <Animated.View style={[sim.reserveBtn, { backgroundColor: btnBg }]}>
          <View style={{ alignItems: "center" }}>
            <Animated.View style={{ opacity: labelOpacity }}>
              <Text style={sim.reserveBtnTxt}>I've Vacated  ✓</Text>
            </Animated.View>
            <Animated.View style={{ position: "absolute", opacity: completedOpacity }}>
              <Text style={sim.reserveBtnTxt}>Swap Complete!</Text>
            </Animated.View>
          </View>
          <TapRipple x={W / 2 - 14} y={22} trigger={tap} />
        </Animated.View>
        <Animated.View style={[sim.tokensEarned, { opacity: success, transform: [{ translateY: tokensY }] }]}>
          <Text style={sim.tokensEarnedTxt}>🪙 +2 tokens added to your balance!</Text>
        </Animated.View>
      </View>
    </Phone>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// STEP DATA
// ═══════════════════════════════════════════════════════════════════════

const DRIVER_STEPS = [
  { title: "Browse the Map", desc: "Open the Explorer tab. Spots appear as price pins near you. Green = cheaper spots.", Sim: SimBrowseMap },
  { title: "Tap a Spot Pin", desc: "Tap any pin to view the spot details — price in tokens, leaver rating, and how soon they're leaving.", Sim: SimSpotDetail },
  { title: "Reserve It", desc: "Confirm the reservation. Tokens are deducted instantly and the spot is locked for you.", Sim: SimReserve },
  { title: "Navigate There", desc: "Head to the spot. The reservation screen shows the address and how far away you are.", Sim: SimNavigate },
  { title: "Tap 'I've Arrived'", desc: "Once you're at the spot, tap the button. This notifies the leaver that you're there.", Sim: SimArrived },
  { title: "Complete the Swap", desc: "The leaver confirms they've vacated. The spot is yours! Rate them to help the community.", Sim: SimComplete },
];

const LEAVER_STEPS = [
  { title: "Tap 'I'm Leaving'", desc: "Tap the blue button at the bottom of the map screen. This starts your listing flow.", Sim: SimLeaveButton },
  { title: "Photo Your Spot", desc: "Take a clear photo of your spot so the driver can find you easily.", Sim: SimCamera },
  { title: "Listing Goes Live", desc: "Your spot instantly appears on the map for nearby drivers. A green pulse means it's active.", Sim: SimListingActive },
  { title: "Driver Reserves", desc: "When a driver books your spot you get a notification with their name and ETA.", Sim: SimDriverReserved },
  { title: "Driver is Coming", desc: "See their name, car, and how far away they are. Tap Chat to coordinate if needed.", Sim: SimDriverReserved },
  { title: "Confirm the Swap", desc: "When the driver arrives, vacate and tap 'I've Vacated'. Tokens land in your balance!", Sim: SimLeaverConfirm },
];

// ═══════════════════════════════════════════════════════════════════════
// MAIN SCREEN
// ═══════════════════════════════════════════════════════════════════════

function StepCard({ step, index }: { step: (typeof DRIVER_STEPS)[0]; index: number }) {
  const { Sim } = step;
  return (
    <View style={styles.stepCard}>
      <View style={styles.stepLeft}>
        <View style={styles.stepNumCircle}><Text style={styles.stepNum}>{index + 1}</Text></View>
        {index < 5 && <View style={styles.stepConnector} />}
      </View>
      <View style={styles.stepRight}>
        <Text style={styles.stepTitle}>{step.title}</Text>
        <Text style={styles.stepDesc}>{step.desc}</Text>
        <Sim />
      </View>
    </View>
  );
}

export default function HelpScreen({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [tab, setTab] = useState<"driver" | "leaver">("driver");
  const steps = tab === "driver" ? DRIVER_STEPS : LEAVER_STEPS;

  return (
    <Modal visible={visible} animationType="slide" statusBarTranslucent>
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>How It Works</Text>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeBtnText}>✕</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.tabBar}>
          <TouchableOpacity style={[styles.tabBtn, tab === "driver" && styles.tabBtnActive]} onPress={() => setTab("driver")}>
            <Text style={[styles.tabBtnText, tab === "driver" && styles.tabBtnTextActive]}>🚗  I'm a Driver</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tabBtn, tab === "leaver" && styles.tabBtnActive]} onPress={() => setTab("leaver")}>
            <Text style={[styles.tabBtnText, tab === "leaver" && styles.tabBtnTextActive]}>🅿️  I'm a Leaver</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <Text style={styles.intro}>
            {tab === "driver"
              ? "Find a spot being vacated nearby, reserve it with tokens, and navigate there."
              : "Going somewhere? List your spot, wait for a driver, confirm the swap, earn tokens."}
          </Text>
          {steps.map((step, i) => <StepCard key={`${tab}-${i}`} step={step} index={i} />)}
          <View style={styles.tipCard}>
            <Text style={styles.tipIcon}>{tab === "driver" ? "💡" : "💰"}</Text>
            <Text style={styles.tipText}>
              {tab === "driver"
                ? "You start with 100 free tokens. Spots typically cost 1–5 tokens."
                : "Build your rating to attract more drivers. Higher rated leavers get reserved faster."}
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

// ── Simulation styles ─────────────────────────────────────────────────
const sim = StyleSheet.create({
  phone: {
    width: "100%", borderRadius: 14, overflow: "hidden",
    borderWidth: 2, borderColor: "#1f2937", backgroundColor: "#1f2937",
    marginTop: 12, shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 8, elevation: 6,
  },
  statusBar: {
    height: 20, backgroundColor: "#111827", flexDirection: "row",
    alignItems: "center", justifyContent: "space-between", paddingHorizontal: 10,
  },
  statusTime: { color: "#fff", fontSize: 9, fontWeight: "700" },
  statusRight: { flexDirection: "row", gap: 4 },
  statusIcon: { color: "#fff", fontSize: 7, letterSpacing: -1 },
  screen: { flex: 1, backgroundColor: "#EEF1F8" },
  screenTitle: { fontSize: 14, fontWeight: "800", color: "#111827" },
  mapBg: { flex: 1, backgroundColor: "#e5e7eb", position: "relative" },
  road: { position: "absolute", backgroundColor: "#f9fafb" },
  building: { position: "absolute", backgroundColor: "#d1d5db", borderRadius: 2 },
  pricePin: {
    position: "absolute", backgroundColor: "#1E3DB8", borderRadius: 8,
    paddingHorizontal: 6, paddingVertical: 2,
    shadowColor: "#1E3DB8", shadowOpacity: 0.4, shadowRadius: 4, elevation: 3,
  },
  pricePinGreen: { backgroundColor: "#059669" },
  priceTxt: { color: "#fff", fontSize: 9, fontWeight: "800" },
  userDot: {
    position: "absolute", bottom: 56, right: 60,
    width: 12, height: 12, borderRadius: 6,
    backgroundColor: "#1E3DB8", borderWidth: 2.5, borderColor: "#fff",
    shadowColor: "#1E3DB8", shadowOpacity: 0.5, shadowRadius: 4, elevation: 4,
  },
  mapHeader: {
    position: "absolute", top: 0, left: 0, right: 0,
    backgroundColor: "#fff", paddingHorizontal: 14, paddingVertical: 7,
    flexDirection: "row", alignItems: "center", justifyContent: "center",
  },
  mapHeaderTitle: { fontSize: 12, fontWeight: "800", color: "#1E3DB8" },
  mapBottom: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    padding: 8,
  },
  leaveBtn: {
    backgroundColor: "#1E3DB8", borderRadius: 10, paddingVertical: 9,
    alignItems: "center", position: "relative",
    shadowColor: "#1E3DB8", shadowOpacity: 0.35, shadowRadius: 6, elevation: 4,
  },
  leaveBtnTxt: { color: "#fff", fontSize: 10, fontWeight: "700" },
  sheet: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    backgroundColor: "#fff", borderTopLeftRadius: 16, borderTopRightRadius: 16,
    padding: 14, paddingTop: 8,
  },
  sheetHandle: { width: 32, height: 3, borderRadius: 2, backgroundColor: "#e5e7eb", alignSelf: "center", marginBottom: 10 },
  sheetAddr: { fontSize: 12, fontWeight: "800", color: "#111827", marginBottom: 6 },
  sheetRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  sheetBadge: { backgroundColor: "#dbeafe", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  sheetBadgeTxt: { fontSize: 9, fontWeight: "700", color: "#1E3DB8" },
  sheetSub: { fontSize: 9, color: "#6b7280" },
  reserveBtn: {
    backgroundColor: "#1E3DB8", borderRadius: 10, paddingVertical: 12,
    alignItems: "center", overflow: "hidden",
  },
  reserveBtnTxt: { color: "#fff", fontSize: 11, fontWeight: "700" },
  confirmCard: {
    backgroundColor: "#fff", borderRadius: 12, padding: 12,
    shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  confirmAddr: { fontSize: 12, fontWeight: "700", color: "#111827", marginBottom: 4 },
  confirmRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 4 },
  confirmLabel: { fontSize: 10, color: "#6b7280" },
  confirmVal: { fontSize: 10, fontWeight: "700", color: "#111827" },
  successBanner: {
    backgroundColor: "#dcfce7", borderRadius: 10, paddingVertical: 10, alignItems: "center",
  },
  successTxt: { fontSize: 11, fontWeight: "700", color: "#16a34a" },
  successCircle: {
    width: 52, height: 52, borderRadius: 26, backgroundColor: "#16a34a",
    alignItems: "center", justifyContent: "center",
  },
  successCheck: { color: "#fff", fontSize: 24, fontWeight: "800" },
  star: { fontSize: 22, color: "#f59e0b" },
  destPin: {
    position: "absolute", width: 22, height: 22, borderRadius: 11,
    backgroundColor: "#059669", alignItems: "center", justifyContent: "center",
  },
  destPinTxt: { color: "#fff", fontSize: 10, fontWeight: "800" },
  carDot: { position: "absolute", top: "47%", left: 0 },
  etaChip: {
    position: "absolute", top: 30, alignSelf: "center",
    backgroundColor: "rgba(0,0,0,0.65)", borderRadius: 12,
    paddingHorizontal: 10, paddingVertical: 5, flexDirection: "row", left: "20%",
  },
  etaTxt: { color: "#fff", fontSize: 9, fontWeight: "700" },
  viewfinder: {
    width: 130, height: 90, borderRadius: 8, alignItems: "center",
    justifyContent: "center", marginBottom: 16,
  },
  corner: {
    position: "absolute", width: 14, height: 14,
    borderTopWidth: 2, borderLeftWidth: 2, borderColor: "rgba(255,255,255,0.7)",
  },
  shutterRow: { flexDirection: "row", alignItems: "center", gap: 20 },
  shutterRing: {
    width: 44, height: 44, borderRadius: 22,
    borderWidth: 3, borderColor: "rgba(255,255,255,0.7)",
    alignItems: "center", justifyContent: "center",
  },
  shutterInner: { width: 32, height: 32, borderRadius: 16, backgroundColor: "#fff" },
  thumbPreview: {
    width: 36, height: 36, borderRadius: 6,
    backgroundColor: "#374151", alignItems: "center", justifyContent: "center",
    borderWidth: 1.5, borderColor: "#fff",
  },
  activeListingCard: {
    backgroundColor: "#fff", borderRadius: 14, padding: 14, borderWidth: 1.5, borderColor: "#bbf7d0",
  },
  activeListingLabel: { fontSize: 9, fontWeight: "800", color: "#16a34a", letterSpacing: 0.8 },
  pulseDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#22c55e" },
  driverCard: {
    backgroundColor: "#1E3DB8", borderRadius: 14, padding: 14,
    flexDirection: "row", alignItems: "center", gap: 12,
  },
  driverAvatar: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center", justifyContent: "center",
  },
  driverAvatarTxt: { color: "#fff", fontSize: 18, fontWeight: "800" },
  driverAssigned: { fontSize: 8, fontWeight: "800", color: "rgba(255,255,255,0.65)", letterSpacing: 0.8, marginBottom: 2 },
  driverName: { fontSize: 13, fontWeight: "800", color: "#fff", marginBottom: 2 },
  driverCar: { fontSize: 9, color: "rgba(255,255,255,0.8)" },
  arrivedBanner: {
    backgroundColor: "#fef3c7", borderRadius: 10, padding: 10, borderWidth: 1, borderColor: "#fde68a",
  },
  arrivedBannerTxt: { fontSize: 10, fontWeight: "600", color: "#92400e", textAlign: "center" },
  tokensEarned: {
    backgroundColor: "#dcfce7", borderRadius: 10, paddingVertical: 10, alignItems: "center",
  },
  tokensEarnedTxt: { fontSize: 11, fontWeight: "700", color: "#16a34a" },
});

// ── Screen styles ─────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#EEF1F8" },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingVertical: 14, backgroundColor: "#fff",
    borderBottomWidth: 1, borderBottomColor: "#f3f4f6",
  },
  headerTitle: { fontSize: 20, fontWeight: "800", color: "#1E3DB8" },
  closeBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: "#f3f4f6", alignItems: "center", justifyContent: "center" },
  closeBtnText: { fontSize: 15, color: "#374151", fontWeight: "700" },
  tabBar: {
    flexDirection: "row", backgroundColor: "#fff", padding: 6, gap: 6,
    borderBottomWidth: 1, borderBottomColor: "#f3f4f6",
  },
  tabBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: "center", backgroundColor: "#f3f4f6" },
  tabBtnActive: { backgroundColor: "#1E3DB8" },
  tabBtnText: { fontSize: 13, fontWeight: "700", color: "#6b7280" },
  tabBtnTextActive: { color: "#fff" },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 40, paddingTop: 16 },
  intro: {
    fontSize: 13, color: "#6b7280", lineHeight: 20, marginBottom: 20,
    backgroundColor: "#fff", borderRadius: 12, padding: 14,
  },
  stepCard: { flexDirection: "row", marginBottom: 4 },
  stepLeft: { alignItems: "center", marginRight: 12, paddingTop: 2 },
  stepNumCircle: {
    width: 28, height: 28, borderRadius: 14, backgroundColor: "#1E3DB8",
    alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  stepNum: { color: "#fff", fontSize: 12, fontWeight: "800" },
  stepConnector: { flex: 1, width: 2, backgroundColor: "#e5e7eb", marginTop: 4, marginBottom: -14 },
  stepRight: {
    flex: 1, backgroundColor: "#fff", borderRadius: 14, padding: 14, marginBottom: 12,
    shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 6, elevation: 2,
  },
  stepTitle: { fontSize: 14, fontWeight: "800", color: "#111827", marginBottom: 4 },
  stepDesc: { fontSize: 12, color: "#6b7280", lineHeight: 18 },
  tipCard: {
    flexDirection: "row", backgroundColor: "#FEF3C7", borderRadius: 14,
    padding: 14, gap: 10, alignItems: "flex-start", marginTop: 4,
  },
  tipIcon: { fontSize: 20 },
  tipText: { flex: 1, fontSize: 13, color: "#78350F", lineHeight: 19 },
});
