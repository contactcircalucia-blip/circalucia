"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Order = {
  id: string;
  order_number: string;
  status: string;
  payment_status: string | null;
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

type ReturnRequest = {
  id: string;
  order_id: string;
  return_number: string;
  request_type: string;
  status: string;
  requested_at: string;
};

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [returnStatuses, setReturnStatuses] = useState<
    Record<string, ReturnRequest>
  >({});
  const [bespokeOrderIds, setBespokeOrderIds] = useState<Record<string, boolean>>({});
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
        "id, order_number, status, payment_status, subtotal, shipping_amount, total_amount, currency, carrier, tracking_number, tracking_url, shipping_provider, created_at"
      )
      .eq("user_id", user.id)
      .order("created_at", {
        ascending: false,
      });

    if (error) {
      console.error("Error loading orders:", error);

      setOrders([]);
      setReturnStatuses({});
      setErrorMessage(
        "We could not load your orders right now."
      );

      setLoading(false);
      return;
    }

    const loadedOrders = (data || []) as Order[];

    setOrders(loadedOrders);

    if (loadedOrders.length === 0) {
      setReturnStatuses({});
      setBespokeOrderIds({});
      setLoading(false);
      return;
    }

    const orderIds = loadedOrders.map(
      (order) => order.id
    );

    const { data: bespokeData, error: bespokeError } = await supabase
      .from("bespoke_requests")
      .select("order_id")
      .eq("user_id", user.id)
      .in("order_id", orderIds);

    if (bespokeError) {
      console.error("Error loading bespoke order links:", bespokeError);
      setBespokeOrderIds({});
    } else {
      const nextBespokeIds: Record<string, boolean> = {};
      for (const row of bespokeData || []) {
        if (row.order_id) nextBespokeIds[row.order_id] = true;
      }
      setBespokeOrderIds(nextBespokeIds);
    }

    const {
      data: returnData,
      error: returnError,
    } = await supabase
      .from("return_requests")
      .select(
        "id, order_id, return_number, request_type, status, requested_at"
      )
      .eq("user_id", user.id)
      .in("order_id", orderIds)
      .order("requested_at", {
        ascending: false,
      });

    if (returnError) {
      console.error(
        "Error loading return requests:",
        returnError
      );

      setReturnStatuses({});
    } else {
      const latestByOrder: Record<
        string,
        ReturnRequest
      > = {};

      for (const request of (returnData ||
        []) as ReturnRequest[]) {
        if (!latestByOrder[request.order_id]) {
          latestByOrder[request.order_id] =
            request;
        }
      }

      setReturnStatuses(latestByOrder);
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

  function formatTime(date: string) {
    return new Intl.DateTimeFormat("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
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

  function getReturnLabel(
    request: ReturnRequest
  ) {
    const status = formatStatus(
      request.status
    );

    if (
      request.request_type === "replacement"
    ) {
      const cleanedStatus = status.replace(
        /^Replacement\s+/i,
        ""
      );

      return `Replacement · ${cleanedStatus}`;
    }

    return `Return · ${status}`;
  }

  if (loading) {
    return (
      <section className="section account-page">
        <p className="eyebrow">
          MY CIRCA LUCIA
        </p>

        <h1>Your orders.</h1>

        <p>Loading your orders...</p>
      </section>
    );
  }

  if (!logged) {
    return (
      <section className="section account-page">
        <p className="eyebrow">
          CLIENT PRIVILEGES
        </p>

        <h1>
          Sign in to view your orders.
        </h1>

        <p>
          Your Circa Lucia orders are
          available only inside your private
          account.
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
    <section className="section account-page premium-orders">
      <div className="orders-kicker"><p className="eyebrow">MY CIRCA LUCIA</p><span className="kicker-line"/><span className="kicker-right">CRAFTED AS YOU IMAGINED</span></div>
      <h1>Your orders.</h1>
      <p className="orders-intro">A record of your Circa Lucia purchases and their current preparation status.</p>
      {errorMessage && <div className="order-error"><p>{errorMessage}</p><button type="button" className="button button-dark" onClick={loadOrders}>Try again</button></div>}
      {!errorMessage && orders.length === 0 ? (
        <div className="orders-empty"><h2>No orders yet.</h2><p>Once you place an order, it will appear here.</p><a href="/collection" className="text-link">Explore collection →</a></div>
      ) : !errorMessage && (
        <div className="luxury-orders-table">
          <div className="luxury-orders-head"><span>ORDER</span><span>DATE</span><span>STATUS</span><span>TOTAL</span><span>ACTION</span></div>
          {orders.map((order) => {
            const returnRequest = returnStatuses[order.id];
            const paymentFailed = order.payment_status === "failed";
            const isBespoke = Boolean(bespokeOrderIds[order.id]);
            const isPaid = order.payment_status === "paid";
            return (
              <div key={order.id} className={`luxury-order ${isBespoke ? "is-bespoke" : ""}`}>
                <div className="order-identity"><strong>{order.order_number}</strong>{isBespoke && <><span className="bespoke-label">BESPOKE ORDER</span><small>Your custom design, crafted uniquely for you.</small></>}</div>
                <div className="date-cell"><strong>{formatDate(order.created_at)}</strong><small>{formatTime(order.created_at)}</small></div>
                <div className="status-cell">
                  <span className={`status-chip ${isPaid ? "paid" : paymentFailed ? "failed" : "pending"}`}><i>{isPaid ? "✓" : paymentFailed ? "!" : "◷"}</i>{isPaid ? "PAID" : paymentFailed ? "PAYMENT FAILED" : formatStatus(order.status)}</span>
                  {returnRequest && <span className="return-chip" title={returnRequest.return_number}>{getReturnLabel(returnRequest)}</span>}
                </div>
                <div className="total-cell"><strong>{formatINR(Number(order.total_amount))}</strong><small>{order.currency || "INR"}</small></div>
                <div className="action-cell">
                  {isBespoke && !isPaid ? <><a className="pay-bespoke" href={`/payment/${encodeURIComponent(order.id)}`}>PAY BESPOKE ORDER →</a><a className="details-link" href={`/account/orders/${encodeURIComponent(order.id)}`}>VIEW DETAILS</a></> : <a className="view-button" href={paymentFailed ? `/payment/${encodeURIComponent(order.id)}` : `/account/orders/${encodeURIComponent(order.id)}`}>{paymentFailed ? "RETRY PAYMENT →" : "VIEW DETAILS →"}</a>}
                </div>
              </div>
            );
          })}
        </div>
      )}
      <div className="orders-signoff"><span>THANK YOU FOR BEING A PART OF CIRCA LUCIA.</span><span>MORE THAN A PAIR</span></div>
      <style jsx>{`
        .premium-orders{max-width:1240px;margin:0 auto;padding-top:54px;padding-bottom:60px}.orders-kicker{display:flex;align-items:center;gap:22px}.orders-kicker .eyebrow,.kicker-right{margin:0;font-size:10px;letter-spacing:.28em}.kicker-line{width:58px;height:1px;background:var(--ink);opacity:.65}.kicker-right{margin-left:auto}.premium-orders h1{margin:12px 0 22px;font-size:clamp(60px,6.5vw,94px);line-height:.95;font-weight:400;letter-spacing:-.035em}.orders-intro{margin:0 0 42px;font-size:16px}.luxury-orders-table{border-top:1px solid var(--line)}.luxury-orders-head,.luxury-order{display:grid;grid-template-columns:2fr 1.05fr 1.15fr .8fr 1.3fr;gap:28px;align-items:center}.luxury-orders-head{padding:15px 10px;font-size:10px;letter-spacing:.18em}.luxury-order{min-height:116px;padding:22px 10px;border-top:1px solid var(--line)}.luxury-order:last-child{border-bottom:1px solid var(--line)}.luxury-order.is-bespoke{margin:0 -12px 12px;padding:24px 22px;border:1px solid #cdbb94;border-radius:10px}.order-identity,.date-cell,.total-cell{display:flex;flex-direction:column;align-items:flex-start;gap:7px;min-width:0}.order-identity strong,.date-cell strong{font-size:16px;font-weight:400}.order-identity small,.date-cell small,.total-cell small{font-size:12px;color:var(--muted)}.bespoke-label{padding:7px 11px;background:var(--ink);color:var(--paper);font-size:10px;letter-spacing:.12em}.status-cell{display:flex;flex-direction:column;align-items:flex-start;gap:8px}.status-chip,.return-chip{display:inline-flex;align-items:center;gap:8px;padding:8px 11px;border:1px solid var(--line);font-size:10px;letter-spacing:.08em;text-transform:uppercase;white-space:nowrap}.status-chip i{display:grid;place-items:center;width:18px;height:18px;border:1px solid currentColor;border-radius:50%;font-style:normal}.status-chip.pending{border-color:#d8c59e;background:#fbf7ee;color:#6f5829}.status-chip.paid{border-color:#b7ccb9;background:#f0f6f0;color:#315c39}.status-chip.failed{border-color:#cda69f;background:#fbf2f0;color:#8b3026}.return-chip{background:var(--cream)}.total-cell strong{font-size:18px;font-weight:500}.action-cell{display:flex;flex-direction:column;gap:10px;align-items:stretch}.pay-bespoke,.view-button{min-height:50px;display:flex;align-items:center;justify-content:center;padding:0 18px;font-size:11px;letter-spacing:.14em;text-decoration:none;text-align:center}.pay-bespoke{background:var(--ink);color:var(--paper);border:1px solid var(--ink)}.view-button{background:transparent;color:var(--ink);border:1px solid var(--ink)}.details-link{align-self:center;color:var(--ink);border-bottom:1px solid var(--ink);padding-bottom:3px;font-size:10px;letter-spacing:.14em;text-decoration:none}.orders-signoff{display:flex;justify-content:space-between;gap:20px;padding-top:34px;font-size:9px;letter-spacing:.28em}
        @media(max-width:900px){.premium-orders{padding-top:34px}.kicker-line,.kicker-right{display:none}.premium-orders h1{font-size:clamp(50px,15vw,72px)}.luxury-orders-head{display:none}.luxury-orders-table{border-top:0}.luxury-order,.luxury-order.is-bespoke{grid-template-columns:1fr 1fr;gap:22px 16px;margin:0 0 16px;padding:22px;border:1px solid var(--line);border-radius:8px}.luxury-order.is-bespoke{border-color:#cdbb94}.action-cell{grid-column:1/-1}.orders-signoff{flex-direction:column}}
        @media(max-width:520px){.luxury-order,.luxury-order.is-bespoke{grid-template-columns:1fr}.action-cell{grid-column:auto}}
      `}</style>
    </section>
  );
}