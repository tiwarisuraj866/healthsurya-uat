"use client";

import { AuthenticateWithRedirectCallback } from "@clerk/nextjs";

export default function SSOCallbackPage() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <AuthenticateWithRedirectCallback />
    </div>
  );
}
