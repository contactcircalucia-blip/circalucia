"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
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

  shipping_address: {
    full_name?: string;
    email?: string;
    phone?: string;
    address?: string;
    city?: string;
    state?: string;
    pin_code?: string;
    country?: string;
  } | null;

  customer_notes: string | null;
  created_at: string;
};

type OrderItem = {
  id: string;
  product_id: string | null;
  product_name: string;
  quantity: number;
  unit_price: number;
  selected_size: string | null;
  selected_color: string | null;
  selected_material: string | null;
  selected_heel_height: string | null;
  customization: Record<string, unknown> | null;
};

type StatusHistory = {
  id: string;
  status: string;
  note: string | null;
  created_at: string;
};

const STATUS_FLOW = [
  "pending_payment",
  "paid",
  "processing",
  "ready_to_ship",
  "shipped",
  "delivered",
];

const STATUS_LABELS: Record<string, string> = {
  pending_payment: "Payment pending",
  paid: "Paid",
  processing: "Processing",
  ready_to_ship: "Ready to ship",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

export default function OrderDetailsPage() {
  const params = useParams();

  const orderId =
    typeof params.id === "string"
      ? params.id
      : "";

  const [order, setOrder] =
    useState<Order | null>(null);

  const [items, setItems] =
    useState<OrderItem[]>([]);

  const [statusHistory, setStatusHistory] =
    useState<StatusHistory[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [logged, setLogged] =
    useState(false);

  const [notFound, setNotFound] =
    useState(false);

  const [cancelling, setCancelling] =
    useState(false);

  const [showCancelBox, setShowCancelBox] =
    useState(false);

  const [cancelReason, setCancelReason] =
    useState("");

  const [cancelError, setCancelError] =
    useState("");

  async function loadOrder() {
    if (!orderId) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setLogged(false);
      setLoading(false);
      return;
    }

    setLogged(true);

    const {
      data: orderData,
      error: orderError,
    } = await supabase
      .from("orders")
      .select(
        "id, order_number, status, subtotal, shipping_amount, total_amount, currency, carrier, tracking_number, tracking_url, shipping_provider, shipping_address, customer_notes, created_at"
      )
      .eq("id", orderId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (orderError) {
      console.error(
        "Error loading order:",
        orderError
      );

      setNotFound(true);
      setLoading(false);
      return;
    }

    if (!orderData) {
      console.error(
        "Order not found for ID:",
        orderId
      );

      setNotFound(true);
      setLoading(false);
      return;
    }

    const {
      data: itemData,
      error: itemError,
    } = await supabase
      .from("order_items")
      .select(
        "id, product_id, product_name, quantity, unit_price, selected_size, selected_color, selected_material, selected_heel_height, customization"
      )
      .eq("order_id", orderId)
      .order("created_at", {
        ascending: true,
      });

    if (itemError) {
      console.error(
        "Error loading order items:",
        itemError
      );
    }

    const {
      data: historyData,
      error: historyError,
    } = await supabase
      .from("order_status_history")
      .select(
        "id, status, note, created_at"
      )
      .eq("order_id", orderId)
      .order("created_at", {
        ascending: true,
      });

    if (historyError) {
      console.error(
        "Error loading order status history:",
        historyError
      );
    }

    setOrder(orderData as Order);

    setItems(
      (itemData || []) as OrderItem[]
    );

    setStatusHistory(
      (historyData || []) as StatusHistory[]
    );

    setLoading(false);
  }

  useEffect(() => {
    loadOrder();
  }, [orderId]);

  function formatDate(date: string) {
    return new Intl.DateTimeFormat("en-IN", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(new Date(date));
  }

  function formatDateTime(date: string) {
    return new Intl.DateTimeFormat("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "numeric",
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
    return (
      STATUS_LABELS[status] ||
      status
        .replace(/_/g, " ")
        .replace(/\b\w/g, (letter) =>
          letter.toUpperCase()
        )
    );
  }

  function getHistoryEntry(
    status: string
  ) {
    return statusHistory.find(
      (entry) => entry.status === status
    );
  }

  function isStatusCompleted(
    status: string
  ) {
    if (!order) {
      return false;
    }

    if (order.status === "cancelled") {
      return false;
    }

    const currentIndex =
      STATUS_FLOW.indexOf(order.status);

    const statusIndex =
      STATUS_FLOW.indexOf(status);

    if (
      currentIndex === -1 ||
      statusIndex === -1
    ) {
      return false;
    }

    return statusIndex <= currentIndex;
  }

  function isCurrentStatus(
    status: string
  ) {
    return order?.status === status;
  }

  function canCancelOrder(
    status: string
  ) {
    return [
      "pending_payment",
      "paid",
      "processing",
    ].includes(status);
  }

  async function handleCancelOrder() {
    if (!order) {
      return;
    }

    const confirmed = window.confirm(
      "Are you sure you want to cancel this order?"
    );

    if (!confirmed) {
      return;
    }

    setCancelling(true);
    setCancelError("");

    const {
      data,
      error,
    } = await supabase.rpc(
      "cancel_my_order",
      {
        p_order_id: order.id,
        p_reason:
          cancelReason.trim() || null,
      }
    );

    if (error) {
      console.error(
        "Error cancelling order:",
        error
      );

      if (
        error.message.includes(
          "ORDER_CANNOT_BE_CANCELLED"
        )
      ) {
        setCancelError(
          "This order can no longer be cancelled because preparation or shipping has progressed."
        );
      } else if (
        error.message.includes(
          "ORDER_NOT_FOUND"
        )
      ) {
        setCancelError(
          "This order could not be found."
        );
      } else {
        setCancelError(
          "We could not cancel this order. Please try again."
        );
      }

      setCancelling(false);
      return;
    }

    if (!data?.success) {
      setCancelError(
        "We could not cancel this order."
      );

      setCancelling(false);
      return;
    }

    setShowCancelBox(false);
    setCancelReason("");
    setCancelling(false);

    await loadOrder();
  }

  if (loading) {
    return (
      <section className="section account-page">
        <p className="eyebrow">
          MY CIRCA LUCIA
        </p>

        <h1>Order details.</h1>

        <p>
          Loading your order...
        </p>
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
          Sign in to view this order.
        </h1>

        <p>
          Your order details are available
          only inside your private Circa Lucia
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

  if (notFound || !order) {
    return (
      <section className="section account-page">
        <p className="eyebrow">
          MY CIRCA LUCIA
        </p>

        <h1>Order not found.</h1>

        <p>
          We could not find this order in your
          account.
        </p>

        <a
          href="/account/orders"
          className="text-link"
        >
          ← Back to orders
        </a>
      </section>
    );
  }

  const address =
    order.shipping_address;

  /*
   * =========================================
   * SHIPPING / TRACKING
   * =========================================
   */

  const displayCarrier =
    order.carrier ||
    order.shipping_provider ||
    null;

  const normalizedCarrier =
    (displayCarrier || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");

  const isEkart =
    normalizedCarrier === "ekart" ||
    normalizedCarrier === "e-kart" ||
    normalizedCarrier === "ekart logistics";

  const generatedTrackingUrl =
    isEkart &&
    order.tracking_number
      ? `https://www.ekartlogistics.com/ekartlogistics-web/shipmenttrack/${encodeURIComponent(
          order.tracking_number
        )}`
      : null;

  const finalTrackingUrl =
    order.tracking_url ||
    generatedTrackingUrl;

  const hasTracking =
    Boolean(
      displayCarrier ||
      order.tracking_number ||
      finalTrackingUrl
    );

  return (
    <section className="section account-page">
      <div className="order-details-header">
        <div>
          <p className="eyebrow">
            MY CIRCA LUCIA
          </p>

          <h1>
            Order details.
          </h1>

          <p className="order-number-large">
            {order.order_number}
          </p>
        </div>

        <div className="order-status-large">
          <span>Status</span>

          <strong>
            {formatStatus(order.status)}
          </strong>
        </div>
      </div>

      <div className="order-meta">
        <div>
          <span>Order date</span>

          <strong>
            {formatDate(
              order.created_at
            )}
          </strong>
        </div>

        <div>
          <span>Order number</span>

          <strong>
            {order.order_number}
          </strong>
        </div>
      </div>

      {/* =========================================
          ORDER PROGRESS
          ========================================= */}

      <div className="order-section">
        <div className="order-section-heading">
          <p className="eyebrow">
            ORDER PROGRESS
          </p>
        </div>

        {order.status ===
        "cancelled" ? (
          <div className="order-cancelled">
            <div className="order-timeline-marker">
              ×
            </div>

            <div>
              <strong>
                Order cancelled
              </strong>

              {getHistoryEntry(
                "cancelled"
              ) && (
                <span>
                  {formatDateTime(
                    getHistoryEntry(
                      "cancelled"
                    )!.created_at
                  )}
                </span>
              )}

              {getHistoryEntry(
                "cancelled"
              )?.note && (
                <p>
                  {
                    getHistoryEntry(
                      "cancelled"
                    )!.note
                  }
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className="order-timeline">
            {STATUS_FLOW.map(
              (status, index) => {
                const historyEntry =
                  getHistoryEntry(
                    status
                  );

                const completed =
                  isStatusCompleted(
                    status
                  );

                const current =
                  isCurrentStatus(
                    status
                  );

                return (
                  <div
                    key={status}
                    className={`order-timeline-item ${
                      completed
                        ? "completed"
                        : ""
                    } ${
                      current
                        ? "current"
                        : ""
                    }`}
                  >
                    <div className="order-timeline-line">
                      {index <
                        STATUS_FLOW.length -
                          1 && <span />}
                    </div>

                    <div className="order-timeline-marker">
                      {completed
                        ? "✓"
                        : ""}
                    </div>

                    <div className="order-timeline-content">
                      <strong>
                        {formatStatus(
                          status
                        )}
                      </strong>

                      {historyEntry ? (
                        <span>
                          {formatDateTime(
                            historyEntry.created_at
                          )}
                        </span>
                      ) : (
                        <span>
                          Awaiting this stage
                        </span>
                      )}

                      {historyEntry?.note && (
                        <p>
                          {
                            historyEntry.note
                          }
                        </p>
                      )}
                    </div>
                  </div>
                );
              }
            )}
          </div>
        )}
      </div>

      {/* =========================================
          SHIPPING / TRACKING
          ========================================= */}

      {hasTracking && (
        <div className="order-section">
          <div className="order-section-heading">
            <p className="eyebrow">
              SHIPMENT
            </p>
          </div>

          <div className="customer-shipping-box">
            {displayCarrier && (
              <div className="customer-shipping-row">
                <span>
                  Carrier
                </span>

                <strong>
                  {displayCarrier}
                </strong>
              </div>
            )}

            {order.tracking_number && (
              <div className="customer-shipping-row">
                <span>
                  Tracking / AWB
                </span>

                <strong>
                  {order.tracking_number}
                </strong>
              </div>
            )}

            {finalTrackingUrl && (
              <a
                href={finalTrackingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="button button-dark customer-track-button"
              >
                Track shipment →
              </a>
            )}
          </div>
        </div>
      )}

      <div className="order-details-layout">
        <div className="order-details-main">
          <div className="order-section">
            <div className="order-section-heading">
              <p className="eyebrow">
                ITEMS
              </p>
            </div>

            <div className="order-items">
              {items.length === 0 ? (
                <p>
                  No items were found for
                  this order.
                </p>
              ) : (
                items.map((item) => (
                  <div
                    className="order-detail-item"
                    key={item.id}
                  >
                    <div className="order-item-info">
                      <h2>
                        {
                          item.product_name
                        }
                      </h2>

                      <div className="order-item-meta">
                        {item.selected_size && (
                          <span>
                            Size{" "}
                            {
                              item.selected_size
                            }
                          </span>
                        )}

                        {item.selected_color && (
                          <span>
                            Color{" "}
                            {
                              item.selected_color
                            }
                          </span>
                        )}

                        {item.selected_material && (
                          <span>
                            Material{" "}
                            {
                              item.selected_material
                            }
                          </span>
                        )}

                        {item.selected_heel_height && (
                          <span>
                            Heel{" "}
                            {
                              item.selected_heel_height
                            }
                          </span>
                        )}

                        <span>
                          Quantity{" "}
                          {item.quantity}
                        </span>
                      </div>
                    </div>

                    <div className="order-item-price">
                      {formatINR(
                        Number(
                          item.unit_price
                        ) *
                          item.quantity
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="order-section">
            <div className="order-section-heading">
              <p className="eyebrow">
                SHIPPING ADDRESS
              </p>
            </div>

            <div className="order-address">
              <strong>
                {address?.full_name ||
                  "Not available"}
              </strong>

              {address?.address && (
                <span>
                  {address.address}
                </span>
              )}

              {(address?.city ||
                address?.state ||
                address?.pin_code) && (
                <span>
                  {[
                    address.city,
                    address.state,
                    address.pin_code,
                  ]
                    .filter(Boolean)
                    .join(", ")}
                </span>
              )}

              {address?.country && (
                <span>
                  {address.country}
                </span>
              )}

              {address?.phone && (
                <span>
                  {address.phone}
                </span>
              )}

              {address?.email && (
                <span>
                  {address.email}
                </span>
              )}
            </div>
          </div>

          {order.customer_notes && (
            <div className="order-section">
              <div className="order-section-heading">
                <p className="eyebrow">
                  CUSTOMER NOTES
                </p>
              </div>

              <p className="order-notes">
                {order.customer_notes}
              </p>
            </div>
          )}
        </div>

        <aside className="order-summary">
          <p className="eyebrow">
            ORDER SUMMARY
          </p>

          <div className="summary-row">
            <span>Subtotal</span>

            <strong>
              {formatINR(
                Number(
                  order.subtotal
                )
              )}
            </strong>
          </div>

          <div className="summary-row">
            <span>Shipping</span>

            <strong>
              {Number(
                order.shipping_amount
              ) === 0
                ? "Free"
                : formatINR(
                    Number(
                      order.shipping_amount
                    )
                  )}
            </strong>
          </div>

          <div className="summary-total">
            <span>Total</span>

            <strong>
              {formatINR(
                Number(
                  order.total_amount
                )
              )}
            </strong>
          </div>
        </aside>
      </div>

      {/* =========================================
          ORDER CANCELLATION
          ========================================= */}

      {canCancelOrder(order.status) && (
        <div className="order-cancellation-card">
          {!showCancelBox ? (
            <>
              <p className="eyebrow">
                NEED TO CANCEL?
              </p>

              <p>
                You can cancel this order while
                it is still awaiting payment,
                paid, or being prepared.
              </p>

              <button
                type="button"
                className="button button-light"
                onClick={() => {
                  setShowCancelBox(true);
                  setCancelError("");
                }}
              >
                Cancel order
              </button>
            </>
          ) : (
            <>
              <p className="eyebrow">
                CANCEL ORDER
              </p>

              <h3>
                Are you sure you want to cancel
                this order?
              </h3>

              <p>
                Cancellation cannot be undone.
              </p>

              <label className="cancel-reason-label">
                Reason (optional)
              </label>

              <textarea
                className="cancel-reason-input"
                value={cancelReason}
                onChange={(event) =>
                  setCancelReason(
                    event.target.value
                  )
                }
                placeholder="Tell us why you are cancelling..."
                rows={4}
              />

              {cancelError && (
                <p className="order-cancel-error">
                  {cancelError}
                </p>
              )}

              <div className="cancel-actions">
                <button
                  type="button"
                  className="button button-dark"
                  onClick={
                    handleCancelOrder
                  }
                  disabled={cancelling}
                >
                  {cancelling
                    ? "Cancelling..."
                    : "Confirm cancellation"}
                </button>

                <button
                  type="button"
                  className="text-link"
                  onClick={() => {
                    setShowCancelBox(false);
                    setCancelReason("");
                    setCancelError("");
                  }}
                  disabled={cancelling}
                >
                  Keep my order
                </button>
              </div>
            </>
          )}
        </div>
      )}

      <div className="order-back">
        <a
          href="/account/orders"
          className="text-link"
        >
          ← Back to all orders
        </a>
      </div>
    </section>
  );
}