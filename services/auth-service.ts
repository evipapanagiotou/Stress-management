import AsyncStorage from "@react-native-async-storage/async-storage";

export type User = {
  uid: string;
  email: string | null;
  displayName: string | null;
};

type StoredUser = {
  uid: string;
  email: string;
  password: string;
  displayName: string | null;
};

const USERS_KEY = "@auth:users";
const SESSION_KEY = "@auth:session";

let _currentUser: User | null = null;
let _listeners: Array<(user: User | null) => void> = [];

async function _loadSession() {
  try {
    const raw = await AsyncStorage.getItem(SESSION_KEY);
    _currentUser = raw ? JSON.parse(raw) : null;
  } catch {
    _currentUser = null;
  }
  _listeners.forEach((cb) => cb(_currentUser));
}

_loadSession();

export function subscribeToAuthState(callback: (user: User | null) => void) {
  _listeners.push(callback);
  AsyncStorage.getItem(SESSION_KEY)
    .then((raw) => callback(raw ? JSON.parse(raw) : null))
    .catch(() => callback(null));
  return () => {
    _listeners = _listeners.filter((cb) => cb !== callback);
  };
}

export function getCurrentUser(): User | null {
  return _currentUser;
}

async function getUsers(): Promise<StoredUser[]> {
  const raw = await AsyncStorage.getItem(USERS_KEY);
  return raw ? JSON.parse(raw) : [];
}

function makeUid(): string {
  return (
    Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
  );
}

export async function registerWithEmail(
  email: string,
  password: string,
  displayName?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!email || !password) {
      return { success: false, error: "Enter your email and password." };
    }
    if (password.length < 6) {
      return {
        success: false,
        error: "Password must be at least 6 characters.",
      };
    }

    const users = await getUsers();
    if (users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase())) {
      return { success: false, error: "This email is already registered." };
    }

    const newUser: StoredUser = {
      uid: makeUid(),
      email: email.trim().toLowerCase(),
      password,
      displayName: displayName?.trim() || null,
    };
    await AsyncStorage.setItem(USERS_KEY, JSON.stringify([...users, newUser]));

    const session: User = {
      uid: newUser.uid,
      email: newUser.email,
      displayName: newUser.displayName,
    };
    await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(session));
    _currentUser = session;
    _listeners.forEach((cb) => cb(session));

    return { success: true };
  } catch {
    return { success: false, error: "Registration failed. Please try again." };
  }
}

export async function signInWithEmail(
  email: string,
  password: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const users = await getUsers();
    const match = users.find(
      (u) =>
        u.email.toLowerCase() === email.trim().toLowerCase() &&
        u.password === password
    );

    if (!match) {
      return { success: false, error: "Incorrect email or password." };
    }

    const session: User = {
      uid: match.uid,
      email: match.email,
      displayName: match.displayName,
    };
    await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(session));
    _currentUser = session;
    _listeners.forEach((cb) => cb(session));

    return { success: true };
  } catch {
    return { success: false, error: "Sign in failed. Please try again." };
  }
}

export async function resetPassword(
  email: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const users = await getUsers();
    const exists = users.find(
      (u) => u.email.toLowerCase() === email.trim().toLowerCase()
    );
    if (!exists) {
      return { success: false, error: "No account found with this email." };
    }
    return { success: true };
  } catch {
    return { success: false, error: "Something went wrong. Please try again." };
  }
}

export async function logout(): Promise<{ success: boolean; error?: string }> {
  try {
    await AsyncStorage.removeItem(SESSION_KEY);
    _currentUser = null;
    _listeners.forEach((cb) => cb(null));
    return { success: true };
  } catch {
    return { success: false, error: "Sign out failed." };
  }
}
