import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from "firebase/auth";
import { auth } from "./firebase";

export function subscribeToAuthState(callback: (user: User | null) => void) {
  return onAuthStateChanged(auth, callback);
}

export function getCurrentUser(): User | null {
  return auth.currentUser;
}

export async function signInWithEmail(
  email: string,
  password: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await signInWithEmailAndPassword(auth, email, password);
    return { success: true };
  } catch (e: any) {
    return { success: false, error: mapAuthError(e.code) };
  }
}

export async function registerWithEmail(
  email: string,
  password: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await createUserWithEmailAndPassword(auth, email, password);
    return { success: true };
  } catch (e: any) {
    return { success: false, error: mapAuthError(e.code) };
  }
}

export async function resetPassword(
  email: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await sendPasswordResetEmail(auth, email);
    return { success: true };
  } catch (e: any) {
    return { success: false, error: mapAuthError(e.code) };
  }
}

export async function logout(): Promise<{ success: boolean; error?: string }> {
  try {
    await signOut(auth);
    return { success: true };
  } catch (e: any) {
    return { success: false, error: mapAuthError(e.code) };
  }
}

function mapAuthError(code: string): string {
  switch (code) {
    case "auth/invalid-email":
      return "Invalid email address.";
    case "auth/user-not-found":
    case "auth/wrong-password":
    case "auth/invalid-credential":
      return "Incorrect email or password.";
    case "auth/email-already-in-use":
      return "This email is already registered.";
    case "auth/weak-password":
      return "Password must be at least 6 characters.";
    case "auth/too-many-requests":
      return "Too many attempts. Try again later.";
    case "auth/network-request-failed":
      return "Network error. Check your connection.";
    default:
      return "Something went wrong. Please try again.";
  }
}
