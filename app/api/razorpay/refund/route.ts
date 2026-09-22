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
  let returnRequestId = "";

  try {
    const body = await request.json();
    returnRequestId = String(body?.returnRequestId || "").trim();
    const accessToken = getBearerToken(request);

    if (!returnRequestId || !accessToken) {
      return NextResponse.json(
        { success: false, error: "Missing refund request or admin session." },
        { status: 400 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    const keyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!supabaseUrl || !publishableKey || !keyId || !keySecret) {
      return NextResponse.json(
        { success: false, error: "Refund server is not fully configured." },
        { status: 500 }
      );
    }

    const adminSupabase = createClient(supabaseUrl, publishableKey, {
      global: {
        headers: { Authorization: `Bearer ${accessToken}` },
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const {
      data: { user },
      error: userError,
    } = await adminSupabase.auth.getUser(accessToken);

    if (userError || !user) {
      return NextResponse.json(
        { success: false, error: "AUTH_REQUIRED" },
        { status: 401 }
      );
    }

    const { data: profile, error: profileError } = await adminSupabase
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError || profile?.is_admin !== true) {
      return NextResponse.json(
        { success: false, error: "ADMIN_REQUIRED" },
        { status: 403 }
      );
    }

    const { data: claim, error: claimError } = await adminSupabase.rpc(
      "admin_claim_refund",
      { p_return_request_id: returnRequestId }
    );

    if (claimError) {
      return NextResponse.json(
        { success: false, error: claimError.message },
        { status: 409 }
      );
    }

    if (claim?.already_started) {
      return NextResponse.json({
        success: true,
        alreadyStarted: true,
        refundId: claim.razorpay_refund_id,
        refundStatus: claim.refund_status,
      });
    }

    const amountPaise = Math.round(Number(claim.amount) * 100);

    if (!Number.isSafeInteger(amountPaise) || amountPaise <= 0) {
      await adminSupabase.rpc("admin_release_refund_claim", {
        p_return_request_id: returnRequestId,
        p_error: "Invalid approved refund amount.",
      });

      return NextResponse.json(
        { success: false, error: "INVALID_REFUND_AMOUNT" },
        { status: 400 }
      );
    }

    const paymentId = String(claim.razorpay_payment_id || "");

    if (!paymentId.startsWith("pay_")) {
      await adminSupabase.rpc("admin_release_refund_claim", {
        p_return_request_id: returnRequestId,
        p_error: "Original Razorpay payment ID is missing.",
      });

      return NextResponse.json(
        { success: false, error: "ORIGINAL_RAZORPAY_PAYMENT_REQUIRED" },
        { status: 400 }
      );
    }

    const razorpayResponse = await fetch(
      `https://api.razorpay.com/v1/payments/${encodeURIComponent(paymentId)}/refund`,
      {
        method: "POST",
        headers: {
          Authorization: basicAuth(keyId, keySecret),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount: amountPaise,
          speed: "normal",
          receipt: String(claim.return_number || returnRequestId).slice(0, 40),
          notes: {
            circa_lucia_return_request_id: returnRequestId,
            circa_lucia_return_number: String(claim.return_number || ""),
            circa_lucia_order_id: String(claim.order_id || ""),
            circa_lucia_order_number: String(claim.order_number || ""),
          },
        }),
        cache: "no-store",
      }
    );

    const refund = await razorpayResponse.json().catch(() => null);

    if (!razorpayResponse.ok || !refund?.id) {
      const description =
        refund?.error?.description ||
        refund?.error?.reason ||
        "Razorpay could not initiate the refund.";

      await adminSupabase.rpc("admin_release_refund_claim", {
        p_return_request_id: returnRequestId,
        p_error: description,
      });

      return NextResponse.json(
        { success: false, error: description },
        { status: razorpayResponse.status >= 400 && razorpayResponse.status < 500 ? 400 : 502 }
      );
    }

    const refundStatus =
      refund.status === "processed"
        ? "processed"
        : refund.status === "failed"
        ? "failed"
        : "pending";

    const reference =
      refund?.acquirer_data?.arn ||
      refund?.acquirer_data?.rrn ||
      refund?.acquirer_data?.utr ||
      null;

    const { data: recorded, error: recordError } = await adminSupabase.rpc(
      "admin_record_refund_result",
      {
        p_return_request_id: returnRequestId,
        p_razorpay_refund_id: refund.id,
        p_refund_status: refundStatus,
        p_refunded_amount: Number(refund.amount || amountPaise) / 100,
        p_refund_reference: reference,
        p_refund_error:
          refundStatus === "failed" ? "Razorpay marked the refund as failed." : null,
      }
    );

    if (recordError) {
      console.error("Refund created at Razorpay but DB update failed:", {
        returnRequestId,
        refundId: refund.id,
        error: recordError,
      });

      return NextResponse.json(
        {
          success: false,
          critical: true,
          refundId: refund.id,
          error:
            "Refund was created at Razorpay, but the local record could not be updated. Do not click refund again; reconcile this refund ID in Razorpay.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      refundId: refund.id,
      refundStatus,
      amount: Number(refund.amount || amountPaise) / 100,
      returnStatus: recorded?.status,
    });
  } catch (error) {
    console.error("Razorpay refund error:", error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unable to process refund.",
      },
      { status: 500 }
    );
  }
}
