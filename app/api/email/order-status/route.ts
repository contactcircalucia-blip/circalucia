import { NextRequest, NextResponse } from "next/server";

import { createClient } from "@supabase/supabase-js";

import { sendCircaLuciaEmail } from "@/lib/email";

const EMAIL_STATUSES = [
  "ready_to_ship",
  "shipped",
  "delivered",
  "cancelled",
] as const;

type EmailStatus = (typeof EMAIL_STATUSES)[number];

function formatStatus(status: string) {
  return status
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function normalizeTrackingUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;

  const trimmed = value.trim();

  if (!trimmed) return null;

  if (!/^https?:\/\//i.test(trimmed)) {
    return `https://${trimmed}`;
  }

  return trimmed;
}

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function buildStatusEmail({
  customerName,
  orderNumber,
  status,
  note,
  trackingNumber,
  trackingUrl,
}: {
  customerName: string;
  orderNumber: string;
  status: string;
  note?: string | null;
  trackingNumber?: string | null;
  trackingUrl?: string | null;
}) {
  const safeName = escapeHtml(customerName || "Customer");
  const safeOrderNumber = escapeHtml(orderNumber);
  const safeStatus = escapeHtml(formatStatus(status));
  const safeNote = escapeHtml(note);
  const safeTrackingNumber = escapeHtml(trackingNumber);

  const trackingSection =
    trackingNumber || trackingUrl
      ? `
        <div style="
          margin-top:24px;
          padding:20px;
          border:1px solid #d9d0c4;
          background:#faf8f4;
        ">
          <div style="
            font-family:Arial,sans-serif;
            font-size:11px;
            letter-spacing:1.5px;
            text-transform:uppercase;
            color:#716b64;
            margin-bottom:10px;
          ">
            Shipment Details
          </div>

          ${
            trackingNumber
              ? `
                <div style="
                  font-family:Arial,sans-serif;
                  font-size:15px;
                  color:#141210;
                  margin-bottom:12px;
                ">
                  <strong>Tracking / AWB:</strong>
                  ${safeTrackingNumber}
                </div>
              `
              : ""
          }

          ${
            trackingUrl
              ? `
                <a
                  href="${escapeHtml(trackingUrl)}"
                  style="
                    display:inline-block;
                    padding:12px 18px;
                    background:#141210;
                    color:#ffffff;
                    text-decoration:none;
                    font-family:Arial,sans-serif;
                    font-size:12px;
                    letter-spacing:1px;
                    text-transform:uppercase;
                  "
                >
                  Track Shipment
                </a>
              `
              : ""
          }
        </div>
      `
      : "";

  const noteSection = note
    ? `
      <div style="
        margin-top:24px;
        padding:18px 20px;
        border-left:3px solid #d9d0c4;
        background:#faf8f4;
      ">
        <div style="
          font-family:Arial,sans-serif;
          font-size:11px;
          letter-spacing:1.5px;
          text-transform:uppercase;
          color:#716b64;
          margin-bottom:8px;
        ">
          Note from Circa Lucia
        </div>

        <div style="
          font-family:Arial,sans-serif;
          font-size:14px;
          line-height:1.7;
          color:#141210;
        ">
          ${safeNote}
        </div>
      </div>
    `
    : "";

  return `
<!DOCTYPE html>
<html>
  <body style="
    margin:0;
    padding:0;
    background:#f3eee6;
  ">
    <div style="
      width:100%;
      padding:40px 16px;
      box-sizing:border-box;
    ">
      <div style="
        max-width:620px;
        margin:0 auto;
        background:#ffffff;
        padding:40px;
        box-sizing:border-box;
      ">
        <div style="
          text-align:center;
          margin-bottom:35px;
        ">
          <div style="
            font-family:Georgia,'Times New Roman',serif;
            font-size:30px;
            letter-spacing:3px;
            color:#141210;
          ">
            CIRCA LUCIA
          </div>

          <div style="
            margin-top:8px;
            font-family:Arial,sans-serif;
            font-size:10px;
            letter-spacing:2px;
            color:#716b64;
            text-transform:uppercase;
          ">
            Crafted as You Imagined.
          </div>
        </div>

        <div style="
          font-family:Georgia,'Times New Roman',serif;
          font-size:26px;
          color:#141210;
          margin-bottom:18px;
        ">
          Order Update
        </div>

        <div style="
          font-family:Arial,sans-serif;
          font-size:15px;
          line-height:1.7;
          color:#141210;
        ">
          Dear ${safeName},
        </div>

        <div style="
          margin-top:16px;
          font-family:Arial,sans-serif;
          font-size:15px;
          line-height:1.7;
          color:#141210;
        ">
          There is an update regarding your Circa Lucia order
          <strong>${safeOrderNumber}</strong>.
        </div>

        <div style="
          margin-top:24px;
          padding:20px;
          background:#f3eee6;
        ">
          <div style="
            font-family:Arial,sans-serif;
            font-size:11px;
            letter-spacing:1.5px;
            text-transform:uppercase;
            color:#716b64;
            margin-bottom:8px;
          ">
            Current Status
          </div>

          <div style="
            font-family:Georgia,'Times New Roman',serif;
            font-size:24px;
            color:#141210;
          ">
            ${safeStatus}
          </div>
        </div>

        ${trackingSection}

        ${noteSection}

        <div style="
          margin-top:35px;
          font-family:Arial,sans-serif;
          font-size:14px;
          line-height:1.7;
          color:#716b64;
        ">
          Thank you for choosing Circa Lucia.
          We will continue to keep you informed as your order progresses.
        </div>

        <div style="
          margin-top:35px;
          padding-top:20px;
          border-top:1px solid #d9d0c4;
          font-family:Arial,sans-serif;
          font-size:12px;
          line-height:1.6;
          color:#716b64;
          text-align:center;
        ">
          Circa Lucia<br />
          Crafted as You Imagined.
        </div>
      </div>
    </div>
  </body>
</html>
`;
}

