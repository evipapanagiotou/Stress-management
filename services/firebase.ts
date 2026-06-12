import { initializeApp, getApps, getApp } from "firebase/app";
import { initializeAuth, getReactNativePersistence, getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import AsyncStorage from "@react-native-async-storage/async-storage";

const firebaseConfig = {
  apiKey: "AIzaSyDGbboqkN3W9qG6joWpxtq5UrRv-jFqLkI",
  authDomain: "stress-management-app-349e2.firebaseapp.com",
  projectId: "stress-management-app-349e2",
  storageBucket: "stress-management-app-349e2.firebasestorage.app",
  messagingSenderId: "661106311646",
  appId: "1:661106311646:android:34561f4de341d592129d4f",
};

const isNew = !getApps().length;
const app = isNew ? initializeApp(firebaseConfig) : getApp();

export const auth = isNew
  ? initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    })
  : getAuth(app);

export const db = getFirestore(app);
