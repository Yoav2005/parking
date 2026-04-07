import React, { useEffect, useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Alert, ActivityIndicator, SafeAreaView, Modal, FlatList, TextInput, Image,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useAuthStore } from "../store/authStore";
import { reservationsApi } from "../api/reservations";
import { apiClient } from "../api/client";
import { RatingModal } from "../components/RatingModal";
import { CAR_MAKES, getModelsForMake } from "../constants/cars";
import { useAddress } from "../hooks/useAddress";

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: "#DBEAFE", COMPLETED: "#D1FAE5", CANCELLED: "#FEE2E2",
  REFUNDED: "#FEF3C7", PENDING: "#F3F4F6",
};
const STATUS_TEXT: Record<string, string> = {
  ACTIVE: "#1E3DB8", COMPLETED: "#065F46", CANCELLED: "#991B1B",
  REFUNDED: "#92400E", PENDING: "#374151",
};

// ── Generic picker modal ───────────────────────────────────────────────
function PickerModal({
  visible, title, items, onSelect, onClose,
}: {
  visible: boolean; title: string; items: string[];
  onSelect: (v: string) => void; onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent>
      <View style={picker.overlay}>
        <TouchableOpacity style={picker.backdrop} activeOpacity={1} onPress={onClose} />
        <View style={picker.sheet}>
          <View style={picker.handle} />
          <View style={picker.headerRow}>
            <Text style={picker.title}>{title}</Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={picker.close}>✕</Text>
            </TouchableOpacity>
          </View>
          <FlatList
            data={items}
            keyExtractor={(i) => i}
            contentContainerStyle={{ paddingBottom: 32 }}
            renderItem={({ item }) => (
              <TouchableOpacity style={picker.item} onPress={() => { onSelect(item); onClose(); }}>
                <Text style={picker.itemText}>{item}</Text>
              </TouchableOpacity>
            )}
          />
        </View>
      </View>
    </Modal>
  );
}

const picker = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "flex-end" },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.4)" },
  sheet: {
    backgroundColor: "#fff", borderTopLeftRadius: 20, borderTopRightRadius: 20,
    maxHeight: "70%",
  },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: "#E5E7EB", alignSelf: "center", marginTop: 12, marginBottom: 4 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingVertical: 12 },
  title: { fontSize: 17, fontWeight: "800", color: "#111827" },
  close: { fontSize: 18, color: "#9CA3AF", fontWeight: "700" },
  item: { paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#F3F4F6" },
  itemText: { fontSize: 16, color: "#111827" },
});

