"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import AdminNav from "@/components/AdminNav";

type ReturnItem = {
  id: string;
  order_item_id: string;
  product_id: string | null;
  product_name: string;
  selected_size: string | null;
  quantity: number;
  unit_price: number;
  requested_refund_amount: number;
  approved_refund_amount: number | null;
  reason: string | null;
  requested_replacement_size: string | null;
  approved_replacement_size: string | null;
};

type ReturnRequest = {
  id: string;
  return_number: string;
  order_id: string;
  user_id: string;
  request_type: string;
  status: string;
  reason: string;
  customer_notes: string | null;
  admin_notes: string | null;
  requested_refund_amount: number;
  approved_refund_amount: number | null;
  refunded_amount: number;
  razorpay_refund_id: string | null;
  refund_reference: string | null;
  refund_status: string | null;
  refund_error: string | null;
  refund_attempted_at: string | null;
  refund_processed_at: string | null;
  delivered_at: string | null;
  eligibility_expires_at: string | null;
  requested_at: string;
  received_at: string | null;
  replacement_carrier: string | null;
  replacement_tracking_number: string | null;
  replacement_tracking_url: string | null;
  replacement_delivered_at: string | null;
  items?: ReturnItem[];
  order_financials?: {
    shipping_amount: number;
    tax_amount: number;
    discount_amount: number;
    total_amount: number;
  } | null;
};

const field: React.CSSProperties = {
  width: "100%",
  padding: "12px 14px",
  border: "1px solid var(--line)",
  background: "var(--paper)",
  color: "var(--ink)",
  boxSizing: "border-box",
};

const primary: React.CSSProperties = {
  padding: "11px 15px",
  border: "1px solid var(--ink)",
  background: "var(--ink)",
  color: "var(--paper)",
  cursor: "pointer",
};

const secondary: React.CSSProperties = {
  ...primary,
  background: "transparent",
  color: "var(--ink)",
};