export async function POST(request: NextRequest) {
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

  try {
    const {
      accessToken,
      orderId,
      orderNumber,
      status,
      note,
      trackingNumber,
      trackingUrl,
    } = body as Record<string, unknown>;

    if (typeof accessToken !== "string" || !accessToken.trim()) {
      return NextResponse.json(
        {
          success: false,
          error: "MISSING_ACCESS_TOKEN",
        },
        { status: 401 }
      );
    }

    if (typeof orderId !== "string" || !orderId.trim()) {
      return NextResponse.json(
        {
          success: false,
          error: "MISSING_ORDER_ID",
        },
        { status: 400 }
      );
    }

    if (typeof status !== "string" || !status.trim()) {
      return NextResponse.json(
        {
          success: false,
          error: "MISSING_STATUS",
        },
        { status: 400 }
      );
    }

    if (!EMAIL_STATUSES.includes(status as EmailStatus)) {
      return NextResponse.json(
        {
          success: false,
          error: `EMAIL_NOT_REQUIRED_FOR_STATUS: ${status}`,
        },
        { status: 400 }
      );
    }

    const supabaseUrl =
      process.env.NEXT_PUBLIC_SUPABASE_URL;

    const publishableKey =
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

    const serviceRoleKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl) {
      return NextResponse.json(
        {
          success: false,
          error: "SUPABASE_URL_NOT_CONFIGURED",
        },
        { status: 500 }
      );
    }

    if (!publishableKey) {
      return NextResponse.json(
        {
          success: false,
          error: "SUPABASE_PUBLISHABLE_KEY_NOT_CONFIGURED",
        },
        { status: 500 }
      );
    }

    if (!serviceRoleKey) {
      return NextResponse.json(
        {
          success: false,
          error:
            "SUPABASE_SERVICE_ROLE_KEY_NOT_CONFIGURED. Add SUPABASE_SERVICE_ROLE_KEY to .env.local and restart Next.js.",
        },
        { status: 500 }
      );
    }

    /*
     * ---------------------------------------------------------
     * 1. Verify the currently logged-in admin
     * ---------------------------------------------------------
     */

    const supabaseAuth = createClient(
      supabaseUrl,
      publishableKey
    );

    const {
      data: { user },
      error: authError,
    } = await supabaseAuth.auth.getUser(accessToken);

    if (authError || !user) {
      console.error(
        "Order email auth failed:",
        authError
      );

      return NextResponse.json(
        {
          success: false,
          error: "ADMIN_AUTH_FAILED",
        },
        { status: 401 }
      );
    }

    /*
     * ---------------------------------------------------------
     * 2. Create server-only service-role client
     * ---------------------------------------------------------
     */

    const supabaseAdmin = createClient(
      supabaseUrl,
      serviceRoleKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    /*
     * ---------------------------------------------------------
     * 3. Verify that the logged-in user is an admin
     * ---------------------------------------------------------
     */

    const {
      data: adminProfile,
      error: adminProfileError,
    } = await supabaseAdmin
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .maybeSingle();

    if (adminProfileError) {
      console.error(
        "Admin profile lookup failed:",
        adminProfileError
      );

      return NextResponse.json(
        {
          success: false,
          error: "ADMIN_PROFILE_LOOKUP_FAILED",
        },
        { status: 500 }
      );
    }

    if (!adminProfile?.is_admin) {
      return NextResponse.json(
        {
          success: false,
          error: "ADMIN_ACCESS_REQUIRED",
        },
        { status: 403 }
      );
    }

    /*
     * ---------------------------------------------------------
     * 4. Find the order
     * ---------------------------------------------------------
     */

    const {
      data: order,
      error: orderError,
    } = await supabaseAdmin
      .from("orders")
      .select(
        `
        id,
        user_id,
        order_number,
        status,
        carrier,
        tracking_number,
        tracking_url
        `
      )
      .eq("id", orderId)
      .maybeSingle();

    if (orderError) {
      console.error(
        "Order lookup failed:",
        orderError
      );

      return NextResponse.json(
        {
          success: false,
          error: "ORDER_LOOKUP_FAILED",
        },
        { status: 404 }
      );
    }

    if (!order) {
      return NextResponse.json(
        {
          success: false,
          error: `ORDER_NOT_FOUND: ${orderId}`,
        },
        { status: 404 }
      );
    }

    /*
     * ---------------------------------------------------------
     * 5. Make sure database status matches email
     * ---------------------------------------------------------
     */

    if (order.status !== status) {
      return NextResponse.json(
        {
          success: false,
          error:
            `STATUS_MISMATCH: Database status is "${order.status}" ` +
            `but email requested status "${status}".`,
        },
        { status: 409 }
      );
    }

    /*
     * ---------------------------------------------------------
     * 6. Get customer email from Supabase Auth
     * ---------------------------------------------------------
     */

    if (!order.user_id) {
      return NextResponse.json(
        {
          success: false,
          error: "ORDER_HAS_NO_CUSTOMER",
        },
        { status: 400 }
      );
    }

    const {
      data: customerAuth,
      error: customerAuthError,
    } =
      await supabaseAdmin.auth.admin.getUserById(
        order.user_id
      );

    if (customerAuthError) {
      console.error(
        "Customer auth lookup failed:",
        customerAuthError
      );

      return NextResponse.json(
        {
          success: false,
          error: "CUSTOMER_EMAIL_LOOKUP_FAILED",
        },
        { status: 500 }
      );
    }

    /*
     * This is the customer's REAL email.
     * We keep retrieving it now because we will use it later
     * when the Circa Lucia domain is verified with Resend.
     */

    const actualCustomerEmail =
      customerAuth.user?.email;

    if (!actualCustomerEmail) {
      return NextResponse.json(
        {
          success: false,
          error: "CUSTOMER_HAS_NO_EMAIL",
        },
        { status: 400 }
      );
    }

    /*
     * ---------------------------------------------------------
     * TEMPORARY V2 TESTING MODE
     * ---------------------------------------------------------
     *
     * Resend's onboarding@resend.dev sender currently allows
     * testing emails only to the Resend account owner's email.
     *
     * Therefore, ALL order-status emails temporarily go to:
     *
     * contact.circalucia@gmail.com
     *
     * Later, after verifying the Circa Lucia domain with Resend,
     * change this to:
     *
     * const customerEmail = actualCustomerEmail;
     */

    const customerEmail =
      "contact.circalucia@gmail.com";

    console.log(
      "EMAIL RECIPIENT BEING SENT TO:",
      customerEmail
    );

    /*
     * ---------------------------------------------------------
     * 7. Get customer profile name
     * ---------------------------------------------------------
     */

    const {
      data: customerProfile,
      error: customerProfileError,
    } = await supabaseAdmin
      .from("profiles")
      .select("full_name")
      .eq("id", order.user_id)
      .maybeSingle();

    if (customerProfileError) {
      console.warn(
        "Customer profile lookup failed. Continuing without name:",
        customerProfileError
      );
    }

    const customerName =
      customerProfile?.full_name ||
      customerAuth.user?.user_metadata?.full_name ||
      "Customer";

    /*
     * ---------------------------------------------------------
     * 8. Use database shipping information
     * ---------------------------------------------------------
     */

    const finalTrackingNumber =
      order.tracking_number ||
      trackingNumber ||
      null;

    const finalTrackingUrl =
      normalizeTrackingUrl(
        order.tracking_url ||
        trackingUrl
      );

    /*
     * ---------------------------------------------------------
     * 9. Build subject
     * ---------------------------------------------------------
     */

    const subjectMap: Record<EmailStatus, string> = {
      ready_to_ship:
        `Your Circa Lucia order ${order.order_number} is ready to ship`,

      shipped:
        `Your Circa Lucia order ${order.order_number} has shipped`,

      delivered:
        `Your Circa Lucia order ${order.order_number} has been delivered`,

      cancelled:
        `Your Circa Lucia order ${order.order_number} has been cancelled`,
    };

    const subject =
      subjectMap[status as EmailStatus];

    /*
     * ---------------------------------------------------------
     * 10. Build HTML
     * ---------------------------------------------------------
     */

    const html = buildStatusEmail({
      customerName,
      orderNumber:
        order.order_number ||
        (typeof orderNumber === "string" ? orderNumber : ""),
      status,
      note:
        typeof note === "string" && note.trim()
          ? note.trim()
          : null,
      trackingNumber: finalTrackingNumber,
      trackingUrl: finalTrackingUrl,
    });

    /*
     * ---------------------------------------------------------
     * 11. Send through Resend
     * ---------------------------------------------------------
     */

    const emailResult =
      await sendCircaLuciaEmail({
        to: customerEmail,
        subject,
        html,
      });

    console.log(
      "Circa Lucia order status email sent:",
      {
        orderId: order.id,
        orderNumber: order.order_number,
        status,
        customerEmail,
        actualCustomerEmail,
        resendId: emailResult?.id || null,
      }
    );

    return NextResponse.json({
      success: true,
      message:
        "Order status email sent successfully.",
      orderId: order.id,
      orderNumber: order.order_number,
      status,
      resendId: emailResult?.id || null,
    });

  } catch (error) {
    console.error(
      "Order status email route crashed:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error: "ORDER_STATUS_EMAIL_ERROR",
      },
      { status: 500 }
    );
  }
}