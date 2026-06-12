import React, { useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Alert,
  StatusBar,
  Dimensions,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { getExams, Exam, deleteExam } from "../../../utils/storage";
import { useFocusEffect } from "@react-navigation/native";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../../../context/ThemeContext";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";

const { width } = Dimensions.get("window");
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function CalendarScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { darkMode } = useTheme();
  const tabBarHeight = useBottomTabBarHeight();

  const [selectedDate, setSelectedDate] = useState(new Date());
  const [exams, setExams] = useState<Exam[]>([]);

  // Load Data
  const loadData = useCallback(async () => {
    try {
      const exs = await getExams();
      setExams(exs);
    } catch (error) {
      console.error("Error loading calendar data:", error);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  // Haptic Feedback Helper
  const triggerHaptic = () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  // Delete Exam Logic
  const confirmDeleteExam = (id: string) => {
    Alert.alert(
      "Delete Exam?",
      "Are you sure you want to remove this exam from your schedule?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            await deleteExam(id);
            await loadData();
            if (Platform.OS !== "web") {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }
          },
        },
      ]
    );
  };

  // Calendar Logic Helpers
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const days = new Date(year, month + 1, 0).getDate();
    const firstDay = new Date(year, month, 1).getDay();
    return { days, firstDay };
  };

  const { days, firstDay } = getDaysInMonth(selectedDate);
  const startOfToday = new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());

  // Next Exam Countdown Logic (fixed "1 day" feeling)
  const nextExamInfo = useMemo(() => {
    const futureExams = exams
      .map((e) => ({ ...e, dObj: new Date(e.date) }))
      .filter((e) => {
        const startExam = new Date(e.dObj.getFullYear(), e.dObj.getMonth(), e.dObj.getDate());
        return startExam.getTime() >= startOfToday.getTime();
      })
      .sort((a, b) => a.dObj.getTime() - b.dObj.getTime());

    if (futureExams.length === 0) return null;

    const next = futureExams[0];
    const startExam = new Date(next.dObj.getFullYear(), next.dObj.getMonth(), next.dObj.getDate());
    const diffTime = startExam.getTime() - startOfToday.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

    return { ...next, daysRemaining: diffDays };
  }, [exams, startOfToday]);

  const upcomingExamsCount = useMemo(() => {
  return exams.filter((exam) => {
    const examDate = new Date(exam.date);
    return examDate.getTime() >= startOfToday.getTime();
  }).length;
}, [exams, startOfToday]);

const examsNext30Days = useMemo(() => {
  const thirtyDaysFromNow = new Date(startOfToday);
  thirtyDaysFromNow.setDate(startOfToday.getDate() + 30);

  return exams.filter((exam) => {
    const examDate = new Date(exam.date);
    return examDate >= startOfToday && examDate <= thirtyDaysFromNow;
  }).length;
}, [exams, startOfToday]);

