"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { getAccessToken, authApi, getUserInfo } from "@/lib/api";
import { usePathname, useRouter } from "next/navigation";
import { User } from "@/types";

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: User | null;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const checkAuth = () => {
      const token = getAccessToken();
      const userInfo = getUserInfo();
      if (token) {
        setIsAuthenticated(true);
        setUser(userInfo);
      } else {
        setIsAuthenticated(false);
        setUser(null);
        if (pathname !== "/login") {
          router.push("/login");
        }
      }
      setIsLoading(false);
    };

    checkAuth();

    // Setup an interval to check token every minute in case of external logout
    const interval = setInterval(checkAuth, 60000);
    return () => clearInterval(interval);
  }, [pathname, router]);

  const logout = () => {
    authApi.logout();
    setIsAuthenticated(false);
    setUser(null);
    router.push("/login");
  };

  const isPublicPage = pathname === "/login";

  return (
    <AuthContext.Provider value={{ isAuthenticated, isLoading, user, logout }}>
      {isLoading ? (
        <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
          <div className="w-12 h-12 border-4 border-indigo-600/20 border-t-indigo-600 rounded-full animate-spin"></div>
        </div>
      ) : isPublicPage || isAuthenticated ? (
        children
      ) : (
        <div className="min-h-screen bg-[#0a0a0f]" />
      )}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
