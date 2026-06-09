"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Clock, LogOut, ArrowLeft } from "lucide-react";

export default function VerificationPendingPage() {
  const { user, signOut } = useAuth();

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4 py-16">
      <div className="glass-card max-w-md w-full p-8 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-warning/10 text-warning mb-6">
          <Clock className="h-7 w-7" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight">Verification Pending</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Hello {user?.full_name || "Partner"}, your profile registration is currently under review. 
          Our operations team will verify your credentials and documents shortly.
        </p>

        <div className="mt-6 rounded-lg bg-muted/40 p-4 text-left text-xs text-muted-foreground space-y-2">
          <div>
            <span className="font-semibold text-foreground">Role:</span> {user?.role?.toUpperCase()}
          </div>
          <div>
            <span className="font-semibold text-foreground">Status:</span> {user?.verification_status?.toUpperCase()}
          </div>
          <div>
            <span className="font-semibold text-foreground">Email:</span> {user?.email}
          </div>
        </div>

        <p className="mt-6 text-xs text-muted-foreground">
          If you have recently submitted new files or updated your license, please wait up to 24 hours for review.
        </p>

        <div className="mt-8 flex flex-col gap-3">
          <Button variant="outline" className="w-full" onClick={() => signOut()}>
            <LogOut className="mr-2 h-4 w-4" /> Sign out
          </Button>
          <Button variant="ghost" className="w-full" asChild>
            <Link href="/">
              <ArrowLeft className="mr-2 h-4 w-4" /> Return to Home
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
