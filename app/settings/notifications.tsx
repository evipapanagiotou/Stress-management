import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { Alert, SafeAreaView, StyleSheet, Switch, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../../context/ThemeContext";
import {
  cancelAllNotifications,
  getNotificationPreferences,
  registerForPushNotifications,
  saveNotificationPreferences,
  type NotificationPreferences,
} from "../../services/notification-service";
import { getExams } from "../../utils/storage";

export default function NotificationSettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { darkMode } = useTheme();
  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null);

  const bgColors = darkMode ? (["#0f172a", "#1e293b"] as const) : (["#F8FAFC", "#EEF2FF"] as const);
  const cardBg = darkMode ? "#1e293b" : "#ffffff";
  const cardBorder = darkMode ? "#334155" : "#E2E8F0";
  const textPrimary = darkMode ? "#f1f5f9" : "#111827";
  const textSecondary = darkMode ? "#94a3b8" : "#64748B";
  const iconBg = darkMode ? "#334155" : "#ffffff";

  useEffect(() => {
    getNotificationPreferences().then(setPrefs);
  }, []);

  const update = async (patch: Partial<NotificationPreferences>) => {
    if (!prefs) return;
    const next = { ...prefs, ...patch };
    setPrefs(next);
    await registerForPushNotifications();
    await saveNotificationPreferences(next, await getExams());
  };

  const clear = async () => {
    await cancelAllNotifications();
    Alert.alert("Notifications cleared", "All scheduled reminders were cancelled.");
  };

  return (
    <LinearGradient colors={bgColors} style={styles.bg}>
      <SafeAreaView style={styles.safe}>
        <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
          <TouchableOpacity onPress={() => router.back()} style={[styles.iconButton, { backgroundColor: iconBg }]}>
            <Ionicons name="chevron-back" size={22} color={textPrimary} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: textPrimary }]}>Notifications</Text>
          <View style={styles.iconButtonGhost} />
        </View>

        <View style={styles.content}>
          <View style={[styles.group, { backgroundColor: cardBg, borderColor: cardBorder }]}>
            <View style={styles.row}>
              <View>
                <Text style={[styles.rowTitle, { color: textPrimary }]}>Study reminder</Text>
                <Text style={[styles.rowSub, { color: textSecondary }]}>Daily at 18:00</Text>
              </View>
              <Switch value={prefs?.studyReminder ?? false} onValueChange={(value) => update({ studyReminder: value })} trackColor={{ true: "#6366f1", false: "#CBD5E1" }} />
            </View>
            <View style={[styles.divider, { backgroundColor: cardBorder }]} />
            <View style={styles.row}>
              <View>
                <Text style={[styles.rowTitle, { color: textPrimary }]}>Stress check-ins</Text>
                <Text style={[styles.rowSub, { color: textSecondary }]}>Morning and evening prompts</Text>
              </View>
              <Switch value={prefs?.stressCheckIns ?? false} onValueChange={(value) => update({ stressCheckIns: value })} trackColor={{ true: "#6366f1", false: "#CBD5E1" }} />
            </View>
            <View style={[styles.divider, { backgroundColor: cardBorder }]} />
            <View style={styles.row}>
              <View>
                <Text style={[styles.rowTitle, { color: textPrimary }]}>Exam reminders</Text>
                <Text style={[styles.rowSub, { color: textSecondary }]}>One and three days before exams</Text>
              </View>
              <Switch value={prefs?.examReminders ?? false} onValueChange={(value) => update({ examReminders: value })} trackColor={{ true: "#6366f1", false: "#CBD5E1" }} />
            </View>
          </View>

          <TouchableOpacity onPress={clear} style={[styles.clearButton, { backgroundColor: cardBg, borderColor: darkMode ? "#7f1d1d" : "#FECACA" }]}>
            <Ionicons name="notifications-off-outline" size={20} color="#DC2626" />
            <Text style={styles.clearText}>Cancel scheduled reminders</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1 },
  safe: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  iconButtonGhost: { width: 44, height: 44 },
  headerTitle: { color: "#111827", fontSize: 22, fontWeight: "800" },
  content: { padding: 20, gap: 16 },
  group: {
    backgroundColor: "#fff",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  row: {
    minHeight: 76,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
  },
  rowTitle: { color: "#111827", fontSize: 16, fontWeight: "800" },
  rowSub: { color: "#64748B", marginTop: 4 },
  divider: { height: 1, backgroundColor: "#E2E8F0", marginLeft: 16 },
  clearButton: {
    height: 54,
    borderRadius: 8,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#FECACA",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  clearText: { color: "#DC2626", fontWeight: "800" },
});
