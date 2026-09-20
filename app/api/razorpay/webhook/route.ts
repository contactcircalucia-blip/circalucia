import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const razorpayKeyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID!;
const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET!;
const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET!;

function safeEqual(a: string, b: string) {
  try {
    const aBuffer = Buffer.from(a, "utf8");
    const bBuffer = Buffer.from(b, "utf8");

    if (aBuffer.length !== bBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(aBuffer, bBuffer);
  } catch {
    return false;
  }
}

async function fetchRazorpayPayment(paymentId: string) {
  const auth = Buffer.from(
    `${razorpayKeyId}:${razorpayKeySecret}`
  ).toString("base64");

  const response = await fetch(
    `https://api.razorpay.com/v1/payments/${encodeURIComponent(
      paymentId
    )}`,
    {
      method: "GET",
      headers: {
        Authorization: `Basic ${auth}`,
      },
      cache: "no-store",
    }
  );

  if (!response.ok) {
    const body = await response.text();

    console.error(
      "Unable to fetch Razorpay payment:",
      response.status,
      body
    );

    throw new Error("RAZORPAY_PAYMENT_FETCH_FAILED");
  }

  return response.json();
}

export async function POST(request: NextRequest) {
  try {
    // --------------------------------------------------------
    // ENVIRONMENT CHECK
    // --------------------------------------------------------

    if (
      !supabaseUrl ||
      !serviceRoleKey ||
      !razorpayKeyId ||
      !razorpayKeySecret ||
      !webhookSecret
    ) {
      console.error("Missing Razorpay/Supabase server environment variables.");

      return NextResponse.json(
        { error: "SERVER_CONFIGURATION_ERROR" },
        { status: 500 }
      );
    }

    // --------------------------------------------------------
    // IMPORTANT:
    // Razorpay signature must be checked against RAW body.
    // Do not call request.json() before signature validation.
    // --------------------------------------------------------

    const rawBody = await request.text();

    const receivedSignature =
      request.headers.get("x-razorpay-signature");

    if (!receivedSignature) {
      return NextResponse.json(
        { error: "MISSING_SIGNATURE" },
        { status: 401 }
      );
    }

    const expectedSignature = crypto
      .createHmac("sha256", webhookSecret)
      .update(rawBody)
      .digest("hex");

    if (!safeEqual(expectedSignature, receivedSignature)) {
      console.error("Invalid Razorpay webhook signature.");

      return NextResponse.json(
        { error: "INVALID_SIGNATURE" },
        { status: 401 }
      );
    }

    // --------------------------------------------------------
    // PARSE VERIFIED PAYLOAD
    // --------------------------------------------------------

    let payload: any;

    try {
      payload = JSON.parse(rawBody);
    } catch {
      return NextResponse.json(
        { error: "INVALID_JSON" },
        { status: 400 }
      );
    }

    const event = payload?.event;

    // We currently subscribe only to payment.captured.
    // Ignore anything else safely.
    if (event !== "payment.captured") {
      return NextResponse.json({
        received: true,
        ignored: true,
        event,
      });
    }

    // --------------------------------------------------------
    // READ PAYMENT FROM WEBHOOK
    // --------------------------------------------------------

    const webhookPayment =
      payload?.payload?.payment?.entity;

    const paymentId =
      typeof webhookPayment?.id === "string"
        ? webhookPayment.id
        : null;

    const razorpayOrderId =
      typeof webhookPayment?.order_id === "string"
        ? webhookPayment.order_id
        : null;

    if (!paymentId || !razorpayOrderId) {
      console.error(
        "Webhook missing payment/order ID."
      );

      return NextResponse.json(
        { error: "INVALID_PAYMENT_PAYLOAD" },
        { status: 400 }
      );
    }

    // --------------------------------------------------------
    // FETCH OUR ORDER USING TRUSTED RAZORPAY ORDER ID
    // --------------------------------------------------------

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

    const {
      data: order,
      error: orderError,
    } = await admin
      .from("orders")
      .select(
        `
          id,
          order_number,
          status,
          payment_status,
          total_amount,
          currency,
          razorpay_order_id,
          razorpay_payment_id,
          paid_at,
          stock_reserved,
          stock_released_at
        `
      )
      .eq(
        "razorpay_order_id",
        razorpayOrderId
      )
      .maybeSingle();

    if (orderError) {
      console.error(
        "Webhook order lookup failed:",
        orderError
      );

      return NextResponse.json(
        { error: "ORDER_LOOKUP_FAILED" },
        { status: 500 }
      );
    }

    if (!order) {
      console.error(
        "No local order for Razorpay order:",
        razorpayOrderId
      );

      return NextResponse.json(
        { error: "ORDER_NOT_FOUND" },
        { status: 404 }
      );
    }

    // --------------------------------------------------------
    // IDEMPOTENCY
    //
    // Razorpay can retry webhooks.
    // If this exact payment already completed the order,
    // simply acknowledge it.
    // --------------------------------------------------------

    if (
      order.payment_status === "paid" &&
      order.razorpay_payment_id === paymentId
    ) {
      return NextResponse.json({
        received: true,
        already_processed: true,
      });
    }

    // If order is paid using some OTHER payment ID,
    // do not overwrite it.
    if (
      order.payment_status === "paid" &&
      order.razorpay_payment_id &&
      order.razorpay_payment_id !== paymentId
    ) {
      console.error(
        "Paid order received different payment ID.",
        order.id
      );

      return NextResponse.json(
        { error: "PAYMENT_ID_CONFLICT" },
        { status: 409 }
      );
    }

    // --------------------------------------------------------
    // SERVER-TO-SERVER PAYMENT VERIFICATION
    //
    // Do not rely only on the webhook JSON.
    // --------------------------------------------------------

    const verifiedPayment =
      await fetchRazorpayPayment(paymentId);

    if (
      verifiedPayment?.id !== paymentId ||
      verifiedPayment?.order_id !== razorpayOrderId
    ) {
      console.error(
        "Razorpay payment/order mismatch."
      );

      return NextResponse.json(
        { error: "PAYMENT_ORDER_MISMATCH" },
        { status: 400 }
      );
    }

    if (
      verifiedPayment?.status !== "captured" ||
      verifiedPayment?.captured !== true
    ) {
      console.error(
        "Payment is not captured:",
        verifiedPayment?.status
      );

      return NextResponse.json(
        { error: "PAYMENT_NOT_CAPTURED" },
        { status: 409 }
      );
    }

    // --------------------------------------------------------
    // VERIFY CURRENCY
    // --------------------------------------------------------

    const localCurrency =
      String(order.currency || "INR").toUpperCase();

    const razorpayCurrency =
      String(
        verifiedPayment?.currency || ""
      ).toUpperCase();

    if (
      !razorpayCurrency ||
      razorpayCurrency !== localCurrency
    ) {
      console.error(
        "Payment currency mismatch."
      );

      return NextResponse.json(
        { error: "CURRENCY_MISMATCH" },
        { status: 400 }
      );
    }

    // --------------------------------------------------------
    // VERIFY AMOUNT
    //
    // Razorpay stores INR in paise.
    // --------------------------------------------------------

    const expectedAmount =
      Math.round(
        Number(order.total_amount) * 100
      );

    const receivedAmount =
      Number(verifiedPayment?.amount);

    if (
      !Number.isInteger(expectedAmount) ||
      !Number.isInteger(receivedAmount) ||
      expectedAmount <= 0 ||
      receivedAmount !== expectedAmount
    ) {
      console.error(
        "Payment amount mismatch.",
        {
          expectedAmount,
          receivedAmount,
          orderId: order.id,
        }
      );

      return NextResponse.json(
        { error: "AMOUNT_MISMATCH" },
        { status: 400 }
      );
    }

    // --------------------------------------------------------
    // IMPORTANT STOCK SAFETY CHECK
    //
    // If stock has already been released because this order
    // expired, do NOT silently mark it paid.
    //
    // This avoids accepting a late payment while inventory has
    // already been returned and potentially sold elsewhere.
    // --------------------------------------------------------

    if (order.stock_released_at) {
      console.error(
        "Captured payment received after stock release.",
        {
          orderId: order.id,
          paymentId,
        }
      );

      return NextResponse.json(
        {
          error: "PAYMENT_AFTER_STOCK_RELEASE",
          order_id: order.id,
        },
        { status: 409 }
      );
    }

    // --------------------------------------------------------
    // MARK ORDER PAID
    // --------------------------------------------------------

    const {
      data: updatedOrder,
      error: updateError,
    } = await admin
      .from("orders")
      .update({
        status: "paid",
        payment_status: "paid",
        razorpay_payment_id: paymentId,
        paid_at: new Date().toISOString(),
        stock_reserved: false,
        updated_at: new Date().toISOString(),
      })
      .eq("id", order.id)
      .neq("payment_status", "paid")
      .is("stock_released_at", null)
      .select(
        `
          id,
          order_number,
          status,
          payment_status,
          razorpay_order_id,
          razorpay_payment_id,
          paid_at
        `
      )
      .maybeSingle();

    if (updateError) {
      console.error(
        "Webhook order update failed:",
        updateError
      );

      return NextResponse.json(
        { error: "ORDER_UPDATE_FAILED" },
        { status: 500 }
      );
    }

    // Another request may have completed it between our
    // lookup and update. Check the latest state.
    if (!updatedOrder) {
      const {
        data: latestOrder,
        error: latestError,
      } = await admin
        .from("orders")
        .select(
          `
            id,
            payment_status,
            razorpay_payment_id,
            stock_released_at
          `
        )
        .eq("id", order.id)
        .single();

      if (latestError) {
        return NextResponse.json(
          { error: "ORDER_STATE_CHECK_FAILED" },
          { status: 500 }
        );
      }

      if (
        latestOrder.payment_status === "paid" &&
        latestOrder.razorpay_payment_id ===
          paymentId
      ) {
        return NextResponse.json({
          received: true,
          already_processed: true,
        });
      }

      if (latestOrder.stock_released_at) {
        return NextResponse.json(
          {
            error: "PAYMENT_AFTER_STOCK_RELEASE",
          },
          { status: 409 }
        );
      }

      return NextResponse.json(
        { error: "ORDER_NOT_UPDATED" },
        { status: 409 }
      );
    }

    console.log(
      "Razorpay webhook payment confirmed:",
      {
        orderId: updatedOrder.id,
        orderNumber:
          updatedOrder.order_number,
        paymentId:
          updatedOrder.razorpay_payment_id,
      }
    );

    return NextResponse.json({
      received: true,
      success: true,
      order_id: updatedOrder.id,
      order_number:
        updatedOrder.order_number,
    });
  } catch (error) {
    console.error(
      "Razorpay webhook error:",
      error
    );

    return NextResponse.json(
      { error: "WEBHOOK_PROCESSING_FAILED" },
      { status: 500 }
    );
  }
}