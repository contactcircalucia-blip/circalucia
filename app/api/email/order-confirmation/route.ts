import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendCircaLuciaEmail } from "@/lib/email";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const orderId = body?.orderId;
    const accessToken = body?.accessToken;

    if (!orderId || !accessToken) {
      return NextResponse.json(
        {
          success: false,
          error: "Order ID and access token are required.",
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

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        {
          success: false,
          error: "AUTH_REQUIRED",
        },
        { status: 401 }
      );
    }

    const { data: order, error: orderError } =
      await supabase
        .from("orders")
        .select(
          `
          id,
          order_number,
          status,
          subtotal,
          shipping_amount,
          total_amount,
          currency,
          shipping_address,
          created_at
        `
        )
        .eq("id", orderId)
        .eq("user_id", user.id)
        .maybeSingle();

    if (orderError) {
      console.error(
        "Order lookup error:",
        orderError
      );

      return NextResponse.json(
        {
          success: false,
          error: "Unable to load order.",
        },
        { status: 500 }
      );
    }

    if (!order) {
      return NextResponse.json(
        {
          success: false,
          error: "Order not found.",
        },
        { status: 404 }
      );
    }

    const { data: items, error: itemsError } =
      await supabase
        .from("order_items")
        .select(
          `
          product_name,
          quantity,
          unit_price,
          selected_size,
          selected_color,
          selected_material,
          selected_heel_height
        `
        )
        .eq("order_id", order.id);

    if (itemsError) {
      console.error(
        "Order items lookup error:",
        itemsError
      );

      return NextResponse.json(
        {
          success: false,
          error: "Unable to load order items.",
        },
        { status: 500 }
      );
    }

    const shippingAddress =
      order.shipping_address as Record<
        string,
        unknown
      > | null;

    const customerName =
      typeof shippingAddress?.full_name ===
      "string"
        ? shippingAddress.full_name
        : "Customer";

    const itemRows = (items || [])
      .map((item: any) => {
        const variantDetails = [
          item.selected_size
            ? `Size: ${item.selected_size}`
            : "",
          item.selected_color
            ? `Color: ${item.selected_color}`
            : "",
          item.selected_material
            ? `Material: ${item.selected_material}`
            : "",
          item.selected_heel_height
            ? `Heel: ${item.selected_heel_height}`
            : "",
        ]
          .filter(Boolean)
          .join(" · ");

        return `
          <tr>
            <td style="padding:12px 0;border-bottom:1px solid #e5ded5;">
              <strong>${item.product_name}</strong>
              ${
                variantDetails
                  ? `
                    <div style="
                      margin-top:4px;
                      color:#716b64;
                      font-size:12px;
                    ">
                      ${variantDetails}
                    </div>
                  `
                  : ""
              }
            </td>

            <td style="
              padding:12px 0;
              border-bottom:1px solid #e5ded5;
              text-align:center;
            ">
              ${item.quantity}
            </td>

            <td style="
              padding:12px 0;
              border-bottom:1px solid #e5ded5;
              text-align:right;
            ">
              ₹${Number(
                item.unit_price
              ).toLocaleString("en-IN")}
            </td>
          </tr>
        `;
      })
      .join("");

    const emailHtml = `
      <div style="
        margin:0;
        padding:40px 20px;
        background:#f3eee6;
        font-family:Arial,Helvetica,sans-serif;
        color:#141210;
      ">

        <div style="
          max-width:620px;
          margin:0 auto;
          background:#faf8f4;
          padding:40px;
        ">

          <p style="
            margin:0 0 14px;
            color:#716b64;
            font-size:11px;
            letter-spacing:2px;
            text-transform:uppercase;
          ">
            CIRCA LUCIA
          </p>

          <h1 style="
            margin:0 0 18px;
            font-family:Georgia,'Times New Roman',serif;
            font-size:32px;
            font-weight:400;
          ">
            Thank you, ${customerName}.
          </h1>

          <p style="
            margin:0 0 28px;
            color:#4f4a45;
            line-height:1.7;
            font-size:14px;
          ">
            Your order has been received successfully.
            Your order is currently awaiting payment
            confirmation.
          </p>

          <div style="
            border:1px solid #d9d0c4;
            padding:20px;
            margin-bottom:30px;
          ">

            <p style="
              margin:0 0 6px;
              color:#716b64;
              font-size:10px;
              letter-spacing:1.5px;
              text-transform:uppercase;
            ">
              ORDER NUMBER
            </p>

            <strong style="
              font-size:20px;
              letter-spacing:1px;
            ">
              ${order.order_number}
            </strong>

          </div>

          <table style="
            width:100%;
            border-collapse:collapse;
            font-size:13px;
          ">

            <thead>
              <tr>
                <th style="
                  padding:0 0 10px;
                  text-align:left;
                  color:#716b64;
                  font-size:10px;
                  letter-spacing:1px;
                  text-transform:uppercase;
                ">
                  Item
                </th>

                <th style="
                  padding:0 0 10px;
                  text-align:center;
                  color:#716b64;
                  font-size:10px;
                  letter-spacing:1px;
                  text-transform:uppercase;
                ">
                  Qty
                </th>

                <th style="
                  padding:0 0 10px;
                  text-align:right;
                  color:#716b64;
                  font-size:10px;
                  letter-spacing:1px;
                  text-transform:uppercase;
                ">
                  Price
                </th>
              </tr>
            </thead>

            <tbody>
              ${itemRows}
            </tbody>

          </table>

          <div style="
            margin-top:24px;
            border-top:1px solid #d9d0c4;
            padding-top:18px;
          ">

            <div style="
              display:flex;
              justify-content:space-between;
              margin-bottom:8px;
              font-size:13px;
            ">
              <span>Subtotal</span>

              <strong>
                ₹${Number(
                  order.subtotal
                ).toLocaleString("en-IN")}
              </strong>
            </div>

            <div style="
              display:flex;
              justify-content:space-between;
              margin-bottom:8px;
              font-size:13px;
              color:#716b64;
            ">
              <span>Shipping</span>

              <span>
                ${
                  Number(
                    order.shipping_amount
                  ) > 0
                    ? `₹${Number(
                        order.shipping_amount
                      ).toLocaleString("en-IN")}`
                    : "To be calculated"
                }
              </span>
            </div>

            <div style="
              display:flex;
              justify-content:space-between;
              padding-top:12px;
              margin-top:12px;
              border-top:1px solid #d9d0c4;
              font-size:16px;
            ">
              <strong>Total</strong>

              <strong>
                ₹${Number(
                  order.total_amount
                ).toLocaleString("en-IN")}
              </strong>
            </div>

          </div>

          <p style="
            margin:32px 0 0;
            color:#716b64;
            font-size:12px;
            line-height:1.7;
          ">
            Payment gateway integration will be connected
            before launch. Once payment is confirmed,
            the Circa Lucia atelier will begin preparing
            your pair.
          </p>

          <div style="
            margin-top:36px;
            padding-top:20px;
            border-top:1px solid #d9d0c4;
            color:#716b64;
            font-size:11px;
            line-height:1.6;
          ">

            <strong style="color:#141210;">
              Circa Lucia
            </strong>

            <br />

            Crafted as you imagined.

          </div>

        </div>
      </div>
    `;

    /*
     * TEMPORARY TEST RECIPIENT
     *
     * Resend's onboarding@resend.dev sender
     * can only send testing emails to the
     * email address associated with the Resend account.
     *
     * We will change this back to:
     *
     *     to: user.email!
     *
     * after circalucia.com is verified in Resend.
     */
    await sendCircaLuciaEmail({
      to: "contact.circalucia@gmail.com",
      subject: `Order confirmed — ${order.order_number}`,
      html: emailHtml,
    });

    return NextResponse.json({
      success: true,
      message:
        "Order confirmation email sent successfully.",
    });
  } catch (error) {
    console.error(
      "Order confirmation email error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unknown error",
      },
      { status: 500 }
    );
  }
}