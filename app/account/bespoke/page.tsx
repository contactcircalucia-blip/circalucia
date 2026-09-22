"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type BespokeRequest = {
  id: string;
  request_number: string | null;
  design_description: string | null;
  timing: string | null;
  status: string;
  admin_notes: string | null;
  customer_message: string | null;
  final_price: number | null;
  approved_at: string | null;
  order_id: string | null;
  created_at: string;
};

export default function AccountBespokePage() {
  const [requests, setRequests] = useState<BespokeRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [logged, setLogged] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    loadRequests();
  }, []);

  async function loadRequests() {
    setLoading(true);
    setError("");

    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      setLogged(false);
      setLoading(false);
      return;
    }

    setLogged(true);

    const { data, error: requestError } = await supabase
      .from("bespoke_requests")
      .select("id, request_number, design_description, timing, status, admin_notes, customer_message, final_price, approved_at, order_id, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (requestError) {
      console.error("Error loading bespoke requests:", requestError);
      setError("We could not load your bespoke requests right now.");
      setRequests([]);
    } else {
      setRequests((data || []) as BespokeRequest[]);
    }

    setLoading(false);
  }

  function formatDate(value: string) {
    return new Intl.DateTimeFormat("en-IN", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(new Date(value));
  }

  function formatINR(value: number) {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(value);
  }

  function formatStatus(value: string) {
    return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  function designTitle(description: string | null) {
    if (!description) return "Your bespoke design";
    const firstLine = description.split("\n")[0] || "";
    return firstLine.replace(/^Starting design:\s*/i, "").trim() || "Your bespoke design";
  }

  if (loading) {
    return (
      <section className="section account-page">
        <p className="eyebrow">MY CIRCA LUCIA</p>
        <h1>Your bespoke.</h1>
        <p>Loading your bespoke requests...</p>
      </section>
    );
  }

  if (!logged) {
    return (
      <section className="section account-page">
        <p className="eyebrow">CLIENT PRIVILEGES</p>
        <h1>Sign in to view your bespoke requests.</h1>
        <p>Your private atelier requests are available inside your Circa Lucia account.</p>
        <a href="/account" className="button button-dark">Sign in</a>
      </section>
    );
  }

  return (
    <section className="section account-page bespoke-account-page">
      <div className="page-head">
        <div>
          <p className="eyebrow">MY CIRCA LUCIA · THE BESPOKE ATELIER</p>
          <h1>Your bespoke.</h1>
          <p className="intro">
            Follow your custom requests from first conversation to approved bespoke order.
          </p>
        </div>
        <a href="/bespoke" className="button button-dark">New bespoke request</a>
      </div>

      {error && (
        <div className="message-box">
          <p>{error}</p>
          <button type="button" className="button button-dark" onClick={loadRequests}>
            Try again
          </button>
        </div>
      )}

      {!error && requests.length === 0 && (
        <div className="empty-state">
          <span>01</span>
          <div>
            <h2>Your atelier journey starts here.</h2>
            <p>You have not submitted a bespoke request yet.</p>
            <a href="/bespoke" className="text-link">Begin a bespoke request →</a>
          </div>
        </div>
      )}

      {!error && requests.length > 0 && (
        <div className="requests">
          {requests.map((request, index) => {
            const approved = Boolean(request.approved_at || request.order_id);

            return (
              <article className={`request-card ${approved ? "approved" : ""}`} key={request.id}>
                <div className="request-index">{String(index + 1).padStart(2, "0")}</div>

                <div className="request-main">
                  <div className="request-top">
                    <div>
                      <p className="request-number">{request.request_number || "BESPOKE REQUEST"}</p>
                      <h2>{designTitle(request.design_description)}</h2>
                    </div>
                    <span className={`status ${approved ? "approved-status" : ""}`}>
                      {approved ? "APPROVED" : formatStatus(request.status)}
                    </span>
                  </div>

                  <div className="meta-grid">
                    <div><span>REQUESTED</span><strong>{formatDate(request.created_at)}</strong></div>
                    <div><span>TIMING</span><strong>{request.timing || "To be discussed"}</strong></div>
                    {request.final_price != null && (
                      <div><span>FINAL PRICE</span><strong>{formatINR(Number(request.final_price))}</strong></div>
                    )}
                  </div>

                  {request.design_description && (
                    <div className="detail-block">
                      <span>YOUR VISION</span>
                      <p>{request.design_description}</p>
                    </div>
                  )}

                  {(request.customer_message || request.admin_notes) && (
                    <div className="atelier-note">
                      <span>FROM THE ATELIER</span>
                      <p>{request.customer_message || request.admin_notes}</p>
                    </div>
                  )}

                  {approved && (
                    <div className="order-panel">
                      <div>
                        <span className="order-label">BESPOKE ORDER</span>
                        <h3>Your design has been approved.</h3>
                        <p>
                          {request.order_id
                            ? "Your bespoke order is ready in your account."
                            : "Your approved request is being prepared as an order."}
                        </p>
                      </div>

                      {request.order_id && (
                        <div className="order-actions">
                          <a href={`/payment/${encodeURIComponent(request.order_id)}`} className="button button-dark">
                            Pay bespoke order
                          </a>
                          <a href={`/account/orders/${encodeURIComponent(request.order_id)}`} className="text-link">
                            View order →
                          </a>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      <style jsx>{`
        .bespoke-account-page{max-width:1180px;margin:0 auto}
        .page-head{display:flex;justify-content:space-between;align-items:flex-end;gap:40px;margin-bottom:58px}
        .page-head h1{margin:12px 0 20px}
        .intro{max-width:620px;margin:0;color:#716b64;line-height:1.75}
        .page-head>.button{flex:0 0 auto;margin-bottom:5px}
        .requests{border-top:1px solid #d9d0c4}
        .request-card{display:grid;grid-template-columns:62px 1fr;gap:28px;padding:38px 0;border-bottom:1px solid #d9d0c4}
        .request-card.approved{margin:18px 0;padding:34px 28px;border:1px solid #cdbb94}
        .request-index{padding-top:4px;color:#9a9288;font-size:11px;letter-spacing:.14em}
        .request-top{display:flex;justify-content:space-between;align-items:flex-start;gap:30px}
        .request-number{margin:0 0 9px;color:#716b64;font-size:10px;letter-spacing:.15em}
        .request-top h2{margin:0;font-size:29px;font-weight:400}
        .status{flex:0 0 auto;padding:7px 10px;border:1px solid #d9d0c4;font-size:9px;letter-spacing:.12em;text-transform:uppercase}
        .approved-status{border-color:#141210;background:#141210;color:#faf8f4}
        .meta-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:24px;margin:30px 0;padding:22px 0;border-top:1px solid #e4ddd4;border-bottom:1px solid #e4ddd4}
        .meta-grid div{display:flex;flex-direction:column;gap:8px}
        .meta-grid span,.detail-block>span,.atelier-note>span{color:#8b837a;font-size:9px;letter-spacing:.15em}
        .meta-grid strong{font-size:13px;font-weight:400}
        .detail-block{margin-top:26px}
        .detail-block p{max-width:760px;margin:10px 0 0;color:#4f4a45;font-size:13px;line-height:1.75;white-space:pre-line}
        .atelier-note{margin-top:26px;padding:20px 22px;background:#faf8f4;border-left:2px solid #141210}
        .atelier-note p{margin:9px 0 0;color:#4f4a45;font-size:13px;line-height:1.7;white-space:pre-line}
        .order-panel{display:flex;justify-content:space-between;align-items:center;gap:28px;margin-top:30px;padding-top:28px;border-top:1px solid #d7c49d}
        .order-label{display:inline-block;padding:6px 9px;background:#141210;color:#faf8f4;font-size:9px;letter-spacing:.15em}
        .order-panel h3{margin:14px 0 7px;font-size:20px;font-weight:400}
        .order-panel p{margin:0;color:#716b64;font-size:13px}
        .order-actions{display:flex;flex-direction:column;align-items:center;gap:12px;min-width:205px}
        .order-actions .button{width:100%;box-sizing:border-box;text-align:center}
        .empty-state{display:grid;grid-template-columns:62px 1fr;gap:28px;padding:42px 0;border-top:1px solid #d9d0c4;border-bottom:1px solid #d9d0c4}
        .empty-state>span{color:#9a9288;font-size:11px;letter-spacing:.14em}
        .empty-state h2{margin:0 0 10px;font-size:28px;font-weight:400}
        .empty-state p{color:#716b64}
        .message-box{padding:24px;border:1px solid #d9d0c4}
        @media(max-width:760px){
          .page-head{display:block;margin-bottom:40px}
          .page-head>.button{display:inline-block;margin-top:24px}
          .request-card,.request-card.approved,.empty-state{grid-template-columns:1fr;gap:14px}
          .request-card.approved{padding:26px 20px}
          .request-top,.order-panel{flex-direction:column}
          .meta-grid{grid-template-columns:1fr}
          .order-actions{width:100%;align-items:stretch}
          .order-actions .text-link{align-self:flex-start}
        }
      `}</style>
    </section>
  );
}
