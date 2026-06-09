"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

const UserContext = createContext<any>(null);

export function ClerkProvider({ children }: { children: React.ReactNode }) {
  const [role, setRole] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const getCookie = (name: string) => {
      const value = `; ${document.cookie}`;
      const parts = value.split(`; ${name}=`);
      if (parts.length === 2) return parts.pop()?.split(';').shift();
      return null;
    };
    setRole(getCookie("mock_role") || null);
    setIsLoaded(true);
  }, []);

  let clerkId = null;
  let fullName = "";
  if (role === "admin") {
    clerkId = "f1000001-0001-4000-8000-000000000001";
    fullName = "Suraj Tiwari";
  } else if (role === "doctor") {
    clerkId = "c1000001-0001-4000-8000-000000000001";
    fullName = "Dr. Rajesh Gupta";
  } else if (role === "lab") {
    clerkId = "d1000001-0001-4000-8000-000000000001";
    fullName = "PathCare Diagnostics";
  } else if (role === "pharmacy") {
    clerkId = "d1000002-0001-4000-8000-000000000002";
    fullName = "MedLife Labs";
  } else if (role === "patient") {
    clerkId = "b1000001-0001-4000-8000-000000000001";
    fullName = "Rahul Sharma";
  }

  const mockUser = clerkId ? {
    id: clerkId,
    primaryEmailAddress: { emailAddress: `${role}@healthsurya.com` },
    firstName: fullName.split(" ")[0],
    lastName: fullName.split(" ").slice(1).join(" ") || "User",
    fullName: fullName,
    publicMetadata: {
      role: role,
      verification_status: "approved",
      is_active: true
    }
  } : null;

  return (
    <UserContext.Provider value={{ user: mockUser, isLoaded, isSignedIn: !!clerkId, role, setRole }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (!context) {
    return { isLoaded: false, isSignedIn: false, user: null };
  }
  return {
    isLoaded: context.isLoaded,
    isSignedIn: context.isSignedIn,
    user: context.user
  };
}

export function useClerk() {
  return {
    signOut: async () => {
      document.cookie = "mock_role=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
      window.location.href = "/login";
    }
  };
}

export function useSignIn() {
  return {
    isLoaded: true,
    signIn: {
      create: async ({ identifier, password }: any) => {
        let role = "patient";
        if (identifier.includes("doctor")) role = "doctor";
        else if (identifier.includes("lab")) role = "lab";
        else if (identifier.includes("pharmacy")) role = "pharmacy";
        else if (identifier.includes("admin")) role = "admin";
        
        document.cookie = `mock_role=${role}; path=/`;
        return { status: "complete", createdSessionId: "mock_session" };
      },
      prepareFirstFactor: async () => {},
      attemptFirstFactor: async () => {
        document.cookie = "mock_role=patient; path=/";
        return { status: "complete", createdSessionId: "mock_session" };
      },
      authenticateWithRedirect: async ({ redirectUrlComplete }: any) => {
        document.cookie = "mock_role=patient; path=/";
        window.location.href = redirectUrlComplete || "/dashboard";
      }
    },
    setActive: async () => {
      window.location.reload();
    }
  };
}

export function useSignUp() {
  return {
    isLoaded: true,
    signUp: {
      create: async ({ unsafeMetadata }: any) => {
        if (unsafeMetadata?.role) {
          document.cookie = `mock_intent_role=${unsafeMetadata.role}; path=/`;
        }
      },
      prepareVerification: async () => {},
      preparePhoneNumberVerification: async () => {},
      attemptVerification: async () => {
        const cookies = document.cookie.split("; ");
        const intentCookie = cookies.find(row => row.startsWith("mock_intent_role="));
        const role = intentCookie ? intentCookie.split("=")[1] : "patient";
        document.cookie = `mock_role=${role}; path=/`;
        return { status: "complete", createdSessionId: "mock_session" };
      },
      attemptPhoneNumberVerification: async () => {
        const cookies = document.cookie.split("; ");
        const intentCookie = cookies.find(row => row.startsWith("mock_intent_role="));
        const role = intentCookie ? intentCookie.split("=")[1] : "patient";
        document.cookie = `mock_role=${role}; path=/`;
        return { status: "complete", createdSessionId: "mock_session" };
      },
      authenticateWithRedirect: async ({ redirectUrlComplete }: any) => {
        document.cookie = "mock_role=patient; path=/";
        window.location.href = redirectUrlComplete || "/dashboard";
      }
    },
    setActive: async () => {
      window.location.reload();
    }
  };
}
