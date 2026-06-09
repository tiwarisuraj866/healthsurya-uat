"use client";

import { useSignIn } from "@clerk/nextjs";
import { useAuth } from "@/lib/auth";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useRef, useEffect, Suspense } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { AuthPageShell } from "@/components/auth/AuthPageShell";
import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";
import { RolePicker } from "@/components/auth/RolePicker";
import { LoginCaptcha, validateLoginCaptcha } from "@/components/auth/LoginCaptcha";
import { FieldError } from "@/components/auth/FieldError";
import { getAuthRole, parseAuthRole, type AuthRoleId } from "@/lib/auth-roles";
import { validateEmail, validatePhone } from "@/lib/user-validation";
import { toE164India } from "@/lib/otp";
import { LogIn, Mail, Phone, KeyRound, Loader2 } from "lucide-react";
import { toast } from "sonner";

type LoginTab = "password" | "phone-otp";

function LoginPageContent() {
  const { isLoaded, signIn, setActive } = useSignIn() as any;
  const { loading: isAuthLoading, user: dbProfile } = useAuth();
  const isAuthLoaded = !isAuthLoading;
  const router = useRouter();
  const searchParams = useSearchParams();

  const redirectParam = searchParams.get("redirect") || "/dashboard";
  const roleParam = searchParams.get("role") || "patient";

  const [intentRole, setIntentRole] = useState<AuthRoleId>(() => parseAuthRole(roleParam));
  const roleConfig = getAuthRole(intentRole);

  const [tab, setTab] = useState<LoginTab>("phone-otp");
  const [loading, setLoading] = useState(false);

  // Password Login state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);

  // Phone OTP Login state
  const [otpPhone, setOtpPhone] = useState("");
  const [otpPhoneError, setOtpPhoneError] = useState<string | null>(null);
  const [otpSent, setOtpSent] = useState(false);
  const [verificationCode, setVerificationCode] = useState("");

  // Captcha state
  const [captchaInput, setCaptchaInput] = useState("");
  const captchaExpected = useRef("");

  // Terms agreement state
  const [agreeTerms, setAgreeTerms] = useState(false);

  // Clear fields and reset state on component mount / revisit
  useEffect(() => {
    setEmail("");
    setPassword("");
    setOtpPhone("");
    setVerificationCode("");
    setCaptchaInput("");
    setOtpSent(false);
    setAgreeTerms(false);
  }, []);

  // Handle redirect after successful authentication
  useEffect(() => {
    if (isAuthLoaded && dbProfile) {
      // Direct user directly to home page upon successful login
      router.push("/");
    }
  }, [isAuthLoaded, dbProfile, router]);

  if (!isLoaded) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // ── Password Sign In (Clerk) ──
  const onPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agreeTerms) {
      toast.error("Please check the 'I agree to the Terms & Conditions' checkbox to proceed.");
      return;
    }
    const err = validateEmail(email);
    if (err) {
      setEmailError(err);
      return;
    }
    if (!validateLoginCaptcha(captchaInput, captchaExpected.current)) {
      toast.error("Incorrect security code. Refresh the code and try again.");
      return;
    }

    setLoading(true);
    try {
      const result = await signIn.create({
        identifier: email,
        password,
      });

      if (result.status === "complete") {
        await setActive({ session: result.createdSessionId });
        toast.success("Welcome back!");
      } else {
        console.warn("Clerk sign-in status incomplete:", result.status);
        toast.error("Sign-in incomplete. Please contact support.");
      }
    } catch (err: any) {
      toast.error(err.errors?.[0]?.message || err.message || "Invalid credentials");
    } finally {
      setLoading(false);
    }
  };

  // ── Send Phone OTP (Clerk) ──
  const onSendPhoneOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agreeTerms) {
      toast.error("Please check the 'I agree to the Terms & Conditions' checkbox to proceed.");
      return;
    }
    const err = validatePhone(otpPhone);
    if (err) {
      setOtpPhoneError(err);
      return;
    }
    if (!validateLoginCaptcha(captchaInput, captchaExpected.current)) {
      toast.error("Incorrect security code. Refresh the code and try again.");
      return;
    }

    setLoading(true);
    try {
      const formattedPhone = toE164India(otpPhone);
      const result = await signIn.create({
        identifier: formattedPhone,
      });

      // Find the phone code strategy factor
      const phoneCodeFactor = result.supportedFirstFactors.find(
        (factor: any) => factor.strategy === "phone_code"
      ) as any;

      if (!phoneCodeFactor) {
        toast.error("Phone OTP login is not enabled or supported for this number.");
        setLoading(false);
        return;
      }

      await signIn.prepareFirstFactor({
        strategy: "phone_code",
        phoneNumberId: phoneCodeFactor.phoneNumberId,
      });

      setOtpSent(true);
      toast.success(`OTP sent to +91 ${otpPhone}`);
    } catch (err: any) {
      toast.error(err.errors?.[0]?.message || err.message || "Failed to send OTP code.");
    } finally {
      setLoading(false);
    }
  };

  // ── Verify Phone OTP (Clerk) ──
  const onVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (verificationCode.length !== 6) {
      toast.error("Please enter a valid 6-digit OTP.");
      return;
    }

    setLoading(true);
    try {
      const result = await signIn.attemptFirstFactor({
        strategy: "phone_code",
        code: verificationCode,
      });

      if (result.status === "complete") {
        await setActive({ session: result.createdSessionId });
        toast.success("Signed in successfully!");
      } else {
        toast.error("Multi-factor authentication or further setup required.");
      }
    } catch (err: any) {
      toast.error(err.errors?.[0]?.message || err.message || "Invalid OTP code.");
    } finally {
      setLoading(false);
    }
  };

  function TabBtn({ id, icon: Icon, label }: { id: LoginTab; icon: any; label: string }) {
    const active = tab === id;
    return (
      <button
        type="button"
        onClick={() => {
          setTab(id);
          setOtpSent(false);
        }}
        className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-medium transition-all ${
          active
            ? "bg-primary text-primary-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        <Icon className="h-3.5 w-3.5" />
        {label}
      </button>
    );
  }

  return (
    <AuthPageShell
      title="Sign in"
      subtitle={`Access your ${roleConfig.label.toLowerCase()} account`}
      role={roleConfig}
      footer={
        <>
          New here?{" "}
          <a
            href={`/register?redirect=${encodeURIComponent(redirectParam)}&role=${intentRole}`}
            className="font-medium text-primary hover:underline"
          >
            {roleConfig.registerCta}
          </a>
        </>
      }
    >
      <div className="mb-4">
        <Label className="text-xs text-muted-foreground">I am signing in as</Label>
        <div className="mt-2">
          <RolePicker value={intentRole} onChange={setIntentRole} compact />
        </div>
      </div>

      <GoogleSignInButton redirectPath={redirectParam} />

      <div className="my-4 flex items-center gap-2 text-[10px] uppercase tracking-wide text-muted-foreground">
        <div className="h-px flex-1 bg-border" />
        or sign in with
        <div className="h-px flex-1 bg-border" />
      </div>

      {/* Tab switcher */}
      <div className="mb-4 flex gap-1 rounded-xl bg-muted p-1">
        <TabBtn id="phone-otp" icon={Phone} label="Mobile OTP" />
        <TabBtn id="password" icon={KeyRound} label="Password" />
      </div>

      {/* ── Mobile OTP Tab ── */}
      {tab === "phone-otp" && !otpSent && (
        <form onSubmit={onSendPhoneOtp} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="otp-phone">Mobile number</Label>
            <div className="flex gap-2">
              <span className="flex h-10 items-center rounded-md border bg-muted px-3 text-sm font-mono text-muted-foreground select-none">
                +91
              </span>
              <Input
                id="otp-phone"
                className="min-h-10 font-mono"
                type="tel"
                inputMode="numeric"
                required
                maxLength={10}
                placeholder="9876543210"
                value={otpPhone}
                onChange={(e) => {
                  setOtpPhone(e.target.value.replace(/\D/g, ""));
                  setOtpPhoneError(null);
                }}
                onBlur={() => setOtpPhoneError(validatePhone(otpPhone))}
              />
            </div>
            <FieldError error={otpPhoneError} />
          </div>

          <LoginCaptcha
            value={captchaInput}
            onChange={setCaptchaInput}
            onChallengeChange={(code) => {
              captchaExpected.current = code;
            }}
          />

                  {/* Terms checkbox */}
          <div className="flex items-center space-x-2 my-2 py-1">
            <Checkbox
              id="agree-terms-otp"
              checked={agreeTerms}
              onCheckedChange={(checked) => setAgreeTerms(!!checked)}
            />
            <Label
              htmlFor="agree-terms-otp"
              className="text-xs text-muted-foreground cursor-pointer select-none"
            >
              I agree to the <a href="/legal/terms" className="text-primary hover:underline font-medium">Terms & Conditions</a>
            </Label>
          </div>

          <Button type="submit" className="btn-gradient w-full min-h-10" disabled={loading || !agreeTerms}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Sending OTP…
              </>
            ) : (
              <>
                <Phone className="h-4 w-4 mr-2" />
                Send OTP Code
              </>
            )}
          </Button>
        </form>
      )}

      {/* OTP Verification form */}
      {tab === "phone-otp" && otpSent && (
        <form onSubmit={onVerifyOtp} className="space-y-4">
          <div className="space-y-1.5 text-center">
            <Label htmlFor="otp-code">Enter 6-digit Verification Code sent to +91 {otpPhone}</Label>
            <Input
              id="otp-code"
              className="text-center font-mono tracking-widest text-lg min-h-10"
              type="text"
              inputMode="numeric"
              maxLength={6}
              required
              placeholder="000000"
              value={verificationCode}
              onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ""))}
            />
          </div>
          <Button type="submit" className="btn-gradient w-full min-h-10" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Verifying…
              </>
            ) : (
              "Verify Code & Sign In"
            )}
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="w-full text-xs text-muted-foreground"
            onClick={() => setOtpSent(false)}
          >
            Change mobile number
          </Button>
        </form>
      )}

      {/* ── Password Tab ── */}
      {tab === "password" && (
        <form onSubmit={onPasswordSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="login-email">Email</Label>
            <Input
              id="login-email"
              className="min-h-10"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setEmailError(null);
              }}
              onBlur={() => setEmailError(validateEmail(email))}
            />
            <FieldError error={emailError} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="login-password">Password</Label>
            <Input
              id="login-password"
              className="min-h-10"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <LoginCaptcha
            value={captchaInput}
            onChange={setCaptchaInput}
            onChallengeChange={(code) => {
              captchaExpected.current = code;
            }}
          />

          {/* Terms checkbox */}
          <div className="flex items-center space-x-2 my-2 py-1">
            <Checkbox
              id="agree-terms-password"
              checked={agreeTerms}
              onCheckedChange={(checked) => setAgreeTerms(!!checked)}
            />
            <Label
              htmlFor="agree-terms-password"
              className="text-xs text-muted-foreground cursor-pointer select-none"
            >
              I agree to the <a href="/legal/terms" className="text-primary hover:underline font-medium">Terms & Conditions</a>
            </Label>
          </div>

          <Button type="submit" className="btn-gradient w-full min-h-10" disabled={loading || !agreeTerms}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Signing in…
              </>
            ) : (
              `Sign in as ${roleConfig.label}`
            )}
          </Button>
        </form>
      )}
    </AuthPageShell>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    }>
      <LoginPageContent />
    </Suspense>
  );
}
