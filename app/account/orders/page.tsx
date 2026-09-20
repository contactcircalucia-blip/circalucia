"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Order = {
  id: string;
  order_number: string;
  status: string;
  subtotal: number;
  shipping_amount: number;
  total_amount: number;
  currency: string;
  carrier: string | null;
  tracking_number: string | null;
  tracking_url: string | null;
  shipping_provider: string | null;
  created_at: string;
};

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [logged, setLogged] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function loadOrders() {
    setLoading(true);
    setErrorMessage("");

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setLogged(false);
      setLoading(false);
      return;
    }

    setLogged(true);

    const { data, error } = await supabase
      .from("orders")
      .select(
        "id, order_number, status, subtotal, shipping_amount, total_amount, currency, carrier, tracking_number, tracking_url, shipping_provider, created_at"
      )
      .eq("user_id", user.id)
      .order("created_at", {
        ascending: false,
      });

    if (error) {
      console.error("Error loading orders:", error);

      setOrders([]);
      setErrorMessage(
        "We could not load your orders right now."
      );
    } else {
      setOrders((data || []) as Order[]);
    }

    setLoading(false);
  }

  useEffect(() => {
    loadOrders();
  }, []);

  function formatDate(date: string) {
    return new Intl.DateTimeFormat("en-IN", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(new Date(date));
  }

  function formatINR(value: number) {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(value);
  }

  function formatStatus(status: string) {
    return status
      .replace(/_/g, " ")
      .replace(/\b\w/g, (letter) =>
        letter.toUpperCase()
      );
  }

  if (loading) {
    return (
      <section className="section account-page">
        <p className="eyebrow">MY CIRCA LUCIA</p>

        <h1>Your orders.</h1>

        <p>Loading your orders...</p>
      </section>
    );
  }

  if (!logged) {
    return (
      <section className="section account-page">
        <p className="eyebrow">CLIENT PRIVILEGES</p>

        <h1>Sign in to view your orders.</h1>

        <p>
          Your Circa Lucia orders are available only
          inside your private account.
        </p>

        <a
          href="/account"
          className="button button-dark"
        >
          Sign in
        </a>
      </section>
    );
  }

  return (
    <section className="section account-page">
      <p className="eyebrow">MY CIRCA LUCIA</p>

      <h1>Your orders.</h1>

      <p>
        A record of your Circa Lucia purchases and
        their current preparation status.
      </p>

      {errorMessage && (
        <div className="order-error">
          <p>{errorMessage}</p>

          <button
            type="button"
            className="button button-dark"
            onClick={loadOrders}
          >
            Try again
          </button>
        </div>
      )}

      {!errorMessage && orders.length === 0 ? (
        <div className="orders-empty">
          <h2>No orders yet.</h2>

          <p>
            Once you place an order, it will appear
            here.
          </p>

          <a
            href="/collection"
            className="text-link"
          >
            Explore collection →
          </a>
        </div>
      ) : (
        !errorMessage && (
          <div className="orders-table">
            <div className="orders-table-header">
              <span>ORDER</span>
              <span>DATE</span>
              <span>STATUS</span>
              <span>TOTAL</span>
              <span></span>
            </div>

            {orders.map((order) => {
              const displayCarrier =
                order.carrier ||
                order.shipping_provider ||
                null;

              const hasTracking =
                Boolean(
                  displayCarrier ||
                    order.tracking_number ||
                    order.tracking_url
                );

              return (
                <div
                  className="order-row"
                  key={order.id}
                >
                  <div className="order-number">
                    {order.order_number}
                  </div>

                  <div className="order-date">
                    {formatDate(
                      order.created_at
                    )}
                  </div>

                  <div className="order-status">
                    <span>
                      {formatStatus(
                        order.status
                      )}
                    </span>
                  </div>

                  <div className="order-total">
                    {formatINR(
                      Number(
                        order.total_amount
                      )
                    )}
                  </div>

                  <div className="order-action">
                    <a
                      href={`/account/orders/${encodeURIComponent(
                        order.id
                      )}`}
                      className="text-link"
                    >
                      View details →
                    </a>

                    
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}
    </section>
  );
}