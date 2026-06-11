import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { getExams, getReflections, getStressEntries } from "../utils/storage";

export async function exportAllData(): Promise<void> {
  const [exams, stress, reflections] = await Promise.all([
    getExams(),
    getStressEntries(),
    getReflections(),
  ]);

  const raw = await AsyncStorage.getItem("POMO_SESSIONS_V1");
  const sessions = raw ? JSON.parse(raw) : [];

  const lines: string[] = [];

  lines.push("=== EXAMS ===");
  lines.push("Subject,Date,Location,Notes");
  for (const e of exams) {
    lines.push(`"${e.subject}","${e.date}","${e.location ?? ""}","${e.notes ?? ""}"`);
  }

  lines.push("");
  lines.push("=== STRESS ENTRIES ===");
  lines.push("Date,Level,Note");
  for (const s of stress) {
    lines.push(`"${s.date}","${s.level}","${s.note ?? ""}"`);
  }

  lines.push("");
  lines.push("=== REFLECTIONS ===");
  lines.push("ExamId,StressBefore,Rating,WhatHelped,WhatToChange,CreatedAt");
  for (const r of reflections) {
    lines.push(
      `"${r.examId}","${r.stressBefore ?? ""}","${r.rating ?? ""}","${r.whatHelped ?? ""}","${r.whatToChange ?? ""}","${r.createdAt}"`
    );
  }

  lines.push("");
  lines.push("=== POMODORO SESSIONS ===");
  lines.push("Id,StartedAt,PlannedMinutes,ActualMinutes,Completed,Interruptions,Subject");
  for (const s of sessions) {
    const date = new Date(s.startedAt).toISOString();
    lines.push(
      `"${s.id}","${date}","${s.plannedMinutes}","${s.actualMinutes}","${s.completed}","${s.interruptedCount}","${s.subjectTitle ?? ""}"`
    );
  }

  const csv = lines.join("\n");
  const path = FileSystem.documentDirectory + "unstressify-export.csv";
  await FileSystem.writeAsStringAsync(path, csv, {
    encoding: FileSystem.EncodingType.UTF8,
  });

  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    await Sharing.shareAsync(path, {
      mimeType: "text/csv",
      dialogTitle: "Export App Data",
    });
  }
}
