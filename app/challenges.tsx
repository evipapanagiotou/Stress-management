import React, { useCallback, useMemo, useState } from "react";
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  Alert, 
  StatusBar, 
  SafeAreaView 
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "../context/ThemeContext";
import { CHALLENGES, computeProgress, iconForLevel, loadStats, resetStats, ChallengeStats } from "../utils/challenges";

/* ------------------------------------------------------------------
   UI Components
------------------------------------------------------------------ */

const ProgressBar = ({ ratio, darkMode }: { ratio: number; darkMode: boolean }) => {
  const pct = Math.round(Math.max(0, Math.min(1, ratio)) * 100);
  return (
    <View style={[styles.progressTrack, darkMode && styles.progressTrackDark]}>
      <View style={[styles.progressFill, { width: `${pct}%` }]} />
    </View>
  );
};

/* ------------------------------------------------------------------
   Main Screen
------------------------------------------------------------------ */

export default function ChallengesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { darkMode } = useTheme();

  const [stats, setStats] = useState<ChallengeStats | null>(null);

  const load = useCallback(async () => {
    const s = await loadStats();
    setStats(s);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const items = useMemo(() => {
    if (!stats) return [];
    return CHALLENGES.map((c) => ({ c, p: computeProgress(c, stats) }));
  }, [stats]);

  const activeItems = useMemo(() => items.filter(x => !x.p.completed), [items]);
  const completedItems = useMemo(() => items.filter(x => x.p.completed), [items]);

  const getRank = () => {
    const count = completedItems.length;
    if (count === 0) return "Beginner";
    if (count < 3) return "Rising Star";
    if (count < 6) return "Focus Master";
    return "Legendary Scholar";
  };

  return (
    <SafeAreaView style={[styles.container, darkMode && styles.containerDark]}>
      <StatusBar barStyle={darkMode ? "light-content" : "dark-content"} />
      
      <LinearGradient
        colors={darkMode ? ["#0B1220", "#0B1220"] : ["#EEF2FF", "#F8FAFC"]}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={() => router.back()} style={[styles.backBtn, darkMode && styles.backBtnDark]}>
          <Ionicons name="chevron-back" size={24} color={darkMode ? "#E5E7EB" : "#1E293B"} />
        </TouchableOpacity>

        <View style={styles.headerTitleRow}>
          <Text style={[styles.headerTitle, darkMode && styles.textOnDark]}>Challenges</Text>
        </View>

        <TouchableOpacity onPress={() => {
            Alert.alert("Reset progress", "This will restart all challenges. Continue?", [
              { text: "Cancel", style: "cancel" },
              { text: "Reset", style: "destructive", onPress: async () => setStats(await resetStats()) },
            ]);
        }} style={[styles.backBtn, darkMode && styles.backBtnDark]}>
          <Ionicons name="refresh-outline" size={20} color={darkMode ? "#94A3B8" : "#64748B"} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        
        {/* Summary Card */}
        <View style={[styles.summaryCard, darkMode && styles.cardDark]}>
            <View style={styles.summaryTop}>
                <View>
                    <Text style={[styles.summaryLabel, darkMode && styles.subTextOnDark]}>YOUR RANK</Text>
                    <Text style={[styles.summaryValue, darkMode && styles.textOnDark]}>{getRank()}</Text>
                </View>
                <View style={styles.statsBadge}>
                    <Text style={styles.statsBadgeText}>{completedItems.length} / {items.length}</Text>
                </View>
            </View>
            <View style={[styles.summaryDivider, darkMode && { backgroundColor: "#1F2937" }]} />
            <Text style={[styles.summaryFooter, darkMode && styles.subTextOnDark]}>
                You have completed <Text style={{fontWeight: '900', color: '#6366f1'}}>{completedItems.length}</Text> challenges so far.
            </Text>
        </View>

        {/* Active Challenges */}
        {activeItems.length > 0 && (
          <>
            <Text style={[styles.sectionTitle, darkMode && styles.textOnDark]}>Work in Progress</Text>
            {activeItems.map(({ c, p }) => <ChallengeItem key={c.id} c={c} p={p} darkMode={darkMode} />)}
          </>
        )}

        {/* Completed Milestones */}
        {completedItems.length > 0 && (
          <>
            <Text style={[styles.sectionTitle, darkMode && styles.textOnDark, { marginTop: 20 }]}>Completed Milestones</Text>
            {completedItems.map(({ c, p }) => <ChallengeItem key={c.id} c={c} p={p} darkMode={darkMode} isDone />)}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function ChallengeItem({ c, p, darkMode, isDone }: any) {
    return (
        <View style={[styles.challengeCard, darkMode && styles.cardDark, isDone && (darkMode ? styles.cardDoneDark : styles.cardDone)]}>
            <View style={styles.row}>
                <View style={[styles.iconBox, darkMode && styles.iconBoxDark, isDone && (darkMode ? styles.cardDoneDark : styles.iconBoxDone)]}>
                    <Ionicons name={isDone ? "checkmark" : iconForLevel(c.level) as any} size={22} color={isDone ? "#10b981" : "#6366f1"} />
                </View>
                <View style={{ flex: 1, marginLeft: 15 }}>
                    <Text style={[styles.challengeTitle, darkMode && styles.textOnDark]}>{c.title}</Text>
                    <Text style={[styles.challengeDesc, darkMode && styles.subTextOnDark]}>{c.description}</Text>
                    {!isDone && (
                        <View style={{ marginTop: 12 }}>
                            <ProgressBar ratio={p.ratio} darkMode={darkMode} />
                            <Text style={[styles.progressVal, darkMode && styles.subTextOnDark]}>{p.currentText}</Text>
                        </View>
                    )}
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  containerDark: { backgroundColor: "#0B1220" },
  header: { paddingHorizontal: 20, paddingBottom: 15, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  headerTitleRow: { alignItems: "center" },
  headerTitle: { fontSize: 20, fontWeight: "900", color: "#1E293B" },
  backBtn: { width: 44, height: 44, borderRadius: 15, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", elevation: 2 },
  backBtnDark: { backgroundColor: "#111827", borderWidth: 1, borderColor: "#1F2937" },
  textOnDark: { color: "#E5E7EB" },
  subTextOnDark: { color: "#94A3B8" },
  summaryCard: { backgroundColor: "#fff", borderRadius: 24, padding: 20, marginBottom: 25, borderWidth: 1, borderColor: "#EEF2FF", elevation: 2 },
  cardDark: { backgroundColor: "#111827", borderColor: "#1F2937" },
  summaryTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  summaryLabel: { fontSize: 10, fontWeight: '900', color: '#64748B', letterSpacing: 1 },
  summaryValue: { fontSize: 22, fontWeight: '900', color: '#1E293B', marginTop: 2 },
  statsBadge: { backgroundColor: '#6366f1', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  statsBadgeText: { color: '#fff', fontWeight: '900', fontSize: 12 },
  summaryDivider: { height: 1, backgroundColor: '#F1F5F9', marginVertical: 15 },
  summaryFooter: { fontSize: 13, fontWeight: '600', color: '#64748B' },
  sectionTitle: { fontSize: 18, fontWeight: '900', marginBottom: 12, marginLeft: 5 },
  challengeCard: { backgroundColor: "#fff", borderRadius: 24, padding: 18, marginBottom: 16, borderWidth: 1, borderColor: "#EEF2FF" },
  cardDone: { backgroundColor: "#F5F3FF", borderColor: "#E0E7FF" },
  cardDoneDark: { backgroundColor: "rgba(99,102,241,0.04)", borderColor: "rgba(99,102,241,0.2)" },
  row: { flexDirection: "row" },
  iconBox: { width: 50, height: 50, borderRadius: 16, backgroundColor: "#F8FAFC", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#F1F5F9" },
  iconBoxDark: { backgroundColor: "#0B1220", borderColor: "#1F2937" },
  iconBoxDone: { backgroundColor: "#fff", borderColor: "#E0E7FF" },
  challengeTitle: { fontSize: 16, fontWeight: "900", color: "#1E293B" },
  challengeDesc: { fontSize: 13, fontWeight: "600", color: "#64748B", marginTop: 4, lineHeight: 18 },
  progressTrack: { height: 8, backgroundColor: "#F1F5F9", borderRadius: 10, overflow: "hidden" },
  progressTrackDark: { backgroundColor: "#1F2937" },
  progressFill: { height: "100%", backgroundColor: "#6366f1" },
  progressVal: { fontSize: 11, fontWeight: '800', marginTop: 8, color: '#64748B' }
});