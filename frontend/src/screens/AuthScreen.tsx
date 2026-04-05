import React, { useState, useRef } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
  ScrollView, SafeAreaView,
} from "react-native";
import { useAuthStore } from "../store/authStore";

interface Props {
  onAuthenticated: () => void;
}

type Step = "form" | "otp";

export default function AuthScreen({ onAuthenticated }: Props) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [step, setStep] = useState<Step>("form");

  // Form fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // OTP fields — 6 individual boxes
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const otpRefs = useRef<(TextInput | null)[]>([]);

  const { login, registerInitiate, registerVerify, isLoading } = useAuthStore();

  // ── Step 1: submit form ──────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!email || !password) { Alert.alert("Error", "Please fill in all fields"); return; }
    try {
      if (mode === "login") {
        await login(email, password);
        onAuthenticated();
      } else {
        if (!fullName) { Alert.alert("Error", "Please enter your name"); return; }
        await registerInitiate(email, password, fullName);
        setStep("otp");
      }
    } catch (e: any) {
      Alert.alert("Error", e.response?.data?.detail || "Something went wrong");
    }
  };

  // ── Step 2: verify OTP ───────────────────────────────────────────────
  const handleVerify = async () => {
    const code = otp.join("");
    if (code.length < 6) { Alert.alert("Error", "Enter the 6-digit code"); return; }
    try {
      await registerVerify(email, code);
      onAuthenticated();
    } catch (e: any) {
      Alert.alert("Error", e.response?.data?.detail || "Verification failed");
    }
  };

  const handleOtpChange = (val: string, idx: number) => {
    const digit = val.replace(/[^0-9]/g, "").slice(-1);
    const next = [...otp];
    next[idx] = digit;
    setOtp(next);
    if (digit && idx < 5) otpRefs.current[idx + 1]?.focus();
    if (!digit && idx > 0) otpRefs.current[idx - 1]?.focus();
  };

  const handleResend = async () => {
    try {
      await registerInitiate(email, password, fullName);
      setOtp(["", "", "", "", "", ""]);
      otpRefs.current[0]?.focus();
      Alert.alert("Sent", "A new code has been sent to your email.");
    } catch (e: any) {
      Alert.alert("Error", e.response?.data?.detail || "Failed to resend");
    }
  };

  // ── OTP screen ────────────────────────────────────────────────────────
  if (step === "otp") {
    return (
      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
            <View style={styles.logoWrap}>
              <View style={styles.logoBox}>
                <Text style={styles.logoLetter}>P</Text>
              </View>
              <Text style={styles.appName}>ParkPass</Text>
            </View>

            <View style={styles.card}>
              <View style={styles.otpIconCircle}>
                <Text style={styles.otpIconText}>✉️</Text>
              </View>
              <Text style={styles.cardTitle}>Check your email</Text>
              <Text style={styles.cardSubtitle}>
                We sent a 6-digit code to{"\n"}
                <Text style={styles.emailHighlight}>{email}</Text>
              </Text>

              {/* 6-box OTP input */}
              <View style={styles.otpRow}>
                {otp.map((digit, i) => (
                  <TextInput
                    key={i}
                    ref={(r) => { otpRefs.current[i] = r; }}
                    style={[styles.otpBox, digit ? styles.otpBoxFilled : null]}
                    value={digit}
                    onChangeText={(v) => handleOtpChange(v, i)}
                    keyboardType="number-pad"
                    maxLength={1}
                    textAlign="center"
                    selectTextOnFocus
                  />
                ))}
              </View>

              <TouchableOpacity style={styles.loginButton} onPress={handleVerify} disabled={isLoading}>
                {isLoading
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.loginButtonText}>Verify & Create Account  →</Text>
                }
              </TouchableOpacity>

              <TouchableOpacity onPress={handleResend} style={styles.resendWrap}>
                <Text style={styles.resendText}>Didn't get it? <Text style={styles.resendLink}>Resend code</Text></Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={() => setStep("form")} style={styles.resendWrap}>
                <Text style={styles.backText}>← Change email</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // ── Form screen ───────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {/* Logo */}
          <View style={styles.logoWrap}>
            <View style={styles.logoBox}>
              <Text style={styles.logoLetter}>P</Text>
            </View>
            <Text style={styles.appName}>ParkPass</Text>
            <Text style={styles.tagline}>The Urban Concierge for effortless city parking.</Text>
          </View>

          {/* Card */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>
              {mode === "login" ? "Welcome back" : "Create account"}
            </Text>
            <Text style={styles.cardSubtitle}>
              {mode === "login"
                ? "Enter your credentials to access your pass."
                : "Sign up to start sharing and finding spots."}
            </Text>

            {mode === "register" && (
              <View style={styles.fieldWrap}>
                <Text style={styles.fieldLabel}>FULL NAME</Text>
                <View style={styles.inputRow}>
                  <Text style={styles.inputIcon}>👤</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Your name"
                    value={fullName}
                    onChangeText={setFullName}
                    autoCapitalize="words"
                  />
                </View>
              </View>
            )}

            <View style={styles.fieldWrap}>
              <Text style={styles.fieldLabel}>EMAIL ADDRESS</Text>
              <View style={styles.inputRow}>
                <Text style={styles.inputIcon}>✉️</Text>
                <TextInput
                  style={styles.input}
                  placeholder="name@example.com"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
            </View>

            <View style={styles.fieldWrap}>
              <View style={styles.passwordLabelRow}>
                <Text style={styles.fieldLabel}>PASSWORD</Text>
                {mode === "login" && (
                  <TouchableOpacity>
                    <Text style={styles.forgotText}>FORGOT?</Text>
                  </TouchableOpacity>
                )}
              </View>
              <View style={styles.inputRow}>
                <Text style={styles.inputIcon}>🔒</Text>
                <TextInput
                  style={styles.input}
                  placeholder="••••••••"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                  <Text style={styles.eyeIcon}>{showPassword ? "🙈" : "👁️"}</Text>
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity style={styles.loginButton} onPress={handleSubmit} disabled={isLoading}>
              {isLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.loginButtonText}>
                  {mode === "login" ? "Login  →" : "Send Verification Code  →"}
                </Text>
              )}
            </TouchableOpacity>

            {mode === "login" && (
              <>
                <View style={styles.dividerRow}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.dividerText}>OR CONTINUE WITH</Text>
                  <View style={styles.dividerLine} />
                </View>
                <View style={styles.socialRow}>
                  <TouchableOpacity style={styles.socialButton}>
                    <Text style={styles.googleText}>GOOGLE</Text>
                    <Text style={styles.socialLabel}> Google</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.socialButton}>
                    <Text style={styles.appleText}>i0S</Text>
                    <Text style={styles.socialLabel}> Apple</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>

          <TouchableOpacity onPress={() => { setMode(mode === "login" ? "register" : "login"); setStep("form"); }} style={styles.switchRow}>
            <Text style={styles.switchText}>
              {mode === "login" ? "Don't have an account? " : "Already have an account? "}
              <Text style={styles.switchLink}>{mode === "login" ? "Sign Up" : "Sign In"}</Text>
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#EEF1F8" },
  container: { flex: 1 },
  scroll: { flexGrow: 1, alignItems: "center", paddingVertical: 40, paddingHorizontal: 24 },
  logoWrap: { alignItems: "center", marginBottom: 32 },
  logoBox: {
    width: 64, height: 64, borderRadius: 16,
    backgroundColor: "#1E3DB8", alignItems: "center", justifyContent: "center", marginBottom: 12,
  },
  logoLetter: { color: "#fff", fontSize: 32, fontWeight: "900" },
  appName: { fontSize: 28, fontWeight: "800", color: "#1E3DB8", marginBottom: 6 },
  tagline: { fontSize: 14, color: "#6B7280", textAlign: "center", maxWidth: 260 },
  card: {
    backgroundColor: "#fff", borderRadius: 20, padding: 24,
    width: "100%", shadowColor: "#000", shadowOpacity: 0.06,
    shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 4,
  },
  cardTitle: { fontSize: 22, fontWeight: "800", color: "#111827", marginBottom: 4 },
  cardSubtitle: { fontSize: 13, color: "#6B7280", marginBottom: 20, lineHeight: 20 },
  emailHighlight: { fontWeight: "700", color: "#1E3DB8" },
  fieldWrap: { marginBottom: 16 },
  fieldLabel: { fontSize: 11, fontWeight: "700", color: "#9CA3AF", letterSpacing: 0.8, marginBottom: 6 },
  passwordLabelRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  forgotText: { fontSize: 11, fontWeight: "700", color: "#1E3DB8", letterSpacing: 0.8 },
  inputRow: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#F3F4F6", borderRadius: 12, paddingHorizontal: 12, height: 50,
  },
  inputIcon: { fontSize: 16, marginRight: 8 },
  eyeIcon: { fontSize: 16, marginLeft: 8 },
  input: { flex: 1, fontSize: 15, color: "#111827" },
  loginButton: {
    backgroundColor: "#1E3DB8", borderRadius: 12,
    height: 52, alignItems: "center", justifyContent: "center", marginTop: 8,
  },
  loginButtonText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  dividerRow: { flexDirection: "row", alignItems: "center", marginVertical: 20 },
  dividerLine: { flex: 1, height: 1, backgroundColor: "#E5E7EB" },
  dividerText: { fontSize: 11, color: "#9CA3AF", marginHorizontal: 10, letterSpacing: 0.5 },
  socialRow: { flexDirection: "row", gap: 12 },
  socialButton: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    borderWidth: 1.5, borderColor: "#E5E7EB", borderRadius: 12, height: 48,
  },
  googleText: { fontSize: 14, fontWeight: "800", color: "#4285F4", letterSpacing: -0.5 },
  appleText: { fontSize: 14, fontWeight: "700", color: "#111827" },
  socialLabel: { fontSize: 14, color: "#374151", fontWeight: "600" },
  switchRow: { marginTop: 24 },
  switchText: { fontSize: 14, color: "#6B7280" },
  switchLink: { color: "#1E3DB8", fontWeight: "700" },

  // OTP screen
  otpIconCircle: {
    width: 64, height: 64, borderRadius: 32, backgroundColor: "#EEF1F8",
    alignItems: "center", justifyContent: "center", alignSelf: "center", marginBottom: 16,
  },
  otpIconText: { fontSize: 28 },
  otpRow: {
    flexDirection: "row", justifyContent: "space-between", marginVertical: 24, gap: 8,
  },
  otpBox: {
    flex: 1, height: 56, borderRadius: 12,
    backgroundColor: "#F3F4F6", fontSize: 24, fontWeight: "800", color: "#111827",
    borderWidth: 2, borderColor: "transparent",
  },
  otpBoxFilled: { borderColor: "#1E3DB8", backgroundColor: "#EEF1F8" },
  resendWrap: { alignItems: "center", marginTop: 16 },
  resendText: { fontSize: 14, color: "#6B7280" },
  resendLink: { color: "#1E3DB8", fontWeight: "700" },
  backText: { fontSize: 14, color: "#9CA3AF" },
});
