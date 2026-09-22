"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import AdminNav from "@/components/AdminNav";

type Order = {
  id: string;
  order_number: string | null;
  user_id: string | null;
  status: string | null;
  subtotal: number | null;
  shipping_amount: number | null;
  tax_amount?: number | null;
  discount_amount?: number | null;
  total_amount: number | null;
  currency: string | null;

  promotion_id?: string | null;
  promo_code?: string | null;

  payment_status?: string | null;
  razorpay_order_id?: string | null;
  razorpay_payment_id?: string | null;
  paid_at?: string | null;
  shipping_address: Record<string, any> | null;
  customer_notes: string | null;
  created_at: string;
  updated_at: string | null;

  carrier?: string | null;
  tracking_number?: string | null;
  tracking_url?: string | null;

  shipping_provider?: string | null;
  shipped_at?: string | null;
  delivered_at?: string | null;
};

type ReturnStatusInfo = {
  id: string;
  order_id: string;
  return_number: string;
  request_type: string;
  status: string;
  requested_at: string;
};

type OrderItem = {
  id: string;
  order_id: string;
  product_id: string | null;
  product_name: string | null;
  quantity: number;
  unit_price: number;
  selected_size: string | null;
  selected_color: string | null;
  selected_material: string | null;
  selected_heel_height: string | null;
  customization: Record<string, any> | null;
  created_at: string;
};

const STATUS_OPTIONS = [
  "pending_payment",
  "paid",
  "processing",
  "ready_to_ship",
  "shipped",
  "delivered",
  "cancelled",
];

const EMAIL_STATUS_OPTIONS = [
  "ready_to_ship",
  "shipped",
  "delivered",
  "cancelled",
];

function formatCurrency(value: number | null | undefined) {
  return `₹${Number(value || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";

  return new Date(value).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function getStatusLabel(status: string | null | undefined) {
  if (!status) return "Unknown";

  return status
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function getAddressLines(address: Record<string, any> | null) {
  if (!address) return [];

  return [
    address.full_name,
    address.address_line1,
    address.address_line2,
    address.landmark,
    address.city,
    address.state,
    address.postal_code,
    address.country,
    address.phone,
  ].filter(Boolean);
}

/*
 * Normalize a tracking URL so that:
 *
 * ekartlogistics.com/track/123
 *
 * becomes:
 *
 * https://ekartlogistics.com/track/123
 */
function normalizeTrackingUrl(value: string | null | undefined) {
  const trimmed = value?.trim() || "";

  if (!trimmed) return "";

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  return `https://${trimmed}`;
}

