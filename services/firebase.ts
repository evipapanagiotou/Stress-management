import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDGbboqkN3W9qG6joWpxtq5UrRv-jFqLkI",
  authDomain: "stress-management-app-349e2.firebaseapp.com",
  projectId: "stress-management-app-349e2",
  storageBucket: "stress-management-app-349e2.firebasestorage.app",
  messagingSenderId: "661106311646",
  appId: "1:661106311646:android:34561f4de341d592129d4f",
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

export const db = getFirestore(app);
