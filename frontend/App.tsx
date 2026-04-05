import React, { useEffect, useState, useRef } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Alert } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import * as Notifications from "expo-notifications";
import { useAuthStore } from "./src/store/authStore";
import {
  useSpotWebSocket,
  setLeaverAlertHandler,
  setReservationCancelledHandler,
  setDriverArrivedHandler,
  setChatNotifyHandler,
} from "./src/hooks/useWebSocket";
import { reservationsApi } from "./src/api/reservations";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});
import AuthScreen from "./src/screens/AuthScreen";
import MapScreen from "./src/screens/MapScreen";
import CreateSpotScreen from "./src/screens/CreateSpotScreen";
import SpotDetailScreen from "./src/screens/SpotDetailScreen";
import ReservationScreen from "./src/screens/ReservationScreen";
import ProfileScreen from "./src/screens/ProfileScreen";
import ReservationsListScreen from "./src/screens/ReservationsListScreen";
import { LeaverAlertModal } from "./src/components/LeaverAlertModal";
import { DriverConfirmModal } from "./src/components/DriverConfirmModal";

const Stack = createStackNavigator();

// ── Custom bottom tab bar ──────────────────────────────────────────────
type Tab = "explorer" | "reservations" | "profile";

function BottomTabBar({ active, onChange }: { active: Tab; onChange: (t: Tab) => void }) {
  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: "explorer", label: "EXPLORER", icon: "🗺" },
    { key: "reservations", label: "RESERVATION", icon: "🅿" },
    { key: "profile", label: "PROFILE", icon: "👤" },
  ];
  return (
    <View style={tabStyles.bar}>
      {tabs.map((t) => (
        <TouchableOpacity key={t.key} style={tabStyles.tab} onPress={() => onChange(t.key)}>
          <Text style={[tabStyles.icon, active === t.key && tabStyles.iconActive]}>{t.icon}</Text>
          <Text style={[tabStyles.label, active === t.key && tabStyles.labelActive]}>{t.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const tabStyles = StyleSheet.create({
  bar: {
    flexDirection: "row", backgroundColor: "#fff",
    borderTopWidth: 1, borderTopColor: "#F3F4F6",
    paddingBottom: 24, paddingTop: 10,
  },
  tab: { flex: 1, alignItems: "center" },
  icon: { fontSize: 22, color: "#9CA3AF", marginBottom: 2 },
  iconActive: { color: "#1E3DB8" },
  label: { fontSize: 9, fontWeight: "700", color: "#9CA3AF", letterSpacing: 0.5 },
  labelActive: { color: "#1E3DB8" },
});

// ── Types ──────────────────────────────────────────────────────────────
type ReservationParams = {
  reservationId: string;
  clientSecret: string | null;
  spotAddress: string;
  spotLat: number;
  spotLng: number;
  leaverId: string;
  leaverName?: string;
  leaverRating?: number;
  tokenCost?: number;
  driverBalance?: number;
};

type LeaverAlert = {
  visible: boolean;
  spotId?: string;
  reservationId?: string;
  spotAddress?: string;
  driverName?: string;
  driverCarMake?: string;
  driverCarModel?: string;
  distanceKm?: number;
};

// ── MapScreen wrapper that handles pending reservation navigation ──────
function MapScreenWrapper({
  pendingNav, onPendingNavConsumed, onSpotPress, onLeaveSpot, onGoToReservations, onNavigateReservation,
}: {
  pendingNav: ReservationParams | null;
  onPendingNavConsumed: () => void;
  onSpotPress: (id: string) => void;
  onLeaveSpot: () => void;
  onGoToReservations: () => void;
  onNavigateReservation: (p: ReservationParams) => void;
}) {
  useEffect(() => {
    if (pendingNav) {
      onPendingNavConsumed();
      onNavigateReservation(pendingNav);
    }
  }, [pendingNav]);
  return <MapScreen onSpotPress={onSpotPress} onLeaveSpot={onLeaveSpot} onGoToReservations={onGoToReservations} />;
}

// ── Main app with tabs ─────────────────────────────────────────────────
function MainApp() {
  const [activeTab, setActiveTab] = useState<Tab>("explorer");
  useSpotWebSocket();

  const [pendingNav, setPendingNav] = useState<ReservationParams | null>(null);
  const [leaverAlert, setLeaverAlert] = useState<LeaverAlert>({ visible: false });
  const [driverConfirm, setDriverConfirm] = useState<{ visible: boolean; params?: ReservationParams }>({ visible: false });
  const [reservationsRefreshKey, setReservationsRefreshKey] = useState(0);

  const activeTabRef = useRef<Tab>("explorer");
  activeTabRef.current = activeTab;

  // Request notification permissions + register chat notify handler
  useEffect(() => {
    Notifications.requestPermissionsAsync();
    setChatNotifyHandler((data) => {
      Notifications.scheduleNotificationAsync({
        content: {
          title: `💬 ${data.sender_name}`,
          body: data.content,
          sound: true,
        },
        trigger: null,
      });
    });
    return () => setChatNotifyHandler(null);
  }, []);

  useEffect(() => {
    // Leaver gets alerted when driver reserves their spot
    setLeaverAlertHandler((data) => {
      const currentUserId = useAuthStore.getState().user?.id;
      if (data.leaver_id && currentUserId && data.leaver_id === currentUserId) {
        setLeaverAlert({
          visible: true,
          spotId: data.spot_id,
          reservationId: data.reservation_id,
          spotAddress: data.spot_address,
          driverName: data.driver_name,
          driverCarMake: data.driver_car_make,
          driverCarModel: data.driver_car_model,
          distanceKm: data.distance_km,
        });
      }
    });

    // Leaver gets notified when driver cancels
    setReservationCancelledHandler((data) => {
      const currentUserId = useAuthStore.getState().user?.id;
      if (data.leaver_id !== currentUserId) return;
      if (activeTabRef.current === "reservations") {
        // Already on the tab — tell ReservationsListScreen to refresh
        setReservationsRefreshKey((k) => k + 1);
      } else {
        Alert.alert(
          "Reservation Cancelled",
          "The driver has cancelled. Your spot is now available again.",
          [{
            text: "View Listing",
            onPress: () => setActiveTab("reservations"),
          }, { text: "OK" }],
        );
      }
    });

    // Driver arrived — notify leaver regardless of which tab they're on
    setDriverArrivedHandler((data) => {
      const currentUserId = useAuthStore.getState().user?.id;
      if (data.leaver_id !== currentUserId) return;

      // Fire a push notification too
      Notifications.scheduleNotificationAsync({
        content: {
          title: "🚗 Driver Has Arrived!",
          body: `${data.driver_name} is at your spot. Tap to confirm the swap.`,
          sound: true,
        },
        trigger: null,
      });

      Alert.alert(
        "🚗 Driver Has Arrived!",
        `${data.driver_name} is at your spot. Please vacate and confirm the swap.`,
        [
          { text: "Not yet" },
          {
            text: "I've vacated ✓",
            onPress: async () => {
              try {
                await reservationsApi.leaverConfirm(data.reservation_id);
                // If on reservations tab, switch to it to refresh
                setActiveTab("reservations");
              } catch (e: any) {
                Alert.alert("Error", e.response?.data?.detail || "Failed to confirm");
              }
            },
          },
        ],
        { cancelable: false },
      );
    });

    return () => {
      setLeaverAlertHandler(null);
      setReservationCancelledHandler(null);
      setDriverArrivedHandler(null);
    };
  }, []);

  return (
    <View style={{ flex: 1 }}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {activeTab === "explorer" && (
          <>
            <Stack.Screen name="Map">
              {(props) => (
                <MapScreenWrapper
                  pendingNav={pendingNav}
                  onPendingNavConsumed={() => setPendingNav(null)}
                  onSpotPress={(id) => props.navigation.navigate("SpotDetail", { spotId: id })}
                  onLeaveSpot={() => props.navigation.navigate("CreateSpot")}
                  onGoToReservations={() => setActiveTab("reservations")}
                  onNavigateReservation={(p) => props.navigation.navigate("Reservation", p)}
                />
              )}
            </Stack.Screen>
            <Stack.Screen name="CreateSpot">
              {(props) => (
                <CreateSpotScreen
                  onCreated={() => props.navigation.goBack()}
                  onCancel={() => props.navigation.goBack()}
                />
              )}
            </Stack.Screen>
            <Stack.Screen name="SpotDetail">
              {(props) => (
                <SpotDetailScreen
                  spotId={props.route.params?.spotId}
                  onReserved={(p) => {
                    props.navigation.goBack();
                    setDriverConfirm({ visible: true, params: p });
                  }}
                  onBack={() => props.navigation.goBack()}
                />
              )}
            </Stack.Screen>
            <Stack.Screen name="Reservation">
              {(props) => (
                <ReservationScreen
                  reservationId={props.route.params?.reservationId}
                  clientSecret={props.route.params?.clientSecret}
                  spotAddress={props.route.params?.spotAddress || ""}
                  spotLat={props.route.params?.spotLat || 0}
                  spotLng={props.route.params?.spotLng || 0}
                  leaverId={props.route.params?.leaverId || ""}
                  leaverName={props.route.params?.leaverName}
                  leaverRating={props.route.params?.leaverRating}
                  tokenCost={props.route.params?.tokenCost}
                  driverBalance={props.route.params?.driverBalance}
                  onCompleted={() => { props.navigation.popToTop(); setActiveTab("explorer"); }}
                  onBack={() => props.navigation.goBack()}
                />
              )}
            </Stack.Screen>
          </>
        )}
        {activeTab === "reservations" && (
          <Stack.Screen name="ReservationsTab">
            {() => <ReservationsListScreen onGoToMap={() => setActiveTab("explorer")} refreshKey={reservationsRefreshKey} />}
          </Stack.Screen>
        )}
        {activeTab === "profile" && (
          <Stack.Screen name="ProfileTab" component={ProfileScreen} />
        )}
      </Stack.Navigator>

      <BottomTabBar active={activeTab} onChange={setActiveTab} />

      {/* ── Driver confirmation modal (shown right after reserving) ── */}
      <DriverConfirmModal
        visible={driverConfirm.visible}
        spotAddress={driverConfirm.params?.spotAddress}
        leaverName={driverConfirm.params?.leaverName}
        leaverRating={driverConfirm.params?.leaverRating}
        tokenCost={driverConfirm.params?.tokenCost}
        driverBalance={driverConfirm.params?.driverBalance}
        onDismiss={() => setDriverConfirm({ visible: false })}
        onGoToReservation={() => {
          const p = driverConfirm.params!;
          setDriverConfirm({ visible: false });
          setPendingNav(p);
          setActiveTab("explorer");
        }}
      />

      {/* ── Leaver alert modal (partial slide-up) ── */}
      <LeaverAlertModal
        visible={leaverAlert.visible}
        driverName={leaverAlert.driverName}
        distanceKm={leaverAlert.distanceKm}
        onDismiss={() => setLeaverAlert({ visible: false })}
        onViewDetails={() => {
          setLeaverAlert({ visible: false });
          setActiveTab("reservations"); // go to reservation tab — it shows the leaver view inline
        }}
      />
    </View>
  );
}


// ── Root ───────────────────────────────────────────────────────────────
export default function App() {
  const { user, loadFromStorage } = useAuthStore();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    loadFromStorage().finally(() => setReady(true));
  }, []);

  if (!ready) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <NavigationContainer>
          {user ? (
            <MainApp />
          ) : (
            <Stack.Navigator screenOptions={{ headerShown: false }}>
              <Stack.Screen name="Auth">
                {() => <AuthScreen onAuthenticated={() => {}} />}
              </Stack.Screen>
            </Stack.Navigator>
          )}
        </NavigationContainer>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
