import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import type { Exam } from "../utils/storage";

const PREFS_KEY = "notif:preferences:v1";

export type NotificationPreferences = {
  studyReminder: boolean;
  stressCheckIns: boolean;
  examReminders: boolean;
};

const DEFAULT_PREFS: NotificationPreferences = {
  studyReminder: false,
  stressCheckIns: false,
  examReminders: false,
};

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function registerForPushNotifications(): Promise<boolean> {
  const { status } = await Notifications.requestPermissionsAsync();
  return status === "granted";
}

export async function getNotificationPreferences(): Promise<NotificationPreferences> {
  try {
    const raw = await AsyncStorage.getItem(PREFS_KEY);
    return raw ? { ...DEFAULT_PREFS, ...JSON.parse(raw) } : DEFAULT_PREFS;
  } catch {
    return DEFAULT_PREFS;
  }
}

export async function saveNotificationPreferences(
  prefs: NotificationPreferences,
  exams: Exam[]
): Promise<void> {
  await AsyncStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  await cancelAllNotifications();

  if (prefs.studyReminder) await scheduleStudyReminder();
  if (prefs.stressCheckIns) await scheduleStressCheckIns();
  if (prefs.examReminders) await scheduleExamReminders(exams);
}

async function scheduleStudyReminder(): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: "Study time! 📚",
      body: "Time for your daily study session. Start a Pomodoro!",
      data: { screen: "pomodoro" },
    },
    trigger: { hour: 18, minute: 0, repeats: true } as any,
  });
}

async function scheduleStressCheckIns(): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: "Good morning! 🌤",
      body: "How are you feeling today? Log your mood.",
      data: { screen: "home" },
    },
    trigger: { hour: 9, minute: 0, repeats: true } as any,
  });
  await Notifications.scheduleNotificationAsync({
    content: {
      title: "Evening check-in 🌙",
      body: "How was your stress level today?",
      data: { screen: "home" },
    },
    trigger: { hour: 21, minute: 0, repeats: true } as any,
  });
}

export async function scheduleExamReminders(exams: Exam[]): Promise<void> {
  const now = Date.now();
  for (const exam of exams) {
    const examTime = new Date(exam.date).getTime();
    const threeDaysBefore = examTime - 3 * 24 * 60 * 60 * 1000;
    const oneDayBefore = examTime - 24 * 60 * 60 * 1000;

    if (threeDaysBefore > now) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: `${exam.subject} in 3 days 📅`,
          body: "Start preparing and manage your stress early.",
          data: { screen: "exams" },
        },
        trigger: { date: new Date(threeDaysBefore) } as any,
      });
    }
    if (oneDayBefore > now) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: `${exam.subject} tomorrow! ⚠️`,
          body: "Final review day. Don't forget to breathe.",
          data: { screen: "exams" },
        },
        trigger: { date: new Date(oneDayBefore) } as any,
      });
    }
  }
}

const BREATHING_COOLDOWN_KEY = "notif:breathing:lastSent";
const BREATHING_COOLDOWN_MS = 60 * 60 * 1000; // 1 hour

export async function suggestBreathingExercise(): Promise<void> {
  const notifsEnabled = await AsyncStorage.getItem("@settings_notifs");
  if (notifsEnabled === "false") return;

  const lastSent = await AsyncStorage.getItem(BREATHING_COOLDOWN_KEY);
  if (lastSent && Date.now() - Number(lastSent) < BREATHING_COOLDOWN_MS) return;

  await Notifications.scheduleNotificationAsync({
    content: {
      title: "High stress detected 😮‍💨",
      body: "Try a quick breathing exercise to calm down.",
      data: { screen: "games" },
    },
    trigger: null,
  });
  await AsyncStorage.setItem(BREATHING_COOLDOWN_KEY, String(Date.now()));
}

export async function cancelAllNotifications(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

export function addNotificationResponseListener(
  handler: (response: Notifications.NotificationResponse) => void
) {
  return Notifications.addNotificationResponseReceivedListener(handler);
}