function money(value: number | null | undefined) {
  return `₹${Number(value || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function date(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function label(value: string | null | undefined) {
  if (!value) return "—";
  return value.replaceAll("_", " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

export default function AdminReturnsPage() {
  const [checked, setChecked] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [requests, setRequests] = useState<ReturnRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [refunds, setRefunds] = useState<Record<string, string>>({});
  const [sizes, setSizes] = useState<Record<string, string>>({});
  const [tracking, setTracking] = useState<
    Record<string, { carrier: string; number: string; url: string }>
  >({});

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        setChecked(true);
        setLoading(false);
        return;
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("is_admin")
        .eq("id", data.user.id)
        .maybeSingle();

      const admin = profile?.is_admin === true;
      setIsAdmin(admin);
      setChecked(true);
      if (admin) await loadRequests();
      else setLoading(false);
    })();
  }, []);

  async function loadRequests() {
    setLoading(true);
    setError("");

    const { data, error: requestError } = await supabase
      .from("return_requests")
      .select("*")
      .order("requested_at", { ascending: false });

    if (requestError) {
      setError(requestError.message);
      setLoading(false);
      return;
    }

    const rows = (data || []) as ReturnRequest[];

    if (rows.length) {
      const ids = rows.map((r) => r.id);
      const { data: itemData, error: itemError } = await supabase
        .from("return_request_items")
        .select("*")
        .in("return_request_id", ids)
        .order("created_at", { ascending: true });

      if (itemError) {
        setError(itemError.message);
        setLoading(false);
        return;
      }

      const grouped: Record<string, ReturnItem[]> = {};
      for (const item of itemData || []) {
        const key = item.return_request_id as string;
        grouped[key] ||= [];
        grouped[key].push(item as ReturnItem);
      }

      for (const row of rows) row.items = grouped[row.id] || [];

      const orderIds = [...new Set(rows.map((r) => r.order_id))];
      const { data: orderData, error: orderError } = await supabase
        .from("orders")
        .select("id, shipping_amount, tax_amount, discount_amount, total_amount")
        .in("id", orderIds);

      if (orderError) {
        setError(orderError.message);
        setLoading(false);
        return;
      }

      const orderMap = new Map(
        (orderData || []).map((order: any) => [
          order.id,
          {
            shipping_amount: Number(order.shipping_amount || 0),
            tax_amount: Number(order.tax_amount || 0),
            discount_amount: Number(order.discount_amount || 0),
            total_amount: Number(order.total_amount || 0),
          },
        ])
      );

      for (const row of rows) {
        row.order_financials = orderMap.get(row.order_id) || null;
      }
    }

    setRequests(rows);
    setLoading(false);
  }

  async function action(
    request: ReturnRequest,
    actionName: string
  ) {
    setBusy(request.id);
    setMessage("");
    setError("");

    const refundValue =
      refunds[request.id] ??
      String(request.requested_refund_amount || 0);

    const track = tracking[request.id] || { carrier: "", number: "", url: "" };

    const replacementSize =
      sizes[request.id] ||
      request.items?.[0]?.requested_replacement_size ||
      request.items?.[0]?.approved_replacement_size ||
      "";

    if (actionName === "approve_replacement" && !replacementSize) {
      setError("Please select an approved replacement size.");
      setBusy(null);
      return;
    }

    const { error: rpcError } = await supabase.rpc(
      "admin_manage_return_request",
      {
        p_return_request_id: request.id,
        p_action: actionName,
        p_admin_notes: notes[request.id] || null,
        p_approved_refund_amount:
          actionName === "approve_return"
            ? Number(refundValue)
            : null,
        p_approved_replacement_size:
          actionName === "approve_replacement"
            ? replacementSize
            : null,
        p_tracking_number:
          actionName === "mark_replacement_shipped"
            ? track.number
            : null,
        p_tracking_url:
          actionName === "mark_replacement_shipped"
            ? track.url
            : null,
        p_replacement_carrier:
          actionName === "mark_replacement_shipped"
            ? track.carrier
            : null,
      }
    );

    if (rpcError) {
      setError(rpcError.message);
      setBusy(null);
      return;
    }

    setMessage(`${request.return_number} updated successfully.`);
    setBusy(null);
    await loadRequests();
  }

  async function processRefund(request: ReturnRequest) {
    const confirmed = window.confirm(
      `Process ${money(
        request.approved_refund_amount
      )} back to the customer's ORIGINAL Razorpay payment source?\n\nThis creates a real Razorpay refund and cannot be undone from CIRCA LUCIA.`
    );

    if (!confirmed) return;

    setBusy(request.id);
    setMessage("");
    setError("");

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error("Admin session expired. Please sign in again.");
      }

      const response = await fetch("/api/razorpay/refund", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          returnRequestId: request.id,
        }),
      });

      const result = await response.json().catch(() => null);

      if (!response.ok || !result?.success) {
        if (result?.critical && result?.refundId) {
          throw new Error(
            `${result.error} Razorpay refund ID: ${result.refundId}`
          );
        }
        throw new Error(result?.error || "Unable to process Razorpay refund.");
      }

      if (result.alreadyStarted) {
        setMessage(
          `${request.return_number}: refund was already started (${result.refundId || "existing refund"}).`
        );
      } else if (result.refundStatus === "processed") {
        setMessage(
          `${request.return_number}: refund processed successfully to the original payment source. Razorpay refund ID: ${result.refundId}`
        );
      } else {
        setMessage(
          `${request.return_number}: refund accepted by Razorpay and is processing to the original payment source. Razorpay refund ID: ${result.refundId}`
        );
      }

      await loadRequests();
    } catch (err: any) {
      setError(err?.message || "Unable to process Razorpay refund.");
    } finally {
      setBusy(null);
    }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return requests.filter((r) => {
      if (filter !== "all" && r.status !== filter) return false;
      if (!q) return true;
      return [
        r.return_number,
        r.order_id,
        r.user_id,
        r.reason,
        r.status,
        r.request_type,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [requests, search, filter]);

  const pending = requests.filter((r) => r.status === "requested").length;
  const received = requests.filter((r) => r.status === "received").length;
  const completed = requests.filter((r) =>
    ["refunded", "replacement_delivered"].includes(r.status)
  ).length;

  if (!checked) {
    return <main className="page"><section className="section"><div className="container">Checking admin access…</div></section></main>;
  }

  if (!isAdmin) {
    return <main className="page"><section className="section"><div className="container"><h1>Admin access required</h1><Link href="/admin">Return to admin</Link></div></section></main>;
  }

  return (
    <main className="page">
      <section className="section">
        <div className="container">
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",gap:20,flexWrap:"wrap",marginBottom:22}}>
            <div>
              <p style={{margin:"0 0 8px",fontSize:12,letterSpacing:"0.16em",textTransform:"uppercase",color:"var(--muted)"}}>Circa Lucia · Administration</p>
              <h1 style={{margin:0,fontFamily:"Cormorant Garamond, serif",fontSize:48,fontWeight:500}}>Returns &amp; Replacements</h1>
            </div>
            <button style={secondary} onClick={loadRequests} disabled={loading}>{loading ? "Refreshing…" : "Refresh"}</button>
          </div>

          <AdminNav />

          {message && <div style={{padding:14,marginBottom:16,background:"var(--cream)",border:"1px solid var(--line)"}}>{message}</div>}
          {error && <div style={{padding:14,marginBottom:16,background:"#faf1ee",border:"1px solid #c7aaa0",color:"#7c3f30"}}>{error}</div>}

          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:12,marginBottom:28}}>
            {[["Requests",requests.length],["Awaiting review",pending],["Returned / received",received],["Completed",completed]].map(([name,value]) => (
              <div key={String(name)} style={{border:"1px solid var(--line)",padding:20}}>
                <div style={{fontSize:12,color:"var(--muted)",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:8}}>{name}</div>
                <div style={{fontSize:28}}>{value}</div>
              </div>
            ))}
          </div>

          <div style={{display:"grid",gridTemplateColumns:"minmax(0,1fr) 230px",gap:12,marginBottom:25}}>
            <input value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="Search return number, order, reason…" style={field}/>
            <select value={filter} onChange={(e)=>setFilter(e.target.value)} style={field}>
              <option value="all">All statuses</option>
              {["requested","approved","replacement_approved","return_in_transit","received","refund_processing","refunded","replacement_processing","replacement_shipped","replacement_delivered","rejected","cancelled"].map(s => <option key={s} value={s}>{label(s)}</option>)}
            </select>
          </div>

          {loading ? <p>Loading requests…</p> : filtered.length === 0 ? <p>No return or replacement requests found.</p> : (
            <div style={{display:"grid",gap:14}}>
              {filtered.map((request) => {
                const open = expanded === request.id;
                const requestItems = request.items || [];
                const productValue = requestItems.reduce(
                  (sum, item) => sum + Number(item.unit_price || 0) * Number(item.quantity || 0),
                  0
                );
                const shippingAmount = Number(request.order_financials?.shipping_amount || 0);
                const taxAmount = Number(request.order_financials?.tax_amount || 0);
                const discountAmount = Number(request.order_financials?.discount_amount || 0);
                const orderPaidAmount = Number(request.order_financials?.total_amount || 0);
                const approvedInput =
                  refunds[request.id] ?? String(request.requested_refund_amount || 0);
                return (
                  <article key={request.id} style={{border:"1px solid var(--line)",background:"var(--paper)"}}>
                    <button type="button" onClick={()=>setExpanded(open ? null : request.id)} style={{width:"100%",padding:22,border:0,background:"transparent",textAlign:"left",cursor:"pointer"}}>
                      <div style={{display:"flex",justifyContent:"space-between",gap:20,flexWrap:"wrap"}}>
                        <div>
                          <strong style={{fontFamily:"Cormorant Garamond, serif",fontSize:25,fontWeight:500}}>{request.return_number}</strong>
                          <div style={{marginTop:6,fontSize:13,color:"var(--muted)"}}>Order {request.order_id} · {date(request.requested_at)}</div>
                        </div>
                        <div style={{textAlign:"right"}}>
                          <div style={{fontSize:12,textTransform:"uppercase",letterSpacing:"0.08em"}}>{label(request.status)}</div>
                          <div style={{marginTop:6,color:"var(--muted)",fontSize:13}}>{request.request_type === "replacement" ? "Replacement requested" : "Return & refund requested"}</div>
                        </div>
                      </div>
                    </button>

                    {open && (
                      <div style={{borderTop:"1px solid var(--line)",padding:22}}>
                        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:20,marginBottom:22}}>
                          <div><strong>Reason</strong><p>{request.reason}</p><p style={{color:"var(--muted)"}}>{request.customer_notes || "No customer notes."}</p></div>
                          <div><strong>Eligibility</strong><p>Delivered: {date(request.delivered_at)}<br/>Window ended: {date(request.eligibility_expires_at)}</p></div>
                          <div>
                            <strong>Amounts</strong>
                            <p style={{lineHeight:1.8}}>
                              Product value: {money(productValue)}<br/>
                              Shipping: {money(shippingAmount)}<br/>
                              Tax: {money(taxAmount)}<br/>
                              {discountAmount > 0 && <>Order discount: −{money(discountAmount)}<br/></>}
                              <strong>Order paid: {money(orderPaidAmount)}</strong><br/>
                              Requested refund: {money(request.requested_refund_amount)}<br/>
                              Approved: {request.approved_refund_amount == null ? "—" : money(request.approved_refund_amount)}<br/>
                              Refunded: {money(request.refunded_amount)}
                            </p>
                          </div>
                        </div>

                        <h3 style={{fontSize:12,textTransform:"uppercase",letterSpacing:"0.12em",color:"var(--muted)"}}>Requested items</h3>
                        <div style={{display:"grid",gap:10,marginBottom:22}}>
                          {requestItems.map(item => (
                            <div key={item.id} style={{border:"1px solid var(--line)",padding:15,display:"flex",justifyContent:"space-between",gap:16,flexWrap:"wrap"}}>
                              <div><strong>{item.product_name}</strong><div style={{fontSize:13,color:"var(--muted)",marginTop:5}}>Qty {item.quantity} · Original size {item.selected_size || "—"}{item.requested_replacement_size ? ` · Requested replacement ${item.requested_replacement_size}` : ""}{item.approved_replacement_size ? ` · Approved replacement ${item.approved_replacement_size}` : ""}</div></div>
                              <div>{money(item.unit_price)} × {item.quantity}</div>
                            </div>
                          ))}
                        </div>

                        <textarea rows={3} value={notes[request.id] ?? request.admin_notes ?? ""} onChange={(e)=>setNotes(n=>({...n,[request.id]:e.target.value}))} placeholder="Admin notes…" style={{...field,marginBottom:12}}/>

                        {request.status === "requested" && (
                          <>
                            {request.request_type !== "replacement" ? (
                              <>
                                <div style={{padding:16,border:"1px solid var(--line)",background:"var(--cream)",marginBottom:12}}>
                                  <div style={{fontSize:12,textTransform:"uppercase",letterSpacing:"0.08em",color:"var(--muted)",marginBottom:10}}>
                                    Refund approval
                                  </div>
                                  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:8,marginBottom:12,fontSize:13,lineHeight:1.7}}>
                                    <div>Product value<br/><strong>{money(productValue)}</strong></div>
                                    <div>Shipping<br/><strong>{money(shippingAmount)}</strong></div>
                                    <div>Tax<br/><strong>{money(taxAmount)}</strong></div>
                                    <div>Order paid<br/><strong>{money(orderPaidAmount)}</strong></div>
                                  </div>

                                  <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:12}}>
                                    <button
                                      type="button"
                                      style={secondary}
                                      onClick={()=>setRefunds(v=>({...v,[request.id]:String(request.requested_refund_amount || productValue)}))}
                                    >
                                      Product Only · {money(request.requested_refund_amount || productValue)}
                                    </button>
                                    <button
                                      type="button"
                                      style={secondary}
                                      disabled={orderPaidAmount <= 0}
                                      onClick={()=>setRefunds(v=>({...v,[request.id]:String(orderPaidAmount)}))}
                                    >
                                      Full Order · {money(orderPaidAmount)}
                                    </button>
                                  </div>

                                  <label style={{display:"block",fontSize:12,color:"var(--muted)",marginBottom:6}}>
                                    Approved refund amount — custom amount allowed
                                  </label>
                                  <input
                                    type="number"
                                    min="0"
                                    max={orderPaidAmount > 0 ? orderPaidAmount : undefined}
                                    step="0.01"
                                    value={approvedInput}
                                    onChange={(e)=>setRefunds(v=>({...v,[request.id]:e.target.value}))}
                                    placeholder="Approved refund amount"
                                    style={field}
                                  />
                                  <p style={{margin:"8px 0 0",fontSize:12,color:"var(--muted)",lineHeight:1.6}}>
                                    The database will block refunds that would make the total refunded or committed amount exceed the order paid amount.
                                  </p>
                                </div>

                                <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
                                  <button style={primary} disabled={busy===request.id} onClick={()=>action(request,"approve_return")}>Approve Return & Refund</button>
                                  <button style={secondary} disabled={busy===request.id} onClick={()=>action(request,"reject")}>Reject</button>
                                </div>
                              </>
                            ) : (
                              <>
                                <div style={{marginBottom:12}}>
                                  <select value={sizes[request.id] ?? requestItems[0]?.requested_replacement_size ?? requestItems[0]?.approved_replacement_size ?? ""} onChange={(e)=>setSizes(v=>({...v,[request.id]:e.target.value}))} style={field}>
                                    <option value="">Replacement size</option>
                                    {["35","36","37","38","39","40","41","42"].map(size=><option key={size} value={size}>{size}</option>)}
                                  </select>
                                </div>
                                <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
                                  <button style={primary} disabled={busy===request.id} onClick={()=>action(request,"approve_replacement")}>Approve Replacement</button>
                                  <button style={secondary} disabled={busy===request.id} onClick={()=>action(request,"reject")}>Reject</button>
                                </div>
                              </>
                            )}
                          </>
                        )}

                        {["approved","replacement_approved"].includes(request.status) && (
                          <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
                            <button style={secondary} disabled={busy===request.id} onClick={()=>action(request,"mark_in_transit")}>Mark Return In Transit</button>
                            <button style={primary} disabled={busy===request.id} onClick={()=>action(request,"mark_received")}>Mark Returned Item Received</button>
                          </div>
                        )}

                        {request.status === "return_in_transit" && (
                          <button style={primary} disabled={busy===request.id} onClick={()=>action(request,"mark_received")}>Mark Returned Item Received</button>
                        )}

                        {request.status === "received" && request.request_type !== "replacement" && (
                          <button style={primary} disabled={busy===request.id} onClick={()=>action(request,"start_refund")}>Move to Refund Processing</button>
                        )}

                        {request.status === "received" && request.request_type === "replacement" && (
                          <button style={primary} disabled={busy===request.id} onClick={()=>action(request,"start_replacement")}>Process Replacement</button>
                        )}

                        {request.status === "refund_processing" && (
                          <div style={{padding:16,border:"1px solid var(--line)",background:"var(--cream)"}}>
                            <div style={{marginBottom:10}}>
                              <strong>Approved refund: {money(request.approved_refund_amount)}</strong>
                            </div>

                            {request.razorpay_refund_id ? (
                              <div style={{fontSize:13,lineHeight:1.7}}>
                                <div>Razorpay refund: <strong>{request.razorpay_refund_id}</strong></div>
                                <div>Status: <strong>{label(request.refund_status || "pending")}</strong></div>
                                {request.refund_reference && <div>Bank reference: <strong>{request.refund_reference}</strong></div>}
                                <p style={{margin:"10px 0 0",color:"var(--muted)"}}>
                                  The refund has already been submitted to Razorpay. It cannot be submitted again from this request.
                                </p>
                              </div>
                            ) : (
                              <>
                                <p style={{margin:"0 0 12px",fontSize:13,lineHeight:1.7,color:"var(--muted)"}}>
                                  This sends the approved amount through Razorpay to the same payment method used for the original order.
                                </p>
                                <button
                                  style={primary}
                                  disabled={busy===request.id}
                                  onClick={()=>processRefund(request)}
                                >
                                  {busy===request.id ? "Processing Refund…" : "Process Refund to Original Payment Source"}
                                </button>
                                {request.refund_error && (
                                  <p style={{margin:"12px 0 0",color:"#7c3f30",fontSize:13}}>
                                    Last refund error: {request.refund_error}
                                  </p>
                                )}
                              </>
                            )}
                          </div>
                        )}

                        {request.status === "refunded" && (
                          <div style={{padding:16,border:"1px solid var(--line)",background:"var(--cream)",fontSize:13,lineHeight:1.8}}>
                            <strong>Refunded to original payment source</strong>
                            <div>Amount: {money(request.refunded_amount)}</div>
                            <div>Razorpay refund: {request.razorpay_refund_id || "—"}</div>
                            {request.refund_reference && <div>Bank reference: {request.refund_reference}</div>}
                          </div>
                        )}

                        {request.status === "replacement_processing" && (
                          <div style={{display:"grid",gap:10}}>
                            <input
                              value={tracking[request.id]?.carrier || ""}
                              onChange={(e)=>setTracking(t=>({...t,[request.id]:{
                                carrier:e.target.value,
                                number:t[request.id]?.number || "",
                                url:t[request.id]?.url || ""
                              }}))}
                              placeholder="Replacement courier / carrier (e.g. Ekart)"
                              style={field}
                            />
                            <input
                              value={tracking[request.id]?.number || ""}
                              onChange={(e)=>setTracking(t=>({...t,[request.id]:{
                                carrier:t[request.id]?.carrier || "",
                                number:e.target.value,
                                url:t[request.id]?.url || ""
                              }}))}
                              placeholder="Replacement tracking / AWB number"
                              style={field}
                            />
                            <input
                              value={tracking[request.id]?.url || ""}
                              onChange={(e)=>setTracking(t=>({...t,[request.id]:{
                                carrier:t[request.id]?.carrier || "",
                                number:t[request.id]?.number || "",
                                url:e.target.value
                              }}))}
                              placeholder="Replacement tracking URL"
                              style={field}
                            />
                            <button style={primary} disabled={busy===request.id} onClick={()=>action(request,"mark_replacement_shipped")}>Mark Replacement Shipped</button>
                          </div>
                        )}

                        {request.status === "replacement_shipped" && (
                          <div>
                            <p>
                              Courier: {request.replacement_carrier || "—"}<br/>
                              Tracking: {request.replacement_tracking_number || "—"}
                            </p>
                            <button style={primary} disabled={busy===request.id} onClick={()=>action(request,"mark_replacement_delivered")}>Mark Replacement Delivered</button>
                          </div>
                        )}

                        {request.status === "replacement_delivered" && (
                          <p style={{padding:14,border:"1px solid var(--line)",background:"var(--cream)"}}>
                            Replacement delivered successfully.
                          </p>
                        )}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
