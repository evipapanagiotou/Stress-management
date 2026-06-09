// utils/userProfile.ts
import AsyncStorage from "@react-native-async-storage/async-storage";

export const KEY_FIRST = "user:firstName";
export const KEY_LAST = "user:lastName";
export const KEY_FULL = "user:name";
export const KEY_LEGACY = "userName";

export type UserProfile = { firstName: string; lastName: string; fullName: string };

export function makeFullName(firstName: string, lastName: string) {
  return [firstName.trim(), lastName.trim()].filter(Boolean).join(" ");
}

export async function loadUserProfile(): Promise<UserProfile> {
  const firstName = (await AsyncStorage.getItem(KEY_FIRST)) || "";
  const lastName = (await AsyncStorage.getItem(KEY_LAST)) || "";
  const full = (await AsyncStorage.getItem(KEY_FULL)) || "";
  const legacy = (await AsyncStorage.getItem(KEY_LEGACY)) || "";

  // If first/last exist -> trust them
  if (firstName || lastName) {
    const fullName = makeFullName(firstName, lastName);
    return { firstName, lastName, fullName };
  }

  // Else parse full/legacy
  const nameToParse = full || legacy;
  if (!nameToParse) return { firstName: "", lastName: "", fullName: "" };

  const parts = nameToParse.trim().split(/\s+/);
  const f = parts[0] || "";
  const l = parts.slice(1).join(" ");
  return { firstName: f, lastName: l, fullName: makeFullName(f, l) };
}

export async function saveUserProfile(firstName: string, lastName: string) {
  const f = firstName.trim();
  const l = lastName.trim();
  const fullName = makeFullName(f, l);

  await AsyncStorage.multiSet([
    [KEY_FIRST, f],
    [KEY_LAST, l],
    [KEY_FULL, fullName],
    [KEY_LEGACY, fullName], // keeps Home older code compatible
  ]);

  return { firstName: f, lastName: l, fullName };
}

export async function clearUserProfile() {
  await AsyncStorage.multiRemove([KEY_FIRST, KEY_LAST, KEY_FULL, KEY_LEGACY]);
}
