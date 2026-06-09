import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import crypto from "crypto";

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/payments/create-order
// Creates a Razorpay order and records it in the database.
// Frontend then opens Razorpay checkout with the returned order_id.
// ─────────────────────────────────────────────────────────────────────────────
export async function POST(req: Request) {
  try {
    // 1. Authenticate user
    const { userId: clerkUserId } = await auth();
    if (!clerkUserId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    // 2. Get user profile
    const { data: profile, error: profileError } = (await supabaseAdmin
      .from("profiles" as any)
      .select("id, wallet_balance")
      .eq("clerk_user_id", clerkUserId)
      .single()) as any;

    if (profileError || !profile) {
      return new NextResponse("User profile not found", { status: 404 });
    }

    // 3. Parse request body
    const { amount, currency = "INR", receipt, notes = {} } = await req.json();

    if (!amount || typeof amount !== "number" || amount < 100) {
      return new NextResponse("Bad Request – amount must be >= ₹1 (100 paise)", {
        status: 400,
      });
    }

    if (!receipt || typeof receipt !== "string") {
      return new NextResponse("Bad Request – receipt is required", { status: 400 });
    }

    // 4. Create Razorpay order via their API
    const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID;
    const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;

    if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
      console.error("[Payments] Missing Razorpay credentials");
      return new NextResponse("Payment gateway not configured", { status: 503 });
    }

    const credentials = Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString(
      "base64"
    );

    const razorpayResponse = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${credentials}`,
      },
      body: JSON.stringify({
        amount: Math.round(amount), // amount in paise
        currency,
        receipt: receipt.slice(0, 40), // Razorpay receipt max 40 chars
        notes: {
          user_id: profile.id,
          clerk_user_id: clerkUserId,
          ...notes,
        },
      }),
    });

    if (!razorpayResponse.ok) {
      const err = await razorpayResponse.json().catch(() => ({}));
      console.error("[Payments] Razorpay create order error:", err);
      return new NextResponse("Payment gateway error", { status: 502 });
    }

    const rzpOrder = await razorpayResponse.json();

    // 5. Audit log
    await (supabaseAdmin.from("audit_logs" as any) as any).insert({
      user_id: profile.id,
      action: "PAYMENT_ORDER_CREATED",
      entity_type: "PAYMENT",
      entity_id: rzpOrder.id,
    } as any);

    // 6. Return order details + public key to frontend
    return NextResponse.json({
      order_id: rzpOrder.id,
      amount: rzpOrder.amount,
      currency: rzpOrder.currency,
      key: RAZORPAY_KEY_ID,
    });
  } catch (err: any) {
    console.error("[Payments] Error in create-order:", err);
    return new NextResponse(err.message || "Internal Server Error", { status: 500 });
  }
}
