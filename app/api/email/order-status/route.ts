import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendCircaLuciaEmail } from "@/lib/email";

function formatStatus(status: string) {
  return status
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

/*
 * Always turn a tracking URL into an absolute URL.
 *
 * Example:
 * ekartlogistics.com/track/123
 * ->
 * https://ekartlogistics.com/track/123
 */
function normalizeTrackingUrl(
  value: string | null | undefined
) {
  const cleaned = (value || "").trim();

  if (!cleaned) return "";

  if (
    cleaned.startsWith("https://") ||
    cleaned.startsWith("http://")
  ) {
    return cleaned;
  }

  return `https://${cleaned}`;
}

/*
 * Basic HTML escaping so customer-provided information
 * cannot break the email HTML.
 */
function escapeHtml(value: string | null | undefined) {
  return String(value || "")
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
  const formattedStatus = formatStatus(status);

  let message = "";

  switch (status) {
    case "processing":
      message =
        "Your order is now being prepared by our team. We are carefully working on your order and will keep you updated as it progresses.";
      break;

    case "ready_to_ship":
      message =
        "Your order has been prepared and is now ready to leave our atelier.";
      break;

    case "shipped":
      message =
        "Your order has been dispatched and is now on its way to you.";
      break;

    case "delivered":
      message =
        "Your order has been delivered. We hope you love your Circa Lucia piece.";
      break;

    case "cancelled":
      message =
        "Your order has been cancelled. If you did not request this cancellation or need any assistance, please contact our team.";
      break;

    default:
      message = `Your order status has been updated to ${formattedStatus}.`;
  }

  const safeCustomerName = escapeHtml(customerName);
  const safeOrderNumber = escapeHtml(orderNumber);
  const safeFormattedStatus = escapeHtml(
    formattedStatus
  );
  const safeMessage = escapeHtml(message);
  const safeTrackingNumber = escapeHtml(
    trackingNumber
  );
  const safeNote = escapeHtml(note);

  const normalizedTrackingUrl =
    normalizeTrackingUrl(trackingUrl);

  let safeTrackingUrl = "";

  if (normalizedTrackingUrl) {
    try {
      const parsedUrl = new URL(
        normalizedTrackingUrl
      );

      if (
        parsedUrl.protocol === "http:" ||
        parsedUrl.protocol === "https:"
      ) {
        safeTrackingUrl = escapeHtml(
          parsedUrl.toString()
        );
      }
    } catch {
      safeTrackingUrl = "";
    }
  }

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Circa Lucia Order Update</title>
</head>

<body style="margin:0;padding:0;background:#f3eee6;font-family:Arial,Helvetica,sans-serif;color:#141210;">

  <div style="max-width:640px;margin:0 auto;padding:40px 20px;">

    <div style="background:#faf8f4;border:1px solid #d9d0c4;">

      <div style="padding:42px 35px 30px;text-align:center;border-bottom:1px solid #d9d0c4;">
        <div style="font-family:Georgia,'Times New Roman',serif;font-size:30px;letter-spacing:3px;color:#141210;">
          CIRCA LUCIA
        </div>

        <div style="margin-top:10px;font-family:Georgia,'Times New Roman',serif;font-size:13px;letter-spacing:1.5px;color:#716b64;">
          CRAFTED AS YOU IMAGINED.
        </div>
      </div>

      <div style="padding:40px 35px;">

        <p style="margin:0 0 22px;font-family:Georgia,'Times New Roman',serif;font-size:25px;line-height:1.4;">
          Hello ${safeCustomerName || "there"},
        </p>

        <p style="margin:0 0 28px;font-size:15px;line-height:1.8;color:#716b64;">
          There is an update regarding your Circa Lucia order.
        </p>

        <div style="border-top:1px solid #d9d0c4;border-bottom:1px solid #d9d0c4;padding:22px 0;margin-bottom:28px;">

          <div style="font-size:12px;letter-spacing:1.5px;text-transform:uppercase;color:#716b64;margin-bottom:8px;">
            Order
          </div>

          <div style="font-family:Georgia,'Times New Roman',serif;font-size:20px;">
            ${safeOrderNumber}
          </div>

          <div style="margin-top:18px;font-size:12px;letter-spacing:1.5px;text-transform:uppercase;color:#716b64;margin-bottom:8px;">
            Current status
          </div>

          <div style="font-family:Georgia,'Times New Roman',serif;font-size:20px;">
            ${safeFormattedStatus}
          </div>

        </div>

        <p style="margin:0 0 28px;font-size:15px;line-height:1.8;color:#141210;">
          ${safeMessage}
        </p>

        ${
          trackingNumber
            ? `
        <div style="background:#f3eee6;padding:22px;margin:28px 0;">

          <div style="font-size:12px;letter-spacing:1.5px;text-transform:uppercase;color:#716b64;margin-bottom:8px;">
            Tracking number
          </div>

          <div style="font-size:16px;letter-spacing:0.5px;">
            ${safeTrackingNumber}
          </div>

          ${
            safeTrackingUrl
              ? `
          <div style="margin-top:18px;">
            <a
              href="${safeTrackingUrl}"
              target="_blank"
              rel="noopener noreferrer"
              style="display:inline-block;background:#141210;color:#faf8f4;text-decoration:none;padding:13px 22px;font-size:12px;letter-spacing:1.5px;text-transform:uppercase;"
            >
              Track shipment
            </a>
          </div>
          `
              : `
          <div style="margin-top:14px;font-size:13px;color:#716b64;">
            Tracking information is available using the tracking number above.
          </div>
          `
          }

        </div>
        `
            : ""
        }

        ${
          note
            ? `
        <div style="margin-top:28px;padding:20px;border-left:2px solid #d9d0c4;">

          <div style="font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:#716b64;margin-bottom:8px;">
            Note from Circa Lucia
          </div>

          <div style="font-size:14px;line-height:1.7;">
            ${safeNote}
          </div>

        </div>
        `
            : ""
        }

        <p style="margin:35px 0 0;font-size:14px;line-height:1.8;color:#716b64;">
          Thank you for choosing Circa Lucia.
        </p>

      </div>

      <div style="padding:28px 35px;border-top:1px solid #d9d0c4;text-align:center;">

        <div style="font-family:Georgia,'Times New Roman',serif;font-size:16px;letter-spacing:2px;">
          CIRCA LUCIA
        </div>

        <div style="margin-top:10px;font-size:11px;color:#716b64;letter-spacing:1px;">
          Crafted as you imagined.
        </div>

      </div>

    </div>

  </div>

</body>
</html>
`;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      accessToken,
      orderId,
      orderNumber,
      status,
      note,
      trackingNumber,
      trackingUrl,
    } = body;

    if (!accessToken || !orderId || !status) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing required fields.",
        },
        { status: 400 }
      );
    }

    /*
     * Create a Supabase client using the admin user's
     * authenticated access token.
     */
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      {
        global: {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      }
    );

    /*
     * Verify the authenticated user.
     */
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      console.error(
        "Order status email AUTH_REQUIRED:",
        userError
      );

      return NextResponse.json(
        {
          success: false,
          error: "AUTH_REQUIRED",
        },
        { status: 401 }
      );
    }

    /*
     * Verify admin.
     */
    const {
      data: profile,
      error: profileError,
    } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .single();

    if (profileError) {
      console.error(
        "Admin profile lookup failed:",
        profileError
      );

      return NextResponse.json(
        {
          success: false,
          error: `ADMIN_PROFILE_LOOKUP_FAILED: ${profileError.message}`,
        },
        { status: 403 }
      );
    }

    if (!profile?.is_admin) {
      return NextResponse.json(
        {
          success: false,
          error: "ADMIN_REQUIRED",
        },
        { status: 403 }
      );
    }

    /*
     * Get the customer email from auth.users through
     * the SECURITY DEFINER RPC.
     */
    const {
      data: customerEmail,
      error: customerEmailError,
    } = await supabase.rpc(
      "admin_get_order_customer_email",
      {
        p_order_id: orderId,
      }
    );

    if (customerEmailError) {
      console.error(
        "Customer email lookup error:",
        customerEmailError
      );

      return NextResponse.json(
        {
          success: false,
          error: `CUSTOMER_EMAIL_LOOKUP_FAILED: ${customerEmailError.message}`,
        },
        { status: 500 }
      );
    }

    if (!customerEmail) {
      console.error(
        "Customer email was empty for order:",
        orderId
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "CUSTOMER_EMAIL_NOT_FOUND",
        },
        { status: 404 }
      );
    }

    /*
     * Get the actual order.
     *
     * We fetch tracking data directly from the database
     * rather than trusting stale browser values.
     */
    const {
      data: order,
      error: orderError,
    } = await supabase
      .from("orders")
      .select(
        "user_id, order_number, status, carrier, tracking_number, tracking_url"
      )
      .eq("id", orderId)
      .single();

    if (orderError) {
      console.error(
        "Order lookup failed:",
        orderError
      );

      return NextResponse.json(
        {
          success: false,
          error: `ORDER_LOOKUP_FAILED: ${orderError.message}`,
        },
        { status: 404 }
      );
    }

    if (!order?.user_id) {
      return NextResponse.json(
        {
          success: false,
          error: "ORDER_CUSTOMER_NOT_FOUND",
        },
        { status: 404 }
      );
    }

    /*
     * Use the database tracking values.
     *
     * This is important because the browser may have an
     * old value while the database contains the latest one.
     */
    const finalTrackingNumber =
      order.tracking_number ||
      trackingNumber ||
      null;

    const finalTrackingUrl = normalizeTrackingUrl(
      order.tracking_url ||
        trackingUrl ||
        ""
    );

    /*
     * Get customer's name.
     */
    const {
      data: customerProfile,
      error: customerProfileError,
    } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", order.user_id)
      .maybeSingle();

    if (customerProfileError) {
      console.warn(
        "Customer profile name lookup failed:",
        customerProfileError
      );
    }

    const customerName =
      customerProfile?.full_name || "there";

    /*
     * Use the actual database order number where possible.
     */
    const finalOrderNumber =
      order.order_number ||
      orderNumber ||
      orderId;

    /*
     * Build email.
     */
    const html = buildStatusEmail({
      customerName,
      orderNumber: finalOrderNumber,
      status,
      note,
      trackingNumber: finalTrackingNumber,
      trackingUrl: finalTrackingUrl,
    });

    const subjectMap: Record<
      string,
      string
    > = {
      processing: `Your Circa Lucia order ${finalOrderNumber} is being prepared`,

      ready_to_ship: `Your Circa Lucia order ${finalOrderNumber} is ready to ship`,

      shipped: `Your Circa Lucia order ${finalOrderNumber} has been shipped`,

      delivered: `Your Circa Lucia order ${finalOrderNumber} has been delivered`,

      cancelled: `Your Circa Lucia order ${finalOrderNumber} has been cancelled`,
    };

    const subject =
      subjectMap[status] ||
      `Update regarding your Circa Lucia order ${finalOrderNumber}`;

    /*
     * SEND EMAIL
     *
     * Keep this in a try/catch separately so that if Resend
     * rejects the email, we return the exact error to the
     * admin page.
     */
    try {
      const emailResult =
        await sendCircaLuciaEmail({
          to: customerEmail,
          subject,
          html,
        });

      console.log(
        "Circa Lucia order status email sent:",
        {
          orderId,
          orderNumber: finalOrderNumber,
          status,
          customerEmail,
          trackingNumber:
            finalTrackingNumber,
          trackingUrl:
            finalTrackingUrl || null,
          resendResult: emailResult,
        }
      );

      return NextResponse.json({
        success: true,
        message:
          "Order status email sent successfully.",
        customerEmail,
        trackingNumber:
          finalTrackingNumber,
        trackingUrl:
          finalTrackingUrl || null,
      });
    } catch (emailError) {
      console.error(
        "Resend rejected order status email:",
        emailError
      );

      return NextResponse.json(
        {
          success: false,
          error:
            emailError instanceof Error
              ? `RESEND_EMAIL_FAILED: ${emailError.message}`
              : "RESEND_EMAIL_FAILED",
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error(
      "Order status email route error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "EMAIL_SEND_FAILED",
      },
      { status: 500 }
    );
  }
}
