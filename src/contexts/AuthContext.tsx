import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { Database } from "@/integrations/mysql/client";
import bcrypt from "bcryptjs";

interface User {
  id: string;
  email: string;
}

interface AuthContextValue {
  user: User | null;
  session: any;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkSession();
  }, []);

  const checkSession = async () => {
    const token = localStorage.getItem("session_token");
    if (token) {
      try {
        const sessionData = await Database.getSessionByToken(token);
        if (sessionData) {
          setUser({ id: sessionData.user_id, email: sessionData.email });
          setSession({ token });
        } else {
          localStorage.removeItem("session_token");
        }
      } catch (error) {
        console.error("Session check failed:", error);
        localStorage.removeItem("session_token");
      }
    }
    setLoading(false);
  };

  const signIn = async (email: string, password: string) => {
    // Simple password check (in production, use proper hashing)
    const userData = await Database.getUserByEmail(email);
    if (!userData) {
      throw new Error("User not found");
    }

    // Handle both new bcrypt hashes and legacy plain text passwords
    const isBcryptHash = userData.password_hash.startsWith('$2a$') || userData.password_hash.startsWith('$2b$');
    let isValid = false;

    if (isBcryptHash) {
      isValid = bcrypt.compareSync(password, userData.password_hash);
    } else {
      // Legacy plain text check
      isValid = userData.password_hash === password;
      if (isValid) {
        // Auto-upgrade password to bcrypt hash
        const salt = bcrypt.genSaltSync(10);
        const newHash = bcrypt.hashSync(password, salt);
        Database.query('UPDATE users SET password_hash = ? WHERE id = ?', [newHash, userData.id]).catch(console.error);
      }
    }

    if (!isValid) {
      throw new Error("Invalid password");
    }

    // Create session
    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await Database.createSession(userData.id, token, expiresAt);
    localStorage.setItem("session_token", token);

    setUser({ id: userData.id, email: userData.email });
    setSession({ token });
  };

  const signUp = async (email: string, password: string) => {
    // Check if user exists
    const existingUser = await Database.getUserByEmail(email);
    if (existingUser) {
      throw new Error("User already exists");
    }

    // Hash password
    const salt = bcrypt.genSaltSync(10);
    const hashedPassword = bcrypt.hashSync(password, salt);
    await Database.createUser(email, hashedPassword);

    // Create profile
    const userData = await Database.getUserByEmail(email);
    if (userData) {
      await Database.createProfile(userData.id);
    }

    // Auto sign in
    await signIn(email, password);
  };

  const signOut = async () => {
    const token = localStorage.getItem("session_token");
    if (token) {
      await Database.deleteSession(token);
      localStorage.removeItem("session_token");
    }
    setUser(null);
    setSession(null);
  };

  return (
    <AuthContext.Provider
      value={{ user, session, loading, signIn, signUp, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
