import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Switch,
  ScrollView,
  SafeAreaView,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../../context/ThemeContext";
import { exportAllData } from "../../services/csv-export";
import { logout } from "../../services/auth-service";
import { cancelAllNotifications } from "../../services/notification-service";
// Storage Keys (settings)
const KEY_NOTIFICATIONS = "@settings_notifs";
const KEY_SOUND = "@settings_sound";

export default function ColorfulSettings() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [notifications, setNotifications] = useState(true);
  const { darkMode, setDarkMode } = useTheme();

  const [soundEnabled, setSoundEnabled] = useState(true);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const savedNotifs = await AsyncStorage.getItem(KEY_NOTIFICATIONS);
      const savedSound = await AsyncStorage.getItem(KEY_SOUND);

      if (savedNotifs !== null) setNotifications(savedNotifs === "true");
      if (savedSound !== null) setSoundEnabled(savedSound === "true");
    } catch (e) {
      console.error("Failed to load settings", e);
    }
  };

  const toggleSetting = async (key: string, value: boolean, setter: (v: boolean) => void) => {
    setter(value);
    try {
      await AsyncStorage.setItem(key, String(value));
    } catch (e) {
      console.error("Failed to save setting", e);
    }
  };

  const handleExportData = async () => {
    try {
      await exportAllData();
    } catch (e) {
      console.error("Failed to export data", e);
      Alert.alert("Export failed", "Could not export the app data.");
    }
  };

  const handleLogout = async () => {
    const result = await logout();
    if (result.success) router.replace("/auth/login");
    else Alert.alert("Sign out failed", result.error);
  };

  // ✅ Clear All Data (full reset)
  const handleClearAllData = () => {
    Alert.alert(
      "Clear All Data",
      "This will permanently delete all saved data on this device (name, exams, stats, progress, settings). Continue?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear",
          style: "destructive",
          onPress: async () => {
            try {
              const logoutResult = await logout();
              if (!logoutResult.success) {
                Alert.alert("Sign out failed", logoutResult.error ?? "Could not sign out. Try again.");
                return;
              }
              await cancelAllNotifications();
              await AsyncStorage.clear();

              // Reset local toggles so UI doesn't flash old values
              setNotifications(true);
              setSoundEnabled(true);

              // Go back to the start screen
              router.replace("/auth/login");
            } catch (e) {
              console.error("Failed to clear app data", e);
              Alert.alert("Error", "Could not clear data. Please try again.");
            }
          },
        },
      ]
    );
  };

  return (
    <View style={{ flex: 1 }}>
      <LinearGradient
        colors={darkMode ? ["#0F172A", "#1E293B"] : ["#EEF2FF", "#E0E7FF"]}
        style={StyleSheet.absoluteFillObject}
      />

      <SafeAreaView style={{ flex: 1 }}>
        <View style={[styles.header, { paddingTop: insets.top + 18 }]}>
          <TouchableOpacity onPress={() => router.back()} style={[styles.backButton, darkMode && { backgroundColor: "#1e293b" }]}>
            <Ionicons name="chevron-back" size={24} color="#4338ca" />
          </TouchableOpacity>

          <Text style={[styles.headerTitle, darkMode && { color: "#fff" }]}>Settings</Text>

          <View style={{ width: 44 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <LinearGradient
            colors={["#6366f1", "#818cf8"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.profileCard}
          >
            <View style={styles.avatarPlaceholder}>
              <Ionicons name="person" size={30} color="#6366f1" />
            </View>

            <View style={styles.profileInfo}>
              <Text style={styles.userName}>Student Account</Text>
              <Text style={styles.userSub}>Manage your stress plan</Text>
            </View>

            <TouchableOpacity style={styles.editBtn} onPress={() => router.push("/profile")}>
              <Text style={styles.editBtnText}>Edit</Text>
            </TouchableOpacity>
          </LinearGradient>

          <Text style={styles.sectionLabel}>App Experience</Text>

          <View style={[styles.settingsGroup, darkMode && styles.darkGroup]}>
            <View style={styles.settingRow}>
              <View style={styles.leftSide}>
                <View style={[styles.iconCircle, { backgroundColor: darkMode ? "#1e293b" : "#E0E7FF" }]}>
                  <Ionicons name="notifications" size={20} color="#4338ca" />
                </View>

                <Text style={[styles.settingText, darkMode && { color: "#fff" }]}>Notifications</Text>
              </View>

              <Switch
                value={notifications}
                onValueChange={(v) => toggleSetting(KEY_NOTIFICATIONS, v, setNotifications)}
                trackColor={{ true: "#6366f1", false: "#CBD5E1" }}
              />
            </View>

            <View style={[styles.divider, darkMode && { backgroundColor: "#475569" }]} />

            <View style={styles.settingRow}>
              <View style={styles.leftSide}>
                <View style={[styles.iconCircle, { backgroundColor: darkMode ? "#1e293b" : "#FEF3C7" }]}>
                  <Ionicons name="volume-high" size={20} color="#D97706" />
                </View>

                <Text style={[styles.settingText, darkMode && { color: "#fff" }]}>Sounds</Text>
              </View>

              <Switch
                value={soundEnabled}
                onValueChange={(v) => toggleSetting(KEY_SOUND, v, setSoundEnabled)}
                trackColor={{ true: "#6366f1", false: "#CBD5E1" }}
              />
            </View>

            <View style={[styles.divider, darkMode && { backgroundColor: "#475569" }]} />

            <View style={styles.settingRow}>
              <View style={styles.leftSide}>
                <View style={[styles.iconCircle, { backgroundColor: darkMode ? "#1e293b" : "#F1F5F9" }]}>
                  <Ionicons name="moon" size={20} color={darkMode ? "#E5E7EB" : "#1E293B"} />
                </View>

                <Text style={[styles.settingText, darkMode && { color: "#fff" }]}>Dark Mode</Text>
              </View>

              <Switch
                value={darkMode}
                onValueChange={setDarkMode}
                trackColor={{ true: "#6366f1", false: "#CBD5E1" }}
              />
            </View>

            <View style={[styles.divider, darkMode && { backgroundColor: "#475569" }]} />

            <TouchableOpacity style={styles.settingRow} onPress={() => router.push("/settings/notifications")}>
              <View style={styles.leftSide}>
                <View style={[styles.iconCircle, { backgroundColor: darkMode ? "#1e293b" : "#DCFCE7" }]}>
                  <Ionicons name="alarm-outline" size={20} color="#15803D" />
                </View>

                <Text style={[styles.settingText, darkMode && { color: "#fff" }]}>Reminder Preferences</Text>
              </View>

              <Ionicons name="chevron-forward" size={20} color="#94A3B8" />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.clearBtn, darkMode && { backgroundColor: "#1e293b", borderColor: "#334155" }]}
            onPress={handleExportData}
            activeOpacity={0.9}
          >
            <Ionicons name="download-outline" size={20} color="#4F46E5" />
            <Text style={[styles.clearText, { color: "#4F46E5" }]}>Export App Data</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.clearBtn, darkMode && { backgroundColor: "#1e293b", borderColor: "#334155" }]}
            onPress={() => router.push("/auth/login")}
            activeOpacity={0.9}
          >
            <Ionicons name="cloud-upload-outline" size={20} color="#0F766E" />
            <Text style={[styles.clearText, { color: "#0F766E" }]}>Cloud Sync Account</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.clearBtn, darkMode && { backgroundColor: "#1e293b", borderColor: "#334155" }]}
            onPress={handleLogout}
            activeOpacity={0.9}
          >
            <Ionicons name="log-out-outline" size={20} color={darkMode ? "#94A3B8" : "#64748B"} />
            <Text style={[styles.clearText, { color: darkMode ? "#94A3B8" : "#64748B" }]}>Sign Out</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.clearBtn, darkMode && { backgroundColor: "#1e293b", borderColor: "#450a0a" }]}
            onPress={handleClearAllData}
            activeOpacity={0.9}
          >
            <Ionicons name="trash-outline" size={20} color="#EF4444" />
            <Text style={styles.clearText}>Clear All Data</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  backButton: {
    padding: 10,
    backgroundColor: "#fff",
    borderRadius: 15,
    elevation: 3,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#1E1B4B",
  },
  scrollContent: { padding: 20 },

  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 20,
    borderRadius: 25,
    marginBottom: 25,
    elevation: 8,
  },
  avatarPlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 20,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  profileInfo: { flex: 1, marginLeft: 15 },
  userName: { color: "#fff", fontSize: 18, fontWeight: "700" },
  userSub: { color: "#E0E7FF", fontSize: 13, marginTop: 2 },
  editBtn: {
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 12,
  },
  editBtnText: { color: "#fff", fontWeight: "700" },

  sectionLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#6366f1",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 10,
    marginLeft: 5,
  },

  settingsGroup: {
    backgroundColor: "#fff",
    borderRadius: 22,
    paddingHorizontal: 16,
    marginBottom: 25,
    elevation: 2,
  },
  darkGroup: { backgroundColor: "#334155" },

  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 15,
  },
  leftSide: { flexDirection: "row", alignItems: "center", gap: 15 },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  settingText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1E293B",
  },
  divider: { height: 1, backgroundColor: "#F1F5F9" },

  // ✅ Clear button styles (replaces Sign Out)
  clearBtn: {
    flexDirection: "row",
    backgroundColor: "#fff",
    padding: 18,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: "#FEE2E2",
    marginBottom: 30,
  },
  darkClearBtn: {
    backgroundColor: "#1e293b",
    borderColor: "#450a0a",
  },
  clearText: {
    color: "#EF4444",
    fontWeight: "800",
    fontSize: 16,
  },
});
