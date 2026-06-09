import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { registerWithEmail, resetPassword, signInWithEmail } from "../../services/auth-service";
import { fullSync } from "../../services/firestore-service";
import { getExams, getReflections, getStressEntries } from "../../utils/storage";
import AsyncStorage from "@react-native-async-storage/async-storage";

const POMO_SESSIONS_KEY = "POMO_SESSIONS_V1";

export default function LoginScreen() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const handleSubmit = async () => {
    if (!email.trim() || !password) {
      Alert.alert("Missing details", "Enter your email and password.");
      return;
    }

    setBusy(true);
    const result =
      mode === "register"
        ? await registerWithEmail(email, password, name.trim() || undefined)
        : await signInWithEmail(email, password);

    if (result.success) {
      const rawSessions = await AsyncStorage.getItem(POMO_SESSIONS_KEY);
      await fullSync({
        exams: await getExams(),
        stressEntries: await getStressEntries(),
        reflections: await getReflections(),
        pomodoroSessions: rawSessions ? JSON.parse(rawSessions) : [],
      }).catch((error) => console.warn("Initial sync failed", error));
      router.replace("/(tabs)/home");
    } else {
      Alert.alert("Sign in failed", result.error);
    }
    setBusy(false);
  };

  const handleReset = async () => {
    if (!email.trim()) {
      Alert.alert("Email needed", "Enter your email first.");
      return;
    }
    const result = await resetPassword(email);
    Alert.alert(result.success ? "Email sent" : "Reset failed", result.success ? "Check your inbox." : result.error);
  };

  return (
    <LinearGradient colors={["#F8FAFC", "#EEF2FF"]} style={styles.bg}>
      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.wrap}>
          <TouchableOpacity onPress={() => router.back()} style={styles.back}>
            <Ionicons name="chevron-back" size={22} color="#1F2937" />
          </TouchableOpacity>

          <View style={styles.panel}>
            <Text style={styles.title}>{mode === "login" ? "Student account" : "Create account"}</Text>
            <Text style={styles.subtitle}>Sync exams, stress logs, Pomodoro sessions, and reflections.</Text>

            {mode === "register" && (
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="Display name"
                autoCapitalize="words"
                style={styles.input}
              />
            )}
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="Email"
              keyboardType="email-address"
              autoCapitalize="none"
              style={styles.input}
            />
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="Password"
              secureTextEntry
              style={styles.input}
            />

            <TouchableOpacity disabled={busy} onPress={handleSubmit} style={styles.primary}>
              {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>{mode === "login" ? "Sign in" : "Register"}</Text>}
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setMode(mode === "login" ? "register" : "login")} style={styles.link}>
              <Text style={styles.linkText}>{mode === "login" ? "Create a new account" : "Use an existing account"}</Text>
            </TouchableOpacity>

            {mode === "login" && (
              <TouchableOpacity onPress={handleReset} style={styles.link}>
                <Text style={styles.mutedLink}>Reset password</Text>
              </TouchableOpacity>
            )}
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1 },
  safe: { flex: 1 },
  wrap: { flex: 1, justifyContent: "center", padding: 22 },
  back: {
    position: "absolute",
    left: 22,
    top: 64,
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  panel: { gap: 14 },
  title: { color: "#111827", fontSize: 30, fontWeight: "800" },
  subtitle: { color: "#64748B", fontSize: 15, lineHeight: 22, marginBottom: 8 },
  input: {
    height: 54,
    borderRadius: 14,
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    color: "#111827",
  },
  primary: {
    height: 54,
    borderRadius: 14,
    backgroundColor: "#4F46E5",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 6,
  },
  primaryText: { color: "#fff", fontWeight: "800", fontSize: 16 },
  link: { alignItems: "center", paddingVertical: 4 },
  linkText: { color: "#4F46E5", fontWeight: "700" },
  mutedLink: { color: "#64748B", fontWeight: "700" },
});
