"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useUser, useClerk } from "@clerk/nextjs";
import { supabase } from "@/integrations/supabase/client";

export type AppRole =
  | "patient"
  | "doctor"
  | "lab"
  | "pharmacy"
  | "franchise"
  | "courier"
  | "lab_staff"
  | "pharmacy_staff"
  | "support"
  | "finance"
  | "marketing"
  | "operations"
  | "admin"
  | "super_admin";

export type VerificationStatus = "pending" | "under_review" | "approved" | "rejected" | "suspended";

export interface UserProfile {
  id: string; // UUID in Supabase
  clerk_user_id: string;
  phone: string | null;
  email: string | null;
  full_name: string | null;
  role: AppRole;
  verification_status: VerificationStatus;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface AuthCtx {
  user: UserProfile | null; // Profile from Supabase
  clerkUser: ReturnType<typeof useUser>["user"]; // Raw Clerk User
  roles: AppRole[];
  loading: boolean;
  signOut: () => Promise<void>;
  refreshRoles: () => Promise<void>;
}

const AuthContext = createContext<AuthCtx | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { user: clerkUser, isLoaded: isClerkLoaded } = useUser();
  const { signOut: clerkSignOut } = useClerk();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  const fetchProfile = async (clerkId: string) => {
    if (process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY === "pk_test_Y2xlcmsubW9jay5kZXYk") {
      const getCookie = (name: string) => {
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) return parts.pop()?.split(';').shift();
        return null;
      };
      const mockRole = getCookie("mock_role") || "admin";
      const mockVerStatus = getCookie("mock_verification_status") || "approved";
      return {
        id: clerkId,
        clerk_user_id: clerkId,
        phone: "9876500501",
        email: `${mockRole}@healthsurya.com`,
        full_name: mockRole === "admin" ? "Suraj Tiwari" : mockRole === "doctor" ? "Dr. Rajesh Gupta" : mockRole === "lab" ? "PathCare Diagnostics" : `Test ${mockRole.charAt(0).toUpperCase() + mockRole.slice(1)}`,
        role: mockRole,
        verification_status: mockVerStatus as any,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as any;
    }

    try {
      const { data, error } = (await (supabase
        .from("profiles" as any) as any)
        .select("*")
        .eq("clerk_user_id" as any, clerkId)
        .maybeSingle()) as any;

      if (error) {
        console.error("[AuthProvider] Error fetching profile:", error.message);
        return null;
      }
      return data as UserProfile | null;
    } catch (err) {
      console.error("[AuthProvider] Catch fetching profile:", err);
      return null;
    }
  };

  const loadAndSyncProfile = async (clerkId: string, attempts = 5) => {
    setLoadingProfile(true);
    let currentAttempt = 0;

    const poll = async () => {
      const data = await fetchProfile(clerkId);
      if (data) {
        setProfile(data);
        setLoadingProfile(false);
      } else if (currentAttempt < attempts) {
        currentAttempt++;
        console.log(`[AuthProvider] Profile not found, retrying in 1.5s (attempt ${currentAttempt}/${attempts})...`);
        setTimeout(poll, 1500);
      } else {
        console.warn("[AuthProvider] Profile not found after polling. Webhook might be pending.");
        setProfile(null);
        setLoadingProfile(false);
      }
    };

    poll();
  };

  useEffect(() => {
    if (!isClerkLoaded) {
      return;
    }

    if (clerkUser) {
      loadAndSyncProfile(clerkUser.id);
    } else {
      setProfile(null);
      setLoadingProfile(false);
    }
  }, [clerkUser, isClerkLoaded]);

  const signOut = async () => {
    setLoadingProfile(true);
    await clerkSignOut();
    setProfile(null);
    setLoadingProfile(false);
  };

  const refreshRoles = async () => {
    if (clerkUser) {
      const data = await fetchProfile(clerkUser.id);
      if (data) setProfile(data);
    }
  };

  const roles: AppRole[] = profile ? [profile.role] : [];
  const loading = !isClerkLoaded || loadingProfile;

  return (
    <AuthContext.Provider
      value={{
        user: profile,
        clerkUser,
        roles,
        loading,
        signOut,
        refreshRoles,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
