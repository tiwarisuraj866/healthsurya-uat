import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { OtpInput } from "@/components/auth/OtpInput";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  OTP_RESEND_COOLDOWN_SEC,
  maskEmail,
  maskPhone,
  validateOtpToken,
  type OtpChannel,
} from "@/lib/otp";
import { MailCheck, Phone, RefreshCw, Loader2, ShieldCheck } from "lucide-react";

interface OtpVerifyBlockProps {
  channel: OtpChannel;
  destination: string; // email or E.164 phone
  onSuccess: () => void;
  onBack?: () => void;
}

/**
 * Step 2 of OTP flow: enter the 6-digit code.
 * Handles verify + resend with cooldown timer.
 */
export function OtpVerifyBlock({ channel, destination, onSuccess, onBack }: OtpVerifyBlockProps) {
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(OTP_RESEND_COOLDOWN_SEC);
  const [resending, setResending] = useState(false);

  // Countdown timer
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const maskedDest = channel === "email" ? maskEmail(destination) : maskPhone(destination);
  const ChannelIcon = channel === "email" ? MailCheck : Phone;

  const handleVerify = useCallback(async () => {
    const err = validateOtpToken(token);
    if (err) { toast.error(err); return; }

    setLoading(true);
    try {
      let result;
      if (channel === "email") {
        result = await supabase.auth.verifyOtp({ email: destination, token, type: "email" });
      } else {
        result = await supabase.auth.verifyOtp({ phone: destination, token, type: "sms" });
      }
      if (result.error) throw result.error;
      toast.success("Verified! You're now signed in.");
      onSuccess();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (/expired|invalid/i.test(msg)) {
        toast.error("Code is invalid or expired. Please request a new one.");
      } else {
        toast.error(msg);
      }
      setToken("");
    } finally {
      setLoading(false);
    }
  }, [token, channel, destination, onSuccess]);

  // Auto-submit when all 6 digits are entered
  useEffect(() => {
    if (token.length === 6 && !loading) handleVerify();
  }, [token, loading, handleVerify]);

  async function handleResend() {
    setResending(true);
    try {
      let result;
      if (channel === "email") {
        result = await supabase.auth.signInWithOtp({ email: destination });
      } else {
        result = await supabase.auth.signInWithOtp({ phone: destination });
      }
      if (result.error) throw result.error;
      toast.success("New code sent!");
      setCooldown(OTP_RESEND_COOLDOWN_SEC);
      setToken("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to resend code");
    } finally {
      setResending(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="text-center space-y-2">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
          <ChannelIcon className="h-7 w-7 text-primary" />
        </div>
        <p className="text-sm text-muted-foreground">
          We sent a 6-digit code to <span className="font-semibold text-foreground">{maskedDest}</span>
        </p>
        <p className="text-xs text-muted-foreground">Enter the code below — it expires in 10 minutes.</p>
      </div>

      <OtpInput value={token} onChange={setToken} disabled={loading} autoFocus />

      <Button
        className="w-full gap-2"
        onClick={handleVerify}
        disabled={token.length < 6 || loading}
      >
        {loading ? (
          <><Loader2 className="h-4 w-4 animate-spin" /> Verifying…</>
        ) : (
          <><ShieldCheck className="h-4 w-4" /> Confirm code</>
        )}
      </Button>

      <div className="flex items-center justify-between text-sm">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Back
          </button>
        )}
        <button
          type="button"
          onClick={handleResend}
          disabled={cooldown > 0 || resending}
          className="ml-auto flex items-center gap-1.5 text-muted-foreground hover:text-primary disabled:opacity-40 transition-colors"
        >
          {resending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
          {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
        </button>
      </div>
    </div>
  );
}
