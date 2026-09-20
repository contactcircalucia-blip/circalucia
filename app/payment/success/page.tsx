"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

type PaidOrder = {
  order_number: string;
  payment_status: string;
};

export default function PaymentSuccessPage() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get("orderId");

  const [order, setOrder] = useState<PaidOrder | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function finishPaidOrder() {
      if (!orderId) {
        setLoading(false);
        return;
      }

      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        const user = session?.user;
        const accessToken = session?.access_token;

        if (!user || !accessToken) {
          setLoading(false);
          return;
        }

        const { data, error } = await supabase
          .from("orders")
          .select("order_number, payment_status")
          .eq("id", orderId)
          .eq("user_id", user.id)
          .maybeSingle();

        if (error) {
          console.error("Paid order lookup error:", error);
          setLoading(false);
          return;
        }

        const paidOrder = (data as PaidOrder | null) || null;
        setOrder(paidOrder);

        // Only perform post-payment actions after Supabase itself confirms paid.
        if (paidOrder?.payment_status === "paid") {
          localStorage.removeItem("cl-cart");
          window.dispatchEvent(new Event("cl-cart-updated"));

          // Prevent repeated refreshes in the same browser from repeatedly
          // requesting the same confirmation email.
          const emailFlag = `cl-order-email-${orderId}`;

          if (!localStorage.getItem(emailFlag)) {
            try {
              const emailResponse = await fetch(
                "/api/email/order-confirmation",
                {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({
                    orderId,
                    accessToken,
                  }),
                }
              );

              const emailResult = await emailResponse.json();

              if (emailResponse.ok && emailResult?.success) {
                localStorage.setItem(emailFlag, "sent");
              } else {
                console.error(
                  "Order confirmation email was not sent:",
                  emailResult
                );
              }
            } catch (emailError) {
              console.error(
                "Order confirmation email request failed:",
                emailError
              );
            }
          }
        }
      } catch (error) {
        console.error("Payment success page error:", error);
      } finally {
        setLoading(false);
      }
    }

    finishPaidOrder();
  }, [orderId]);

  if (loading) {
    return (
      <section className="section">
        <p className="eyebrow">PAYMENT</p>
        <h1>Confirming...</h1>
      </section>
    );
  }

  const paid = order?.payment_status === "paid";

  return (
    <section
      className="section"
      style={{
        maxWidth: "900px",
        margin: "0 auto",
        paddingTop: "72px",
        paddingBottom: "96px",
      }}
    >
      <p className="eyebrow">
        {paid ? "PAYMENT CONFIRMED" : "PAYMENT STATUS"}
      </p>

      <h1>
        {paid
          ? "Thank you."
          : "We're checking your payment."}
      </h1>

      <p className="page-intro">
        {paid
          ? `Payment for order ${
              order?.order_number || ""
            } has been verified successfully. Your order is now confirmed.`
          : "Your order has not yet been marked as paid. Please check your account before attempting another payment."}
      </p>

      <div
        style={{
          display: "flex",
          gap: "12px",
          flexWrap: "wrap",
          marginTop: "28px",
        }}
      >
        <Link
          href="/account"
          className="button button-dark"
        >
          View my order
        </Link>

        <Link
          href="/collection"
          className="button"
        >
          Continue shopping
        </Link>
      </div>
    </section>
  );
}
