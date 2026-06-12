import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { subscribeToAuthState, type User } from "../services/auth-service";

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  signedIn: boolean;
};

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  signedIn: false,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = subscribeToAuthState((nextUser) => {
      setUser(nextUser);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const value = useMemo(
    () => ({ user, loading, signedIn: Boolean(user) }),
    [loading, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
