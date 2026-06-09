"use client";

import { useSignUp } from "@clerk/nextjs";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useRef, Suspense } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthPageShell } from "@/components/auth/AuthPageShell";
import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";
import { RolePicker } from "@/components/auth/RolePicker";
import { LoginCaptcha, validateLoginCaptcha } from "@/components/auth/LoginCaptcha";
import { PolicyConsentFields, policiesAccepted } from "@/components/auth/PolicyConsentFields";
import { FieldError } from "@/components/auth/FieldError";
import { getAuthRole, parseAuthRole, type AuthRoleId } from "@/lib/auth-roles";
import { validateFullName, validateEmail, validatePhone } from "@/lib/user-validation";
import { toE164India } from "@/lib/otp";
import { UserPlus, Check, Loader2, Phone } from "lucide-react";
import { toast } from "sonner";

function RegisterPageContent() {
  const { isLoaded, signUp, setActive } = useSignUp() as any;
  const router = useRouter();
  const searchParams = useSearchParams();

  const redirectParam = searchParams.get("redirect") || "/dashboard";
  const initialRoleParam = searchParams.get("role") || "patient";

  const [role, setRole] = useState<AuthRoleId>(() => parseAuthRole(initialRoleParam));
  const roleConfig = getAuthRole(role);

  const [form, setForm] = useState({
    full_name: "",
    email: "",
    phone: "",
  });

  const [fieldErrors, setFieldErrors] = useState<Record<string, string | null>>({});
  const [loading, setLoading] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const consentOk = policiesAccepted(termsAccepted, privacyAccepted);

  const [captchaInput, setCaptchaInput] = useState("");
  const captchaExpected = useRef("");

  // OTP Verification state
  const [otpSent, setOtpSent] = useState(false);
  const [verificationCode, setVerificationCode] = useState("");

  if (!isLoaded) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  function setField(key: keyof typeof form, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
    setFieldErrors((e) => ({ ...e, [key]: null }));
  }

  function validateBlur(key: keyof typeof form) {
    let err: string | null = null;
    if (key === "full_name") err = validateFullName(form.full_name);
    if (key === "email") err = validateEmail(form.email);
    if (key === "phone") err = validatePhone(form.phone);
    setFieldErrors((e) => ({ ...e, [key]: err }));
  }

  function validateAll(): boolean {
    const nameErr = validateFullName(form.full_name);
    const emailErr = validateEmail(form.email);
    const phoneErr = validatePhone(form.phone);

    if (nameErr || emailErr || phoneErr) {
      setFieldErrors({
        full_name: nameErr,
        email: emailErr,
        phone: phoneErr,
      });
      return false;
    }
    return true;
  }

  // ── Step 2: Sign Up & Send OTP (Clerk) ──
  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!consentOk) {
      toast.error("You must accept Terms of Service and Privacy Policy.");
      return;
    }
    if (!validateLoginCaptcha(captchaInput, captchaExpected.current)) {
      toast.error("Incorrect security code. Check the image and try again.");
      return;
    }
    if (!validateAll()) {
      toast.error("Please fix the errors above.");
      return;
    }

    setLoading(true);
    try {
      const formattedPhone = toE164India(form.phone);
      const nameParts = form.full_name.trim().split(/\s+/);
      const firstName = nameParts[0] || "";
      const lastName = nameParts.slice(1).join(" ") || "";

      // Initialize Clerk signup
      await signUp.create({
        phoneNumber: formattedPhone,
        emailAddress: form.email,
        firstName,
        lastName,
        // Business roles are stored in metadata and synced via Webhook
        unsafeMetadata: {
          role,
        },
      });

      // Prepare mobile number verification code
      await signUp.preparePhoneNumberVerification({
        strategy: "phone_code",
      });

      setOtpSent(true);
      toast.success(`Verification code sent to +91 ${form.phone}`);
    } catch (err: any) {
      toast.error(err.errors?.[0]?.message || err.message || "Failed to create account.");
    } finally {
      setLoading(false);
    }
  };

  // ── Step 3: Verify OTP (Clerk) ──
  const onVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (verificationCode.length !== 6) {
      toast.error("Please enter a valid 6-digit verification code.");
      return;
    }

    setLoading(true);
    try {
      const result = await signUp.attemptPhoneNumberVerification({
        code: verificationCode,
      });

      if (result.status === "complete") {
        await setActive({ session: result.createdSessionId });
        
        // Record consent audit trail in backend
        try {
          await fetch("/api/consent", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              terms_version: "2026-05-31",
              privacy_version: "2026-05-31",
            }),
          });
        } catch (consentErr) {
          console.error("Error logging consent audit trail:", consentErr);
        }

        toast.success("Account created successfully!");

        // Redirect based on role
        if (role === "patient") {
          router.push("/dashboard");
        } else if (role === "doctor") {
          router.push("/doctor-setup");
        } else if (role === "lab") {
          router.push("/lab-setup");
        } else if (role === "pharmacy") {
          router.push("/pharmacy-setup");
        } else if (role === "franchise") {
          router.push("/franchise-setup");
        } else {
          router.push(redirectParam);
        }
      } else {
        toast.error("Account registration incomplete. Please check details.");
      }
    } catch (err: any) {
      toast.error(err.errors?.[0]?.message || err.message || "Invalid OTP code.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthPageShell
      title="Create account"
      subtitle={roleConfig.tagline}
      role={roleConfig}
      footer={
        <>
          Already registered?{" "}
          <a
            href={`/login?redirect=${encodeURIComponent(redirectParam)}&role=${role}`}
            className="font-medium text-primary hover:underline"
          >
            Sign in as {roleConfig.label}
          </a>
        </>
      }
    >
      {!otpSent && (
        <>
          <div className="mb-4">
            <Label className="text-xs font-medium text-muted-foreground">Choose account type</Label>
            <div className="mt-2">
              <RolePicker value={role} onChange={setRole} />
            </div>
          </div>

          <ul className="mb-4 space-y-1 rounded-lg border bg-muted/30 px-3 py-2.5">
            {roleConfig.perks.map((perk) => (
              <li key={perk} className="flex items-center gap-2 text-xs text-muted-foreground">
                <Check className="h-3.5 w-3.5 shrink-0 text-primary" />
                {perk}
              </li>
            ))}
          </ul>

          <form onSubmit={onSubmit} className="space-y-3">
            {/* Full name */}
            <div className="space-y-1.5">
              <Label htmlFor="reg-name">Full name</Label>
              <Input
                id="reg-name"
                className="min-h-10"
                required
                maxLength={100}
                autoComplete="name"
                value={form.full_name}
                onChange={(e) => setField("full_name", e.target.value)}
                onBlur={() => validateBlur("full_name")}
              />
              <FieldError
                error={fieldErrors.full_name}
                valid={!fieldErrors.full_name && form.full_name.length >= 2}
              />
            </div>

            {/* Email */}
            <div className="space-y-1.5">
              <Label htmlFor="reg-email">Email</Label>
              <Input
                id="reg-email"
                className="min-h-10"
                type="email"
                required
                maxLength={255}
                autoComplete="email"
                value={form.email}
                onChange={(e) => setField("email", e.target.value)}
                onBlur={() => validateBlur("email")}
              />
              <FieldError
                error={fieldErrors.email}
                valid={!fieldErrors.email && form.email.includes("@")}
              />
            </div>

            {/* Phone */}
            <div className="space-y-1.5">
              <Label htmlFor="reg-phone">Mobile number</Label>
              <div className="flex gap-2">
                <span className="flex h-10 items-center rounded-md border bg-muted px-3 text-sm font-mono text-muted-foreground select-none">
                  +91
                </span>
                <Input
                  id="reg-phone"
                  className="min-h-10 font-mono"
                  type="tel"
                  inputMode="numeric"
                  required
                  maxLength={10}
                  placeholder="9876543210"
                  value={form.phone}
                  onChange={(e) => setField("phone", e.target.value.replace(/\D/g, ""))}
                  onBlur={() => validateBlur("phone")}
                />
              </div>
              <FieldError
                error={fieldErrors.phone}
                valid={!fieldErrors.phone && form.phone.length === 10}
              />
            </div>

            <PolicyConsentFields
              termsAccepted={termsAccepted}
              privacyAccepted={privacyAccepted}
              onTermsChange={setTermsAccepted}
              onPrivacyChange={setPrivacyAccepted}
            />

            <LoginCaptcha
              value={captchaInput}
              onChange={setCaptchaInput}
              onChallengeChange={(code) => {
                captchaExpected.current = code;
              }}
            />

            <GoogleSignInButton redirectPath={redirectParam} disabled={!consentOk} />

            <Button
              type="submit"
              className="btn-gradient w-full min-h-10"
              disabled={loading || !consentOk}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Creating…
                </>
              ) : (
                roleConfig.registerCta
              )}
            </Button>
          </form>
        </>
      )}

      {/* OTP Verification form */}
      {otpSent && (
        <form onSubmit={onVerifyOtp} className="space-y-4">
          <div className="space-y-1.5 text-center">
            <Label htmlFor="otp-code">Enter 6-digit Verification Code sent to +91 {form.phone}</Label>
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
              "Verify Code & Create Account"
            )}
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="w-full text-xs text-muted-foreground"
            onClick={() => setOtpSent(false)}
          >
            Change details / Go back
          </Button>
        </form>
      )}
    </AuthPageShell>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    }>
      <RegisterPageContent />
    </Suspense>
  );
}
