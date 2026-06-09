import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { applySecurityHeaders } from "@/lib/security-headers";

// Match paths that require auth check
const isProtectedRoute = createRouteMatcher([
  "/dashboard(.*)",
  "/doctor-manage(.*)",
  "/doctor-setup(.*)",
  "/lab",
  "/lab/(.*)",
  "/lab-manage(.*)",
  "/lab-setup(.*)",
  "/pharmacy",
  "/pharmacy/(.*)",
  "/pharmacy-setup(.*)",
  "/franchise(.*)",
  "/admin(.*)",
  "/support(.*)",
  "/finance(.*)",
  "/marketing(.*)",
  "/operations(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  let response: Response = NextResponse.next();

  if (isProtectedRoute(req)) {
    const { userId, sessionClaims } = await auth();

    // Redirect to login if user not authenticated
    if (!userId) {
      const signInUrl = new URL("/login", req.url);
      signInUrl.searchParams.set("redirect", req.nextUrl.pathname);
      response = NextResponse.redirect(signInUrl);
      return applySecurityHeaders(response);
    }

    // Extract metadata from sessionClaims (JWT custom claims)
    // Customize your Clerk JWT template to map these fields:
    // "metadata": "{{user.public_metadata}}"
    const metadata = (sessionClaims?.metadata || {}) as {
      role?: string;
      verification_status?: string;
      is_active?: boolean;
    };

    const role = metadata.role || "patient";
    const verificationStatus = metadata.verification_status || "approved";
    const isActive = metadata.is_active ?? true;

    const path = req.nextUrl.pathname;

    // Reject suspended accounts
    if (!isActive) {
      response = NextResponse.redirect(new URL("/suspended", req.url));
      return applySecurityHeaders(response);
    }

    // Role verification logic
    if (path.startsWith("/admin") && !["admin", "super_admin"].includes(role)) {
      response = NextResponse.redirect(new URL("/unauthorized", req.url));
      return applySecurityHeaders(response);
    }

    if (path.startsWith("/doctor-manage") || path.startsWith("/doctor-setup")) {
      if (role !== "doctor") {
        response = NextResponse.redirect(new URL("/unauthorized", req.url));
        return applySecurityHeaders(response);
      }
      if (verificationStatus === "pending" || verificationStatus === "under_review") {
        response = NextResponse.redirect(new URL("/verification-pending", req.url));
        return applySecurityHeaders(response);
      }
      if (verificationStatus !== "approved") {
        response = NextResponse.redirect(new URL("/unauthorized", req.url));
        return applySecurityHeaders(response);
      }
    }

    if (path === "/lab" || path.startsWith("/lab/") || path.startsWith("/lab-manage") || path.startsWith("/lab-setup")) {
      if (role !== "lab") {
        response = NextResponse.redirect(new URL("/unauthorized", req.url));
        return applySecurityHeaders(response);
      }
      if (verificationStatus === "pending" || verificationStatus === "under_review") {
        response = NextResponse.redirect(new URL("/verification-pending", req.url));
        return applySecurityHeaders(response);
      }
      if (verificationStatus !== "approved") {
        response = NextResponse.redirect(new URL("/unauthorized", req.url));
        return applySecurityHeaders(response);
      }
    }

    if (path === "/pharmacy" || path.startsWith("/pharmacy/") || path.startsWith("/pharmacy-setup")) {
      if (role !== "pharmacy") {
        response = NextResponse.redirect(new URL("/unauthorized", req.url));
        return applySecurityHeaders(response);
      }
      if (verificationStatus === "pending" || verificationStatus === "under_review") {
        response = NextResponse.redirect(new URL("/verification-pending", req.url));
        return applySecurityHeaders(response);
      }
      if (verificationStatus !== "approved") {
        response = NextResponse.redirect(new URL("/unauthorized", req.url));
        return applySecurityHeaders(response);
      }
    }

    if (path.startsWith("/franchise")) {
      if (role !== "franchise") {
        response = NextResponse.redirect(new URL("/unauthorized", req.url));
        return applySecurityHeaders(response);
      }
      if (verificationStatus === "pending" || verificationStatus === "under_review") {
        response = NextResponse.redirect(new URL("/verification-pending", req.url));
        return applySecurityHeaders(response);
      }
      if (verificationStatus !== "approved") {
        response = NextResponse.redirect(new URL("/unauthorized", req.url));
        return applySecurityHeaders(response);
      }
    }

    if (path.startsWith("/support") && !["support", "admin", "super_admin"].includes(role)) {
      response = NextResponse.redirect(new URL("/unauthorized", req.url));
      return applySecurityHeaders(response);
    }

    if (path.startsWith("/finance") && !["finance", "admin", "super_admin"].includes(role)) {
      response = NextResponse.redirect(new URL("/unauthorized", req.url));
      return applySecurityHeaders(response);
    }

    if (path.startsWith("/marketing") && !["marketing", "admin", "super_admin"].includes(role)) {
      response = NextResponse.redirect(new URL("/unauthorized", req.url));
      return applySecurityHeaders(response);
    }

    if (path.startsWith("/operations") && !["operations", "admin", "super_admin"].includes(role)) {
      response = NextResponse.redirect(new URL("/unauthorized", req.url));
      return applySecurityHeaders(response);
    }
  }

  return applySecurityHeaders(response);
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files
    "/((?!_next|[^?]*\\.(?:html|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
    // Clerk proxy matcher path
    "/__clerk/:path*",
  ],
};
