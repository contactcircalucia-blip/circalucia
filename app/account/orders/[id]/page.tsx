"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Order = {
  id: string;
  order_number: string;
  status: string;
  payment_status: string;
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

type ReturnRequest = {
  id: string;
  return_number: string;
  request_type: string;
  status: string;
  reason: string;
  customer_notes: string | null;
  requested_refund_amount: number;
  approved_refund_amount: number | null;
  refunded_amount: number;
  requested_at: string;
  approved_at: string | null;
  rejected_at: string | null;
  received_at: string | null;
  refunded_at: string | null;
  replacement_carrier: string | null;
  replacement_tracking_number: string | null;
  replacement_tracking_url: string | null;
  replacement_shipped_at: string | null;
  replacement_delivered_at: string | null;
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

  const [returnRequests, setReturnRequests] =
    useState<ReturnRequest[]>([]);

  const [showReturnBox, setShowReturnBox] =
    useState(false);

  const [returnRequestType, setReturnRequestType] =
    useState<"return_refund" | "replacement">("return_refund");

  const [returnReason, setReturnReason] =
    useState("");

  const [returnNotes, setReturnNotes] =
    useState("");

  const [replacementSizes, setReplacementSizes] =
    useState<Record<string, string>>({});

  const [returnQuantities, setReturnQuantities] =
    useState<Record<string, number>>({});

  const [returnSubmitting, setReturnSubmitting] =
    useState(false);

  const [returnError, setReturnError] =
    useState("");

  const [returnSuccess, setReturnSuccess] =
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
        "id, order_number, status, payment_status, subtotal, shipping_amount, total_amount, currency, carrier, tracking_number, tracking_url, shipping_provider, shipping_address, customer_notes, created_at"
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

    const {
      data: returnData,
      error: returnError,
    } = await supabase
      .from("return_requests")
      .select(
        "id, return_number, request_type, status, reason, customer_notes, requested_refund_amount, approved_refund_amount, refunded_amount, requested_at, approved_at, rejected_at, received_at, refunded_at, replacement_carrier, replacement_tracking_number, replacement_tracking_url, replacement_shipped_at, replacement_delivered_at"
      )
      .eq("order_id", orderId)
      .eq("user_id", user.id)
      .order("requested_at", {
        ascending: false,
      });

    if (returnError) {
      console.error(
        "Error loading return requests:",
        returnError
      );
    }

    setReturnRequests(
      (returnData || []) as ReturnRequest[]
    );

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

  function formatReturnStatus(status: string) {
    const labels: Record<string, string> = {
      requested: "Requested",
      approved: "Approved",
      rejected: "Rejected",
      return_in_transit: "Return in transit",
      received: "Return received",
      refund_processing: "Refund in progress",
      refunded: "Refunded",
      replacement_approved: "Replacement approved",
      replacement_processing: "Replacement in progress",
      replacement_shipped: "Replacement shipped",
      replacement_delivered: "Replacement delivered",
      replacement_completed: "Replacement delivered",
      cancelled: "Cancelled",
    };

    return (
      labels[status] ||
      status
        .replace(/_/g, " ")
        .replace(/\b\w/g, (letter) =>
          letter.toUpperCase()
        )
    );
  }

  function getReturnProgress(request: ReturnRequest) {
    const isReplacement =
      request.request_type === "replacement";

    const steps = isReplacement
      ? [
          {
            key: "requested",
            title: "Requested",
            description:
              "Your replacement request has been submitted.",
          },
          {
            key: "approved",
            title: "Replacement approved",
            description:
              "Your replacement request has been approved.",
          },
          {
            key: "pickup",
            title: "Pickup arranged",
            description:
              "Your original item is being returned to CIRCA LUCIA.",
          },
          {
            key: "processing",
            title: "Replacement in progress",
            description:
              "Your replacement is being prepared.",
          },
          {
            key: "shipped",
            title: "Replacement shipped",
            description:
              "Your replacement is on the way.",
          },
          {
            key: "delivered",
            title: "Replacement delivered",
            description:
              "Your replacement has been delivered.",
          },
        ]
      : [
          {
            key: "requested",
            title: "Requested",
            description:
              "Your return request has been submitted.",
          },
          {
            key: "approved",
            title: "Return approved",
            description:
              "Your return and refund request has been approved.",
          },
          {
            key: "pickup",
            title: "Pickup arranged",
            description:
              "Your item is being returned to CIRCA LUCIA.",
          },
          {
            key: "processing",
            title: "Refund in progress",
            description:
              "Your refund is being processed.",
          },
          {
            key: "completed",
            title: "Refunded",
            description:
              "The approved amount has been refunded.",
          },
        ];

    const statusIndex: Record<string, number> = isReplacement
      ? {
          requested: 0,
          replacement_approved: 1,
          approved: 1,
          return_in_transit: 2,
          received: 2,
          replacement_processing: 3,
          replacement_shipped: 4,
          replacement_delivered: 5,
          replacement_completed: 5,
        }
      : {
          requested: 0,
          approved: 1,
          return_in_transit: 2,
          received: 2,
          refund_processing: 3,
          refunded: 4,
        };

    const currentIndex =
      statusIndex[request.status] ?? 0;

    return { steps, currentIndex };
  }

  function updateReturnQuantity(
    itemId: string,
    quantity: number
  ) {
    setReturnQuantities((current) => ({
      ...current,
      [itemId]: Math.max(0, quantity),
    }));
  }

  async function handleReturnRequest() {
    if (!order) {
      return;
    }

    setReturnError("");
    setReturnSuccess("");

    if (!returnReason.trim()) {
      setReturnError(
        "Please select a reason for your return."
      );
      return;
    }

    const selectedItems = items
      .map((item) => ({
        order_item_id: item.id,
        quantity: Math.min(
          item.quantity,
          Math.max(
            0,
            Number(returnQuantities[item.id] || 0)
          )
        ),
        replacement_size:
          returnRequestType === "replacement"
            ? replacementSizes[item.id] || item.selected_size || null
            : null,
      }))
      .filter((item) => item.quantity > 0);

    if (selectedItems.length === 0) {
      setReturnError(
        "Please select at least one item to return."
      );
      return;
    }

    setReturnSubmitting(true);

    const { data, error } = await supabase.rpc(
      "create_return_request",
      {
        p_order_id: order.id,
        p_items: selectedItems,
        p_reason: returnReason.trim(),
        p_customer_notes:
          returnNotes.trim() || null,
        p_request_type: returnRequestType,
      }
    );

    if (error) {
      console.error(
        "Error creating return request:",
        error
      );

      if (
        error.message.includes(
          "RETURN_QUANTITY_EXCEEDS_PURCHASED_QUANTITY"
        )
      ) {
        setReturnError(
          "One or more selected quantities have already been included in another active return request."
        );
      } else if (
        error.message.includes(
          "ORDER_NOT_ELIGIBLE_FOR_RETURN"
        )
      ) {
        setReturnError(
          "This order is not currently eligible for a return."
        );
      } else if (
        error.message.includes(
          "ONLY_PAID_ORDERS_CAN_BE_RETURNED"
        )
      ) {
        setReturnError(
          "Only paid orders can be returned."
        );
      } else if (
        error.message.includes(
          "RETURN_WINDOW_CLOSED"
        )
      ) {
        setReturnError(
          "The 7-day return and replacement window for this order has closed."
        );
      } else if (
        error.message.includes(
          "ORDER_NOT_DELIVERED"
        )
      ) {
        setReturnError(
          "Return or replacement requests become available only after delivery."
        );
      } else {
        setReturnError(
          "We could not submit your request. Please try again."
        );
      }

      setReturnSubmitting(false);
      return;
    }

    setReturnSuccess(
      `Return request ${data?.return_number || ""} has been submitted successfully.`
    );
    setReturnRequestType("return_refund");
    setReturnReason("");
    setReturnNotes("");
    setReturnQuantities({});
    setReplacementSizes({});
    setShowReturnBox(false);
    setReturnSubmitting(false);

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
  (order.status === "shipped" ||
    order.status === "delivered") &&
  Boolean(
    displayCarrier ||
    order.tracking_number ||
    finalTrackingUrl
  );

  const deliveredHistory =
    getHistoryEntry("delivered");

  const deliveredAt = deliveredHistory
    ? new Date(deliveredHistory.created_at)
    : null;

  const returnWindowEnds = deliveredAt
    ? new Date(
        deliveredAt.getTime() +
          7 * 24 * 60 * 60 * 1000
      )
    : null;

  const returnWindowOpen =
    order.status === "delivered" &&
    order.payment_status === "paid" &&
    Boolean(returnWindowEnds) &&
    Date.now() <=
      (returnWindowEnds?.getTime() || 0);

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

      {order.status !== "cancelled" &&
        order.payment_status !== "paid" && (
          <div className="payment-retry-card">
            <div>
              <p className="eyebrow">PAYMENT AWAITING</p>
              <h2>Complete your payment.</h2>
              <p>
                Your order has been created, but payment has not yet been
                confirmed. Continue securely to Razorpay to complete this order.
              </p>
            </div>

            <a
              href={`/payment/${encodeURIComponent(order.id)}`}
              className="button button-dark payment-retry-button"
            >
              Retry payment
            </a>
          </div>
        )}

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
          RETURNS & REPLACEMENTS
          ========================================= */}

      {order.status === "delivered" &&
        order.payment_status === "paid" && (
          <div className="return-refund-card">
            <p className="eyebrow">
              RETURNS & REPLACEMENTS
            </p>

            <h2>Need help with your order?</h2>

            <p>
              You can request a return and refund or a replacement
              within 7 days of delivery.
            </p>

            <div className="return-window-banner">
              <div>
                <strong>Return / replacement window</strong>
                <span>
                  {returnWindowEnds
                    ? returnWindowOpen
                      ? `Open until ${formatDateTime(
                          returnWindowEnds.toISOString()
                        )}`
                      : `Closed ${formatDateTime(
                          returnWindowEnds.toISOString()
                        )}`
                    : "Delivery date required"}
                </span>
              </div>

              <strong className={returnWindowOpen ? "window-open" : ""}>
                {returnWindowOpen ? "OPEN" : "CLOSED"}
              </strong>
            </div>

            {!returnWindowOpen && (
              <p className="return-window-closed">
                The 7-day return and replacement request window for
                this order has closed.
              </p>
            )}

            {returnSuccess && (
              <p className="return-success">
                {returnSuccess}
              </p>
            )}

            {returnWindowOpen && !showReturnBox && (
              <div className="return-action-grid">
                <div className="return-action-card">
                  <div>
                    <span className="return-action-icon">↩</span>
                    <h3>Return &amp; Refund</h3>
                    <p>
                      Send the product back and request a refund to
                      your original payment method.
                    </p>
                  </div>

                  <button
                    type="button"
                    className="button button-dark"
                    onClick={() => {
                      setReturnRequestType("return_refund");
                      setShowReturnBox(true);
                      setReturnError("");
                      setReturnSuccess("");
                    }}
                  >
                    Request Return
                  </button>
                </div>

                <div className="return-action-card">
                  <div>
                    <span className="return-action-icon">⇄</span>
                    <h3>Replacement</h3>
                    <p>
                      Request the same product in another size,
                      subject to availability.
                    </p>
                  </div>

                  <button
                    type="button"
                    className="button button-dark"
                    onClick={() => {
                      setReturnRequestType("replacement");
                      setShowReturnBox(true);
                      setReturnError("");
                      setReturnSuccess("");
                    }}
                  >
                    Request Replacement
                  </button>
                </div>
              </div>
            )}

            {returnRequests.length > 0 && (
              <div className="return-progress-area">
                <p className="eyebrow">
                  RETURN / REPLACEMENT PROGRESS
                </p>

                {returnRequests.map((request) => {
                  const progress =
                    getReturnProgress(request);

                  const isRejected =
                    request.status === "rejected";

                  return (
                    <div
                      className="return-progress-request"
                      key={request.id}
                    >
                      <div className="return-progress-header">
                        <div>
                          <strong>{request.return_number}</strong>
                          <span>
                            {request.request_type === "replacement"
                              ? "Replacement"
                              : "Return & refund"}
                          </span>
                        </div>

                        <strong>
                          {formatReturnStatus(request.status)}
                        </strong>
                      </div>

                      {isRejected ? (
                        <div className="return-rejected">
                          <strong>Request rejected</strong>
                          <span>
                            This request was reviewed and was not
                            approved.
                          </span>
                        </div>
                      ) : (
                        <div className="return-progress-timeline">
                          {progress.steps.map((step, index) => {
                            const completed =
                              index < progress.currentIndex;
                            const current =
                              index === progress.currentIndex;
                            const stepDate =
                              index === 0
                                ? request.requested_at
                                : index === 1
                                ? request.approved_at
                                : index === 2
                                ? request.received_at
                                : request.request_type === "replacement" &&
                                  index === 4
                                ? request.replacement_shipped_at
                                : request.request_type === "replacement" &&
                                  index === 5
                                ? request.replacement_delivered_at
                                : request.request_type !== "replacement" &&
                                  index === 4
                                ? request.refunded_at
                                : null;

                            return (
                              <div
                                className={`return-progress-step ${
                                  completed ? "completed" : ""
                                } ${current ? "current" : ""}`}
                                key={step.key}
                              >
                                <div className="return-progress-marker">
                                  {completed ? "✓" : index + 1}
                                </div>

                                <div className="return-progress-copy">
                                  <strong>{step.title}</strong>

                                  {stepDate && (
                                    <span>
                                      {formatDateTime(stepDate)}
                                    </span>
                                  )}

                                  <span>{step.description}</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {request.request_type === "replacement" &&
                        ["replacement_shipped", "replacement_delivered", "replacement_completed"].includes(request.status) && (
                          <div className="replacement-tracking-card">
                            <div>
                              <span>REPLACEMENT COURIER</span>
                              <strong>
                                {request.replacement_carrier || "Courier"}
                              </strong>
                            </div>

                            <div>
                              <span>TRACKING / AWB</span>
                              <strong>
                                {request.replacement_tracking_number || "—"}
                              </strong>
                            </div>

                            {request.replacement_tracking_url && (
                              <a
                                href={request.replacement_tracking_url}
                                target="_blank"
                                rel="noreferrer"
                                className="button button-dark"
                              >
                                Track Replacement
                              </a>
                            )}
                          </div>
                        )}

                      <div className="return-history-summary">
                        <span>
                          Requested {formatDateTime(request.requested_at)}
                        </span>
                        <span>Reason: {request.reason}</span>

                        {request.request_type !== "replacement" && (
                          <>
                            <span>
                              Requested refund:{" "}
                              {formatINR(
                                Number(
                                  request.requested_refund_amount
                                )
                              )}
                            </span>

                            {request.approved_refund_amount !== null && (
                              <span>
                                Approved:{" "}
                                {formatINR(
                                  Number(
                                    request.approved_refund_amount
                                  )
                                )}
                              </span>
                            )}

                            {Number(request.refunded_amount || 0) > 0 && (
                              <span>
                                Refunded:{" "}
                                {formatINR(
                                  Number(request.refunded_amount)
                                )}
                              </span>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {returnWindowOpen && showReturnBox && (
              <div className="return-form">
                <h2>
                  {returnRequestType === "replacement"
                    ? "Request replacement"
                    : "Request return & refund"}
                </h2>

                <p>
                  Select the item and quantity. CIRCA LUCIA will
                  review your request before approval.
                </p>

                <div className="return-choice">
                  <button
                    type="button"
                    className={
                      returnRequestType === "return_refund"
                        ? "active"
                        : ""
                    }
                    onClick={() =>
                      setReturnRequestType("return_refund")
                    }
                  >
                    Return & refund
                  </button>

                  <button
                    type="button"
                    className={
                      returnRequestType === "replacement"
                        ? "active"
                        : ""
                    }
                    onClick={() =>
                      setReturnRequestType("replacement")
                    }
                  >
                    Replacement
                  </button>
                </div>

                <div className="return-items">
                  {items.map((item) => (
                    <div
                      className="return-item-row"
                      key={item.id}
                    >
                      <div>
                        <strong>
                          {item.product_name}
                        </strong>

                        <span>
                          {item.selected_size
                            ? `Size ${item.selected_size} · `
                            : ""}
                          Purchased: {item.quantity}
                        </span>
                      </div>

                      <label>
                        Return qty
                        <select
                          value={
                            returnQuantities[item.id] || 0
                          }
                          onChange={(event) =>
                            updateReturnQuantity(
                              item.id,
                              Number(event.target.value)
                            )
                          }
                        >
                          {Array.from(
                            {
                              length: item.quantity + 1,
                            },
                            (_, index) => (
                              <option
                                key={index}
                                value={index}
                              >
                                {index}
                              </option>
                            )
                          )}
                        </select>
                      </label>

                      {returnRequestType === "replacement" &&
                        Number(
                          returnQuantities[item.id] || 0
                        ) > 0 && (
                          <label>
                            Replacement size
                            <select
                              value={
                                replacementSizes[item.id] ||
                                item.selected_size ||
                                ""
                              }
                              onChange={(event) =>
                                setReplacementSizes(
                                  (current) => ({
                                    ...current,
                                    [item.id]:
                                      event.target.value,
                                  })
                                )
                              }
                            >
                              <option value="">
                                Select size
                              </option>

                              {[
                                "35",
                                "36",
                                "37",
                                "38",
                                "39",
                                "40",
                                "41",
                                "42",
                              ].map((size) => (
                                <option
                                  key={size}
                                  value={size}
                                >
                                  {size}
                                </option>
                              ))}
                            </select>
                          </label>
                        )}
                    </div>
                  ))}
                </div>

                <label className="return-field">
                  <span>
                    {returnRequestType === "replacement"
                      ? "Reason for replacement"
                      : "Reason for return"}
                  </span>

                  <select
                    value={returnReason}
                    onChange={(event) =>
                      setReturnReason(event.target.value)
                    }
                  >
                    <option value="">
                      Select a reason
                    </option>
                    <option value="Size / fit issue">
                      Size / fit issue
                    </option>
                    <option value="Damaged item">
                      Damaged item
                    </option>
                    <option value="Wrong item received">
                      Wrong item received
                    </option>
                    <option value="Product differs from expectation">
                      Product differs from expectation
                    </option>
                    <option value="Quality issue">
                      Quality issue
                    </option>
                    <option value="Other">
                      Other
                    </option>
                  </select>
                </label>

                <label className="return-field">
                  <span>
                    Additional details (optional)
                  </span>

                  <textarea
                    value={returnNotes}
                    onChange={(event) =>
                      setReturnNotes(event.target.value)
                    }
                    placeholder="Tell us anything that will help us review your request..."
                    rows={4}
                  />
                </label>

                {returnError && (
                  <p className="return-error">
                    {returnError}
                  </p>
                )}

                <div className="return-actions">
                  <button
                    type="button"
                    className="button button-dark"
                    onClick={handleReturnRequest}
                    disabled={returnSubmitting}
                  >
                    {returnSubmitting
                      ? "Submitting..."
                      : returnRequestType === "replacement"
                      ? "Submit replacement request"
                      : "Submit return request"}
                  </button>

                  <button
                    type="button"
                    className="text-link"
                    disabled={returnSubmitting}
                    onClick={() => {
                      setShowReturnBox(false);
                      setReturnError("");
                      setReturnRequestType("return_refund");
                      setReturnReason("");
                      setReturnNotes("");
                      setReturnQuantities({});
                      setReplacementSizes({});
                    }}
                  >
                    Keep my order
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

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
                  className="button button-dark"
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

      <style jsx>{`
        .payment-retry-card {
          margin: 36px 0 0;
          padding: 28px 30px;
          border: 1px solid #d9d0c4;
          background: #faf8f4;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 32px;
        }

        .payment-retry-card h2 {
          margin: 10px 0 8px;
          font-size: clamp(28px, 3vw, 42px);
          line-height: 1;
          font-weight: 400;
          letter-spacing: -0.025em;
        }

        .payment-retry-card p:not(.eyebrow) {
          max-width: 620px;
          margin: 0;
          color: #716b64;
          font-size: 13px;
          line-height: 1.65;
        }

        .payment-retry-button {
          flex: 0 0 auto;
          min-width: 190px;
          text-align: center;
        }

        .return-refund-card {
          margin: 36px 0 0;
          padding: 30px;
          border: 1px solid #d9d0c4;
          background: #faf8f4;
        }

        .return-refund-card h2 {
          margin: 10px 0 10px;
          font-size: clamp(26px, 3vw, 38px);
          line-height: 1.05;
          font-weight: 400;
        }

        .return-window-banner {
          margin: 22px 0;
          padding: 18px 20px;
          border: 1px solid #ddd5ca;
          background: #fff;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 20px;
        }

        .return-window-banner > div {
          display: flex;
          flex-direction: column;
          gap: 5px;
        }

        .return-window-banner span {
          color: #716b64;
          font-size: 12px;
        }

        .return-window-banner > strong {
          font-size: 11px;
          letter-spacing: 0.12em;
        }

        .return-window-banner .window-open {
          padding: 7px 10px;
          border: 1px solid #1f1d1a;
        }

        .return-action-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 16px;
          margin: 24px 0 30px;
        }

        .return-action-card {
          min-height: 230px;
          padding: 24px;
          border: 1px solid #ddd5ca;
          background: #fff;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          gap: 24px;
        }

        .return-action-card h3 {
          margin: 8px 0 8px;
          font-size: 20px;
          font-weight: 500;
        }

        .return-action-card p {
          margin: 0;
          color: #716b64;
          font-size: 13px;
          line-height: 1.65;
        }

        .return-action-icon {
          display: inline-flex;
          width: 38px;
          height: 38px;
          align-items: center;
          justify-content: center;
          border: 1px solid #1f1d1a;
          border-radius: 50%;
          font-size: 20px;
        }

        .return-action-card .button {
          width: 100%;
          text-align: center;
        }

        .return-progress-area {
          margin: 34px 0 8px;
          padding-top: 28px;
          border-top: 1px solid #ddd5ca;
        }

        .return-progress-request {
          margin-top: 18px;
          padding: 22px;
          border: 1px solid #ddd5ca;
          background: #fff;
        }

        .return-progress-header {
          display: flex;
          justify-content: space-between;
          gap: 20px;
          padding-bottom: 18px;
          border-bottom: 1px solid #eee8df;
        }

        .return-progress-header > div {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .return-progress-header span {
          color: #716b64;
          font-size: 12px;
        }

        .return-progress-timeline {
          padding: 24px 0 4px;
        }

        .return-progress-step {
          position: relative;
          display: grid;
          grid-template-columns: 42px minmax(0, 1fr);
          gap: 16px;
          min-height: 92px;
        }

        .return-progress-step:not(:last-child)::before {
          content: "";
          position: absolute;
          left: 20px;
          top: 38px;
          bottom: -4px;
          width: 1px;
          background: #cfc6ba;
        }

        .return-progress-marker {
          position: relative;
          z-index: 1;
          width: 38px;
          height: 38px;
          border-radius: 50%;
          border: 1px solid #bdb5aa;
          background: #d5d0c9;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
        }

        .return-progress-step.completed .return-progress-marker,
        .return-progress-step.current .return-progress-marker {
          border-color: #1f1d1a;
          background: #1f1d1a;
          color: #fff;
        }

        .return-progress-step.current .return-progress-marker {
          box-shadow: 0 0 0 5px #f0ece5;
        }

        .return-progress-copy {
          display: flex;
          flex-direction: column;
          gap: 5px;
          padding-top: 5px;
        }

        .return-progress-copy strong {
          font-size: 17px;
          font-weight: 500;
        }

        .return-progress-copy span {
          color: #716b64;
          font-size: 12px;
          line-height: 1.5;
        }

        .replacement-tracking-card {
          margin: 4px 0 20px;
          padding: 18px;
          border: 1px solid #ddd5ca;
          background: #faf8f4;
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr)) auto;
          gap: 18px;
          align-items: center;
        }

        .replacement-tracking-card > div {
          display: flex;
          flex-direction: column;
          gap: 5px;
        }

        .replacement-tracking-card span {
          color: #716b64;
          font-size: 10px;
          letter-spacing: 0.12em;
        }

        .replacement-tracking-card strong {
          font-size: 14px;
          font-weight: 500;
        }

        .replacement-tracking-card .button {
          text-align: center;
          white-space: nowrap;
        }

        .return-history-summary {
          display: flex;
          flex-wrap: wrap;
          gap: 8px 18px;
          padding-top: 16px;
          border-top: 1px solid #eee8df;
        }

        .return-history-summary span {
          color: #716b64;
          font-size: 11px;
        }

        .return-rejected {
          margin: 20px 0;
          padding: 16px;
          border: 1px solid #c7aaa0;
          background: #faf1ee;
          display: flex;
          flex-direction: column;
          gap: 5px;
        }

        .return-rejected span {
          color: #716b64;
          font-size: 12px;
        }

        .return-refund-card > p:not(.eyebrow),
        .return-form > p {
          max-width: 700px;
          color: #716b64;
          line-height: 1.65;
        }

        .return-window-timeline {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          margin: 22px 0;
          border: 1px solid #ddd5ca;
          background: #fff;
        }

        .return-window-step {
          position: relative;
          min-width: 0;
          padding: 18px;
          border-right: 1px solid #e6dfd5;
        }

        .return-window-step:last-child {
          border-right: 0;
        }

        .return-window-step strong,
        .return-window-step span {
          display: block;
        }

        .return-window-step span {
          margin-top: 5px;
          color: #716b64;
          font-size: 11px;
          line-height: 1.5;
        }

        .return-window-step.completed strong::before {
          content: "✓ ";
        }

        .return-window-step.current {
          background: #f3efe8;
        }

        .return-window-closed {
          margin: 16px 0 !important;
          padding: 12px 14px;
          border: 1px solid #d9d0c4;
          background: #f4f1ec;
        }

        .return-choice {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
          margin-top: 20px;
        }

        .return-choice button {
          min-height: 48px;
          padding: 12px 16px;
          border: 1px solid #cfc6ba;
          background: #fff;
          color: inherit;
          cursor: pointer;
          font: inherit;
        }

        .return-choice button.active {
          border-color: #1f1d1a;
          background: #1f1d1a;
          color: #fff;
        }

        .return-history {
          margin: 22px 0 28px;
          padding: 20px;
          border: 1px solid #e2dbd1;
          background: #fff;
        }

        .return-history h3 {
          margin: 0 0 14px;
          font-size: 16px;
          font-weight: 500;
        }

        .return-history-item {
          display: flex;
          justify-content: space-between;
          gap: 24px;
          padding: 14px 0;
          border-top: 1px solid #eee8df;
        }

        .return-history-item:first-of-type {
          border-top: 0;
        }

        .return-history-item > div,
        .return-history-right {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .return-history-item span {
          color: #716b64;
          font-size: 12px;
        }

        .return-history-right {
          text-align: right;
        }

        .return-form {
          margin-top: 20px;
        }

        .return-items {
          margin: 22px 0;
          border-top: 1px solid #ddd5ca;
        }

        .return-item-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 24px;
          padding: 16px 0;
          border-bottom: 1px solid #ddd5ca;
        }

        .return-item-row > div {
          display: flex;
          flex-direction: column;
          gap: 5px;
        }

        .return-item-row span {
          color: #716b64;
          font-size: 12px;
        }

        .return-item-row label {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 12px;
        }

        .return-item-row select,
        .return-field select,
        .return-field textarea {
          border: 1px solid #cfc6ba;
          background: #fff;
          color: inherit;
          font: inherit;
        }

        .return-item-row select {
          min-width: 70px;
          padding: 9px;
        }

        .return-field {
          display: flex;
          flex-direction: column;
          gap: 8px;
          margin-top: 18px;
          font-size: 13px;
        }

        .return-field select,
        .return-field textarea {
          width: 100%;
          padding: 12px 14px;
        }

        .return-field textarea {
          resize: vertical;
        }

        .return-actions {
          display: flex;
          align-items: center;
          gap: 20px;
          margin-top: 22px;
        }

        .return-error {
          margin: 16px 0 0;
          color: #9c2f2f !important;
        }

        .return-success {
          margin: 16px 0 !important;
          padding: 12px 14px;
          border: 1px solid #b8c9b5;
          background: #f4f8f2;
          color: #365b34 !important;
        }

        @media (max-width: 700px) {
          .return-refund-card {
            padding: 22px 18px;
          }

          .return-window-timeline,
          .return-choice,
          .return-action-grid {
            grid-template-columns: 1fr;
          }

          .return-window-banner,
          .return-progress-header {
            align-items: flex-start;
            flex-direction: column;
          }

          .replacement-tracking-card {
            grid-template-columns: 1fr;
          }

          .replacement-tracking-card .button {
            width: 100%;
          }

          .return-window-step {
            border-right: 0;
            border-bottom: 1px solid #e6dfd5;
          }

          .return-window-step:last-child {
            border-bottom: 0;
          }

          .return-history-item,
          .return-item-row,
          .return-actions {
            align-items: stretch;
            flex-direction: column;
          }

          .return-history-right {
            text-align: left;
          }

          .return-item-row label {
            justify-content: space-between;
          }

          .return-actions .button {
            width: 100%;
          }

          .payment-retry-card {
            padding: 22px 18px;
            align-items: stretch;
            flex-direction: column;
          }

          .payment-retry-button {
            width: 100%;
          }
        }
      `}</style>
    </section>
  );
}