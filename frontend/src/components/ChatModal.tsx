import React, { useEffect, useRef, useState } from "react";
import {
  Modal, View, Text, StyleSheet, TouchableOpacity, TextInput,
  FlatList, KeyboardAvoidingView, Platform, ActivityIndicator,
  SafeAreaView,
} from "react-native";
import { chatApi } from "../api/chat";
import { useAuthStore } from "../store/authStore";
import { setChatMessageHandler, setChatOpenFlag, ChatMessageData } from "../hooks/useWebSocket";

interface Props {
  visible: boolean;
  reservationId: string;
  otherName: string;
  onClose: () => void;
}

export function ChatModal({ visible, reservationId, otherName, onClose }: Props) {
  const { user } = useAuthStore();
  const [messages, setMessages] = useState<ChatMessageData[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList>(null);

  // Track open state for notification suppression
  useEffect(() => {
    setChatOpenFlag(visible);
    return () => setChatOpenFlag(false);
  }, [visible]);

  // Load messages when opened
  useEffect(() => {
    if (!visible || !reservationId) return;
    setLoading(true);
    chatApi.getMessages(reservationId)
      .then(({ data }) => setMessages(data.data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [visible, reservationId]);

  // Real-time: register WS handler while this modal is open
  useEffect(() => {
    if (!visible) return;
    setChatMessageHandler((msg) => {
      if (msg.reservation_id === reservationId) {
        setMessages((prev) => {
          // Avoid duplicates (msg might already be there from optimistic update)
          if (prev.find((m) => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
        setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
      }
    });
    return () => setChatMessageHandler(null);
  }, [visible, reservationId]);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: false }), 50);
    }
  }, [messages.length]);

  const handleSend = async () => {
    const content = text.trim();
    if (!content || sending) return;
    setText("");
    setSending(true);
    try {
      const { data } = await chatApi.sendMessage(reservationId, content);
      const sent: ChatMessageData = data.data;
      setMessages((prev) => {
        if (prev.find((m) => m.id === sent.id)) return prev;
        return [...prev, sent];
      });
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
    } catch {}
    setSending(false);
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <Modal visible={visible} animationType="slide" statusBarTranslucent>
      <SafeAreaView style={styles.safe}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Text style={styles.closeBtnText}>←</Text>
          </TouchableOpacity>
          <View style={styles.headerInfo}>
            <Text style={styles.headerName}>{otherName}</Text>
            <Text style={styles.headerSub}>Active reservation chat</Text>
          </View>
          <View style={styles.onlineDot} />
        </View>

        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={0}
        >
          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator color="#1E3DB8" size="large" />
            </View>
          ) : (
            <FlatList
              ref={listRef}
              data={messages}
              keyExtractor={(m) => m.id}
              contentContainerStyle={styles.messageList}
              ListEmptyComponent={
                <View style={styles.empty}>
                  <Text style={styles.emptyText}>
                    No messages yet. Say hi to {otherName}!
                  </Text>
                </View>
              }
              renderItem={({ item }) => {
                const isMine = item.sender_id === user?.id;
                return (
                  <View style={[styles.bubbleWrap, isMine && styles.bubbleWrapMine]}>
                    {!isMine && (
                      <View style={styles.avatar}>
                        <Text style={styles.avatarText}>
                          {item.sender_name.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                    )}
                    <View style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleTheirs]}>
                      <Text style={[styles.bubbleText, isMine && styles.bubbleTextMine]}>
                        {item.content}
                      </Text>
                      <Text style={[styles.bubbleTime, isMine && styles.bubbleTimeMine]}>
                        {formatTime(item.created_at)}
                      </Text>
                    </View>
                  </View>
                );
              }}
            />
          )}

          {/* Input bar */}
          <View style={styles.inputBar}>
            <TextInput
              style={styles.input}
              value={text}
              onChangeText={setText}
              placeholder="Message..."
              placeholderTextColor="#9CA3AF"
              multiline
              maxLength={500}
              returnKeyType="send"
              onSubmitEditing={handleSend}
            />
            <TouchableOpacity
              style={[styles.sendBtn, (!text.trim() || sending) && styles.sendBtnDisabled]}
              onPress={handleSend}
              disabled={!text.trim() || sending}
            >
              {sending
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={styles.sendBtnText}>↑</Text>
              }
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#EEF1F8" },
  flex: { flex: 1 },
  header: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 16, paddingVertical: 14,
    backgroundColor: "#fff",
    borderBottomWidth: 1, borderBottomColor: "#F3F4F6",
    shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 4, elevation: 2,
  },
  closeBtn: { padding: 4, marginRight: 12 },
  closeBtnText: { fontSize: 24, color: "#1E3DB8", fontWeight: "600" },
  headerInfo: { flex: 1 },
  headerName: { fontSize: 17, fontWeight: "800", color: "#111827" },
  headerSub: { fontSize: 12, color: "#9CA3AF", marginTop: 1 },
  onlineDot: {
    width: 10, height: 10, borderRadius: 5, backgroundColor: "#22C55E",
  },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  messageList: { padding: 16, paddingBottom: 8 },
  empty: { flex: 1, alignItems: "center", paddingTop: 60 },
  emptyText: { fontSize: 14, color: "#9CA3AF", textAlign: "center" },

  bubbleWrap: {
    flexDirection: "row", alignItems: "flex-end", marginBottom: 12,
  },
  bubbleWrapMine: { flexDirection: "row-reverse" },
  avatar: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: "#374151", alignItems: "center", justifyContent: "center",
    marginRight: 8,
  },
  avatarText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  bubble: {
    maxWidth: "72%", borderRadius: 18, paddingHorizontal: 14, paddingVertical: 8,
  },
  bubbleMine: {
    backgroundColor: "#1E3DB8", borderBottomRightRadius: 4,
  },
  bubbleTheirs: {
    backgroundColor: "#fff", borderBottomLeftRadius: 4,
    shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  bubbleText: { fontSize: 15, color: "#111827", lineHeight: 20 },
  bubbleTextMine: { color: "#fff" },
  bubbleTime: { fontSize: 11, color: "#9CA3AF", marginTop: 3, textAlign: "right" },
  bubbleTimeMine: { color: "rgba(255,255,255,0.6)" },

  inputBar: {
    flexDirection: "row", alignItems: "flex-end",
    paddingHorizontal: 12, paddingVertical: 10,
    backgroundColor: "#fff",
    borderTopWidth: 1, borderTopColor: "#F3F4F6",
    gap: 8,
  },
  input: {
    flex: 1, backgroundColor: "#F3F4F6", borderRadius: 20,
    paddingHorizontal: 16, paddingTop: 10, paddingBottom: 10,
    fontSize: 15, color: "#111827", maxHeight: 120,
  },
  sendBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: "#1E3DB8", alignItems: "center", justifyContent: "center",
  },
  sendBtnDisabled: { backgroundColor: "#D1D5DB" },
  sendBtnText: { color: "#fff", fontSize: 20, fontWeight: "700", marginBottom: 2 },
});