export default function AdminPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [returnStatuses, setReturnStatuses] = useState<Record<string, ReturnStatusInfo>>({});
  const [bespokeOrderIds, setBespokeOrderIds] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(
    null
  );

  const [orderItems, setOrderItems] = useState<Record<string, OrderItem[]>>(
    {}
  );

  const [itemsLoading, setItemsLoading] = useState<
    Record<string, boolean>
  >({});

  const [savingStatus, setSavingStatus] = useState<string | null>(null);

  const [shippingForm, setShippingForm] = useState<
    Record<
      string,
      {
        carrier: string;
        trackingNumber: string;
        trackingUrl: string;
      }
    >
  >({});

  const [savingShipping, setSavingShipping] = useState<string | null>(null);

  const [adminChecked, setAdminChecked] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  /*
   * ------------------------------------------------------------
   * AUTH / ADMIN CHECK
   * ------------------------------------------------------------
   */

  async function checkAdmin() {
    try {
      setError("");

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setIsAdmin(false);
        setAdminChecked(true);
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("is_admin")
        .eq("id", user.id)
        .single();

      if (profileError) {
        console.error(profileError);
        setIsAdmin(false);
        setAdminChecked(true);
        return;
      }

      setIsAdmin(profile?.is_admin === true);
      setAdminChecked(true);
    } catch (err) {
      console.error(err);
      setIsAdmin(false);
      setAdminChecked(true);
    }
  }

  /*
   * ------------------------------------------------------------
   * LOAD ORDERS
   * ------------------------------------------------------------
   */

  async function loadOrders() {
    try {
      setLoading(true);
      setError("");

      const { data, error: rpcError } = await supabase.rpc(
        "admin_get_orders"
      );

      if (rpcError) {
        console.error(rpcError);
        throw new Error(rpcError.message);
      }

      const loadedOrders = (data || []) as Order[];
      setOrders(loadedOrders);

      if (loadedOrders.length === 0) {
        setReturnStatuses({});
        setBespokeOrderIds({});
      } else {
        const orderIds = loadedOrders.map((order) => order.id);

        const { data: bespokeData, error: bespokeError } = await supabase
          .from("bespoke_requests")
          .select("order_id")
          .in("order_id", orderIds);

        if (bespokeError) {
          console.error(bespokeError);
          setBespokeOrderIds({});
        } else {
          const nextBespokeIds: Record<string, boolean> = {};
          for (const row of bespokeData || []) {
            if (row.order_id) nextBespokeIds[row.order_id] = true;
          }
          setBespokeOrderIds(nextBespokeIds);
        }

        const { data: returnData, error: returnError } = await supabase
          .from("return_requests")
          .select("id, order_id, return_number, request_type, status, requested_at")
          .in("order_id", orderIds)
          .order("requested_at", { ascending: false });

        if (returnError) {
          console.error(returnError);
          throw new Error(returnError.message);
        }

        const latestByOrder: Record<string, ReturnStatusInfo> = {};

        for (const row of (returnData || []) as ReturnStatusInfo[]) {
          if (!latestByOrder[row.order_id]) {
            latestByOrder[row.order_id] = row;
          }
        }

        setReturnStatuses(latestByOrder);
      }
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "Unable to load orders.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    checkAdmin();
  }, []);

  useEffect(() => {
    if (adminChecked && isAdmin) {
      loadOrders();
    } else if (adminChecked && !isAdmin) {
      setLoading(false);
    }
  }, [adminChecked, isAdmin]);

  /*
   * ------------------------------------------------------------
   * LOAD ORDER ITEMS
   * ------------------------------------------------------------
   */

  async function loadOrderItems(orderId: string) {
    if (orderItems[orderId]) return;

    try {
      setItemsLoading((previous) => ({
        ...previous,
        [orderId]: true,
      }));

      const { data, error: itemsError } = await supabase
        .from("order_items")
        .select("*")
        .eq("order_id", orderId)
        .order("created_at", { ascending: true });

      if (itemsError) {
        console.error(itemsError);
        throw new Error(itemsError.message);
      }

      setOrderItems((previous) => ({
        ...previous,
        [orderId]: (data || []) as OrderItem[],
      }));
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "Unable to load order items.");
    } finally {
      setItemsLoading((previous) => ({
        ...previous,
        [orderId]: false,
      }));
    }
  }

  function toggleOrder(orderId: string) {
    const isOpening = expandedOrderId !== orderId;

    setExpandedOrderId(isOpening ? orderId : null);

    if (isOpening) {
      loadOrderItems(orderId);
    }
  }

  /*
   * ------------------------------------------------------------
   * OPEN TRACKING
   * ------------------------------------------------------------
   */

  function openTrackingUrl(url: string | null | undefined) {
    const normalizedUrl = normalizeTrackingUrl(url);

    if (!normalizedUrl) {
      setError("No tracking URL has been saved for this shipment.");
      return;
    }

    try {
      const parsedUrl = new URL(normalizedUrl);

      if (!["http:", "https:"].includes(parsedUrl.protocol)) {
        throw new Error("Invalid tracking URL.");
      }

      window.open(
        parsedUrl.toString(),
        "_blank",
        "noopener,noreferrer"
      );
    } catch (err) {
      console.error("Invalid tracking URL:", err);

      setError(
        "The tracking URL is invalid. Please enter a complete URL such as https://example.com/track/123456."
      );
    }
  }

  /*
   * ------------------------------------------------------------
   * SEND ORDER STATUS EMAIL
   * ------------------------------------------------------------
   */

  async function sendOrderStatusEmail({
    orderId,
    orderNumber,
    status,
    note,
    trackingNumber,
    trackingUrl,
  }: {
    orderId: string;
    orderNumber: string | null;
    status: string;
    note?: string | null;
    trackingNumber?: string | null;
    trackingUrl?: string | null;
  }) {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        console.error(
          "Order status email failed: no active admin session."
        );

        setError(
          "The order was updated, but the customer email could not be sent because the admin session expired."
        );

        return false;
      }

      const response = await fetch("/api/email/order-status", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          accessToken: session.access_token,
          orderId,
          orderNumber,
          status,
          note: note || null,
          trackingNumber: trackingNumber || null,
          trackingUrl: normalizeTrackingUrl(trackingUrl),
        }),
      });

      const result = await response.json().catch(() => null);

      /*
       * IMPORTANT DEBUG LOGGING
       *
       * This prints the actual API response so we can see
       * exactly why the email failed.
       */
      if (!response.ok || !result?.success) {
        console.error(
          "========== ORDER STATUS EMAIL FAILED =========="
        );

        console.error(
          "HTTP status:",
          response.status
        );

        console.error(
          "API result:",
          JSON.stringify(result, null, 2)
        );

        console.error(
          "Order ID:",
          orderId
        );

        console.error(
          "Order number:",
          orderNumber
        );

        console.error(
          "Status:",
          status
        );

        console.error(
          "=============================================="
        );

        setError(
          result?.error
            ? `Customer email failed: ${result.error}`
            : "The order was updated, but the customer email could not be sent."
        );

        return false;
      }

      console.log(
        "Order status email sent successfully:",
        {
          orderNumber,
          status,
        }
      );

      return true;
    } catch (err) {
      console.error(
        "Order status email request failed:",
        err
      );

      setError(
        "The order was updated, but the customer email request failed."
      );

      return false;
    }
  }

  /*
   * ------------------------------------------------------------
   * UPDATE ORDER STATUS
   * ------------------------------------------------------------
   */

  async function updateOrderStatus(
    orderId: string,
    newStatus: string
  ) {
    try {
      setSavingStatus(orderId);
      setMessage("");
      setError("");

      /*
       * SHIPPED SAFETY CHECK
       */

      if (newStatus === "shipped") {
        const currentOrder = orders.find(
          (order) => order.id === orderId
        );

        if (!currentOrder) {
          throw new Error("Order not found.");
        }

        const currentShipping = getShippingForm(currentOrder);

        const savedTrackingNumber =
          currentOrder.tracking_number?.trim() || "";

        const savedTrackingUrl =
          currentOrder.tracking_url?.trim() || "";

        if (!savedTrackingNumber) {
          setError(
            "Please save the tracking number before marking this order as shipped."
          );
          return;
        }

        if (
          currentShipping.trackingNumber.trim() !==
          savedTrackingNumber
        ) {
          setError(
            'You have unsaved tracking changes. Please click "Save shipping" first, then mark the order as shipped.'
          );
          return;
        }

        if (
          currentShipping.trackingUrl.trim() !==
          savedTrackingUrl
        ) {
          setError(
            'You have unsaved tracking URL changes. Please click "Save shipping" first, then mark the order as shipped.'
          );
          return;
        }
      }

      const { data, error: rpcError } = await supabase.rpc(
        "admin_update_order_status",
        {
          p_order_id: orderId,
          p_new_status: newStatus,
          p_note: null,
        }
      );

      if (rpcError) {
        console.error(rpcError);
        throw new Error(rpcError.message);
      }

      if (!data) {
        throw new Error("Unable to update order status.");
      }

      /*
       * Reload orders so the email always uses
       * the latest database values.
       */

      const { data: freshOrders, error: reloadError } =
        await supabase.rpc("admin_get_orders");

      if (reloadError) {
        console.error(reloadError);
        throw new Error(reloadError.message);
      }

      const updatedOrders = (freshOrders || []) as Order[];

      setOrders(updatedOrders);

      if (updatedOrders.length > 0) {
        const { data: returnData, error: returnError } = await supabase
          .from("return_requests")
          .select("id, order_id, return_number, request_type, status, requested_at")
          .in("order_id", updatedOrders.map((order) => order.id))
          .order("requested_at", { ascending: false });

        if (returnError) {
          console.error(returnError);
        } else {
          const latestByOrder: Record<string, ReturnStatusInfo> = {};

          for (const row of (returnData || []) as ReturnStatusInfo[]) {
            if (!latestByOrder[row.order_id]) {
              latestByOrder[row.order_id] = row;
            }
          }

          setReturnStatuses(latestByOrder);
        }
      }

      /*
       * SEND CUSTOMER EMAIL
       */

      if (EMAIL_STATUS_OPTIONS.includes(newStatus)) {
        const updatedOrder = updatedOrders.find(
          (order) => order.id === orderId
        );

        if (!updatedOrder) {
          throw new Error(
            "Order was updated, but the refreshed order could not be found."
          );
        }

        if (
          newStatus === "shipped" &&
          !updatedOrder.tracking_number?.trim()
        ) {
          setError(
            `Order "${updatedOrder.order_number || updatedOrder.id}" was marked as shipped, but no tracking number was found in the database.`
          );

          return;
        }

        const emailSent = await sendOrderStatusEmail({
          orderId,
          orderNumber: updatedOrder.order_number || null,
          status: newStatus,
          note: updatedOrder.customer_notes || null,
          trackingNumber:
            updatedOrder.tracking_number || null,
          trackingUrl:
            updatedOrder.tracking_url || null,
        });

        if (emailSent) {
          if (newStatus === "shipped") {
            setMessage(
              `Order "${updatedOrder.order_number || updatedOrder.id}" marked as shipped and tracking email sent successfully.`
            );
          } else {
            setMessage(
              `Order status updated to "${getStatusLabel(
                newStatus
              )}" and customer notified.`
            );
          }
        } else {
          setMessage(
            `Order status updated to "${getStatusLabel(
              newStatus
            )}", but the customer email could not be sent.`
          );
        }
      } else {
        setMessage(
          `Order status updated to "${getStatusLabel(newStatus)}".`
        );
      }
    } catch (err: any) {
      console.error(err);

      if (
        typeof err?.message === "string" &&
        err.message.includes("STATUS_ALREADY_SET")
      ) {
        setError(
          "This order is already at that status. No duplicate email was sent."
        );
      } else {
        setError(
          err?.message || "Unable to update order status."
        );
      }
    } finally {
      setSavingStatus(null);
    }
  }

  /*
   * ------------------------------------------------------------
   * SHIPPING
   * ------------------------------------------------------------
   */

  function getShippingForm(order: Order) {
    return (
      shippingForm[order.id] || {
        carrier: order.carrier || "",
        trackingNumber: order.tracking_number || "",
        trackingUrl: order.tracking_url || "",
      }
    );
  }

  function updateShippingForm(
    orderId: string,
    field: "carrier" | "trackingNumber" | "trackingUrl",
    value: string
  ) {
    const order = orders.find((item) => item.id === orderId);

    if (!order) return;

    setShippingForm((previous) => ({
      ...previous,
      [orderId]: {
        ...getShippingForm(order),
        [field]: value,
      },
    }));
  }

  function generateTrackingUrl(
    carrier: string,
    trackingNumber: string
  ) {
    const cleanCarrier = carrier.trim().toLowerCase();
    const cleanTracking = trackingNumber.trim();

    if (!cleanTracking) return "";

    if (cleanCarrier === "ekart") {
      return `https://ekartlogistics.com/track/${encodeURIComponent(
        cleanTracking
      )}`;
    }

    return "";
  }

  async function saveShipping(orderId: string) {
    try {
      setSavingShipping(orderId);
      setMessage("");
      setError("");

      const order = orders.find((item) => item.id === orderId);

      if (!order) {
        throw new Error("Order not found.");
      }

      const form = getShippingForm(order);

      let trackingUrl = normalizeTrackingUrl(
        form.trackingUrl
      );

      /*
       * Automatically generate Ekart URL when URL is empty.
       */

      if (
        !trackingUrl &&
        form.carrier.trim().toLowerCase() === "ekart" &&
        form.trackingNumber.trim()
      ) {
        trackingUrl = generateTrackingUrl(
          form.carrier,
          form.trackingNumber
        );
      }

      /*
       * Validate tracking URL before saving.
       */

      if (trackingUrl) {
        try {
          const parsedUrl = new URL(trackingUrl);

          if (
            !["http:", "https:"].includes(
              parsedUrl.protocol
            )
          ) {
            throw new Error("Invalid protocol");
          }
        } catch {
          throw new Error(
            "Invalid tracking URL. Please enter a complete URL such as https://example.com/track/123456."
          );
        }
      }

      const { data, error: rpcError } = await supabase.rpc(
        "admin_update_order_shipping",
        {
          p_order_id: orderId,
          p_carrier: form.carrier.trim() || null,
          p_tracking_number:
            form.trackingNumber.trim() || null,
          p_tracking_url: trackingUrl || null,
        }
      );

      if (rpcError) {
        console.error(rpcError);
        throw new Error(rpcError.message);
      }

      if (!data) {
        throw new Error("Unable to update shipping details.");
      }

      setOrders((previous) =>
        previous.map((item) =>
          item.id === orderId
            ? {
                ...item,
                carrier: form.carrier.trim() || null,
                tracking_number:
                  form.trackingNumber.trim() || null,
                tracking_url: trackingUrl || null,
              }
            : item
        )
      );

      setShippingForm((previous) => ({
        ...previous,
        [orderId]: {
          carrier: form.carrier.trim(),
          trackingNumber: form.trackingNumber.trim(),
          trackingUrl,
        },
      }));

      setMessage(
        trackingUrl
          ? "Shipping details updated. Tracking link is ready."
          : "Shipping details updated."
      );
    } catch (err: any) {
      console.error(err);
      setError(
        err?.message || "Unable to update shipping details."
      );
    } finally {
      setSavingShipping(null);
    }
  }

  /*
   * ------------------------------------------------------------
   * FILTERING
   * ------------------------------------------------------------
   */

  const filteredOrders = useMemo(() => {
    const query = search.trim().toLowerCase();

    return orders.filter((order) => {
      const matchesStatus =
        statusFilter === "all" ||
        order.status === statusFilter;

      if (!matchesStatus) return false;

      if (!query) return true;

      const searchableText = [
        order.order_number,
        order.id,
        order.user_id,
        order.status,
        order.customer_notes,
        order.carrier,
        order.tracking_number,
        order.promo_code,
        order.payment_status,
        order.razorpay_order_id,
        order.razorpay_payment_id,
        returnStatuses[order.id]?.status,
        returnStatuses[order.id]?.return_number,
        returnStatuses[order.id]?.request_type,
        order.shipping_address?.full_name,
        order.shipping_address?.phone,
        order.shipping_address?.email,
        order.shipping_address?.city,
        order.shipping_address?.postal_code,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchableText.includes(query);
    });
  }, [orders, search, statusFilter, returnStatuses]);

  /*
   * ------------------------------------------------------------
   * STATS
   * ------------------------------------------------------------
   */

  const stats = useMemo(() => {
    const total = orders.length;

    const pending = orders.filter(
      (order) => order.status === "pending_payment"
    ).length;

    const paid = orders.filter(
      (order) => order.status === "paid"
    ).length;

    const processing = orders.filter(
      (order) => order.status === "processing"
    ).length;

    const readyToShip = orders.filter(
      (order) => order.status === "ready_to_ship"
    ).length;

    const shipped = orders.filter(
      (order) => order.status === "shipped"
    ).length;

    const delivered = orders.filter(
      (order) => order.status === "delivered"
    ).length;

    const cancelled = orders.filter(
      (order) => order.status === "cancelled"
    ).length;

    const revenue = orders
      .filter(
        (order) =>
          order.status !== "cancelled" &&
          order.status !== "pending_payment"
      )
      .reduce(
        (sum, order) => sum + Number(order.total_amount || 0),
        0
      );

    return {
      total,
      pending,
      paid,
      processing,
      readyToShip,
      shipped,
      delivered,
      cancelled,
      revenue,
    };
  }, [orders]);

  /*
   * ------------------------------------------------------------
   * AUTH LOADING
   * ------------------------------------------------------------
   */

  if (!adminChecked) {
    return (
      <main className="page">
        <section className="section">
          <div className="container">
            <p>Checking admin access...</p>
          </div>
        </section>
      </main>
    );
  }

  /*
   * ------------------------------------------------------------
   * NOT ADMIN
   * ------------------------------------------------------------
   */

  if (!isAdmin) {
    return (
      <main className="page">
        <section className="section">
          <div className="container">
            <div
              style={{
                maxWidth: "700px",
                margin: "80px auto",
                padding: "40px",
                border: "1px solid var(--line)",
                background: "var(--paper)",
              }}
            >
              <p
                style={{
                  marginBottom: "10px",
                  fontSize: "12px",
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  color: "var(--muted)",
                }}
              >
                Circa Lucia
              </p>

              <h1
                style={{
                  marginBottom: "14px",
                  fontFamily: "Cormorant Garamond, serif",
                  fontSize: "42px",
                  fontWeight: 500,
                }}
              >
                Admin access required
              </h1>

              <p
                style={{
                  color: "var(--muted)",
                  lineHeight: 1.7,
                }}
              >
                You do not have permission to access the Circa
                Lucia administration area.
              </p>
            </div>
          </div>
        </section>
      </main>
    );
  }

  /*
   * ------------------------------------------------------------
   * ADMIN PAGE
   * ------------------------------------------------------------
   */

  return (
    <main className="page">
      <section className="section">
        <div className="container">
          <div
            style={{
              display: "flex", justifyContent: "space-between",
              alignItems: "flex-end", gap: "20px",
              marginBottom: "22px", flexWrap: "wrap",
            }}
          >
            <div>
              <p style={{marginBottom:"8px",fontSize:"12px",letterSpacing:"0.16em",textTransform:"uppercase",color:"var(--muted)"}}>
                Circa Lucia · Administration
              </p>
              <h1 style={{margin:0,fontFamily:"Cormorant Garamond, serif",fontSize:"48px",fontWeight:500}}>
                Orders
              </h1>
            </div>
            <button type="button" onClick={loadOrders} disabled={loading}
              style={{padding:"12px 18px",border:"1px solid var(--line)",background:"transparent",cursor:loading?"not-allowed":"pointer",opacity:loading?0.6:1}}>
              {loading ? "Refreshing..." : "Refresh orders"}
            </button>
          </div>

          <AdminNav />

          {message && (
            <div
              style={{
                marginBottom: "20px",
                padding: "14px 16px",
                border: "1px solid var(--line)",
                background: "var(--cream)",
                fontSize: "14px",
              }}
            >
              {message}
            </div>
          )}

          {error && (
            <div
              style={{
                marginBottom: "20px",
                padding: "14px 16px",
                border: "1px solid #c7aaa0",
                background: "#faf1ee",
                color: "#7c3f30",
                fontSize: "14px",
              }}
            >
              {error}
            </div>
          )}

          {/* STATS */}

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(150px, 1fr))",
              gap: "12px",
              marginBottom: "35px",
            }}
          >
            {[
              ["Orders", stats.total],
              ["Paid", stats.paid],
              ["Processing", stats.processing],
              ["Ready to ship", stats.readyToShip],
              ["Shipped", stats.shipped],
              ["Delivered", stats.delivered],
            ].map(([label, value]) => (
              <div
                key={String(label)}
                style={{
                  border: "1px solid var(--line)",
                  padding: "20px",
                }}
              >
                <div
                  style={{
                    fontSize: "12px",
                    color: "var(--muted)",
                    marginBottom: "8px",
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                  }}
                >
                  {label}
                </div>

                <div style={{ fontSize: "28px" }}>
                  {value}
                </div>
              </div>
            ))}

            <div
              style={{
                border: "1px solid var(--line)",
                padding: "20px",
              }}
            >
              <div
                style={{
                  fontSize: "12px",
                  color: "var(--muted)",
                  marginBottom: "8px",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                }}
              >
                Revenue
              </div>

              <div style={{ fontSize: "24px" }}>
                {formatCurrency(stats.revenue)}
              </div>
            </div>
          </div>

          {/* SEARCH / FILTER */}

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "minmax(0, 1fr) 220px",
              gap: "12px",
              marginBottom: "25px",
            }}
          >
            <input
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Search order number, customer, phone, tracking..."
              style={{
                width: "100%",
                padding: "14px 16px",
                border: "1px solid var(--line)",
                background: "var(--paper)",
                outline: "none",
              }}
            />

            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value)
              }
              style={{
                width: "100%",
                padding: "14px 16px",
                border: "1px solid var(--line)",
                background: "var(--paper)",
              }}
            >
              <option value="all">All statuses</option>

              {STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>
                  {getStatusLabel(status)}
                </option>
              ))}
            </select>
          </div>

          {/* ORDERS */}

          {loading ? (
            <div
              style={{
                padding: "50px 0",
                color: "var(--muted)",
              }}
            >
              Loading orders...
            </div>
          ) : filteredOrders.length === 0 ? (
            <div
              style={{
                padding: "50px 0",
                color: "var(--muted)",
              }}
            >
              No orders found.
            </div>
          ) : (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "14px",
              }}
            >
              {filteredOrders.map((order) => {
                const expanded =
                  expandedOrderId === order.id;

                const items = orderItems[order.id] || [];

                const shipping = getShippingForm(order);
                const currentReturn = returnStatuses[order.id];

                return (
                  <article
                    key={order.id}
                    style={{
                      border: "1px solid var(--line)",
                      background: "var(--paper)",
                    }}
                  >
                    {/* ORDER HEADER */}

                    <button
                      type="button"
                      onClick={() =>
                        toggleOrder(order.id)
                      }
                      style={{
                        width: "100%",
                        border: "none",
                        background: "transparent",
                        textAlign: "left",
                        cursor: "pointer",
                        padding: "22px",
                      }}
                    >
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns:
                            "minmax(0, 1fr) auto",
                          gap: "20px",
                          alignItems: "center",
                        }}
                      >
                        <div>
                          <div
                            style={{
                              display: "flex",
                              gap: "12px",
                              alignItems: "center",
                              flexWrap: "wrap",
                              marginBottom: "8px",
                            }}
                          >
                            <strong
                              style={{
                                fontFamily:
                                  "Cormorant Garamond, serif",
                                fontSize: "24px",
                                fontWeight: 500,
                              }}
                            >
                              {order.order_number ||
                                order.id}
                            </strong>

                            <span
                              style={{
                                padding: "5px 9px",
                                border:
                                  "1px solid var(--line)",
                                fontSize: "11px",
                                textTransform:
                                  "uppercase",
                                letterSpacing:
                                  "0.06em",
                              }}
                            >
                              {getStatusLabel(
                                order.status
                              )}
                            </span>

                            {bespokeOrderIds[order.id] && (
                              <span
                                style={{
                                  padding: "5px 9px",
                                  border: "1px solid var(--ink)",
                                  background: "var(--ink)",
                                  color: "var(--paper)",
                                  fontSize: "11px",
                                  textTransform: "uppercase",
                                  letterSpacing: "0.08em",
                                  fontWeight: 600,
                                }}
                              >
                                Bespoke Order
                              </span>
                            )}

                            {currentReturn && (
                              <span
                                title={`Return request ${currentReturn.return_number}`}
                                style={{
                                  padding: "5px 9px",
                                  border: "1px solid var(--ink)",
                                  background: "var(--cream)",
                                  fontSize: "11px",
                                  textTransform: "uppercase",
                                  letterSpacing: "0.06em",
                                  fontWeight: 600,
                                }}
                              >
                                {currentReturn.request_type === "replacement"
                                  ? `Replacement · ${getStatusLabel(currentReturn.status)}`
                                  : `Return · ${getStatusLabel(currentReturn.status)}`}
                              </span>
                            )}
                          </div>

                          <div
                            style={{
                              fontSize: "13px",
                              color: "var(--muted)",
                            }}
                          >
                            {formatDate(
                              order.created_at
                            )}
                          </div>
                        </div>

                        <div
                          style={{
                            textAlign: "right",
                          }}
                        >
                          <div
                            style={{
                              fontSize: "12px",
                              color: "var(--muted)",
                              marginBottom: "5px",
                            }}
                          >
                            Total
                          </div>

                          <div
                            style={{
                              fontSize: "18px",
                            }}
                          >
                            {formatCurrency(
                              order.total_amount
                            )}
                          </div>
                        </div>
                      </div>
                    </button>

                    {expanded && (
                      <div
                        style={{
                          borderTop:
                            "1px solid var(--line)",
                          padding: "25px",
                        }}
                      >
                        {currentReturn && (
                          <div
                            style={{
                              padding: "16px 18px",
                              border: "1px solid var(--line)",
                              background: "var(--cream)",
                              marginBottom: "25px",
                              display: "flex",
                              justifyContent: "space-between",
                              gap: "16px",
                              alignItems: "center",
                              flexWrap: "wrap",
                            }}
                          >
                            <div>
                              <div
                                style={{
                                  fontSize: "11px",
                                  textTransform: "uppercase",
                                  letterSpacing: "0.1em",
                                  color: "var(--muted)",
                                  marginBottom: "5px",
                                }}
                              >
                                After-sales status
                              </div>
                              <strong>
                                {currentReturn.request_type === "replacement"
                                  ? "Replacement"
                                  : "Return & Refund"}{" "}
                                · {getStatusLabel(currentReturn.status)}
                              </strong>
                              <div style={{fontSize:"12px",color:"var(--muted)",marginTop:"5px"}}>
                                {currentReturn.return_number}
                              </div>
                            </div>

                            <Link
                              href="/admin/returns"
                              style={{
                                color: "var(--ink)",
                                fontSize: "12px",
                                textDecoration: "underline",
                                textUnderlineOffset: "4px",
                              }}
                            >
                              Open Returns & Replacements
                            </Link>
                          </div>
                        )}

                        {/* ORDER INFO */}

                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns:
                              "repeat(auto-fit, minmax(240px, 1fr))",
                            gap: "30px",
                            marginBottom: "35px",
                          }}
                        >
                          <div>
                            <h3
                              style={{
                                marginBottom: "14px",
                                fontSize: "12px",
                                textTransform:
                                  "uppercase",
                                letterSpacing:
                                  "0.12em",
                                color: "var(--muted)",
                              }}
                            >
                              Order
                            </h3>

                            <div
                              style={{
                                display: "flex",
                                flexDirection:
                                  "column",
                                gap: "7px",
                                fontSize: "14px",
                              }}
                            >
                              <div>
                                <strong>
                                  Order ID:
                                </strong>{" "}
                                {order.id}
                              </div>

                              <div>
                                <strong>
                                  User ID:
                                </strong>{" "}
                                {order.user_id || "Guest"}
                              </div>

                              <div>
                                <strong>
                                  Created:
                                </strong>{" "}
                                {formatDate(
                                  order.created_at
                                )}
                              </div>

                              <div>
                                <strong>
                                  Updated:
                                </strong>{" "}
                                {formatDate(
                                  order.updated_at
                                )}
                              </div>
                            </div>
                          </div>

                          <div>
                            <h3
                              style={{
                                marginBottom: "14px",
                                fontSize: "12px",
                                textTransform:
                                  "uppercase",
                                letterSpacing:
                                  "0.12em",
                                color: "var(--muted)",
                              }}
                            >
                              Amount
                            </h3>

                            <div
                              style={{
                                display: "flex",
                                flexDirection:
                                  "column",
                                gap: "7px",
                                fontSize: "14px",
                              }}
                            >
                              <div>
                                <strong>
                                  Subtotal:
                                </strong>{" "}
                                {formatCurrency(
                                  order.subtotal
                                )}
                              </div>

                              <div>
                                <strong>
                                  Shipping:
                                </strong>{" "}
                                {formatCurrency(
                                  order.shipping_amount
                                )}
                              </div>

                              <div>
                                <strong>
                                  Tax:
                                </strong>{" "}
                                {formatCurrency(
                                  order.tax_amount
                                )}
                              </div>

                              <div>
                                <strong>
                                  Promo discount:
                                </strong>{" "}
                                {order.promo_code
                                  ? `− ${formatCurrency(
                                      order.discount_amount
                                    )}`
                                  : formatCurrency(0)}
                              </div>

                              <div>
                                <strong>
                                  Final total:
                                </strong>{" "}
                                {formatCurrency(
                                  order.total_amount
                                )}
                              </div>

                              <div>
                                <strong>
                                  Currency:
                                </strong>{" "}
                                {order.currency ||
                                  "INR"}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* PROMOTION & PAYMENT */}

                        <div
                          style={{
                            padding: "20px",
                            border:
                              "1px solid var(--line)",
                            marginBottom: "25px",
                          }}
                        >
                          <h3
                            style={{
                              marginBottom: "15px",
                              fontSize: "12px",
                              textTransform:
                                "uppercase",
                              letterSpacing:
                                "0.12em",
                              color: "var(--muted)",
                            }}
                          >
                            Promotion & payment
                          </h3>

                          <div
                            style={{
                              display: "grid",
                              gridTemplateColumns:
                                "repeat(auto-fit, minmax(220px, 1fr))",
                              gap: "18px 30px",
                              fontSize: "14px",
                              lineHeight: 1.8,
                            }}
                          >
                            <div>
                              <div>
                                <strong>
                                  Promotion:
                                </strong>{" "}
                                {order.promo_code ? (
                                  <span
                                    style={{
                                      letterSpacing:
                                        "0.06em",
                                    }}
                                  >
                                    {order.promo_code}
                                  </span>
                                ) : (
                                  "No promotion used"
                                )}
                              </div>

                              {order.promo_code && (
                                <>
                                  <div>
                                    <strong>
                                      Discount:
                                    </strong>{" "}
                                    −{" "}
                                    {formatCurrency(
                                      order.discount_amount
                                    )}
                                  </div>

                                  <div>
                                    <strong>
                                      Promotion ID:
                                    </strong>{" "}
                                    {order.promotion_id ||
                                      "—"}
                                  </div>
                                </>
                              )}
                            </div>

                            <div>
                              <div>
                                <strong>
                                  Used by:
                                </strong>{" "}
                                {order.shipping_address
                                  ?.full_name ||
                                  "—"}
                              </div>

                              <div>
                                <strong>
                                  Customer email:
                                </strong>{" "}
                                {order.shipping_address
                                  ?.email || "—"}
                              </div>

                              <div>
                                <strong>
                                  Customer phone:
                                </strong>{" "}
                                {order.shipping_address
                                  ?.phone || "—"}
                              </div>

                              <div>
                                <strong>
                                  User ID:
                                </strong>{" "}
                                {order.user_id || "Guest"}
                              </div>
                            </div>

                            <div>
                              <div>
                                <strong>
                                  Payment:
                                </strong>{" "}
                                {getStatusLabel(
                                  order.payment_status ||
                                    "pending"
                                )}
                              </div>

                              <div>
                                <strong>
                                  Paid at:
                                </strong>{" "}
                                {formatDate(
                                  order.paid_at
                                )}
                              </div>

                              <div>
                                <strong>
                                  Razorpay order:
                                </strong>{" "}
                                {order.razorpay_order_id ||
                                  "—"}
                              </div>

                              <div>
                                <strong>
                                  Razorpay payment:
                                </strong>{" "}
                                {order.razorpay_payment_id ||
                                  "—"}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* STATUS */}

                        <div
                          style={{
                            padding: "20px",
                            border:
                              "1px solid var(--line)",
                            marginBottom: "25px",
                          }}
                        >
                          <h3
                            style={{
                              marginBottom: "15px",
                              fontSize: "12px",
                              textTransform:
                                "uppercase",
                              letterSpacing:
                                "0.12em",
                              color: "var(--muted)",
                            }}
                          >
                            Order status
                          </h3>

                          <div
                            style={{
                              display: "flex",
                              gap: "10px",
                              flexWrap: "wrap",
                            }}
                          >
                            <select
                              value={
                                order.status ||
                                "pending_payment"
                              }
                              disabled={
                                savingStatus ===
                                order.id
                              }
                              onChange={(event) =>
                                updateOrderStatus(
                                  order.id,
                                  event.target.value
                                )
                              }
                              style={{
                                minWidth: "220px",
                                padding:
                                  "12px 14px",
                                border:
                                  "1px solid var(--line)",
                                background:
                                  "var(--paper)",
                              }}
                            >
                              {STATUS_OPTIONS.map(
                                (status) => (
                                  <option
                                    key={status}
                                    value={status}
                                  >
                                    {getStatusLabel(
                                      status
                                    )}
                                  </option>
                                )
                              )}
                            </select>

                            {savingStatus ===
                              order.id && (
                              <span
                                style={{
                                  alignSelf: "center",
                                  fontSize: "13px",
                                  color:
                                    "var(--muted)",
                                }}
                              >
                                Updating...
                              </span>
                            )}
                          </div>

                          <p
                            style={{
                              marginTop: "12px",
                              fontSize: "12px",
                              color: "var(--muted)",
                              lineHeight: 1.6,
                            }}
                          >
                            Customer emails are sent
                            automatically for{" "}
                            <strong>
                              Ready to ship
                            </strong>
                            ,{" "}
                            <strong>Shipped</strong>,{" "}
                            <strong>Delivered</strong>{" "}
                            and{" "}
                            <strong>Cancelled</strong>.
                            Before marking an order as
                            Shipped, save its tracking
                            number and tracking URL.
                            Processing does not send an
                            automatic email. Payment
                            confirmation will be connected
                            to verified Razorpay payment
                            in V3.
                          </p>
                        </div>

                        {/* SHIPPING */}

                        {order.status === "ready_to_ship" && (


                        <div
                          style={{
                            padding: "20px",
                            border:
                              "1px solid var(--line)",
                            marginBottom: "25px",
                          }}
                        >
                          <h3
                            style={{
                              marginBottom: "15px",
                              fontSize: "12px",
                              textTransform:
                                "uppercase",
                              letterSpacing:
                                "0.12em",
                              color: "var(--muted)",
                            }}
                          >
                            Shipping
                          </h3>

                          <div
                            style={{
                              display: "grid",
                              gridTemplateColumns:
                                "repeat(auto-fit, minmax(200px, 1fr))",
                              gap: "12px",
                            }}
                          >
                            <input
                              value={shipping.carrier}
                              onChange={(event) =>
                                updateShippingForm(
                                  order.id,
                                  "carrier",
                                  event.target.value
                                )
                              }
                              placeholder="Carrier e.g. Ekart"
                              style={{
                                width: "100%",
                                padding:
                                  "12px 14px",
                                border:
                                  "1px solid var(--line)",
                                background:
                                  "var(--paper)",
                              }}
                            />

                            <input
                              value={
                                shipping.trackingNumber
                              }
                              onChange={(event) =>
                                updateShippingForm(
                                  order.id,
                                  "trackingNumber",
                                  event.target.value
                                )
                              }
                              placeholder="Tracking / AWB number"
                              style={{
                                width: "100%",
                                padding:
                                  "12px 14px",
                                border:
                                  "1px solid var(--line)",
                                background:
                                  "var(--paper)",
                              }}
                            />

                            <input
                              value={
                                shipping.trackingUrl
                              }
                              onChange={(event) =>
                                updateShippingForm(
                                  order.id,
                                  "trackingUrl",
                                  event.target.value
                                )
                              }
                              placeholder="Tracking URL"
                              style={{
                                width: "100%",
                                padding:
                                  "12px 14px",
                                border:
                                  "1px solid var(--line)",
                                background:
                                  "var(--paper)",
                              }}
                            />
                          </div>

                          <div
                            style={{
                              marginTop: "12px",
                              display: "flex",
                              gap: "10px",
                              alignItems: "center",
                              flexWrap: "wrap",
                            }}
                          >
                            <button
                              type="button"
                              onClick={() =>
                                saveShipping(order.id)
                              }
                              disabled={
                                savingShipping ===
                                order.id
                              }
                              style={{
                                padding:
                                  "11px 18px",
                                border:
                                  "1px solid var(--ink)",
                                background:
                                  "var(--ink)",
                                color:
                                  "var(--paper)",
                                cursor:
                                  savingShipping ===
                                  order.id
                                    ? "not-allowed"
                                    : "pointer",
                                opacity:
                                  savingShipping ===
                                  order.id
                                    ? 0.6
                                    : 1,
                              }}
                            >
                              {savingShipping ===
                              order.id
                                ? "Saving..."
                                : "Save shipping"}
                            </button>

                            {shipping.trackingUrl && (
                              <button
                                type="button"
                                onClick={() =>
                                  openTrackingUrl(
                                    shipping.trackingUrl
                                  )
                                }
                                style={{
                                  border: "none",
                                  background:
                                    "transparent",
                                  padding: 0,
                                  fontSize: "13px",
                                  color:
                                    "var(--ink)",
                                  cursor: "pointer",
                                  textDecoration:
                                    "underline",
                                  textUnderlineOffset:
                                    "3px",
                                }}
                              >
                                Open tracking
                              </button>
                            )}
                          </div>
                        </div>
                        )}

                        {/* CUSTOMER / SHIPPING ADDRESS */}

                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns:
                              "repeat(auto-fit, minmax(240px, 1fr))",
                            gap: "30px",
                            marginBottom: "35px",
                          }}
                        >
                          <div>
                            <h3
                              style={{
                                marginBottom: "14px",
                                fontSize: "12px",
                                textTransform:
                                  "uppercase",
                                letterSpacing:
                                  "0.12em",
                                color: "var(--muted)",
                              }}
                            >
                              Customer
                            </h3>

                            <div
                              style={{
                                fontSize: "14px",
                                lineHeight: 1.8,
                              }}
                            >
                              <div>
                                <strong>
                                  Name:
                                </strong>{" "}
                                {order.shipping_address
                                  ?.full_name ||
                                  "—"}
                              </div>

                              <div>
                                <strong>
                                  Email:
                                </strong>{" "}
                                {order.shipping_address
                                  ?.email || "—"}
                              </div>

                              <div>
                                <strong>
                                  Phone:
                                </strong>{" "}
                                {order.shipping_address
                                  ?.phone || "—"}
                              </div>
                            </div>
                          </div>

                          <div>
                            <h3
                              style={{
                                marginBottom: "14px",
                                fontSize: "12px",
                                textTransform:
                                  "uppercase",
                                letterSpacing:
                                  "0.12em",
                                color: "var(--muted)",
                              }}
                            >
                              Shipping address
                            </h3>

                            <div
                              style={{
                                fontSize: "14px",
                                lineHeight: 1.8,
                              }}
                            >
                              {getAddressLines(
                                order.shipping_address
                              ).map(
                                (
                                  line,
                                  index
                                ) => (
                                  <div key={index}>
                                    {line}
                                  </div>
                                )
                              )}

                              {getAddressLines(
                                order.shipping_address
                              ).length === 0 && (
                                <div
                                  style={{
                                    color:
                                      "var(--muted)",
                                  }}
                                >
                                  No shipping address
                                  available.
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* CUSTOMER NOTES */}

                        {order.customer_notes && (
                          <div
                            style={{
                              padding: "20px",
                              background:
                                "var(--cream)",
                              marginBottom: "30px",
                            }}
                          >
                            <h3
                              style={{
                                marginBottom: "10px",
                                fontSize: "12px",
                                textTransform:
                                  "uppercase",
                                letterSpacing:
                                  "0.12em",
                                color:
                                  "var(--muted)",
                              }}
                            >
                              Customer notes
                            </h3>

                            <p
                              style={{
                                margin: 0,
                                fontSize: "14px",
                                lineHeight: 1.7,
                              }}
                            >
                              {order.customer_notes}
                            </p>
                          </div>
                        )}

                        {/* ITEMS */}

                        <div>
                          <h3
                            style={{
                              marginBottom: "15px",
                              fontSize: "12px",
                              textTransform:
                                "uppercase",
                              letterSpacing:
                                "0.12em",
                              color: "var(--muted)",
                            }}
                          >
                            Order items
                          </h3>

                          {itemsLoading[order.id] ? (
                            <p
                              style={{
                                color:
                                  "var(--muted)",
                              }}
                            >
                              Loading items...
                            </p>
                          ) : items.length === 0 ? (
                            <p
                              style={{
                                color:
                                  "var(--muted)",
                              }}
                            >
                              No items found.
                            </p>
                          ) : (
                            <div
                              style={{
                                display: "flex",
                                flexDirection:
                                  "column",
                                gap: "10px",
                              }}
                            >
                              {items.map((item) => (
                                <div
                                  key={item.id}
                                  style={{
                                    border:
                                      "1px solid var(--line)",
                                    padding: "16px",
                                  }}
                                >
                                  <div
                                    style={{
                                      display:
                                        "flex",
                                      justifyContent:
                                        "space-between",
                                      gap: "20px",
                                      flexWrap:
                                        "wrap",
                                    }}
                                  >
                                    <div>
                                      <strong>
                                        {item.product_name ||
                                          "Product"}
                                      </strong>

                                      <div
                                        style={{
                                          marginTop:
                                            "7px",
                                          fontSize:
                                            "13px",
                                          color:
                                            "var(--muted)",
                                          lineHeight:
                                            1.7,
                                        }}
                                      >
                                        <div>
                                          Quantity:{" "}
                                          {
                                            item.quantity
                                          }
                                        </div>

                                        {item.selected_size && (
                                          <div>
                                            Size:{" "}
                                            {
                                              item.selected_size
                                            }
                                          </div>
                                        )}

                                        {item.selected_color && (
                                          <div>
                                            Color:{" "}
                                            {
                                              item.selected_color
                                            }
                                          </div>
                                        )}

                                        {item.selected_material && (
                                          <div>
                                            Material:{" "}
                                            {
                                              item.selected_material
                                            }
                                          </div>
                                        )}

                                        {item.selected_heel_height && (
                                          <div>
                                            Heel:{" "}
                                            {
                                              item.selected_heel_height
                                            }
                                          </div>
                                        )}
                                      </div>
                                    </div>

                                    <div
                                      style={{
                                        textAlign:
                                          "right",
                                      }}
                                    >
                                      <div>
                                        {formatCurrency(
                                          item.unit_price
                                        )}{" "}
                                        ×{" "}
                                        {
                                          item.quantity
                                        }
                                      </div>

                                      <div
                                        style={{
                                          marginTop:
                                            "5px",
                                          fontSize:
                                            "13px",
                                          color:
                                            "var(--muted)",
                                        }}
                                      >
                                        {formatCurrency(
                                          Number(
                                            item.unit_price ||
                                              0
                                          ) *
                                            Number(
                                              item.quantity ||
                                                0
                                            )
                                        )}
                                      </div>
                                    </div>
                                  </div>

                                  {item.customization &&
                                    (() => {
                                      const c =
                                        item.customization as Record<
                                          string,
                                          unknown
                                        >;

                                      const shipping =
                                        Number(
                                          c.line_shipping ??
                                            c.shipping_charge ??
                                            0
                                        ) || 0;
                                      const tax =
                                        Number(c.line_tax ?? 0) ||
                                        0;
                                      const taxPercent =
                                        Number(
                                          c.tax_percent ?? 0
                                        ) || 0;

                                      const internalKeys =
                                        new Set([
                                          "variant_id",
                                          "inventory_source",
                                          "shipping_charge",
                                          "line_shipping",
                                          "tax_percent",
                                          "line_tax",
                                        ]);

                                      const customerDetails =
                                        Object.entries(c).filter(
                                          ([key, value]) =>
                                            !internalKeys.has(
                                              key
                                            ) &&
                                            value !== null &&
                                            value !== undefined &&
                                            String(value).trim() !==
                                              ""
                                        );

                                      return (
                                        <div
                                          style={{
                                            marginTop:
                                              "14px",
                                            paddingTop:
                                              "14px",
                                            borderTop:
                                              "1px solid var(--line)",
                                            fontSize:
                                              "13px",
                                            lineHeight: 1.7,
                                          }}
                                        >
                                          <div
                                            style={{
                                              display:
                                                "grid",
                                              gridTemplateColumns:
                                                "repeat(auto-fit, minmax(160px, 1fr))",
                                              gap: "8px 24px",
                                              color:
                                                "var(--muted)",
                                            }}
                                          >
                                            <div>
                                              <strong
                                                style={{
                                                  color:
                                                    "var(--ink)",
                                                }}
                                              >
                                                Shipping:
                                              </strong>{" "}
                                              {formatCurrency(
                                                shipping
                                              )}
                                            </div>

                                            <div>
                                              <strong
                                                style={{
                                                  color:
                                                    "var(--ink)",
                                                }}
                                              >
                                                Tax:
                                              </strong>{" "}
                                              {formatCurrency(
                                                tax
                                              )}
                                              {taxPercent > 0
                                                ? ` (${taxPercent}%)`
                                                : ""}
                                            </div>
                                          </div>

                                          {customerDetails.length >
                                            0 && (
                                            <div
                                              style={{
                                                marginTop:
                                                  "12px",
                                              }}
                                            >
                                              <strong>
                                                Customer
                                                customization
                                              </strong>

                                              <div
                                                style={{
                                                  marginTop:
                                                    "6px",
                                                  display:
                                                    "grid",
                                                  gap: "4px",
                                                  color:
                                                    "var(--muted)",
                                                }}
                                              >
                                                {customerDetails.map(
                                                  ([
                                                    key,
                                                    value,
                                                  ]) => (
                                                    <div
                                                      key={
                                                        key
                                                      }
                                                    >
                                                      {key
                                                        .replace(
                                                          /_/g,
                                                          " "
                                                        )
                                                        .replace(
                                                          /\b\w/g,
                                                          (
                                                            char
                                                          ) =>
                                                            char.toUpperCase()
                                                        )}
                                                      :{" "}
                                                      {typeof value ===
                                                        "object"
                                                        ? JSON.stringify(
                                                            value
                                                          )
                                                        : String(
                                                            value
                                                          )}
                                                    </div>
                                                  )
                                                )}
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })()}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
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