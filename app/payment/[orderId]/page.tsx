"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { formatINR } from "@/lib/products";

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => {
      open: () => void;
      on: (event: string, handler: (response: any) => void) => void;
    };
  }
}

type Order = {
  id: string;
  order_number: string;
  subtotal: number;
  shipping_amount: number;
  tax_amount: number;
  total_amount: number;
  currency: string;
  payment_status: string;
  shipping_address: Record<string, any> | null;
};

function loadRazorpayScript() {
  return new Promise<boolean>((resolve) => {
    if (window.Razorpay) {
      resolve(true);
      return;
    }

    const existing = document.querySelector(
      'script[src="https://checkout.razorpay.com/v1/checkout.js"]'
    );

    if (existing) {
      existing.addEventListener("load", () => resolve(true));
      existing.addEventListener("error", () => resolve(false));
      return;
    }

    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export default function PaymentPage() {
  const params = useParams<{ orderId: string }>();
  const router = useRouter();

  const orderId = params.orderId;

  const [order, setOrder] = useState<Order | null>(null);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    async function loadOrder() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          setErrorMessage("Please log in to continue payment.");
          return;
        }

        setEmail(user.email || "");

        const { data, error } = await supabase
          .from("orders")
          .select(
            "id, order_number, subtotal, shipping_amount, tax_amount, total_amount, currency, payment_status, shipping_address"
          )
          .eq("id", orderId)
          .eq("user_id", user.id)
          .maybeSingle();

        if (error) {
          console.error("Payment order lookup error:", error);
          setErrorMessage("We couldn't load this order.");
          return;
        }

        if (!data) {
          setErrorMessage("Order not found.");
          return;
        }

        setOrder(data as Order);
      } catch (error) {
        console.error("Unable to load payment page:", error);
        setErrorMessage("We couldn't load the payment page.");
      } finally {
        setLoading(false);
      }
    }

    if (orderId) {
      loadOrder();
    }
  }, [orderId]);

  async function startPayment() {
    if (!order || paying) return;

    setPaying(true);
    setErrorMessage("");

    try {
      const {
        data: { user: currentUser },
        error: currentUserError,
      } = await supabase.auth.getUser();

      if (currentUserError || !currentUser) {
        setErrorMessage("Your login session has expired. Please log in again.");
        return;
      }

      const { data: refreshed } = await supabase.auth.refreshSession();
      let accessToken = refreshed.session?.access_token;

      if (!accessToken) {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        accessToken = session?.access_token;
      }

      if (!accessToken) {
        setErrorMessage("Your login session has expired. Please log in again.");
        return;
      }

      const scriptReady = await loadRazorpayScript();

      if (!scriptReady || !window.Razorpay) {
        setErrorMessage(
          "Razorpay could not be loaded. Please check your connection and try again."
        );
        return;
      }

      const createResponse = await fetch("/api/razorpay/create-order", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          orderId: order.id,
        }),
      });

      const created = await createResponse.json();

      if (!createResponse.ok || !created.success) {
        setErrorMessage(created.error || "Unable to start payment.");
        return;
      }

      const shippingAddress = order.shipping_address || {};

      const razorpay = new window.Razorpay({
        key: created.keyId,
        amount: created.amount,
        currency: created.currency,
        name: "CIRCA LUCIA",
        description: `Order ${order.order_number}`,
        order_id: created.razorpayOrderId,
        prefill: {
          name: shippingAddress.full_name || "",
          email,
          contact: shippingAddress.phone || "",
        },
        notes: {
          circa_lucia_order_number: order.order_number,
        },
        theme: {
          color: "#141210",
        },
        handler: async (response: any) => {
          try {
            const verifyResponse = await fetch(
              "/api/razorpay/verify-payment",
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${accessToken}`,
                },
                body: JSON.stringify({
                  orderId: order.id,
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_order_id: response.razorpay_order_id,
                  razorpay_signature: response.razorpay_signature,
                }),
              }
            );

            const verified = await verifyResponse.json();

            if (!verifyResponse.ok || !verified.success) {
              setErrorMessage(
                verified.error ||
                  "Payment was received but verification could not be completed."
              );
              setPaying(false);
              return;
            }

            router.push(
              `/payment/success?orderId=${encodeURIComponent(order.id)}`
            );
          } catch (error) {
            console.error("Payment verification error:", error);
            setErrorMessage(
              "Payment verification could not be completed. Please do not pay again until the order status is checked."
            );
            setPaying(false);
          }
        },
        modal: {
          ondismiss: () => {
            setPaying(false);
          },
        },
      });

      razorpay.on("payment.failed", (response: any) => {
        console.error("Razorpay payment failed:", response);
        setErrorMessage(
          response?.error?.description ||
            "Payment failed. You can safely try again."
        );
        setPaying(false);
      });

      razorpay.open();
    } catch (error) {
      console.error("Unable to start Razorpay:", error);
      setErrorMessage("Unable to start payment. Please try again.");
    } finally {
      // Keep the loading state while Razorpay is open. Dismiss/failure/handler
      // will reset it or navigate away.
    }
  }

  if (loading) {
    return (
      <section className="section">
        <p className="eyebrow">SECURE PAYMENT</p>
        <h1>Loading...</h1>
      </section>
    );
  }

  if (!order) {
    return (
      <section className="section">
        <p className="eyebrow">SECURE PAYMENT</p>
        <h1>Payment unavailable.</h1>
        <p className="page-intro">{errorMessage}</p>
        <Link href="/account" className="button button-dark">
          View my account
        </Link>
      </section>
    );
  }

  const alreadyPaid = order.payment_status === "paid";

  return (
    <section className="section payment-page">
      <div>
        <p className="eyebrow">CIRCA LUCIA · SECURE PAYMENT</p>
        <h1>{alreadyPaid ? "Payment complete." : "Complete your order."}</h1>
        <p className="page-intro">
          Order <strong>{order.order_number}</strong>
        </p>

        {errorMessage && (
          <div className="payment-error">{errorMessage}</div>
        )}

        <div className="payment-card">
          <div className="line">
            <span>Subtotal</span>
            <span>{formatINR(Number(order.subtotal))}</span>
          </div>
          <div className="line">
            <span>Shipping</span>
            <span>{formatINR(Number(order.shipping_amount))}</span>
          </div>
          <div className="line">
            <span>Taxes</span>
            <span>{formatINR(Number(order.tax_amount))}</span>
          </div>
          <div className="divider" />
          <div className="total">
            <span>Total</span>
            <strong>{formatINR(Number(order.total_amount))}</strong>
          </div>

          {alreadyPaid ? (
            <Link
              href="/account"
              className="button button-dark payment-button"
            >
              View my order
            </Link>
          ) : (
            <button
              type="button"
              className="button button-dark payment-button"
              disabled={paying}
              onClick={startPayment}
            >
              {paying
                ? "Opening secure payment..."
                : `Pay ${formatINR(Number(order.total_amount))}`}
            </button>
          )}

          <p className="payment-note">
            Payment is processed securely by Razorpay. CIRCA LUCIA does not
            receive or store your card, UPI PIN, or banking credentials.
          </p>
        </div>
      </div>

      <style jsx>{`
        .payment-page {
          max-width: 980px;
          margin: 0 auto;
          padding-top: 56px;
          padding-bottom: 80px;
        }

        .payment-page h1 {
          margin: 18px 0 18px;
          max-width: 820px;
          font-size: clamp(52px, 7vw, 92px);
          line-height: 0.95;
          font-weight: 400;
          letter-spacing: -0.035em;
        }

        .payment-card {
          margin-top: 44px;
          max-width: 620px;
          padding: 28px;
          border-top: 1px solid #141210;
          background: #faf8f4;
        }

        .line,
        .total {
          display: flex;
          justify-content: space-between;
          gap: 24px;
          padding: 7px 0;
        }

        .line {
          color: #716b64;
          font-size: 14px;
        }

        .divider {
          height: 1px;
          margin: 18px 0;
          background: #d9d0c4;
        }

        .total {
          align-items: baseline;
          font-size: 18px;
        }

        .total strong {
          font-size: 24px;
          font-weight: 500;
        }

        .payment-button {
          width: 100%;
          min-height: 58px;
          margin-top: 28px;
        }

        .payment-button:disabled {
          opacity: 0.6;
          cursor: wait;
        }

        .payment-note {
          margin: 16px 0 0;
          color: #716b64;
          font-size: 11px;
          line-height: 1.6;
        }

        .payment-error {
          max-width: 620px;
          margin-top: 24px;
          padding: 14px 16px;
          border: 1px solid #7a263a;
          background: #faf8f4;
          color: #7a263a;
          font-size: 13px;
          line-height: 1.5;
        }

        @media (max-width: 640px) {
          .payment-page {
            padding-top: 28px;
            padding-bottom: 56px;
          }

          .payment-card {
            margin-top: 32px;
            padding: 22px 18px;
          }
        }
      `}</style>
    </section>
  );
}
