import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendCircaLuciaEmail } from "@/lib/email";

type AccountEventBody = {
  accessToken?: unknown;
  event?: unknown;
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export async function POST(request: Request) {
  /*
   * Parse JSON separately so malformed client input
   * returns 400 instead of becoming an internal error.
   */
  let body: AccountEventBody;

  try {
    const parsed: unknown = await request.json();

    if (
      typeof parsed !== "object" ||
      parsed === null ||
      Array.isArray(parsed)
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "INVALID_REQUEST_BODY",
        },
        { status: 400 }
      );
    }

    body = parsed as AccountEventBody;
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: "INVALID_JSON",
      },
      { status: 400 }
    );
  }

  const { accessToken, event } = body;

  if (
    typeof accessToken !== "string" ||
    !accessToken.trim()
  ) {
    return NextResponse.json(
      {
        success: false,
        error: "MISSING_ACCESS_TOKEN",
      },
      { status: 401 }
    );
  }

  if (event !== "welcome" && event !== "login") {
    return NextResponse.json(
      {
        success: false,
        error: "INVALID_ACCOUNT_EVENT",
      },
      { status: 400 }
    );
  }

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env
        .NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      {
        global: {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      }
    );

    /*
     * Verify the access token against Supabase.
     */
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        {
          success: false,
          error: "AUTHENTICATION_REQUIRED",
        },
        { status: 401 }
      );
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .single();

    const rawCustomerName =
      typeof profile?.full_name === "string" &&
      profile.full_name.trim()
        ? profile.full_name.trim()
        : typeof user.user_metadata?.full_name ===
              "string" &&
            user.user_metadata.full_name.trim()
          ? user.user_metadata.full_name.trim()
          : "Client";

    /*
     * User/profile data is inserted into HTML email,
     * so escape it before interpolation.
     */
    const customerName =
      escapeHtml(rawCustomerName);

    if (event === "welcome") {
      await sendCircaLuciaEmail({
        to: "contact.circalucia@gmail.com",
        subject: "Welcome to Circa Lucia",
        html: `
          <div style="margin:0;padding:40px 20px;background:#f3eee6;font-family:Arial,sans-serif;color:#141210;">
            <div style="max-width:620px;margin:0 auto;background:#faf8f4;padding:48px 40px;">

              <p style="margin:0 0 28px;text-align:center;font-size:12px;letter-spacing:3px;color:#716b64;">
                THE HOUSE OF CIRCA LUCIA
              </p>

              <h1 style="margin:0 0 24px;text-align:center;font-family:Georgia,serif;font-size:38px;font-weight:400;">
                Welcome to<br />
                <em>Circa Lucia.</em>
              </h1>

              <p style="font-size:16px;line-height:1.8;margin:0 0 20px;">
                Dear ${customerName},
              </p>

              <p style="font-size:16px;line-height:1.8;margin:0 0 20px;">
                Your private Circa Lucia account has been created.
              </p>

              <p style="font-size:16px;line-height:1.8;margin:0 0 28px;">
                Discover considered silhouettes, handcrafted details
                and footwear designed to feel distinctly yours.
              </p>

              <div style="text-align:center;margin:36px 0;">
                <a
                  href="https://circalucia.vercel.app/collection"
                  style="display:inline-block;padding:14px 26px;background:#141210;color:#faf8f4;text-decoration:none;font-size:13px;letter-spacing:1px;"
                >
                  EXPLORE THE COLLECTION
                </a>
              </div>

              <p style="font-size:14px;line-height:1.8;color:#716b64;margin:32px 0 0;">
                Crafted as you imagined.
              </p>

              <div style="margin-top:40px;padding-top:20px;border-top:1px solid #d9d0c4;text-align:center;">
                <p style="margin:0;font-size:11px;letter-spacing:2px;color:#716b64;">
                  CIRCA LUCIA
                </p>
              </div>

            </div>
          </div>
        `,
      });
    }

    if (event === "login") {
      await sendCircaLuciaEmail({
        to: "contact.circalucia@gmail.com",
        subject:
          "New sign-in to your Circa Lucia account",
        html: `
          <div style="margin:0;padding:40px 20px;background:#f3eee6;font-family:Arial,sans-serif;color:#141210;">
            <div style="max-width:620px;margin:0 auto;background:#faf8f4;padding:48px 40px;">

              <p style="margin:0 0 28px;text-align:center;font-size:12px;letter-spacing:3px;color:#716b64;">
                CIRCA LUCIA
              </p>

              <h1 style="margin:0 0 24px;font-family:Georgia,serif;font-size:34px;font-weight:400;">
                New sign-in
              </h1>

              <p style="font-size:16px;line-height:1.8;">
                Dear ${customerName},
              </p>

              <p style="font-size:16px;line-height:1.8;">
                Your Circa Lucia account was just signed in to.
              </p>

              <p style="font-size:14px;line-height:1.8;color:#716b64;">
                If this was you, no action is required.
                If you do not recognise this activity, please
                change your password and contact us.
              </p>

              <div style="margin-top:40px;padding-top:20px;border-top:1px solid #d9d0c4;">
                <p style="margin:0;font-size:11px;letter-spacing:2px;color:#716b64;">
                  CRAFTED AS YOU IMAGINED.
                </p>
              </div>

            </div>
          </div>
        `,
      });
    }

    return NextResponse.json({
      success: true,
      event,
    });
  } catch (error) {
    /*
     * Keep the detailed error server-side only.
     * Never expose provider/database/internal errors
     * to the browser.
     */
    console.error(
      "Account event email error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error: "ACCOUNT_EVENT_EMAIL_ERROR",
      },
      { status: 500 }
    );
  }
}