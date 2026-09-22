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

function getBearerToken(request: Request) {
  const authorization = request.headers.get("authorization") || "";

  if (!authorization.toLowerCase().startsWith("bearer ")) {
    return null;
  }

  return authorization.slice(7).trim() || null;
}

export async function POST(request: Request) {
  // Parse untrusted JSON separately so malformed input returns 400
  // instead of becoming an internal server error.
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: "INVALID_JSON",
      },
      { status: 400 }
    );
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json(
      {
        success: false,
        error: "INVALID_REQUEST_BODY",
      },
      { status: 400 }
    );
  }

  const {
    orderId,
    razorpay_payment_id,
    razorpay_order_id,
    razorpay_signature,
  } = body as {
    orderId?: unknown;
    razorpay_payment_id?: unknown;
    razorpay_order_id?: unknown;
    razorpay_signature?: unknown;
  };

  const accessToken = getBearerToken(request);

  if (
    typeof orderId !== "string" ||
    !orderId.trim() ||
    !accessToken ||
    typeof razorpay_payment_id !== "string" ||
    !razorpay_payment_id.trim() ||
    typeof razorpay_order_id !== "string" ||
    !razorpay_order_id.trim() ||
    typeof razorpay_signature !== "string" ||
    !razorpay_signature.trim()
  ) {
    return NextResponse.json(
      {
        success: false,
        error: "Missing payment verification data.",
      },
      { status: 400 }
    );
  }

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const publishableKey =
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    const keyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (
      !supabaseUrl ||
      !publishableKey ||
      !keyId ||
      !keySecret ||
      !serviceRoleKey
    ) {
      console.error(
        "Missing server payment verification environment variables."
      );

      return NextResponse.json(
        {
          success: false,
          error: "Payment verification is not configured.",
        },
        { status: 500 }
      );
    }

    const userSupabase = createClient(
      supabaseUrl,
      publishableKey,
      {
        global: {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      }
    );

    const {
      data: { user },
      error: userError,
    } = await userSupabase.auth.getUser(accessToken);

    if (userError || !user) {
      return NextResponse.json(
        {
          success: false,
          error: "AUTH_REQUIRED",
        },
        { status: 401 }
      );
    }

    const { data: order, error: orderError } = await userSupabase
      .from("orders")
      .select(
        "id, order_number, user_id, status, payment_status, total_amount, currency, razorpay_order_id"
      )
      .eq("id", orderId.trim())
      .eq("user_id", user.id)
      .maybeSingle();

    if (orderError || !order) {
      return NextResponse.json(
        {
          success: false,
          error: "Order not found.",
        },
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

    // Never trust the Razorpay order ID supplied by the browser.
    const trustedRazorpayOrderId = order.razorpay_order_id;

    if (
      !trustedRazorpayOrderId ||
      trustedRazorpayOrderId !== razorpay_order_id.trim()
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "RAZORPAY_ORDER_MISMATCH",
        },
        { status: 400 }
      );
    }

    const paymentId = razorpay_payment_id.trim();
    const signature = razorpay_signature.trim();

    const expectedSignature = createHmac("sha256", keySecret)
      .update(`${trustedRazorpayOrderId}|${paymentId}`)
      .digest("hex");

    if (!signaturesMatch(expectedSignature, signature)) {
      return NextResponse.json(
        {
          success: false,
          error: "INVALID_PAYMENT_SIGNATURE",
        },
        { status: 400 }
      );
    }

    // Confirm the payment directly with Razorpay as a second
    // independent server-side verification.
    const paymentResponse = await fetch(
      `https://api.razorpay.com/v1/payments/${encodeURIComponent(
        paymentId
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
      console.error(
        "Razorpay payment lookup error:",
        payment
      );

      return NextResponse.json(
        {
          success: false,
          error: "Unable to verify payment with Razorpay.",
        },
        { status: 502 }
      );
    }

    const expectedAmount = Math.round(
      Number(order.total_amount) * 100
    );

    if (
      !Number.isSafeInteger(expectedAmount) ||
      expectedAmount < 100
    ) {
      console.error(
        "Invalid stored order amount during payment verification:",
        order.id
      );

      return NextResponse.json(
        {
          success: false,
          error: "INVALID_ORDER_AMOUNT",
        },
        { status: 500 }
      );
    }

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
      supabaseUrl,
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
        razorpay_payment_id: paymentId,
        razorpay_signature: signature,
        paid_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", order.id)
      .eq("razorpay_order_id", trustedRazorpayOrderId);

    if (updateError) {
      console.error(
        "Unable to mark order paid:",
        updateError
      );

      return NextResponse.json(
        {
          success: false,
          error: "Unable to update payment status.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      orderId: order.id,
      orderNumber: order.order_number,
    });
  } catch (error) {
    // Detailed exception stays in server logs only.
    console.error("Verify Razorpay payment error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "PAYMENT_VERIFICATION_ERROR",
      },
      { status: 500 }
    );
  }
}
