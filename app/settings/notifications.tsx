import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { Alert, SafeAreaView, StyleSheet, Switch, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
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
  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null);

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
    <LinearGradient colors={["#F8FAFC", "#EEF2FF"]} style={styles.bg}>
      <SafeAreaView style={styles.safe}>
        <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.iconButton}>
            <Ionicons name="chevron-back" size={22} color="#1F2937" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Notifications</Text>
          <View style={styles.iconButtonGhost} />
        </View>

        <View style={styles.content}>
          <View style={styles.group}>
            <View style={styles.row}>
              <View>
                <Text style={styles.rowTitle}>Study reminder</Text>
                <Text style={styles.rowSub}>Daily at 18:00</Text>
              </View>
              <Switch value={prefs?.studyReminder ?? false} onValueChange={(value) => update({ studyReminder: value })} />
            </View>
            <View style={styles.divider} />
            <View style={styles.row}>
              <View>
                <Text style={styles.rowTitle}>Stress check-ins</Text>
                <Text style={styles.rowSub}>Morning and evening prompts</Text>
              </View>
              <Switch value={prefs?.stressCheckIns ?? false} onValueChange={(value) => update({ stressCheckIns: value })} />
            </View>
            <View style={styles.divider} />
            <View style={styles.row}>
              <View>
                <Text style={styles.rowTitle}>Exam reminders</Text>
                <Text style={styles.rowSub}>One and three days before exams</Text>
              </View>
              <Switch value={prefs?.examReminders ?? false} onValueChange={(value) => update({ examReminders: value })} />
            </View>
          </View>

          <TouchableOpacity onPress={clear} style={styles.clearButton}>
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
