import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

function basicAuth(keyId: string, keySecret: string) {
  return `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`;
}

function signaturesMatch(expected: string, received: string) {
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(received, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  try {
    const {
      orderId,
      accessToken,
      razorpay_payment_id,
      razorpay_order_id,
      razorpay_signature,
    } = await request.json();

    if (
      !orderId ||
      !accessToken ||
      !razorpay_payment_id ||
      !razorpay_order_id ||
      !razorpay_signature
    ) {
      return NextResponse.json(
        { success: false, error: "Missing payment verification data." },
        { status: 400 }
      );
    }

    const keyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!keyId || !keySecret || !serviceRoleKey) {
      return NextResponse.json(
        { success: false, error: "Payment verification is not configured." },
        { status: 500 }
      );
    }

    const userSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      {
        global: {
          headers: { Authorization: `Bearer ${accessToken}` },
        },
      }
    );

    const {
      data: { user },
      error: userError,
    } = await userSupabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { success: false, error: "AUTH_REQUIRED" },
        { status: 401 }
      );
    }

    const { data: order, error: orderError } = await userSupabase
      .from("orders")
      .select(
        "id, order_number, user_id, status, payment_status, total_amount, currency, razorpay_order_id"
      )
      .eq("id", orderId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (orderError || !order) {
      return NextResponse.json(
        { success: false, error: "Order not found." },
        { status: 404 }
      );
    }

    if (order.payment_status === "paid") {
      return NextResponse.json({
        success: true,
        orderId: order.id,
        orderNumber: order.order_number,
        alreadyPaid: true,
      });
    }

    // Never trust the Razorpay order id supplied by the browser.
    const trustedRazorpayOrderId = order.razorpay_order_id;

    if (
      !trustedRazorpayOrderId ||
      trustedRazorpayOrderId !== razorpay_order_id
    ) {
      return NextResponse.json(
        { success: false, error: "RAZORPAY_ORDER_MISMATCH" },
        { status: 400 }
      );
    }

    const expectedSignature = createHmac("sha256", keySecret)
      .update(`${trustedRazorpayOrderId}|${razorpay_payment_id}`)
      .digest("hex");

    if (!signaturesMatch(expectedSignature, razorpay_signature)) {
      return NextResponse.json(
        { success: false, error: "INVALID_PAYMENT_SIGNATURE" },
        { status: 400 }
      );
    }

    // Confirm the payment directly with Razorpay as a second server-side check.
    const paymentResponse = await fetch(
      `https://api.razorpay.com/v1/payments/${encodeURIComponent(
        razorpay_payment_id
      )}`,
      {
        headers: {
          Authorization: basicAuth(keyId, keySecret),
        },
        cache: "no-store",
      }
    );

    const payment = await paymentResponse.json();

    if (!paymentResponse.ok) {
      console.error("Razorpay payment lookup error:", payment);
      return NextResponse.json(
        { success: false, error: "Unable to verify payment with Razorpay." },
        { status: 502 }
      );
    }

    const expectedAmount = Math.round(Number(order.total_amount) * 100);

    if (
      payment.order_id !== trustedRazorpayOrderId ||
      payment.amount !== expectedAmount ||
      payment.currency !== (order.currency || "INR") ||
      payment.status !== "captured"
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "PAYMENT_NOT_CAPTURED_OR_AMOUNT_MISMATCH",
        },
        { status: 400 }
      );
    }

    const adminSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      }
    );

    const { error: updateError } = await adminSupabase
      .from("orders")
      .update({
        payment_status: "paid",
        status: "paid",
        razorpay_payment_id,
        razorpay_signature,
        paid_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", order.id)
      .eq("razorpay_order_id", trustedRazorpayOrderId);

    if (updateError) {
      console.error("Unable to mark order paid:", updateError);
      return NextResponse.json(
        { success: false, error: "Unable to update payment status." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      orderId: order.id,
      orderNumber: order.order_number,
    });
  } catch (error) {
    console.error("Verify Razorpay payment error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
