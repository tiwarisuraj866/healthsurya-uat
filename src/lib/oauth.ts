import { supabase } from "@/integrations/supabase/client";

function siteOrigin(): string {
  if (typeof window === "undefined") return "";
  const envVal = typeof process !== "undefined" ? (process.env.NEXT_PUBLIC_SITE_URL ?? process.env.VITE_SITE_URL) : undefined;
  return envVal?.replace(/\/$/, "") || window.location.origin;
}

/** OAuth callback URL — must be whitelisted in Supabase → Authentication → URL Configuration */
export function oauthCallbackUrl(nextPath: string): string {
  const origin = siteOrigin();
  const safeNext = nextPath.startsWith("/") ? nextPath : "/dashboard";
  return `${origin}/auth/callback?next=${encodeURIComponent(safeNext)}`;
}

/** Google OAuth via Supabase Auth */
export async function signInWithGoogle(redirectPath = "/dashboard") {
  if (typeof window === "undefined") {
    return { data: null, error: new Error("Google sign-in is only available in the browser") };
  }

  const redirectTo = oauthCallbackUrl(redirectPath);

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo,
      queryParams: { access_type: "online", prompt: "select_account" },
    },
  });

  if (error) return { data, error };

  if (data?.url) {
    window.location.assign(data.url);
  } else {
    return {
      data,
      error: new Error(
        "Google sign-in did not start. Enable Google provider in Supabase Dashboard → Authentication → Providers, and add this callback URL under Redirect URLs: " +
          redirectTo.split("?")[0],
      ),
    };
  }

  return { data, error: null };
}
