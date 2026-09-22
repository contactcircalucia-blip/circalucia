import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

function basicAuth(keyId: string, keySecret: string) {
  return `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`;
}

function getBearerToken(request: Request) {
  const authorization = request.headers.get("authorization") || "";
  if (!authorization.toLowerCase().startsWith("bearer ")) return null;
  return authorization.slice(7).trim() || null;
}

export async function POST(request: Request) {
  try {
    const { orderId } = await request.json();
    const accessToken = getBearerToken(request);

    if (!orderId || !accessToken) {
      return NextResponse.json(
        { success: false, error: "Order ID and access token are required." },
        { status: 400 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const keyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (
      !supabaseUrl ||
      !publishableKey ||
      !serviceRoleKey ||
      !keyId ||
      !keySecret
    ) {
      console.error("Missing server payment environment variables.");
      return NextResponse.json(
        { success: false, error: "Payment server is not fully configured." },
        { status: 500 }
      );
    }

    // User-scoped client: authenticate the browser session and prove ownership.
    const userSupabase = createClient(supabaseUrl, publishableKey, {
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const {
      data: { user },
      error: userError,
    } = await userSupabase.auth.getUser(accessToken);

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

    if (orderError) {
      console.error("Order lookup error:", orderError);
      return NextResponse.json(
        { success: false, error: "Unable to load order." },
        { status: 500 }
      );
    }

    if (!order) {
      return NextResponse.json(
        { success: false, error: "Order not found." },
        { status: 404 }
      );
    }

    if (order.payment_status === "paid") {
      return NextResponse.json(
        { success: false, error: "ORDER_ALREADY_PAID" },
        { status: 409 }
      );
    }

    const currency = order.currency || "INR";
    const amountPaise = Math.round(Number(order.total_amount) * 100);

    if (!Number.isSafeInteger(amountPaise) || amountPaise < 100) {
      return NextResponse.json(
        { success: false, error: "INVALID_ORDER_AMOUNT" },
        { status: 400 }
      );
    }

    // Server-only privileged client. Never expose this key to the browser.
    const adminSupabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    // If we already created a Razorpay order, verify and reuse it instead of
    // creating duplicates when the customer retries.
    if (order.razorpay_order_id) {
      const existingResponse = await fetch(
        `https://api.razorpay.com/v1/orders/${encodeURIComponent(
          order.razorpay_order_id
        )}`,
        {
          headers: {
            Authorization: basicAuth(keyId, keySecret),
          },
          cache: "no-store",
        }
      );

      if (existingResponse.ok) {
        const existing = await existingResponse.json();

        if (
          existing.id === order.razorpay_order_id &&
          existing.amount === amountPaise &&
          existing.currency === currency &&
          existing.status !== "paid"
        ) {
          return NextResponse.json({
            success: true,
            keyId,
            razorpayOrderId: existing.id,
            amount: existing.amount,
            currency: existing.currency,
            orderNumber: order.order_number,
          });
        }
      }
    }

    const razorpayResponse = await fetch(
      "https://api.razorpay.com/v1/orders",
      {
        method: "POST",
        headers: {
          Authorization: basicAuth(keyId, keySecret),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount: amountPaise,
          currency,
          receipt: String(order.order_number).slice(0, 40),
          notes: {
            circa_lucia_order_id: order.id,
            circa_lucia_order_number: order.order_number,
            user_id: user.id,
          },
        }),
        cache: "no-store",
      }
    );

    const razorpayOrder = await razorpayResponse.json();

    if (!razorpayResponse.ok || !razorpayOrder?.id) {
      console.error("Razorpay order creation error:", razorpayOrder);
      return NextResponse.json(
        {
          success: false,
          error:
            razorpayOrder?.error?.description ||
            "Unable to create Razorpay order.",
        },
        { status: 502 }
      );
    }

    // IMPORTANT: use the server-only client here. The customer should never
    // need an RLS policy that allows them to write payment identifiers.
    const { error: saveError } = await adminSupabase
      .from("orders")
      .update({
        razorpay_order_id: razorpayOrder.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", order.id)
      .eq("user_id", user.id)
      .neq("payment_status", "paid");

    if (saveError) {
      console.error("Unable to save Razorpay order id:", saveError);
      return NextResponse.json(
        { success: false, error: "Unable to save payment order." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      keyId,
      razorpayOrderId: razorpayOrder.id,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
      orderNumber: order.order_number,
    });
  } catch (error) {
    console.error("Create Razorpay order error:", error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
