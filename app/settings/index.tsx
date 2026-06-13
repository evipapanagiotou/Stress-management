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
import {
  cancelAllNotifications,
  getNotificationPreferences,
  registerForPushNotifications,
  saveNotificationPreferences,
  type NotificationPreferences,
} from "../../services/notification-service";
import { getExams } from "../../utils/storage";

const KEY_SOUND = "@settings_sound";

export default function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { darkMode, setDarkMode } = useTheme();

  const [soundEnabled, setSoundEnabled] = useState(true);
  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null);

  useEffect(() => {
    (async () => {
      const [savedSound, loadedPrefs] = await Promise.all([
        AsyncStorage.getItem(KEY_SOUND),
        getNotificationPreferences(),
      ]);
      if (savedSound !== null) setSoundEnabled(savedSound === "true");
      setPrefs(loadedPrefs);
    })();
  }, []);

  const toggleSound = async (value: boolean) => {
    setSoundEnabled(value);
    await AsyncStorage.setItem(KEY_SOUND, String(value));
  };

  const updatePref = async (patch: Partial<NotificationPreferences>) => {
    if (!prefs) return;
    const next = { ...prefs, ...patch };
    setPrefs(next);
    await registerForPushNotifications();
    await saveNotificationPreferences(next, await getExams());
  };

  const handleCancelReminders = async () => {
    await cancelAllNotifications();
    Alert.alert("Reminders cleared", "All scheduled reminders have been cancelled.");
  };

  const handleExportData = async () => {
    try {
      await exportAllData();
    } catch {
      Alert.alert("Export failed", "Could not export the app data.");
    }
  };

  const handleLogout = async () => {
    const result = await logout();
    if (result.success) router.replace("/auth/login");
    else Alert.alert("Sign out failed", result.error);
  };

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
              await cancelAllNotifications();
              await AsyncStorage.clear();
              setSoundEnabled(true);
              setPrefs(null);
              router.replace("/");
            } catch {
              Alert.alert("Error", "Could not clear data. Please try again.");
            }
          },
        },
      ]
    );
  };

  const dm = darkMode;
  const cardBg = dm ? "#334155" : "#fff";
  const textColor = dm ? "#fff" : "#1E293B";
  const subTextColor = dm ? "#94A3B8" : "#64748B";
  const dividerColor = dm ? "#475569" : "#F1F5F9";

  return (
    <View style={{ flex: 1 }}>
      <LinearGradient
        colors={dm ? ["#0F172A", "#1E293B"] : ["#EEF2FF", "#E0E7FF"]}
        style={StyleSheet.absoluteFillObject}
      />

      <SafeAreaView style={{ flex: 1 }}>
        <View style={[styles.header, { paddingTop: insets.top + 18 }]}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={[styles.backButton, dm && { backgroundColor: "#1e293b" }]}
          >
            <Ionicons name="chevron-back" size={24} color="#4338ca" />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, dm && { color: "#fff" }]}>Settings</Text>
          <View style={{ width: 44 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Profile card */}
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

          {/* App Experience */}
          <Text style={styles.sectionLabel}>App Experience</Text>
          <View style={[styles.settingsGroup, { backgroundColor: cardBg }]}>
            <View style={styles.settingRow}>
              <View style={styles.leftSide}>
                <View style={[styles.iconCircle, { backgroundColor: dm ? "#1e293b" : "#FEF3C7" }]}>
                  <Ionicons name="volume-high" size={20} color="#D97706" />
                </View>
                <Text style={[styles.settingText, { color: textColor }]}>Sounds</Text>
              </View>
              <Switch
                value={soundEnabled}
                onValueChange={toggleSound}
                trackColor={{ true: "#6366f1", false: "#CBD5E1" }}
              />
            </View>

            <View style={[styles.divider, { backgroundColor: dividerColor }]} />

            <View style={styles.settingRow}>
              <View style={styles.leftSide}>
                <View style={[styles.iconCircle, { backgroundColor: dm ? "#1e293b" : "#F1F5F9" }]}>
                  <Ionicons name="moon" size={20} color={dm ? "#E5E7EB" : "#1E293B"} />
                </View>
                <Text style={[styles.settingText, { color: textColor }]}>Dark Mode</Text>
              </View>
              <Switch
                value={darkMode}
                onValueChange={setDarkMode}
                trackColor={{ true: "#6366f1", false: "#CBD5E1" }}
              />
            </View>
          </View>

          {/* Reminders */}
          <Text style={styles.sectionLabel}>Reminders</Text>
          <View style={[styles.settingsGroup, { backgroundColor: cardBg }]}>
            <View style={styles.settingRow}>
              <View style={styles.leftSide}>
                <View style={[styles.iconCircle, { backgroundColor: dm ? "#1e293b" : "#ECFDF5" }]}>
                  <Ionicons name="book-outline" size={20} color="#15803D" />
                </View>
                <View>
                  <Text style={[styles.settingText, { color: textColor }]}>Study Reminder</Text>
                  <Text style={[styles.settingSub, { color: subTextColor }]}>Daily at 18:00</Text>
                </View>
              </View>
              <Switch
                value={prefs?.studyReminder ?? false}
                onValueChange={(v) => updatePref({ studyReminder: v })}
                trackColor={{ true: "#6366f1", false: "#CBD5E1" }}
              />
            </View>

            <View style={[styles.divider, { backgroundColor: dividerColor }]} />

            <View style={styles.settingRow}>
              <View style={styles.leftSide}>
                <View style={[styles.iconCircle, { backgroundColor: dm ? "#1e293b" : "#EEF2FF" }]}>
                  <Ionicons name="happy-outline" size={20} color="#4338ca" />
                </View>
                <View>
                  <Text style={[styles.settingText, { color: textColor }]}>Stress Check-ins</Text>
                  <Text style={[styles.settingSub, { color: subTextColor }]}>Morning & evening prompts</Text>
                </View>
              </View>
              <Switch
                value={prefs?.stressCheckIns ?? false}
                onValueChange={(v) => updatePref({ stressCheckIns: v })}
                trackColor={{ true: "#6366f1", false: "#CBD5E1" }}
              />
            </View>

            <View style={[styles.divider, { backgroundColor: dividerColor }]} />

            <View style={styles.settingRow}>
              <View style={styles.leftSide}>
                <View style={[styles.iconCircle, { backgroundColor: dm ? "#1e293b" : "#FFF7ED" }]}>
                  <Ionicons name="calendar-outline" size={20} color="#C2410C" />
                </View>
                <View>
                  <Text style={[styles.settingText, { color: textColor }]}>Exam Reminders</Text>
                  <Text style={[styles.settingSub, { color: subTextColor }]}>1 & 3 days before exams</Text>
                </View>
              </View>
              <Switch
                value={prefs?.examReminders ?? false}
                onValueChange={(v) => updatePref({ examReminders: v })}
                trackColor={{ true: "#6366f1", false: "#CBD5E1" }}
              />
            </View>
          </View>

          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: cardBg, borderColor: dm ? "#7f1d1d" : "#FECACA" }]}
            onPress={handleCancelReminders}
            activeOpacity={0.9}
          >
            <Ionicons name="notifications-off-outline" size={20} color="#DC2626" />
            <Text style={[styles.actionBtnText, { color: "#DC2626" }]}>Cancel scheduled reminders</Text>
          </TouchableOpacity>

          {/* Account */}
          <Text style={[styles.sectionLabel, { marginTop: 8 }]}>Account</Text>

          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: cardBg, borderColor: dm ? "#334155" : "#E2E8F0" }]}
            onPress={handleExportData}
            activeOpacity={0.9}
          >
            <Ionicons name="download-outline" size={20} color="#4F46E5" />
            <Text style={[styles.actionBtnText, { color: "#4F46E5" }]}>Export App Data</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: cardBg, borderColor: dm ? "#334155" : "#E2E8F0" }]}
            onPress={() => router.push("/auth/login")}
            activeOpacity={0.9}
          >
            <Ionicons name="cloud-upload-outline" size={20} color="#0F766E" />
            <Text style={[styles.actionBtnText, { color: "#0F766E" }]}>Cloud Sync Account</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: cardBg, borderColor: dm ? "#334155" : "#E2E8F0" }]}
            onPress={handleLogout}
            activeOpacity={0.9}
          >
            <Ionicons name="log-out-outline" size={20} color={dm ? "#94A3B8" : "#64748B"} />
            <Text style={[styles.actionBtnText, { color: dm ? "#94A3B8" : "#64748B" }]}>Sign Out</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: cardBg, borderColor: dm ? "#450a0a" : "#FEE2E2", marginBottom: 40 }]}
            onPress={handleClearAllData}
            activeOpacity={0.9}
          >
            <Ionicons name="trash-outline" size={20} color="#EF4444" />
            <Text style={[styles.actionBtnText, { color: "#EF4444" }]}>Clear All Data</Text>
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
  headerTitle: { fontSize: 22, fontWeight: "800", color: "#1E1B4B" },
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
    borderRadius: 22,
    paddingHorizontal: 16,
    marginBottom: 12,
    elevation: 2,
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    gap: 12,
  },
  leftSide: { flexDirection: "row", alignItems: "center", gap: 14, flex: 1 },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  settingText: { fontSize: 15, fontWeight: "700" },
  settingSub: { fontSize: 12, fontWeight: "500", marginTop: 1 },
  divider: { height: 1 },

  actionBtn: {
    flexDirection: "row",
    padding: 16,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    borderWidth: 1,
    marginBottom: 10,
    elevation: 1,
  },
  actionBtnText: { fontWeight: "700", fontSize: 15 },
});
