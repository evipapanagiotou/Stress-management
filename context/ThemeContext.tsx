import React, { createContext, useContext, useEffect, useState } from "react"; // Εισαγωγή React και hooks για state, context και lifecycle
import AsyncStorage from "@react-native-async-storage/async-storage"; // Εισαγωγή AsyncStorage για αποθήκευση δεδομένων τοπικά στη συσκευή

const KEY_DARK_MODE = "@settings_darkmode"; // Κλειδί που θα χρησιμοποιηθεί για αποθήκευση του dark mode στο storage

type ThemeContextType = {
  darkMode: boolean; // Boolean τιμή που δείχνει αν είναι ενεργό το dark mode
  setDarkMode: (v: boolean) => void; // Συνάρτηση για αλλαγή της τιμής του dark mode
};

const ThemeContext = createContext<ThemeContextType>({
  darkMode: false, // Default τιμή (light mode)
  setDarkMode: () => {}, // Κενή συνάρτηση ως default (placeholder)
});

export function ThemeProvider({ children }: { children: React.ReactNode }) { // Component που "τυλίγει" την εφαρμογή και παρέχει theme
  const [darkMode, _setDarkMode] = useState(false); // State για το dark mode (default false)

  useEffect(() => { // Εκτελείται μία φορά όταν φορτώνει το component
    (async () => { // Async function για ανάγνωση από storage
      const saved = await AsyncStorage.getItem(KEY_DARK_MODE); // Παίρνει την αποθηκευμένη τιμή
      if (saved !== null) _setDarkMode(saved === "true"); // Αν υπάρχει, μετατρέπει σε boolean και το αποθηκεύει στο state
    })();
  }, []); // Empty array → τρέχει μόνο στο mount

  const setDarkMode = async (v: boolean) => { // Συνάρτηση για αλλαγή dark mode
    _setDarkMode(v); // Αλλάζει το state άμεσα 
    await AsyncStorage.setItem(KEY_DARK_MODE, String(v)); // Αποθηκεύει τη νέα τιμή στο storage ως string
  };

  return (
    <ThemeContext.Provider value={{ darkMode, setDarkMode }}> 
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() { // Custom hook για εύκολη πρόσβαση στο ThemeContext
  return useContext(ThemeContext); // Επιστρέφει το context (darkMode + setDarkMode)
}
