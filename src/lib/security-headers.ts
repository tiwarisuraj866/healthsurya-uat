const SECURITY_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(self)",
  "X-DNS-Prefetch-Control": "off",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains; preload",
};

export function applySecurityHeaders(response: Response): Response {
  // Add base security headers
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    response.headers.set(key, value);
  }

  // Content Security Policy — covers all third-party services used
  if (!response.headers.has("Content-Security-Policy")) {
    response.headers.set(
      "Content-Security-Policy",
      [
        "default-src 'self'",
        // Clerk auth + Razorpay checkout script
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.clerk.accounts.dev https://clerk.healthsurya.com https://*.clerk.com https://clerk.mock.dev https://*.clerk.mock.dev https://checkout.razorpay.com https://api.razorpay.com https://*.sentry.io https://js.sentry-cdn.com https://app.posthog.com",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        // Images from Supabase storage, Clerk, Unsplash, Razorpay QR codes
        "img-src 'self' data: blob: https://images.unsplash.com https://*.clerk.com https://*.supabase.co https://img.clerk.com https://clerk.mock.dev https://*.clerk.mock.dev https://checkout.razorpay.com https://*.razorpay.com",
        "font-src 'self' data: https://fonts.gstatic.com",
        // API connections: Supabase, Clerk, Razorpay, Meta Graph API, PostHog, Sentry, BigDataCloud (geolocation)
        "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.clerk.accounts.dev https://clerk.healthsurya.com https://*.clerk.com https://api.bigdatacloud.net https://clerk.mock.dev https://*.clerk.mock.dev https://api.razorpay.com https://graph.facebook.com https://app.posthog.com https://*.sentry.io https://o*.ingest.sentry.io",
        // Razorpay checkout iframe + Google Maps
        "frame-src 'self' https://api.razorpay.com https://checkout.razorpay.com https://maps.google.com https://*.google.com",
        "frame-ancestors 'none'",
        "base-uri 'self'",
        "form-action 'self'",
      ].join("; "),
    );
  }

  return response;
}
