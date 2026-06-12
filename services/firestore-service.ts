import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  setDoc,
} from "firebase/firestore";
import { db } from "./firebase";
import { getCurrentUser } from "./auth-service";
import type { Exam, ReflectionEntry, StressEntry } from "../utils/storage";
import type { PomodoroSession } from "./analytics-utils";

function userCol(sub: string) {
  const uid = getCurrentUser()?.uid;
  if (!uid) throw new Error("Not authenticated");
  return collection(db, "users", uid, sub);
}

export async function addCloudExam(exam: Exam): Promise<void> {
  try {
    const ref = doc(userCol("exams"), exam.id);
    await setDoc(ref, exam);
  } catch (e) {
    console.warn("[firestore] addCloudExam", e);
  }
}

export async function deleteCloudExam(id: string): Promise<void> {
  try {
    const uid = getCurrentUser()?.uid;
    if (!uid) return;
    await deleteDoc(doc(db, "users", uid, "exams", id));
  } catch (e) {
    console.warn("[firestore] deleteCloudExam", e);
  }
}

export async function addCloudStressEntry(entry: StressEntry): Promise<void> {
  try {
    const ref = doc(userCol("stress"), entry.date);
    await setDoc(ref, entry);
  } catch (e) {
    console.warn("[firestore] addCloudStressEntry", e);
  }
}

export async function saveCloudReflection(entry: ReflectionEntry): Promise<void> {
  try {
    const ref = doc(userCol("reflections"), entry.examId);
    await setDoc(ref, entry);
  } catch (e) {
    console.warn("[firestore] saveCloudReflection", e);
  }
}

export async function addCloudPomoSession(session: PomodoroSession): Promise<void> {
  try {
    const ref = doc(userCol("pomodoro"), session.id);
    await setDoc(ref, session);
  } catch (e) {
    console.warn("[firestore] addCloudPomoSession", e);
  }
}

export async function fullSync(): Promise<void> {
  try {
    const uid = getCurrentUser()?.uid;
    if (!uid) return;

    const [examsSnap, stressSnap, reflSnap] = await Promise.all([
      getDocs(collection(db, "users", uid, "exams")),
      getDocs(collection(db, "users", uid, "stress")),
      getDocs(collection(db, "users", uid, "reflections")),
    ]);

    const cloudExams = examsSnap.docs.map((d) => d.data() as Exam);
    const cloudStress = stressSnap.docs.map((d) => d.data() as StressEntry);
    const cloudRefl = reflSnap.docs.map((d) => d.data() as ReflectionEntry);

    const rawExams = await AsyncStorage.getItem("unstressify:exams");
    const localExams: Exam[] = rawExams ? JSON.parse(rawExams) : [];
    const localIds = new Set(localExams.map((e) => e.id));
    const merged = [
      ...localExams,
      ...cloudExams.filter((e) => !localIds.has(e.id)),
    ];
    await AsyncStorage.setItem("unstressify:exams", JSON.stringify(merged));

    const rawStress = await AsyncStorage.getItem("unstressify:stress");
    const localStress: StressEntry[] = rawStress ? JSON.parse(rawStress) : [];
    const localDates = new Set(localStress.map((s) => s.date));
    const mergedStress = [
      ...localStress,
      ...cloudStress.filter((s) => !localDates.has(s.date)),
    ];
    await AsyncStorage.setItem("unstressify:stress", JSON.stringify(mergedStress));

    const rawRefl = await AsyncStorage.getItem("unstressify:reflections");
    const localRefl: ReflectionEntry[] = rawRefl ? JSON.parse(rawRefl) : [];
    const localExamIds = new Set(localRefl.map((r) => r.examId));
    const mergedRefl = [
      ...localRefl,
      ...cloudRefl.filter((r) => !localExamIds.has(r.examId)),
    ];
    await AsyncStorage.setItem("unstressify:reflections", JSON.stringify(mergedRefl));

    const pomoSnap = await getDocs(collection(db, "users", uid, "pomodoro"));
    const cloudPomo = pomoSnap.docs.map((d) => d.data() as PomodoroSession);
    const rawPomo = await AsyncStorage.getItem("POMO_SESSIONS_V1");
    const localPomo: PomodoroSession[] = rawPomo ? JSON.parse(rawPomo) : [];
    const localPomoIds = new Set(localPomo.map((s) => s.id));
    const mergedPomo = [
      ...localPomo,
      ...cloudPomo.filter((s) => !localPomoIds.has(s.id)),
    ];
    await AsyncStorage.setItem("POMO_SESSIONS_V1", JSON.stringify(mergedPomo));

    // Push local data to cloud
    await Promise.all([
      ...localExams.map((e) => addCloudExam(e)),
      ...localStress.map((s) => addCloudStressEntry(s)),
      ...localRefl.map((r) => saveCloudReflection(r)),
      ...localPomo.map((s) => addCloudPomoSession(s)),
    ]);
  } catch (e) {
    console.warn("[firestore] fullSync", e);
  }
}