const pressureLevel = useMemo(() => {
  if (!nextExamInfo) return null;

  if (nextExamInfo.daysRemaining <= 6) {
    return {
      label: "Exam Soon",
      color: "#EF4444",
      message: "Exam is approaching soon. Prioritize focused preparation.",
    };
  }

  if (nextExamInfo.daysRemaining <= 14) {
    return {
      label: "Upcoming",
      color: "#F59E0B",
      message: "There is still time, but consistent study planning is recommended.",
    };
  }

  return {
    label: "On Track",
    color: "#10B981",
    message: "You have enough time to prepare with a steady study schedule.",
  };
}, [nextExamInfo]);

  const isSameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();

  // ✅ FIXED: always render 7 cells per week (pads both start & end)
  const renderCalendar = () => {
    const calendar: JSX.Element[] = [];
    let week: JSX.Element[] = [];

    // start padding
    for (let i = 0; i < firstDay; i++) {
      week.push(
        <View key={`empty-start-${i}`} style={[styles.calendarDay, darkMode && styles.calendarDayDark]} />
      );
    }

    for (let day = 1; day <= days; day++) {
      const date = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), day);
      const isToday = isSameDay(new Date(), date);
      const isSelected = isSameDay(selectedDate, date);
      const hasEvents = exams.some((e) => isSameDay(new Date(e.date), date));

      week.push(
        <TouchableOpacity
          key={`day-${day}`}
          style={[
            styles.calendarDay,
            darkMode && styles.calendarDayDark,
            isToday && (darkMode ? styles.todayDark : styles.today),
            isSelected && styles.selectedDay,
          ]}
          onPress={() => {
            triggerHaptic();
            setSelectedDate(date);
          }}
          activeOpacity={0.7}
        >
          <Text
            style={[
              styles.dayText,
              darkMode && styles.dayTextDark,
              isToday && (darkMode ? styles.todayTextDark : styles.todayText),
              isSelected && styles.selectedDayText,
            ]}
          >
            {day}
          </Text>

          {hasEvents && (
            <View
              style={[
                styles.eventDot,
                isSelected && { backgroundColor: "#fff" },
                darkMode && !isSelected && styles.eventDotDark,
              ]}
            />
          )}
        </TouchableOpacity>
      );

      const isEndOfWeek = (firstDay + day) % 7 === 0;
      const isEndOfMonth = day === days;

      if (isEndOfWeek || isEndOfMonth) {
        // end padding
        if (isEndOfMonth) {
          while (week.length < 7) {
            week.push(
              <View
                key={`empty-end-${day}-${week.length}`}
                style={[styles.calendarDay, darkMode && styles.calendarDayDark]}
              />
            );
          }
        }

        calendar.push(
          <View key={`week-${day}`} style={styles.calendarWeek}>
            {week}
          </View>
        );
        week = [];
      }
    }

    return calendar;
  };

  const dayExams = exams.filter((exam) => new Date(exam.date).toDateString() === selectedDate.toDateString());

  return (
    <View style={{ flex: 1 }}>
      <StatusBar barStyle={darkMode ? "light-content" : "dark-content"} />
      <LinearGradient
        colors={darkMode ? ["#0B1220", "#111827"] : ["#EEF2FF", "#F8FAFC"]}
        style={StyleSheet.absoluteFillObject}
      />

      <SafeAreaView style={{ flex: 1 }}>
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
          <TouchableOpacity onPress={() => router.back()} style={[styles.backButton, darkMode && styles.backButtonDark]}>
            <Ionicons name="chevron-back" size={24} color="#6366f1" />
          </TouchableOpacity>

          <View style={{ alignItems: "center" }}>
            <Text style={[styles.headerTitle, darkMode && styles.textOnDark]}>Calendar</Text>
            <Text style={[styles.headerSub, darkMode && styles.subTextOnDark]}>Plan your success</Text>
          </View>

          <TouchableOpacity onPress={() => router.push("/exams/add")} style={styles.addButton}>
            <Ionicons name="add" size={26} color="#fff" />
          </TouchableOpacity>
        </View>

        <ScrollView
  contentContainerStyle={{ paddingBottom: tabBarHeight + insets.bottom + 24 }}
  showsVerticalScrollIndicator={false}
>
          {/* Countdown Widget */}
          {nextExamInfo && (
            <LinearGradient
              colors={["#4F46E5", "#7C3AED"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.countdownCard}
            >
              <View style={{ flex: 1 }}>
                <View style={styles.countdownInfo}>
                  <View style={styles.iconCircle}>
                    <Ionicons name="hourglass-outline" size={20} color="#4F46E5" />
                  </View>
                  <View>
                    <Text style={styles.countdownLabel}>NEXT EXAM</Text>
                    <Text style={styles.countdownSubject}>{nextExamInfo.subject}</Text>
                  </View>
                </View>
                {pressureLevel && (
                  <View style={[styles.pressureBadge, { backgroundColor: pressureLevel.color }]}>
                    <Text style={styles.pressureBadgeText}>{pressureLevel.label}</Text>
                  </View>
                )}
              </View>

              <View style={styles.daysBadge}>
                <Text style={styles.daysNumber}>
                  {nextExamInfo.daysRemaining === 0 ? "Today" : nextExamInfo.daysRemaining}
                </Text>
                <Text style={styles.daysText}>{nextExamInfo.daysRemaining === 1 ? "day" : "days"}</Text>
              </View>
            </LinearGradient>
          )}

          <View style={[styles.loadCard, darkMode && styles.loadCardDark]}>
  <View style={styles.loadHeader}>
    <View style={[styles.loadIcon, darkMode && { backgroundColor: "rgba(99,102,241,0.15)" }]}>
      <Ionicons name="bar-chart-outline" size={20} color="#6366f1" />
    </View>

    <View style={{ flex: 1 }}>
      <Text style={[styles.loadTitle, darkMode && styles.textOnDark]}>
        Academic Load
      </Text>
      <Text style={[styles.loadSubtitle, darkMode && styles.subTextOnDark]}>
        {upcomingExamsCount} upcoming exams • {examsNext30Days} in the next 30 days
      </Text>
    </View>
  </View>

  <Text style={[styles.loadMessage, darkMode && styles.subTextOnDark]}>
    {pressureLevel
      ? pressureLevel.message
      : "Add upcoming exams to track deadlines and reduce uncertainty."}
  </Text>
</View>

          {/* Calendar Card */}
          <View style={[styles.mainCard, darkMode && styles.mainCardDark]}>
            <View style={styles.monthHeader}>
              <Text style={[styles.monthText, darkMode && styles.textOnDark]}>
                {selectedDate.toLocaleString("en-US", { month: "long", year: "numeric" })}
              </Text>

              <View style={styles.monthNav}>
                <TouchableOpacity
                  onPress={() => setSelectedDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth() - 1, 1))}
                >
                  <Ionicons name="chevron-back" size={20} color={darkMode ? "#9CA3AF" : "#64748B"} />
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setSelectedDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 1))}
                >
                  <Ionicons
                    name="chevron-forward"
                    size={20}
                    color={darkMode ? "#9CA3AF" : "#64748B"}
                    style={{ marginLeft: 20 }}
                  />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.weekdayHeader}>
              {WEEKDAYS.map((day) => (
                <Text key={day} style={[styles.weekdayText, darkMode && styles.weekdayTextDark]}>
                  {day[0]}
                </Text>
              ))}
            </View>

            {renderCalendar()}
          </View>

          {/* Schedule Section */}
          <View style={styles.scheduleSection}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, darkMode && styles.textOnDark]}>
                {isSameDay(new Date(), selectedDate)
                  ? "Today"
                  : selectedDate.toLocaleDateString("en-US", {
                      weekday: "long",
                      day: "numeric",
                      month: "short",
                    })}
              </Text>
              <Ionicons name="calendar-outline" size={20} color="#6366f1" />
            </View>

            {dayExams.length > 0 ? (
              dayExams.map((exam) => (
                <View key={exam.id} style={[styles.examRow, darkMode && styles.examRowDark]}>
                  <View style={[styles.examColorTag, { backgroundColor: "#6366f1" }]} />
                  <View style={{ flex: 1, marginLeft: 15 }}>
                    <Text style={[styles.examSubjectText, darkMode && styles.textOnDark]}>{exam.subject}</Text>
                    <Text style={[styles.examDetailText, darkMode && styles.subTextOnDark]}>
                      <Ionicons name="time-outline" size={12} />{" "}
                      {new Date(exam.date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      {exam.location ? `  •  ` : ""}
                      {exam.location && <Ionicons name="location-outline" size={12} />} {exam.location}
                    </Text>
                  </View>

                  <TouchableOpacity onPress={() => confirmDeleteExam(exam.id)} style={[styles.deleteBtn, darkMode && { backgroundColor: "rgba(239,68,68,0.15)" }]}>
                    <Ionicons name="trash-outline" size={18} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              ))
            ) : (
              <View style={[styles.emptyContainer, darkMode && styles.emptyContainerDark]}>
                <View style={styles.emptyIllustration}>
                  <Ionicons name="cafe-outline" size={40} color={darkMode ? "#6B7280" : "#CBD5E1"} />
                </View>
                <Text style={[styles.emptyText, darkMode && styles.subTextOnDark]}>No exams scheduled. Add upcoming exams to track deadlines and reduce uncertainty.</Text>
                <TouchableOpacity
                  onPress={() => router.push("/exams/add")}
                  style={[styles.quickAdd, darkMode && styles.quickAddDark]}
                >
                  <Text style={styles.quickAddText}>+ Add New</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
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
    paddingBottom: 15,
  },

  backButton: {
    width: 44,
    height: 44,
    backgroundColor: "#fff",
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    elevation: 3,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 10,
  },
  backButtonDark: {
    backgroundColor: "#111827",
    elevation: 0,
    shadowOpacity: 0,
  },

  headerTitle: { fontSize: 24, fontWeight: "900", color: "#1E293B" },
  headerSub: { fontSize: 13, color: "#64748B", fontWeight: "600" },

  addButton: {
    width: 44,
    height: 44,
    backgroundColor: "#6366f1",
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    elevation: 4,
  },

  countdownCard: {
    margin: 20,
    padding: 20,
    borderRadius: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    elevation: 10,
    shadowColor: "#4F46E5",
    shadowOpacity: 0.3,
    shadowRadius: 15,
  },
  countdownInfo: { flexDirection: "row", alignItems: "center", gap: 15 },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  countdownLabel: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1,
  },
  countdownSubject: { color: "#fff", fontSize: 18, fontWeight: "800" },
  daysBadge: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.15)",
    padding: 10,
    borderRadius: 16,
    minWidth: 60,
  },
  daysNumber: { color: "#fff", fontSize: 20, fontWeight: "900" },
  daysText: { color: "#fff", fontSize: 10, fontWeight: "700" },

  mainCard: {
    backgroundColor: "#fff",
    marginHorizontal: 20,
    borderRadius: 28,
    padding: 20,
    elevation: 4,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 20,
  },
  mainCardDark: {
    backgroundColor: "#111827",
    elevation: 0,
    shadowOpacity: 0,
  },

  monthHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  monthText: { fontSize: 19, fontWeight: "900", color: "#1E293B" },
  monthNav: { flexDirection: "row" },

  weekdayHeader: { flexDirection: "row", marginBottom: 15 },
  weekdayText: {
    flex: 1,
    textAlign: "center",
    color: "#94A3B8",
    fontWeight: "800",
    fontSize: 12,
  },
  weekdayTextDark: { color: "#6B7280" },

  calendarWeek: { flexDirection: "row", marginBottom: 5 },

  calendarDay: {
    flex: 1,
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
  },
  calendarDayDark: {
    backgroundColor: "transparent",
  },

  dayText: { fontSize: 16, fontWeight: "700", color: "#475569" },
  dayTextDark: { color: "#D1D5DB" },

  today: { backgroundColor: "#EEF2FF", borderWidth: 1, borderColor: "#6366f1" },
  todayDark: { backgroundColor: "rgba(99,102,241,0.14)", borderWidth: 1, borderColor: "#6366f1" },

  todayText: { color: "#6366f1", fontWeight: "900" },
  todayTextDark: { color: "#A5B4FC", fontWeight: "900" },

  selectedDay: { backgroundColor: "#6366f1" },
  selectedDayText: { color: "#fff", fontWeight: "900" },

  eventDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: "#6366f1",
    marginTop: 4,
  },
  eventDotDark: {
    backgroundColor: "#A5B4FC",
  },

  scheduleSection: { paddingHorizontal: 25, marginTop: 30 },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 15,
  },
  sectionTitle: { fontSize: 20, fontWeight: "900", color: "#1E293B" },

  examRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    padding: 18,
    borderRadius: 22,
    marginBottom: 12,
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 10,
  },
  examRowDark: {
    backgroundColor: "#111827",
    elevation: 0,
    shadowOpacity: 0,
  },

  examColorTag: { width: 5, height: 40, borderRadius: 3 },
  examSubjectText: { fontSize: 17, fontWeight: "800", color: "#1E293B" },
  examDetailText: { fontSize: 13, color: "#64748B", marginTop: 4, fontWeight: "600" },

  deleteBtn: { padding: 8, backgroundColor: "#FEE2E2", borderRadius: 10 },

  emptyContainer: {
    alignItems: "center",
    marginTop: 20,
    padding: 30,
    backgroundColor: "rgba(255,255,255,0.5)",
    borderRadius: 25,
    borderStyle: "dashed",
    borderWidth: 2,
    borderColor: "#E2E8F0",
  },
  emptyContainerDark: {
    backgroundColor: "rgba(17,24,39,0.55)",
    borderColor: "#1F2937",
  },

  emptyIllustration: { marginBottom: 10 },
  emptyText: {
    color: "#94A3B8",
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
  },

  quickAdd: {
    marginTop: 15,
    backgroundColor: "#fff",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
    elevation: 2,
  },
  quickAddDark: {
    backgroundColor: "#111827",
    elevation: 0,
  },
  quickAddText: { color: "#6366f1", fontWeight: "800", fontSize: 14 },

  textOnDark: { color: "#E5E7EB" },
  subTextOnDark: { color: "#9CA3AF" },

  pressureBadge: {
  marginTop: 8,
  paddingHorizontal: 10,
  paddingVertical: 5,
  borderRadius: 999,
  alignItems: "center",
},

pressureBadgeText: {
  color: "#fff",
  fontSize: 11,
  fontWeight: "900",
},

loadCard: {
  marginHorizontal: 20,
  marginBottom: 18,
  padding: 18,
  borderRadius: 24,
  backgroundColor: "#fff",
  borderWidth: 1,
  borderColor: "#E2E8F0",
  elevation: 2,
},

loadCardDark: {
  backgroundColor: "#111827",
  borderColor: "#1F2937",
  elevation: 0,
},

loadHeader: {
  flexDirection: "row",
  alignItems: "center",
  gap: 12,
},

loadIcon: {
  width: 42,
  height: 42,
  borderRadius: 14,
  backgroundColor: "#EEF2FF",
  alignItems: "center",
  justifyContent: "center",
},

loadTitle: {
  fontSize: 16,
  fontWeight: "900",
  color: "#1E293B",
},

loadSubtitle: {
  marginTop: 3,
  fontSize: 12,
  fontWeight: "700",
  color: "#64748B",
},

loadMessage: {
  marginTop: 12,
  fontSize: 13,
  fontWeight: "600",
  lineHeight: 19,
  color: "#64748B",
},
});