// ── History item with address resolution ──────────────────────────────
function HistoryItem({ item, onRate, formatDate }: {
  item: any;
  onRate: (reservationId: string, ratedId: string) => void;
  formatDate: (iso: string) => string;
}) {
  const address = useAddress(item.spot_address);
  const isDriver = item.role === "driver";
  const otherName = isDriver ? item.leaver_name : item.driver_name;

  return (
    <View style={[styles.historyCard, isDriver ? styles.historyCardDriver : styles.historyCardLeaver]}>
      <View style={styles.historyCardLeft}>
        <View style={[styles.historyIcon, isDriver ? styles.historyIconDriver : styles.historyIconLeaver]}>
          <Text style={styles.historyIconText}>{isDriver ? "🚗" : "🅿️"}</Text>
        </View>
        <View style={styles.historyInfo}>
          <View style={styles.historyRoleRow}>
            <View style={[styles.roleBadge, isDriver ? styles.roleBadgeDriver : styles.roleBadgeLeaver]}>
              <Text style={[styles.roleText, isDriver ? styles.roleTextDriver : styles.roleTextLeaver]}>
                {isDriver ? "DRIVER" : "LEAVER"}
              </Text>
            </View>
          </View>
          <Text style={styles.historyAddress} numberOfLines={1}>
            {address || "Parking spot"}
          </Text>
          {otherName && (
            <Text style={styles.historyOther}>
              {isDriver ? `Leaver: ${otherName}` : `Driver: ${otherName}`}
            </Text>
          )}
          <Text style={styles.historyDate}>{formatDate(item.created_at)}</Text>
        </View>
      </View>
      <View style={styles.historyCardRight}>
        <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[item.status] ?? "#F3F4F6" }]}>
          <Text style={[styles.statusText, { color: STATUS_TEXT[item.status] ?? "#374151" }]}>
            {item.status}
          </Text>
        </View>
        {item.status === "COMPLETED" && item.leaver_id && isDriver && (
          <TouchableOpacity
            style={styles.rateBtn}
            onPress={() => onRate(item.id, item.leaver_id)}
          >
            <Text style={styles.rateBtnText}>★ Rate</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

// ── Main screen ────────────────────────────────────────────────────────
export default function ProfileScreen() {
  const { user, logout, updateProfile, refreshUser } = useAuthStore();
  const [history, setHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [ratingTarget, setRatingTarget] = useState<{ reservationId: string; ratedId: string } | null>(null);

  // Edit profile modal
  const [editVisible, setEditVisible] = useState(false);
  const [editName, setEditName] = useState("");
  const [editPhotoUri, setEditPhotoUri] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);

  // Car picker state
  const [carMake, setCarMake] = useState(user?.car_make ?? "");
  const [carModel, setCarModel] = useState(user?.car_model ?? "");
  const [showMakePicker, setShowMakePicker] = useState(false);
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [savingCar, setSavingCar] = useState(false);

  const carChanged = carMake !== (user?.car_make ?? "") || carModel !== (user?.car_model ?? "");

  useEffect(() => {
    refreshUser();
    reservationsApi.getAll()
      .then(({ data }) => {
        const all: any[] = data.data ?? [];
        setHistory(all.filter((r) => r.status !== "ACTIVE"));
      })
      .catch(() => {})
      .finally(() => setLoadingHistory(false));
  }, []);

  const openEditModal = () => {
    setEditName(user?.full_name ?? "");
    setEditPhotoUri(null);
    setEditVisible(true);
  };

  const pickPhoto = () => {
    Alert.alert("Profile Photo", "Choose a source", [
      {
        text: "Take Photo",
        onPress: async () => {
          const { status } = await ImagePicker.requestCameraPermissionsAsync();
          if (status !== "granted") {
            Alert.alert("Permission needed", "Allow camera access to take a photo.");
            return;
          }
          const result = await ImagePicker.launchCameraAsync({
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.7,
          });
          if (!result.canceled) setEditPhotoUri(result.assets[0].uri);
        },
      },
      {
        text: "Choose from Library",
        onPress: async () => {
          const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (status !== "granted") {
            Alert.alert("Permission needed", "Allow photo library access to change your profile picture.");
            return;
          }
          const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.7,
          });
          if (!result.canceled) setEditPhotoUri(result.assets[0].uri);
        },
      },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const handleSaveProfile = async () => {
    if (!editName.trim()) { Alert.alert("Error", "Name cannot be empty"); return; }
    setSavingProfile(true);
    try {
      let photoUrl = user?.profile_photo_url ?? null;

      if (editPhotoUri) {
        const formData = new FormData();
        formData.append("file", {
          uri: editPhotoUri,
          type: "image/jpeg",
          name: "profile.jpg",
        } as any);
        const { data } = await apiClient.post("/upload", formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        photoUrl = data.data.url;
      }

      await updateProfile({
        full_name: editName.trim(),
        profile_photo_url: photoUrl ?? undefined,
      } as any);
      setEditVisible(false);
    } catch {
      Alert.alert("Error", "Failed to save profile");
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSaveCar = async () => {
    if (!carMake) { Alert.alert("Please select a car make"); return; }
    if (!carModel) { Alert.alert("Please select a car model"); return; }
    setSavingCar(true);
    try {
      await updateProfile({ car_make: carMake, car_model: carModel });
      Alert.alert("Saved", "Your car has been updated.");
    } catch {
      Alert.alert("Error", "Failed to save car info");
    } finally {
      setSavingCar(false);
    }
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString("en-US", {
      month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
    });

  const modelList = getModelsForMake(carMake);

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerBtn}>
          <Text style={styles.headerBtnText}>☰</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>ParkPass</Text>
        <TouchableOpacity style={styles.helpBtn}>
          <Text style={styles.helpBtnText}>?</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Profile hero */}
        <View style={styles.profileHero}>
          <TouchableOpacity style={styles.avatarWrap} onPress={openEditModal}>
            {user?.profile_photo_url ? (
              <Image source={{ uri: user.profile_photo_url }} style={styles.avatarImg} />
            ) : (
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{user?.full_name?.charAt(0).toUpperCase() ?? "U"}</Text>
              </View>
            )}
            <View style={styles.editPhotoBadge}>
              <Text style={styles.editPhotoIcon}>✎</Text>
            </View>
          </TouchableOpacity>
          <Text style={styles.profileName}>{user?.full_name}</Text>
          <Text style={styles.profileEmail}>{user?.email}</Text>
          <Text style={styles.profileRating}>
            ★ {user?.avg_rating?.toFixed(1) ?? "0.0"} · {user?.avg_rating ? "Verified" : "New user"}
          </Text>
          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.actionBtnOutline} onPress={openEditModal}>
              <Text style={styles.actionBtnOutlineText}>Edit Profile</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionBtnFilled}
              onPress={() => Alert.alert("Payouts", "Stripe payouts coming soon")}
            >
              <Text style={styles.actionBtnFilledText}>Stripe Payouts</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Token balance */}
        <View style={styles.tokenCard}>
          <Text style={styles.tokenTitle}>🪙 Dev Token Balance</Text>
          <Text style={styles.tokenBalance}>{user?.token_balance ?? 0} tokens</Text>
          <Text style={styles.tokenSub}>Each new account starts with 100 tokens</Text>
        </View>

        {/* ── Car info section ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>My Car</Text>
          <View style={styles.carCard}>
            <Text style={styles.carCardSub}>
              Shown to the leaver when you reserve their spot.
            </Text>

            {/* If car saved and not editing: show badge with edit button */}
            {user?.car_make && user?.car_model && !carChanged ? (
              <View style={styles.savedCarRow}>
                <View style={styles.currentCarBadge}>
                  <Text style={styles.currentCarIcon}>🚗</Text>
                  <Text style={styles.currentCarText}>{user.car_make} {user.car_model}</Text>
                </View>
                <TouchableOpacity
                  style={styles.editCarBtn}
                  onPress={() => { setCarMake(user.car_make ?? ""); setCarModel(user.car_model ?? ""); setShowMakePicker(true); }}
                >
                  <Text style={styles.editCarBtnText}>Edit</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                {/* Make picker */}
                <TouchableOpacity style={styles.pickerRow} onPress={() => setShowMakePicker(true)}>
                  <View style={styles.pickerLeft}>
                    <Text style={styles.pickerLabel}>MAKE</Text>
                    <Text style={[styles.pickerValue, !carMake && styles.pickerPlaceholder]}>
                      {carMake || "Select make"}
                    </Text>
                  </View>
                  <Text style={styles.pickerChevron}>›</Text>
                </TouchableOpacity>

                {/* Model picker */}
                <TouchableOpacity
                  style={[styles.pickerRow, styles.pickerRowLast]}
                  onPress={() => {
                    if (!carMake) { Alert.alert("Select a make first"); return; }
                    setShowModelPicker(true);
                  }}
                >
                  <View style={styles.pickerLeft}>
                    <Text style={styles.pickerLabel}>MODEL</Text>
                    <Text style={[styles.pickerValue, !carModel && styles.pickerPlaceholder]}>
                      {carModel || "Select model"}
                    </Text>
                  </View>
                  <Text style={styles.pickerChevron}>›</Text>
                </TouchableOpacity>

                {carChanged && (
                  <TouchableOpacity
                    style={styles.saveCarBtn}
                    onPress={handleSaveCar}
                    disabled={savingCar}
                  >
                    {savingCar
                      ? <ActivityIndicator color="#fff" size="small" />
                      : <Text style={styles.saveCarBtnText}>Save Car</Text>
                    }
                  </TouchableOpacity>
                )}
              </>
            )}
          </View>
        </View>

        {/* Reservation history */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Reservation History</Text>

          {loadingHistory ? (
            <ActivityIndicator color="#1E3DB8" style={{ marginTop: 16 }} />
          ) : history.length === 0 ? (
            <View style={styles.emptyHistory}>
              <Text style={styles.emptyHistoryText}>No past reservations yet.</Text>
            </View>
          ) : (
            history.map((item) => (
              <HistoryItem
                key={item.id}
                item={item}
                formatDate={formatDate}
                onRate={(rid, uid) => setRatingTarget({ reservationId: rid, ratedId: uid })}
              />
            ))
          )}
        </View>

        {/* Sign out */}
        <TouchableOpacity
          style={styles.logoutBtn}
          onPress={() => Alert.alert("Sign Out", "Are you sure?", [
            { text: "Cancel" },
            { text: "Sign Out", style: "destructive", onPress: logout },
          ])}
        >
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Car pickers */}
      <PickerModal
        visible={showMakePicker}
        title="Select Make"
        items={CAR_MAKES}
        onClose={() => setShowMakePicker(false)}
        onSelect={(v) => { setCarMake(v); setCarModel(""); }}
      />
      <PickerModal
        visible={showModelPicker}
        title={`${carMake} Models`}
        items={modelList}
        onClose={() => setShowModelPicker(false)}
        onSelect={setCarModel}
      />

      {ratingTarget && (
        <RatingModal
          visible={!!ratingTarget}
          reservationId={ratingTarget.reservationId}
          ratedId={ratingTarget.ratedId}
          ratedName="the leaver"
          onDone={() => setRatingTarget(null)}
        />
      )}

      {/* ── Edit Profile Modal ── */}
      <Modal visible={editVisible} animationType="slide" transparent statusBarTranslucent>
        <View style={edit.overlay}>
          <TouchableOpacity style={edit.backdrop} activeOpacity={1} onPress={() => setEditVisible(false)} />
          <View style={edit.sheet}>
            <View style={edit.handle} />
            <View style={edit.headerRow}>
              <Text style={edit.title}>Edit Profile</Text>
              <TouchableOpacity onPress={() => setEditVisible(false)}>
                <Text style={edit.close}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Photo picker */}
            <TouchableOpacity style={edit.photoPicker} onPress={pickPhoto}>
              {editPhotoUri ? (
                <Image source={{ uri: editPhotoUri }} style={edit.photoPreview} />
              ) : user?.profile_photo_url ? (
                <Image source={{ uri: user.profile_photo_url }} style={edit.photoPreview} />
              ) : (
                <View style={edit.photoPlaceholder}>
                  <Text style={edit.photoPlaceholderText}>{user?.full_name?.charAt(0).toUpperCase() ?? "U"}</Text>
                </View>
              )}
              <View style={edit.photoEditBadge}>
                <Text style={edit.photoEditIcon}>📷</Text>
              </View>
            </TouchableOpacity>
            <Text style={edit.photoHint}>Tap to take or choose a photo</Text>

            {/* Name field */}
            <Text style={edit.fieldLabel}>FULL NAME</Text>
            <TextInput
              style={edit.input}
              value={editName}
              onChangeText={setEditName}
              placeholder="Your name"
              autoCapitalize="words"
            />

            <TouchableOpacity style={edit.saveBtn} onPress={handleSaveProfile} disabled={savingProfile}>
              {savingProfile
                ? <ActivityIndicator color="#fff" />
                : <Text style={edit.saveBtnText}>Save Changes</Text>
              }
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#EEF1F8" },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 12,
  },
  headerBtn: { padding: 4 },
  headerBtnText: { fontSize: 22, color: "#374151" },
  headerTitle: { fontSize: 20, fontWeight: "800", color: "#1E3DB8" },
  helpBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: "#1E3DB8", alignItems: "center", justifyContent: "center",
  },
  helpBtnText: { color: "#fff", fontWeight: "800", fontSize: 15 },
  scroll: { flex: 1 },
  profileHero: { alignItems: "center", paddingVertical: 24, paddingHorizontal: 16 },
  avatarWrap: { position: "relative", marginBottom: 12 },
  avatar: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: "#374151", alignItems: "center", justifyContent: "center",
  },
  avatarText: { color: "#fff", fontSize: 36, fontWeight: "700" },
  avatarImg: { width: 88, height: 88, borderRadius: 44 },
  editPhotoBadge: {
    position: "absolute", bottom: 0, right: 0,
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: "#1E3DB8", alignItems: "center", justifyContent: "center",
    borderWidth: 2, borderColor: "#fff",
  },
  editPhotoIcon: { color: "#fff", fontSize: 12 },
  profileName: { fontSize: 24, fontWeight: "800", color: "#111827", marginBottom: 2 },
  profileEmail: { fontSize: 13, color: "#9CA3AF", marginBottom: 4 },
  profileRating: { fontSize: 14, color: "#F59E0B", fontWeight: "600", marginBottom: 16 },
  actionRow: { flexDirection: "row", gap: 12 },
  actionBtnOutline: {
    flex: 1, height: 42, borderRadius: 10, borderWidth: 1.5, borderColor: "#D1D5DB",
    alignItems: "center", justifyContent: "center", backgroundColor: "#fff",
  },
  actionBtnOutlineText: { fontSize: 14, fontWeight: "600", color: "#374151" },
  actionBtnFilled: {
    flex: 1, height: 42, borderRadius: 10,
    backgroundColor: "#1E3DB8", alignItems: "center", justifyContent: "center",
  },
  actionBtnFilledText: { fontSize: 14, fontWeight: "600", color: "#fff" },
  tokenCard: {
    backgroundColor: "#FEF3C7", borderRadius: 14, marginHorizontal: 16, marginBottom: 16,
    padding: 16, alignItems: "center",
  },
  tokenTitle: { fontSize: 14, fontWeight: "700", color: "#92400E" },
  tokenBalance: { fontSize: 32, fontWeight: "900", color: "#78350F", marginVertical: 4 },
  tokenSub: { fontSize: 12, color: "#A16207" },
  section: { marginHorizontal: 16, marginBottom: 16 },
  sectionTitle: { fontSize: 18, fontWeight: "800", color: "#111827", marginBottom: 12 },

  // Car card
  carCard: {
    backgroundColor: "#fff", borderRadius: 16, overflow: "hidden",
    shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 6, elevation: 2,
  },
  carCardSub: { fontSize: 13, color: "#9CA3AF", padding: 14, paddingBottom: 0 },
  pickerRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: "#F3F4F6",
  },
  pickerRowLast: { borderBottomWidth: 0 },
  pickerLeft: { flex: 1 },
  pickerLabel: { fontSize: 10, fontWeight: "700", color: "#9CA3AF", letterSpacing: 0.8, marginBottom: 3 },
  pickerValue: { fontSize: 16, fontWeight: "700", color: "#111827" },
  pickerPlaceholder: { color: "#9CA3AF", fontWeight: "400" },
  pickerChevron: { fontSize: 22, color: "#9CA3AF" },
  savedCarRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    margin: 14,
  },
  currentCarBadge: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "#EEF1F8", borderRadius: 10, padding: 10, flex: 1,
  },
  currentCarIcon: { fontSize: 20 },
  currentCarText: { fontSize: 14, fontWeight: "700", color: "#1E3DB8" },
  editCarBtn: {
    marginLeft: 10, backgroundColor: "#F3F4F6", borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 8,
  },
  editCarBtnText: { fontSize: 13, fontWeight: "700", color: "#374151" },
  saveCarBtn: {
    backgroundColor: "#1E3DB8", margin: 14, borderRadius: 12,
    height: 46, alignItems: "center", justifyContent: "center",
  },
  saveCarBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },

  // History
  emptyHistory: { alignItems: "center", paddingVertical: 24 },
  emptyHistoryText: { fontSize: 14, color: "#9CA3AF" },
  historyCard: {
    backgroundColor: "#fff", borderRadius: 14, padding: 14,
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    marginBottom: 10,
    shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 4, elevation: 2,
  },
  historyCardDriver: { borderLeftWidth: 3, borderLeftColor: "#1E3DB8" },
  historyCardLeaver: { borderLeftWidth: 3, borderLeftColor: "#059669" },
  historyCardLeft: { flexDirection: "row", alignItems: "center", flex: 1 },
  historyIcon: {
    width: 38, height: 38, borderRadius: 10,
    alignItems: "center", justifyContent: "center", marginRight: 10,
  },
  historyIconDriver: { backgroundColor: "#DBEAFE" },
  historyIconLeaver: { backgroundColor: "#D1FAE5" },
  historyIconText: { fontSize: 18 },
  historyInfo: { flex: 1 },
  historyRoleRow: { flexDirection: "row", marginBottom: 3 },
  roleBadge: { borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2 },
  roleBadgeDriver: { backgroundColor: "#DBEAFE" },
  roleBadgeLeaver: { backgroundColor: "#D1FAE5" },
  roleText: { fontSize: 9, fontWeight: "800", letterSpacing: 0.8 },
  roleTextDriver: { color: "#1E3DB8" },
  roleTextLeaver: { color: "#059669" },
  historyAddress: { fontSize: 14, fontWeight: "700", color: "#111827", maxWidth: 160 },
  historyOther: { fontSize: 12, color: "#6B7280", marginTop: 1 },
  historyDate: { fontSize: 12, color: "#9CA3AF", marginTop: 2 },
  historyCardRight: { alignItems: "flex-end", gap: 6 },
  statusBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  statusText: { fontSize: 11, fontWeight: "700" },
  rateBtn: {
    backgroundColor: "#FEF3C7", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4,
  },
  rateBtnText: { color: "#92400E", fontWeight: "700", fontSize: 12 },
  logoutBtn: {
    marginHorizontal: 16, marginBottom: 32, borderWidth: 1.5, borderColor: "#EF4444",
    borderRadius: 14, height: 52, alignItems: "center", justifyContent: "center",
  },
  logoutText: { color: "#EF4444", fontSize: 16, fontWeight: "600" },
});

