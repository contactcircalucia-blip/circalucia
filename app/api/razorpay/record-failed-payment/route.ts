import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function fetchRazorpayPayment(paymentId: string) {
  const keyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID!;
  const keySecret = process.env.RAZORPAY_KEY_SECRET!;

  if (!keyId || !keySecret) {
    throw new Error("RAZORPAY_SERVER_CONFIGURATION_ERROR");
  }

  const auth = Buffer.from(`${keyId}:${keySecret}`).toString("base64");

  const response = await fetch(
    `https://api.razorpay.com/v1/payments/${encodeURIComponent(paymentId)}`,
    {
      method: "GET",
      headers: {
        Authorization: `Basic ${auth}`,
      },
      cache: "no-store",
    }
  );

  if (!response.ok) {
    throw new Error("RAZORPAY_PAYMENT_FETCH_FAILED");
  }

  return response.json();
}

export async function POST(request: NextRequest) {
  try {
    if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
      return NextResponse.json(
        { error: "SERVER_CONFIGURATION_ERROR" },
        { status: 500 }
      );
    }

    const authorization = request.headers.get("authorization");

    if (!authorization?.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    const accessToken = authorization
      .slice("Bearer ".length)
      .trim();

    const userSupabase = createClient(
      supabaseUrl,
      supabaseAnonKey,
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
        { error: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    const body = await request.json();

    const orderId =
      typeof body?.orderId === "string"
        ? body.orderId
        : null;

    const paymentId =
      typeof body?.razorpay_payment_id === "string"
        ? body.razorpay_payment_id
        : null;

    const razorpayOrderId =
      typeof body?.razorpay_order_id === "string"
        ? body.razorpay_order_id
        : null;

    if (!orderId || !paymentId || !razorpayOrderId) {
      return NextResponse.json(
        { error: "INVALID_REQUEST" },
        { status: 400 }
      );
    }

    const admin = createClient(
      supabaseUrl,
      serviceRoleKey,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      }
    );

    const { data: order, error: orderError } =
      await admin
        .from("orders")
        .select(
          "id, user_id, status, payment_status, razorpay_order_id, razorpay_payment_id"
        )
        .eq("id", orderId)
        .eq("user_id", user.id)
        .maybeSingle();

    if (orderError) {
      console.error(
        "Failed-payment order lookup failed:",
        orderError
      );

      return NextResponse.json(
        { error: "ORDER_LOOKUP_FAILED" },
        { status: 500 }
      );
    }

    if (!order) {
      return NextResponse.json(
        { error: "ORDER_NOT_FOUND" },
        { status: 404 }
      );
    }

    if (order.payment_status === "paid") {
      return NextResponse.json({
        success: true,
        ignored: true,
        reason: "ORDER_ALREADY_PAID",
      });
    }

    if (
      order.razorpay_order_id &&
      order.razorpay_order_id !== razorpayOrderId
    ) {
      return NextResponse.json(
        { error: "RAZORPAY_ORDER_MISMATCH" },
        { status: 409 }
      );
    }

    const verifiedPayment =
      await fetchRazorpayPayment(paymentId);

    if (
      verifiedPayment?.id !== paymentId ||
      verifiedPayment?.order_id !== razorpayOrderId
    ) {
      return NextResponse.json(
        { error: "PAYMENT_VERIFICATION_MISMATCH" },
        { status: 400 }
      );
    }

    if (
      String(verifiedPayment?.status || "").toLowerCase() !==
      "failed"
    ) {
      return NextResponse.json(
        { error: "PAYMENT_IS_NOT_FAILED" },
        { status: 409 }
      );
    }

    const now = new Date().toISOString();

    const {
      data: updatedOrder,
      error: updateError,
    } = await admin
      .from("orders")
      .update({
        payment_status: "failed",
        updated_at: now,
      })
      .eq("id", order.id)
      .neq("payment_status", "paid")
      .select("id, status, payment_status")
      .maybeSingle();

    if (updateError) {
      console.error(
        "Failed-payment status update failed:",
        updateError
      );

      return NextResponse.json(
        { error: "PAYMENT_STATUS_UPDATE_FAILED" },
        { status: 500 }
      );
    }

    if (!updatedOrder) {
      const {
        data: latestOrder,
        error: latestError,
      } = await admin
        .from("orders")
        .select("id, status, payment_status")
        .eq("id", order.id)
        .single();

      if (latestError) {
        return NextResponse.json(
          { error: "ORDER_STATE_CHECK_FAILED" },
          { status: 500 }
        );
      }

      if (latestOrder.payment_status === "paid") {
        return NextResponse.json({
          success: true,
          ignored: true,
          reason: "ORDER_ALREADY_PAID",
        });
      }

      return NextResponse.json(
        { error: "PAYMENT_STATUS_NOT_UPDATED" },
        { status: 409 }
      );
    }

    return NextResponse.json({
      success: true,
      order_id: updatedOrder.id,
      order_status: updatedOrder.status,
      payment_status: updatedOrder.payment_status,
    });
  } catch (error) {
    console.error("Record failed payment error:", error);

    return NextResponse.json(
      { error: "FAILED_PAYMENT_PROCESSING_ERROR" },
      { status: 500 }
    );
  }
}