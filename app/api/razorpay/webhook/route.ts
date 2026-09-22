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

async function fetchRazorpayRefund(refundId: string) {
  const auth = Buffer.from(
    `${razorpayKeyId}:${razorpayKeySecret}`
  ).toString("base64");

  const response = await fetch(
    `https://api.razorpay.com/v1/refunds/${encodeURIComponent(refundId)}`,
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
      "Unable to fetch Razorpay refund:",
      response.status,
      body
    );

    throw new Error("RAZORPAY_REFUND_FETCH_FAILED");
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

    // --------------------------------------------------------
    // PAYMENT FAILED
    //
    // Record the failed attempt for admin/audit visibility, but do NOT
    // cancel the order. The customer can still use Retry Payment.
    // --------------------------------------------------------

    if (event === "payment.failed") {
      const failedPayment = payload?.payload?.payment?.entity;

      const paymentId =
        typeof failedPayment?.id === "string"
          ? failedPayment.id
          : null;

      const razorpayOrderId =
        typeof failedPayment?.order_id === "string"
          ? failedPayment.order_id
          : null;

      if (!paymentId || !razorpayOrderId) {
        console.error("Failed-payment webhook missing payment/order ID.");

        return NextResponse.json(
          { error: "INVALID_FAILED_PAYMENT_PAYLOAD" },
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

      const {
        data: failedOrder,
        error: failedOrderError,
      } = await admin
        .from("orders")
        .select(
          `
            id,
            order_number,
            status,
            payment_status,
            razorpay_order_id,
            razorpay_payment_id
          `
        )
        .eq("razorpay_order_id", razorpayOrderId)
        .maybeSingle();

      if (failedOrderError) {
        console.error(
          "Failed-payment order lookup failed:",
          failedOrderError
        );

        return NextResponse.json(
          { error: "FAILED_PAYMENT_ORDER_LOOKUP_FAILED" },
          { status: 500 }
        );
      }

      if (!failedOrder) {
        console.error(
          "No local order for failed Razorpay payment:",
          razorpayOrderId
        );

        return NextResponse.json(
          { error: "FAILED_PAYMENT_ORDER_NOT_FOUND" },
          { status: 404 }
        );
      }

      // A delayed/retried payment.failed event must never downgrade an order
      // that has already been successfully paid.
      if (failedOrder.payment_status === "paid") {
        return NextResponse.json({
          received: true,
          ignored: true,
          reason: "ORDER_ALREADY_PAID",
          event,
          order_id: failedOrder.id,
        });
      }

      // Verify the failed payment directly with Razorpay instead of trusting
      // only the webhook JSON.
      const verifiedPayment =
        await fetchRazorpayPayment(paymentId);

      if (
        verifiedPayment?.id !== paymentId ||
        verifiedPayment?.order_id !== razorpayOrderId
      ) {
        return NextResponse.json(
          { error: "FAILED_PAYMENT_VERIFICATION_MISMATCH" },
          { status: 400 }
        );
      }

      if (String(verifiedPayment?.status || "").toLowerCase() !== "failed") {
        // The payment may have changed state between webhook delivery and
        // verification. Never overwrite a newer successful state.
        return NextResponse.json({
          received: true,
          ignored: true,
          reason: "PAYMENT_NO_LONGER_FAILED",
          event,
          payment_status: verifiedPayment?.status || null,
        });
      }

      const failureCode =
        verifiedPayment?.error_code ||
        failedPayment?.error_code ||
        null;

      const failureDescription =
        verifiedPayment?.error_description ||
        failedPayment?.error_description ||
        "Payment attempt failed.";

      const failureSource =
        verifiedPayment?.error_source ||
        failedPayment?.error_source ||
        null;

      const failureStep =
        verifiedPayment?.error_step ||
        failedPayment?.error_step ||
        null;

      const failureReason =
        verifiedPayment?.error_reason ||
        failedPayment?.error_reason ||
        null;

      // Persist the payment failure so Admin and Customer order pages can
      // display PAYMENT FAILED. Keep the order lifecycle status unchanged
      // (normally pending_payment) so Retry Payment remains available.
      const now = new Date().toISOString();

      const { data: failedUpdatedOrder, error: failedUpdateError } = await admin
        .from("orders")
        .update({
          payment_status: "failed",
          updated_at: now,
        })
        .eq("id", failedOrder.id)
        .neq("payment_status", "paid")
        .select("id, order_number, status, payment_status")
        .maybeSingle();

      if (failedUpdateError) {
        console.error(
          "Failed-payment local status update failed:",
          failedUpdateError
        );

        return NextResponse.json(
          { error: "FAILED_PAYMENT_STATUS_UPDATE_FAILED" },
          { status: 500 }
        );
      }

      // A successful payment may have completed the order between our first
      // lookup and this update. Never downgrade that newer successful state.
      if (!failedUpdatedOrder) {
        const { data: latestOrder, error: latestOrderError } = await admin
          .from("orders")
          .select("id, order_number, status, payment_status")
          .eq("id", failedOrder.id)
          .single();

        if (latestOrderError) {
          console.error(
            "Failed-payment latest-order check failed:",
            latestOrderError
          );

          return NextResponse.json(
            { error: "FAILED_PAYMENT_STATE_CHECK_FAILED" },
            { status: 500 }
          );
        }

        if (latestOrder.payment_status === "paid") {
          return NextResponse.json({
            received: true,
            ignored: true,
            reason: "ORDER_ALREADY_PAID",
            event,
            order_id: failedOrder.id,
          });
        }

        return NextResponse.json(
          { error: "FAILED_PAYMENT_STATUS_NOT_UPDATED" },
          { status: 409 }
        );
      }

      console.warn("Razorpay payment failed:", {
        orderId: failedOrder.id,
        orderNumber: failedOrder.order_number,
        paymentId,
        razorpayOrderId,
        failureCode,
        failureDescription,
        failureSource,
        failureStep,
        failureReason,
      });

      return NextResponse.json({
        received: true,
        success: true,
        event,
        order_id: failedUpdatedOrder.id,
        order_number: failedUpdatedOrder.order_number,
        order_status: failedUpdatedOrder.status,
        payment_status: failedUpdatedOrder.payment_status,
        payment_id: paymentId,
        payment_failed: true,
      });
    }

    // --------------------------------------------------------
    // REFUND EVENTS
    // --------------------------------------------------------

    if (event === "refund.processed" || event === "refund.failed") {
      const webhookRefund = payload?.payload?.refund?.entity;

      const refundId =
        typeof webhookRefund?.id === "string"
          ? webhookRefund.id
          : null;

      const paymentId =
        typeof webhookRefund?.payment_id === "string"
          ? webhookRefund.payment_id
          : null;

      if (!refundId || !paymentId) {
        console.error("Webhook missing refund/payment ID.");

        return NextResponse.json(
          { error: "INVALID_REFUND_PAYLOAD" },
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

      const {
        data: returnRequest,
        error: returnLookupError,
      } = await admin
        .from("return_requests")
        .select(
          `
            id,
            return_number,
            order_id,
            status,
            admin_decision,
            approved_refund_amount,
            refunded_amount,
            razorpay_refund_id,
            refund_status
          `
        )
        .eq("razorpay_refund_id", refundId)
        .maybeSingle();

      if (returnLookupError) {
        console.error(
          "Refund webhook return lookup failed:",
          returnLookupError
        );

        return NextResponse.json(
          { error: "RETURN_LOOKUP_FAILED" },
          { status: 500 }
        );
      }

      if (!returnRequest) {
        console.error(
          "No local return request for Razorpay refund:",
          refundId
        );

        return NextResponse.json(
          { error: "RETURN_REQUEST_NOT_FOUND" },
          { status: 404 }
        );
      }

      const {
        data: refundOrder,
        error: refundOrderError,
      } = await admin
        .from("orders")
        .select(
          `
            id,
            order_number,
            payment_status,
            total_amount,
            currency,
            razorpay_payment_id
          `
        )
        .eq("id", returnRequest.order_id)
        .maybeSingle();

      if (refundOrderError || !refundOrder) {
        console.error(
          "Refund webhook order lookup failed:",
          refundOrderError
        );

        return NextResponse.json(
          { error: "REFUND_ORDER_NOT_FOUND" },
          { status: 500 }
        );
      }

      if (refundOrder.razorpay_payment_id !== paymentId) {
        console.error("Refund payment ID mismatch.", {
          refundId,
          webhookPaymentId: paymentId,
          localPaymentId: refundOrder.razorpay_payment_id,
        });

        return NextResponse.json(
          { error: "REFUND_PAYMENT_ID_MISMATCH" },
          { status: 409 }
        );
      }

      // Do not trust the webhook entity alone. Fetch the refund from
      // Razorpay server-to-server before changing our final refund state.
      const verifiedRefund = await fetchRazorpayRefund(refundId);

      if (
        verifiedRefund?.id !== refundId ||
        verifiedRefund?.payment_id !== paymentId
      ) {
        return NextResponse.json(
          { error: "REFUND_VERIFICATION_MISMATCH" },
          { status: 400 }
        );
      }

      const approvedAmountPaise = Math.round(
        Number(returnRequest.approved_refund_amount || 0) * 100
      );

      const verifiedAmountPaise = Number(verifiedRefund?.amount);

      if (
        !Number.isInteger(approvedAmountPaise) ||
        approvedAmountPaise <= 0 ||
        !Number.isInteger(verifiedAmountPaise) ||
        verifiedAmountPaise !== approvedAmountPaise
      ) {
        console.error("Refund amount mismatch.", {
          refundId,
          approvedAmountPaise,
          verifiedAmountPaise,
        });

        return NextResponse.json(
          { error: "REFUND_AMOUNT_MISMATCH" },
          { status: 409 }
        );
      }

      const verifiedStatus = String(
        verifiedRefund?.status || ""
      ).toLowerCase();

      // Webhooks can be retried. A processed refund is terminal locally.
      if (
        returnRequest.status === "refunded" &&
        returnRequest.refund_status === "processed" &&
        verifiedStatus === "processed"
      ) {
        return NextResponse.json({
          received: true,
          already_processed: true,
          event,
          refund_id: refundId,
        });
      }

      if (
        event === "refund.processed" &&
        verifiedStatus !== "processed"
      ) {
        return NextResponse.json(
          { error: "REFUND_NOT_PROCESSED_AT_RAZORPAY" },
          { status: 409 }
        );
      }

      if (
        event === "refund.failed" &&
        verifiedStatus !== "failed"
      ) {
        return NextResponse.json(
          { error: "REFUND_NOT_FAILED_AT_RAZORPAY" },
          { status: 409 }
        );
      }

      const reference =
        verifiedRefund?.acquirer_data?.arn ||
        verifiedRefund?.acquirer_data?.rrn ||
        verifiedRefund?.acquirer_data?.utr ||
        null;

      const now = new Date().toISOString();

      if (verifiedStatus === "processed") {
        const {
          error: refundUpdateError,
        } = await admin
          .from("return_requests")
          .update({
            status: "refunded",
            refund_status: "processed",
            refunded_amount: verifiedAmountPaise / 100,
            refund_reference: reference,
            refund_error: null,
            refunded_at: now,
            refund_processed_at: now,
            updated_at: now,
          })
          .eq("id", returnRequest.id)
          .eq("razorpay_refund_id", refundId);

        if (refundUpdateError) {
          console.error(
            "Processed refund local update failed:",
            refundUpdateError
          );

          return NextResponse.json(
            { error: "REFUND_UPDATE_FAILED" },
            { status: 500 }
          );
        }

        console.log("Razorpay refund processed:", {
          returnRequestId: returnRequest.id,
          returnNumber: returnRequest.return_number,
          refundId,
        });

        return NextResponse.json({
          received: true,
          success: true,
          event,
          refund_id: refundId,
          return_request_id: returnRequest.id,
          status: "refunded",
        });
      }

      const failureMessage =
        verifiedRefund?.error_description ||
        verifiedRefund?.error_reason ||
        verifiedRefund?.error_code ||
        "Razorpay marked the refund as failed.";

      const {
        error: failedUpdateError,
      } = await admin
        .from("return_requests")
        .update({
          refund_status: "failed",
          refund_error: String(failureMessage).slice(0, 1000),
          updated_at: now,
        })
        .eq("id", returnRequest.id)
        .eq("razorpay_refund_id", refundId);

      if (failedUpdateError) {
        console.error(
          "Failed refund local update failed:",
          failedUpdateError
        );

        return NextResponse.json(
          { error: "REFUND_FAILURE_UPDATE_FAILED" },
          { status: 500 }
        );
      }

      console.error("Razorpay refund failed:", {
        returnRequestId: returnRequest.id,
        returnNumber: returnRequest.return_number,
        refundId,
        failureMessage,
      });

      return NextResponse.json({
        received: true,
        success: true,
        event,
        refund_id: refundId,
        return_request_id: returnRequest.id,
        refund_status: "failed",
      });
    }

    // Ignore events we do not handle.
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