import { createContext, useContext, useEffect, useState, useRef, ReactNode } from "react";
import { useGetMe } from "@workspace/api-client-react";
import type { AuthUser } from "@workspace/api-client-react";

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  login: (token: string, user: AuthUser) => void;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  login: () => {},
  logout: () => {},
  isLoading: true,
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(localStorage.getItem("token"));
  const [user, setUser] = useState<AuthUser | null>(null);
  const logoutCalledRef = useRef(false);

  const { data: meData, isLoading, error } = useGetMe({
    query: {
      queryKey: ["getMe", token],
      enabled: !!token,
      retry: false,
      // Don't throw — we handle error explicitly
      throwOnError: false,
    },
  });

  useEffect(() => {
    if (meData) {
      setUser(meData);
      logoutCalledRef.current = false;
    }
  }, [meData]);

  useEffect(() => {
    // Only logout on explicit auth errors (401/403), not network/transient errors
    if (error && token && !logoutCalledRef.current) {
      const status = (error as any)?.status ?? (error as any)?.response?.status;
      if (status === 401 || status === 403) {
        logoutCalledRef.current = true;
        logout();
      }
      // For other errors (500, network), leave the session intact
    }
  }, [error, token]);

  const login = (newToken: string, newUser: AuthUser) => {
    localStorage.setItem("token", newToken);
    setToken(newToken);
    setUser(newUser);
    logoutCalledRef.current = false;
  };

  const logout = () => {
    localStorage.removeItem("token");
    setToken(null);
    setUser(null);
    window.location.href = "/login";
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        login,
        logout,
        isLoading: !!token && isLoading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
