import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { api, User } from "../services/api";

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<{ error?: string }>;
  signup: (
    username: string,
    email: string,
    password: string,
    displayName?: string,
  ) => Promise<{ error?: string }>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load user on mount if token exists
  useEffect(() => {
    const storedToken = localStorage.getItem("auth_token");
    if (storedToken) {
      api.setToken(storedToken);
      setToken(storedToken);
      refreshUser();
    } else {
      setIsLoading(false);
    }
  }, []);

  const refreshUser = async () => {
    setIsLoading(true);
    const response = await api.getCurrentUser();

    if (response.data) {
      setUser(response.data.user);
    } else {
      // Token is invalid, clear it
      setUser(null);
      setToken(null);
      api.setToken(null);
    }
    setIsLoading(false);
  };

  const login = async (username: string, password: string) => {
    const response = await api.login(username, password);

    if (response.error) {
      return { error: response.error };
    }

    if (response.data) {
      setUser(response.data.user);
      setToken(response.data.token);
      api.setToken(response.data.token);
      return {};
    }

    return { error: "Login failed" };
  };

  const signup = async (
    username: string,
    email: string,
    password: string,
    displayName?: string,
  ) => {
    const response = await api.signup(username, email, password, displayName);

    if (response.error) {
      return { error: response.error };
    }

    if (response.data) {
      setUser(response.data.user);
      setToken(response.data.token);
      api.setToken(response.data.token);
      return {};
    }

    return { error: "Signup failed" };
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    api.setToken(null);
  };

  const value = {
    user,
    token,
    isLoading,
    isAuthenticated: Boolean(user) && Boolean(token),
    login,
    signup,
    logout,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
