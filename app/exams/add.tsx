// app/exams/add.tsx
import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Platform,
  SafeAreaView,
  KeyboardAvoidingView,
  ScrollView,
  Modal,
  Alert,
  StatusBar,
} from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import uuid from "react-native-uuid";
import DateTimePicker, { DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { addExam } from "../../utils/storage";
import { useTheme } from "../../context/ThemeContext";

const fmtDate = (d: Date) =>
  d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

const fmtTime = (d: Date) =>
  d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });

export default function AddExamScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { darkMode } = useTheme();

  const [subject, setSubject] = useState("");
  const [location, setLocation] = useState("");

  const initial = useMemo(() => {
    const t = new Date();
    t.setSeconds(0, 0);
    t.setMinutes(0);
    t.setHours(9);
    return t;
  }, []);

  const [selectedDate, setSelectedDate] = useState<Date>(initial);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [iosTemp, setIosTemp] = useState<Date>(selectedDate);
  const [focused, setFocused] = useState<"subject" | "location" | null>(null);

  const onAndroidDateChange = (_: DateTimePickerEvent, date?: Date) => {
    setShowDatePicker(false);
    if (date) {
      const d = new Date(selectedDate);
      d.setFullYear(date.getFullYear(), date.getMonth(), date.getDate());
      setSelectedDate(d);
    }
  };

  const onAndroidTimeChange = (_: DateTimePickerEvent, date?: Date) => {
    setShowTimePicker(false);
    if (date) {
      const d = new Date(selectedDate);
      d.setHours(date.getHours(), date.getMinutes(), 0, 0);
      setSelectedDate(d);
    }
  };

  const saveExam = async () => {
    const sub = subject.trim();
    if (!sub) {
      Alert.alert("Required Field", "Please enter a subject name.");
      return;
    }
    await addExam({
      id: String(uuid.v4()),
      subject: sub,
      date: selectedDate.toISOString(),
      location: location.trim() || undefined,
    });
    router.back();
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
        <View style={[styles.header, { paddingTop: insets.top + 18 }]}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={[styles.backBtn, darkMode && styles.backBtnDark]}
          >
            <Ionicons name="chevron-back" size={24} color={darkMode ? "#E5E7EB" : "#1E293B"} />
          </TouchableOpacity>

          <View style={styles.headerTitleRow}>
            <Text style={[styles.headerTitle, darkMode && styles.textOnDark]}>New Exam</Text>
            <Text style={[styles.headerSub, darkMode && styles.subTextOnDark]}>
              Track academic deadlines
            </Text>
          </View>

          <View style={{ width: 40 }} />
        </View>

        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Exam Details */}
            <View style={[styles.card, darkMode && styles.cardDark]}>
              <Text style={[styles.sectionLabel, darkMode && styles.subTextOnDark]}>
                Exam Details
              </Text>

              <View
                style={[
                  styles.inputWrapper,
                  darkMode && styles.inputDark,
                  focused === "subject" && styles.inputFocused,
                ]}
              >
                <Ionicons name="book" size={20} color="#6366f1" />
                <TextInput
                  style={[styles.textInput, darkMode && styles.textOnDark]}
                  placeholder="Subject Name (e.g. Mathematics)"
                  placeholderTextColor={darkMode ? "#6B7280" : "#94A3B8"}
                  value={subject}
                  onChangeText={setSubject}
                  onFocus={() => setFocused("subject")}
                  onBlur={() => setFocused(null)}
                />
              </View>

              <View
                style={[
                  styles.inputWrapper,
                  darkMode && styles.inputDark,
                  focused === "location" && styles.inputFocused,
                ]}
              >
                <Ionicons name="location" size={20} color={darkMode ? "#9CA3AF" : "#64748B"} />
                <TextInput
                  style={[styles.textInput, darkMode && styles.textOnDark]}
                  placeholder="Location (Room, Hall, etc.)"
                  placeholderTextColor={darkMode ? "#6B7280" : "#94A3B8"}
                  value={location}
                  onChangeText={setLocation}
                  onFocus={() => setFocused("location")}
                  onBlur={() => setFocused(null)}
                />
              </View>
            </View>

            {/* Schedule */}
            <View style={[styles.card, darkMode && styles.cardDark]}>
              <Text style={[styles.sectionLabel, darkMode && styles.subTextOnDark]}>Schedule</Text>

              <View style={styles.dateTimeRow}>
                <TouchableOpacity
                  style={[styles.pickerBtn, darkMode && styles.pickerBtnDark]}
                  onPress={() => {
                    setIosTemp(selectedDate);
                    setShowDatePicker(true);
                  }}
                >
                  <View style={[styles.pickerIconBox, darkMode && styles.pickerIconBoxDark]}>
                    <Ionicons name="calendar" size={18} color="#6366f1" />
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={[styles.pickerLabel, darkMode && styles.subTextOnDark]}>Date</Text>
                    <Text
                      style={[styles.pickerValue, darkMode && styles.textOnDark]}
                      numberOfLines={2}
                    >
                      {fmtDate(selectedDate)}
                    </Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.pickerBtn, darkMode && styles.pickerBtnDark]}
                  onPress={() => {
                    setIosTemp(selectedDate);
                    setShowTimePicker(true);
                  }}
                >
                  <View style={[styles.pickerIconBox, darkMode && styles.pickerIconBoxDark]}>
                    <Ionicons name="time" size={18} color="#6366f1" />
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={[styles.pickerLabel, darkMode && styles.subTextOnDark]}>Time</Text>
                    <Text style={[styles.pickerValue, darkMode && styles.textOnDark]} numberOfLines={1}>
                      {fmtTime(selectedDate)}
                    </Text>
                  </View>
                </TouchableOpacity>
              </View>
            </View>

            {/* Hint */}
            <View style={[styles.hintBox, darkMode && styles.hintDark]}>
              <Ionicons name="information-circle" size={20} color="#6366f1" />
              <Text style={[styles.hintText, darkMode && styles.hintTextDark]}>
                You'll get a reminder 24 hours before your exam.
              </Text>
            </View>
          </ScrollView>

          {/* Footer */}
          <View
            style={[
              styles.footer,
              darkMode && styles.footerDark,
              { paddingBottom: Math.max(insets.bottom, 20) },
            ]}
          >
            <TouchableOpacity
              style={[styles.saveButton, !subject.trim() && styles.saveDisabled]}
              onPress={saveExam}
              disabled={!subject.trim()}
            >
              <LinearGradient
                colors={
                  subject.trim()
                    ? ["#6366f1", "#4f46e5"]
                    : [darkMode ? "#374151" : "#CBD5E1", darkMode ? "#374151" : "#CBD5E1"]
                }
                style={styles.saveGradient}
              >
                <Text style={styles.saveButtonText}>Save Exam Schedule</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>

      {/* iOS Modals */}
      <Modal visible={showDatePicker && Platform.OS === "ios"} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, darkMode && styles.modalCardDark]}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                <Text style={[styles.modalCancel, darkMode && styles.subTextOnDark]}>Cancel</Text>
              </TouchableOpacity>

              <Text style={[styles.modalTitle, darkMode && styles.textOnDark]}>Pick Date</Text>

              <TouchableOpacity
                onPress={() => {
                  const d = new Date(selectedDate);
                  d.setFullYear(iosTemp.getFullYear(), iosTemp.getMonth(), iosTemp.getDate());
                  setSelectedDate(d);
                  setShowDatePicker(false);
                }}
              >
                <Text style={styles.modalDone}>Done</Text>
              </TouchableOpacity>
            </View>

            <DateTimePicker
              value={iosTemp}
              mode="date"
              display="spinner"
              onChange={(_, d) => d && setIosTemp(d)}
              themeVariant={darkMode ? "dark" : "light"}
            />
          </View>
        </View>
      </Modal>

      <Modal visible={showTimePicker && Platform.OS === "ios"} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, darkMode && styles.modalCardDark]}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setShowTimePicker(false)}>
                <Text style={[styles.modalCancel, darkMode && styles.subTextOnDark]}>Cancel</Text>
              </TouchableOpacity>

              <Text style={[styles.modalTitle, darkMode && styles.textOnDark]}>Pick Time</Text>

              <TouchableOpacity
                onPress={() => {
                  const d = new Date(selectedDate);
                  d.setHours(iosTemp.getHours(), iosTemp.getMinutes(), 0, 0);
                  setSelectedDate(d);
                  setShowTimePicker(false);
                }}
              >
                <Text style={styles.modalDone}>Done</Text>
              </TouchableOpacity>
            </View>

            <DateTimePicker
              value={iosTemp}
              mode="time"
              display="spinner"
              onChange={(_, d) => d && setIosTemp(d)}
              themeVariant={darkMode ? "dark" : "light"}
            />
          </View>
        </View>
      </Modal>

      {/* Android Pickers */}
      {showDatePicker && Platform.OS === "android" && (
        <DateTimePicker
          value={selectedDate}
          mode="date"
          display="calendar"
          onChange={onAndroidDateChange}
          
        />
      )}
      {showTimePicker && Platform.OS === "android" && (
        <DateTimePicker
          value={selectedDate}
          mode="time"
          display="clock"
          onChange={onAndroidTimeChange}
          
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 5,
  },
  backBtnDark: {
    backgroundColor: "#111827",
    shadowOpacity: 0,
    elevation: 0,
  },

  headerTitleRow: { alignItems: "center" },
  headerTitle: { fontSize: 24, fontWeight: "900", color: "#1E293B" },
  headerSub: { fontSize: 13, color: "#64748B", fontWeight: "600",  marginTop: 2, },

  scrollContent: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 120 },

  card: {
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 20,
    marginBottom: 20,
    elevation: 4,
    shadowColor: "#6366f1",
    shadowOpacity: 0.08,
    shadowRadius: 15,
  },
  cardDark: {
    backgroundColor: "#111827",
    shadowOpacity: 0,
    elevation: 0,
  },

  sectionLabel: {
    fontSize: 14,
    fontWeight: "800",
    color: "#64748B",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 15,
  },

  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderRadius: 16,
    paddingHorizontal: 15,
    height: 56,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  inputDark: {
    backgroundColor: "#0B1220",
    borderColor: "#1F2937",
  },
  inputFocused: { borderColor: "#6366f1", backgroundColor: "#fff" },

  textInput: { flex: 1, marginLeft: 12, fontSize: 16, fontWeight: "600", color: "#1E293B" },

  dateTimeRow: { flexDirection: "row", gap: 12 },

  pickerBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#F8FAFC",
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  pickerBtnDark: {
    backgroundColor: "#0B1220",
    borderColor: "#1F2937",
  },
  pickerIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#EEF2FF",
    alignItems: "center",
    justifyContent: "center",
  },
  pickerIconBoxDark: {
    backgroundColor: "rgba(99,102,241,0.12)",
  },
  pickerLabel: { fontSize: 11, fontWeight: "700", color: "#64748B" },
  pickerValue: { fontSize: 13, fontWeight: "800", color: "#1E293B", flexShrink: 1 },

  hintBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#EEF2FF",
    padding: 16,
    borderRadius: 20,
  },
  hintDark: {
    backgroundColor: "rgba(99,102,241,0.12)",
  },
  hintText: { flex: 1, fontSize: 13, color: "#4F46E5", fontWeight: "600", lineHeight: 18 },
  hintTextDark: { color: "#C7D2FE" },

  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingTop: 15,
    backgroundColor: "#F8FAFC",
  },
  footerDark: {
    backgroundColor: "#0B1220",
  },
  saveButton: {
    borderRadius: 20,
    overflow: "hidden",
    elevation: 8,
    shadowColor: "#6366f1",
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
  saveDisabled: { elevation: 0, shadowOpacity: 0 },
  saveGradient: { paddingVertical: 18, alignItems: "center" },
  saveButtonText: { color: "#fff", fontSize: 16, fontWeight: "900" },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: "rgba(15, 23, 42, 0.5)", justifyContent: "flex-end" },
  modalCard: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    padding: 20,
    paddingBottom: 40,
  },
  modalCardDark: {
    backgroundColor: "#0B1220",
  },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  modalTitle: { fontSize: 17, fontWeight: "900", color: "#1E293B" },
  modalCancel: { color: "#64748B", fontWeight: "700" },
  modalDone: { color: "#6366f1", fontWeight: "800" },

  // Shared text colors
  textOnDark: { color: "#E5E7EB" },
  subTextOnDark: { color: "#9CA3AF" },
});