const edit = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "flex-end" },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.45)" },
  sheet: {
    backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 24, paddingBottom: 40,
  },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: "#E5E7EB", alignSelf: "center", marginTop: 12, marginBottom: 8 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 12 },
  title: { fontSize: 18, fontWeight: "800", color: "#111827" },
  close: { fontSize: 20, color: "#9CA3AF", fontWeight: "700" },
  photoPicker: { alignSelf: "center", marginTop: 8, position: "relative" },
  photoPreview: { width: 90, height: 90, borderRadius: 45 },
  photoPlaceholder: {
    width: 90, height: 90, borderRadius: 45,
    backgroundColor: "#374151", alignItems: "center", justifyContent: "center",
  },
  photoPlaceholderText: { color: "#fff", fontSize: 36, fontWeight: "700" },
  photoEditBadge: {
    position: "absolute", bottom: 0, right: 0,
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: "#1E3DB8", alignItems: "center", justifyContent: "center",
    borderWidth: 2, borderColor: "#fff",
  },
  photoEditIcon: { fontSize: 14 },
  photoHint: { textAlign: "center", fontSize: 12, color: "#9CA3AF", marginTop: 6, marginBottom: 20 },
  fieldLabel: { fontSize: 11, fontWeight: "700", color: "#9CA3AF", letterSpacing: 0.8, marginBottom: 6 },
  input: {
    backgroundColor: "#F3F4F6", borderRadius: 12, paddingHorizontal: 16,
    height: 52, fontSize: 16, color: "#111827", marginBottom: 20,
  },
  saveBtn: {
    backgroundColor: "#1E3DB8", borderRadius: 14,
    height: 54, alignItems: "center", justifyContent: "center",
  },
  saveBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
