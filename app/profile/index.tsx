// app/profile/index.tsx
import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  StatusBar,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../../context/ThemeContext";

// ✅ Keys (single source of truth)
const KEY_FIRST = "user:firstName";
const KEY_LAST = "user:lastName";
const KEY_FULL = "user:name";
const KEY_LEGACY = "userName"; // Home reads this

const getInitials = (first: string, last: string) => {
  const a = (first || "").trim()[0] || "";
  const b = (last || "").trim()[0] || "";
  return (a + b).toUpperCase();
};

const makeFull = (first: string, last: string) =>
  [first.trim(), last.trim()].filter(Boolean).join(" ");

const parseFullName = (full: string) => {
  const parts = full.trim().split(/\s+/);
  const first = parts[0] || "";
  const last = parts.slice(1).join(" ");
  return { first, last };
};

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { darkMode } = useTheme();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [focused, setFocused] = useState<"first" | "last" | null>(null);

  const initials = useMemo(() => getInitials(firstName, lastName), [firstName, lastName]);

  // ✅ Load profile consistently (supports Home-only saved name)
  useEffect(() => {
    (async () => {
      try {
        const savedFirst = (await AsyncStorage.getItem(KEY_FIRST)) || "";
        const savedLast = (await AsyncStorage.getItem(KEY_LAST)) || "";
        const savedFull = (await AsyncStorage.getItem(KEY_FULL)) || "";
        const savedLegacy = (await AsyncStorage.getItem(KEY_LEGACY)) || "";

        // If first/last exist -> use them
        if (savedFirst || savedLast) {
          setFirstName(savedFirst);
          setLastName(savedLast);
          return;
        }

        // Else parse full / legacy
        const nameToParse = savedFull || savedLegacy;
        if (nameToParse) {
          const { first, last } = parseFullName(nameToParse);
          setFirstName(first);
          setLastName(last);
        }
      } catch (e) {
        console.warn("Failed to load profile:", e);
      }
    })();
  }, []);

  const onSave = async () => {
    const f = firstName.trim();
    const l = lastName.trim();

    // ✅ Require BOTH
    if (!f) {
      Alert.alert("Required", "Please enter your first name.");
      return;
    }
    if (!l) {
      Alert.alert("Required", "Please enter your last name.");
      return;
    }

    const full = makeFull(f, l);

    try {
      // ✅ Save everything in sync
      await AsyncStorage.multiSet([
        [KEY_FIRST, f],
        [KEY_LAST, l],
        [KEY_FULL, full],
        [KEY_LEGACY, full],
      ]);

      Alert.alert("Success", "Profile updated successfully! ✨");
      router.back();
    } catch (e) {
      console.error("Failed to save profile:", e);
      Alert.alert("Error", "Could not save changes. Please try again.");
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle={darkMode ? "light-content" : "dark-content"} />

      <LinearGradient
        colors={darkMode ? ["#0B1220", "#111827"] : ["#EEF2FF", "#F8FAFC"]}
        style={StyleSheet.absoluteFillObject}
      />

      <SafeAreaView style={{ flex: 1 }}>
        {/* Header */}
        <View style={[styles.headerUX, { paddingTop: insets.top + 25 }]}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={[styles.backBtnUX, darkMode && styles.backBtnUXDark]}
          >
            <Ionicons name="chevron-back" size={24} color={darkMode ? "#E5E7EB" : "#1E293B"} />
          </TouchableOpacity>

          <View style={styles.headerTitleRow}>
            <Text style={[styles.headerTitleUX, darkMode && styles.textOnDark]}>My Profile</Text>
            <Text style={[styles.headerSubUX, darkMode && styles.subTextOnDark]}>
              Personalize your experience
            </Text>
          </View>

          <View style={{ width: 44 }} />
        </View>

        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {/* Avatar Section */}
            <View style={styles.avatarSection}>
              <View style={[styles.avatarShadow, darkMode && styles.avatarShadowDark]}>
                <LinearGradient colors={["#6366f1", "#4f46e5"]} style={styles.avatarCircle}>
                  {initials ? (
                    <Text style={styles.avatarText}>{initials}</Text>
                  ) : (
                    <Ionicons name="person" size={40} color="#fff" />
                  )}
                </LinearGradient>
              </View>

              <Text style={[styles.namePreview, darkMode && styles.textOnDark]}>
                {makeFull(firstName, lastName) || "Your Name"}
              </Text>
            </View>

            {/* Input Form Card */}
            <View style={[styles.card, darkMode && styles.cardDark]}>
              <View style={styles.cardHeader}>
                <Ionicons name="id-card-outline" size={20} color="#6366f1" />
                <Text style={[styles.cardLabel, darkMode && styles.textOnDark]}>Basic Information</Text>
              </View>

              <Text style={[styles.inputLabel, darkMode && styles.inputLabelDark]}>FIRST NAME</Text>
              <View
                style={[
                  styles.inputWrapper,
                  darkMode && styles.inputWrapperDark,
                  focused === "first" && (darkMode ? styles.inputFocusedDark : styles.inputFocused),
                ]}
              >
                <TextInput
                  value={firstName}
                  onChangeText={setFirstName}
                  onFocus={() => setFocused("first")}
                  onBlur={() => setFocused(null)}
                  placeholder="e.g. Alex"
                  placeholderTextColor={darkMode ? "#6B7280" : "#94A3B8"}
                  style={[styles.textInput, darkMode && styles.textInputDark]}
                  returnKeyType="next"
                />
              </View>

              <Text style={[styles.inputLabel, darkMode && styles.inputLabelDark]}>LAST NAME</Text>
              <View
                style={[
                  styles.inputWrapper,
                  darkMode && styles.inputWrapperDark,
                  focused === "last" && (darkMode ? styles.inputFocusedDark : styles.inputFocused),
                ]}
              >
                <TextInput
                  value={lastName}
                  onChangeText={setLastName}
                  onFocus={() => setFocused("last")}
                  onBlur={() => setFocused(null)}
                  placeholder="e.g. Papadopoulos"
                  placeholderTextColor={darkMode ? "#6B7280" : "#94A3B8"}
                  style={[styles.textInput, darkMode && styles.textInputDark]}
                  returnKeyType="done"
                  onSubmitEditing={onSave}
                />
              </View>
            </View>
          </ScrollView>

          {/* Save Button Footer */}
          <View style={[styles.footer, darkMode && styles.footerDark, { paddingBottom: Math.max(insets.bottom, 20) }]}>
            <TouchableOpacity activeOpacity={0.9} onPress={onSave} style={[styles.saveBtn, darkMode && styles.saveBtnDark]}>
              <LinearGradient colors={["#6366f1", "#4f46e5"]} style={styles.saveGradient}>
                <Text style={styles.saveBtnText}>Save Changes</Text>
                <Ionicons name="checkmark-circle" size={20} color="#fff" />
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  headerUX: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 15,
  },
  backBtnUX: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 5,
  },
  backBtnUXDark: {
    backgroundColor: "#111827",
    elevation: 0,
    shadowOpacity: 0,
  },

  headerTitleRow: { alignItems: "center" },
  headerTitleUX: { fontSize: 20, fontWeight: "900", color: "#1E293B" },
  headerSubUX: { fontSize: 13, color: "#64748B", fontWeight: "600" },

  scrollContent: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 120 },

  avatarSection: { alignItems: "center", marginBottom: 30 },
  avatarShadow: {
    elevation: 10,
    shadowColor: "#6366f1",
    shadowOpacity: 0.3,
    shadowRadius: 15,
    shadowOffset: { width: 0, height: 8 },
  },
  avatarShadowDark: { elevation: 0, shadowOpacity: 0 },

  avatarCircle: {
    width: 110,
    height: 110,
    borderRadius: 55,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 4,
    borderColor: "#fff",
  },
  avatarText: { color: "#fff", fontWeight: "900", fontSize: 32, letterSpacing: 1 },
  namePreview: { marginTop: 15, fontSize: 24, fontWeight: "900", color: "#1E293B" },

  card: {
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 20,
    marginBottom: 16,
    elevation: 3,
    shadowColor: "#6366f1",
    shadowOpacity: 0.06,
    shadowRadius: 12,
  },
  cardDark: {
    backgroundColor: "#111827",
    elevation: 0,
    shadowOpacity: 0,
  },

  cardHeader: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 20 },
  cardLabel: { fontSize: 16, fontWeight: "800", color: "#1E293B" },

  inputLabel: { fontSize: 11, fontWeight: "800", color: "#94A3B8", marginBottom: 8, marginLeft: 4 },
  inputLabelDark: { color: "#9CA3AF" },

  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderRadius: 16,
    paddingHorizontal: 15,
    height: 56,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  inputWrapperDark: {
    backgroundColor: "#0B1220",
    borderColor: "#1F2937",
  },

  inputFocused: { borderColor: "#6366f1", backgroundColor: "#fff" },
  inputFocusedDark: { borderColor: "#6366f1", backgroundColor: "#0B1220" },

  textInput: { flex: 1, fontSize: 16, fontWeight: "700", color: "#1E293B" },
  textInputDark: { color: "#E5E7EB" },

  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingTop: 15,
    backgroundColor: "#F8FAFC",
  },
  footerDark: { backgroundColor: "#0B1220" },

  saveBtn: {
    borderRadius: 20,
    overflow: "hidden",
    elevation: 4,
    shadowColor: "#6366f1",
    shadowOpacity: 0.2,
  },
  saveBtnDark: { elevation: 0, shadowOpacity: 0 },

  saveGradient: {
    paddingVertical: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  saveBtnText: { color: "#fff", fontSize: 16, fontWeight: "900" },

  textOnDark: { color: "#E5E7EB" },
  subTextOnDark: { color: "#9CA3AF" },
});
