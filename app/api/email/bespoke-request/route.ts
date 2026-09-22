import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendCircaLuciaEmail } from "@/lib/email";

const ADMIN_EMAIL =
  process.env.BESPOKE_ADMIN_EMAIL ||
  "contact.circalucia@gmail.com";

/*
 * TEMPORARY TEST RECIPIENT
 *
 * We are currently using Resend's temporary
 * onboarding@resend.dev sender.
 *
 * Resend only allows this test sender to deliver
 * to the account's authorized test recipient.
 *
 * Once circalucia.com is purchased and verified
 * in Resend, REMOVE this constant and change
 * customerEmail back to bespokeRequest.email.
 */
const CUSTOMER_TEST_EMAIL = "contact.circalucia@gmail.com";

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

  const rawBody = body as Record<string, unknown>;

  const requestId =
    typeof rawBody.requestId === "string"
      ? rawBody.requestId.trim()
      : "";

  const accessToken =
    typeof rawBody.accessToken === "string"
      ? rawBody.accessToken.trim()
      : "";

  try {
    if (!requestId || !accessToken) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing request information.",
        },
        { status: 400 }
      );
    }

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

    // Verify the logged-in user.
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        {
          success: false,
          error: "Authentication required.",
        },
        { status: 401 }
      );
    }

    // Only retrieve the bespoke request belonging to this user.
    const { data: bespokeRequest, error: requestError } =
      await supabase
        .from("bespoke_requests")
        .select(
          `
            id,
            user_id,
            request_number,
            name,
            email,
            phone,
            design_description,
            timing,
            status,
            created_at
          `
        )
        .eq("id", requestId)
        .eq("user_id", user.id)
        .single();

    if (requestError || !bespokeRequest) {
      console.error(
        "Unable to load bespoke request:",
        requestError
      );

      return NextResponse.json(
        {
          success: false,
          error: "Bespoke request not found.",
        },
        { status: 404 }
      );
    }

    const requestNumber =
      bespokeRequest.request_number || requestId;

    const customerName =
      bespokeRequest.name || "Client";

    /*
     * IMPORTANT:
     * For this temporary Resend test, the customer
     * confirmation goes to the Resend account email.
     *
     * Later, when circalucia.com is verified,
     * change this back to:
     *
     * const customerEmail =
     *   bespokeRequest.email || user.email;
     */
    const customerEmail = CUSTOMER_TEST_EMAIL;

    if (!customerEmail) {
      return NextResponse.json(
        {
          success: false,
          error: "Customer email address is missing.",
        },
        { status: 400 }
      );
    }

    const createdAt = bespokeRequest.created_at
      ? new Date(
          bespokeRequest.created_at
        ).toLocaleString("en-IN", {
          dateStyle: "medium",
          timeStyle: "short",
        })
      : "Recently";

    /*
     * ----------------------------------------------------
     * CUSTOMER CONFIRMATION EMAIL
     * ----------------------------------------------------
     */

    const customerHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8" />
          <meta
            name="viewport"
            content="width=device-width, initial-scale=1.0"
          />
          <title>Bespoke Request Received</title>
        </head>

        <body
          style="
            margin:0;
            padding:0;
            background:#f3eee6;
            color:#141210;
            font-family:Arial,Helvetica,sans-serif;
          "
        >
          <div
            style="
              max-width:680px;
              margin:40px auto;
              padding:0 20px;
            "
          >
            <div
              style="
                background:#faf8f4;
                border:1px solid #d9d0c4;
                padding:42px;
              "
            >

              <div
                style="
                  text-align:center;
                  margin-bottom:36px;
                "
              >
                <div
                  style="
                    font-family:Georgia,'Times New Roman',serif;
                    font-size:30px;
                    letter-spacing:0.08em;
                  "
                >
                  CIRCA LUCIA
                </div>

                <div
                  style="
                    margin-top:8px;
                    color:#716b64;
                    font-size:11px;
                    letter-spacing:0.16em;
                    text-transform:uppercase;
                  "
                >
                  Crafted as you imagined.
                </div>
              </div>

              <div
                style="
                  border-top:1px solid #d9d0c4;
                  padding-top:32px;
                "
              >
                <p
                  style="
                    margin:0 0 18px;
                    font-family:Georgia,'Times New Roman',serif;
                    font-size:27px;
                    line-height:1.3;
                  "
                >
                  Your vision has reached our atelier.
                </p>

                <p
                  style="
                    margin:0 0 22px;
                    color:#716b64;
                    font-size:14px;
                    line-height:1.8;
                  "
                >
                  Dear ${escapeHtml(customerName)},
                </p>

                <p
                  style="
                    margin:0 0 22px;
                    color:#716b64;
                    font-size:14px;
                    line-height:1.8;
                  "
                >
                  Thank you for submitting your bespoke
                  request to Circa Lucia. Our concierge
                  will review your vision and contact you
                  regarding the next step.
                </p>

                <div
                  style="
                    margin:28px 0;
                    padding:22px;
                    background:#f3eee6;
                    border:1px solid #d9d0c4;
                  "
                >
                  <div
                    style="
                      color:#716b64;
                      font-size:11px;
                      letter-spacing:0.12em;
                      text-transform:uppercase;
                      margin-bottom:8px;
                    "
                  >
                    Request number
                  </div>

                  <div
                    style="
                      font-family:Georgia,'Times New Roman',serif;
                      font-size:22px;
                    "
                  >
                    ${escapeHtml(requestNumber)}
                  </div>
                </div>

                <p
                  style="
                    margin:0 0 8px;
                    color:#141210;
                    font-size:13px;
                    font-weight:bold;
                  "
                >
                  Request details
                </p>

                <div
                  style="
                    color:#716b64;
                    font-size:13px;
                    line-height:1.8;
                    white-space:pre-line;
                  "
                >
                  ${escapeHtml(
                    bespokeRequest.design_description ||
                      "No additional design details provided."
                  )}
                </div>

                <div
                  style="
                    margin-top:22px;
                    color:#716b64;
                    font-size:13px;
                    line-height:1.8;
                  "
                >
                  <strong style="color:#141210;">
                    Estimated timing:
                  </strong>
                  ${escapeHtml(
                    bespokeRequest.timing ||
                      "To be discussed"
                  )}
                </div>

                <div
                  style="
                    margin-top:32px;
                    padding-top:24px;
                    border-top:1px solid #d9d0c4;
                    color:#716b64;
                    font-size:12px;
                    line-height:1.7;
                  "
                >
                  Submitted on ${escapeHtml(createdAt)}.
                </div>

                <p
                  style="
                    margin:30px 0 0;
                    color:#141210;
                    font-family:Georgia,'Times New Roman',serif;
                    font-size:17px;
                    line-height:1.6;
                  "
                >
                  Crafted as you imagined.
                </p>
              </div>
            </div>

            <div
              style="
                text-align:center;
                padding:22px 10px;
                color:#716b64;
                font-size:11px;
                line-height:1.6;
              "
            >
              Circa Lucia · Bespoke Atelier
            </div>
          </div>
        </body>
      </html>
    `;

    /*
     * ----------------------------------------------------
     * ADMIN EMAIL
     * ----------------------------------------------------
     */

    const actualCustomerEmail =
      bespokeRequest.email || user.email || "Not provided";

    const adminHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8" />
          <meta
            name="viewport"
            content="width=device-width, initial-scale=1.0"
          />
          <title>New Bespoke Request</title>
        </head>

        <body
          style="
            margin:0;
            padding:0;
            background:#f3eee6;
            color:#141210;
            font-family:Arial,Helvetica,sans-serif;
          "
        >
          <div
            style="
              max-width:680px;
              margin:40px auto;
              padding:0 20px;
            "
          >
            <div
              style="
                background:#faf8f4;
                border:1px solid #d9d0c4;
                padding:42px;
              "
            >

              <div
                style="
                  font-family:Georgia,'Times New Roman',serif;
                  font-size:28px;
                  letter-spacing:0.08em;
                  margin-bottom:8px;
                "
              >
                CIRCA LUCIA
              </div>

              <div
                style="
                  color:#716b64;
                  font-size:11px;
                  letter-spacing:0.14em;
                  text-transform:uppercase;
                  margin-bottom:32px;
                "
              >
                New Bespoke Request
              </div>

              <div
                style="
                  padding:20px;
                  background:#f3eee6;
                  border:1px solid #d9d0c4;
                  margin-bottom:28px;
                "
              >
                <div
                  style="
                    color:#716b64;
                    font-size:11px;
                    letter-spacing:0.12em;
                    text-transform:uppercase;
                    margin-bottom:8px;
                  "
                >
                  Request number
                </div>

                <div
                  style="
                    font-family:Georgia,'Times New Roman',serif;
                    font-size:23px;
                  "
                >
                  ${escapeHtml(requestNumber)}
                </div>
              </div>

              <p
                style="
                  margin:0 0 20px;
                  font-size:15px;
                  line-height:1.7;
                "
              >
                A new bespoke request has been submitted.
              </p>

              <table
                style="
                  width:100%;
                  border-collapse:collapse;
                  font-size:13px;
                "
              >
                <tr>
                  <td
                    style="
                      padding:10px 0;
                      color:#716b64;
                      width:150px;
                      vertical-align:top;
                    "
                  >
                    Customer
                  </td>

                  <td
                    style="
                      padding:10px 0;
                      color:#141210;
                      vertical-align:top;
                    "
                  >
                    ${escapeHtml(customerName)}
                  </td>
                </tr>

                <tr>
                  <td
                    style="
                      padding:10px 0;
                      color:#716b64;
                      vertical-align:top;
                    "
                  >
                    Email
                  </td>

                  <td
                    style="
                      padding:10px 0;
                      color:#141210;
                      vertical-align:top;
                    "
                  >
                    ${escapeHtml(actualCustomerEmail)}
                  </td>
                </tr>

                <tr>
                  <td
                    style="
                      padding:10px 0;
                      color:#716b64;
                      vertical-align:top;
                    "
                  >
                    Phone
                  </td>

                  <td
                    style="
                      padding:10px 0;
                      color:#141210;
                      vertical-align:top;
                    "
                  >
                    ${escapeHtml(
                      bespokeRequest.phone || "Not provided"
                    )}
                  </td>
                </tr>

                <tr>
                  <td
                    style="
                      padding:10px 0;
                      color:#716b64;
                      vertical-align:top;
                    "
                  >
                    Timing
                  </td>

                  <td
                    style="
                      padding:10px 0;
                      color:#141210;
                      vertical-align:top;
                    "
                  >
                    ${escapeHtml(
                      bespokeRequest.timing ||
                        "Not specified"
                    )}
                  </td>
                </tr>

                <tr>
                  <td
                    style="
                      padding:10px 0;
                      color:#716b64;
                      vertical-align:top;
                    "
                  >
                    Submitted
                  </td>

                  <td
                    style="
                      padding:10px 0;
                      color:#141210;
                      vertical-align:top;
                    "
                  >
                    ${escapeHtml(createdAt)}
                  </td>
                </tr>
              </table>

              <div
                style="
                  margin-top:28px;
                  padding-top:24px;
                  border-top:1px solid #d9d0c4;
                "
              >
                <div
                  style="
                    color:#716b64;
                    font-size:11px;
                    letter-spacing:0.12em;
                    text-transform:uppercase;
                    margin-bottom:10px;
                  "
                >
                  Design & vision
                </div>

                <div
                  style="
                    white-space:pre-line;
                    font-size:14px;
                    line-height:1.8;
                  "
                >
                  ${escapeHtml(
                    bespokeRequest.design_description ||
                      "No details provided."
                  )}
                </div>
              </div>

            </div>
          </div>
        </body>
      </html>
    `;

    /*
     * ----------------------------------------------------
     * SEND EMAILS
     * ----------------------------------------------------
     */

    let customerEmailSent = false;
    let adminEmailSent = false;

    /*
     * CUSTOMER TEST EMAIL
     */
    try {
      await sendCircaLuciaEmail({
        to: customerEmail,
        subject: `Bespoke confirmation · ${requestNumber}`,
        html: customerHtml,
      });

      customerEmailSent = true;

      console.log(
        `Bespoke customer test email sent to ${customerEmail}`
      );
    } catch (emailError) {
      console.error(
        "Unable to send customer bespoke email:",
        emailError
      );
    }

    /*
     * ADMIN EMAIL
     */
    try {
      await sendCircaLuciaEmail({
        to: ADMIN_EMAIL,
        subject: `New bespoke request · ${requestNumber}`,
        html: adminHtml,
      });

      adminEmailSent = true;

      console.log(
        `Bespoke admin email sent to ${ADMIN_EMAIL}`
      );
    } catch (emailError) {
      console.error(
        "Unable to send admin bespoke email:",
        emailError
      );
    }

    return NextResponse.json({
      success: true,
      customerEmailSent,
      adminEmailSent,
    });
  } catch (error) {
    console.error(
      "Bespoke email API error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error: "Unable to process bespoke email.",
      },
      { status: 500 }
    );
  }
}

/*
 * Escape user/database content before inserting it
 * into an HTML email.
 */
function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}