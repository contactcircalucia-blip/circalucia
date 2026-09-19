"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Order = {
  id: string;
  order_number: string;
  user_id: string | null;
  status: string;
  subtotal: number;
  shipping_amount: number;
  total_amount: number;
  currency: string;
  shipping_address: Record<string, unknown> | null;
  customer_notes: string | null;

  carrier: string | null;
  tracking_number: string | null;
  tracking_url: string | null;

  shipping_provider: string | null;
  shipped_at: string | null;
  delivered_at: string | null;

  created_at: string;
  updated_at: string;
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

function formatINR(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatStatus(status: string) {
  return status
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function Admin() {
  const [tab, setTab] = useState("Overview");

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const [shippingProvider, setShippingProvider] = useState<
    Record<string, string>
  >({});

  const [trackingNumber, setTrackingNumber] = useState<
    Record<string, string>
  >({});

  const [trackingUrl, setTrackingUrl] = useState<
    Record<string, string>
  >({});

  const [savingShipping, setSavingShipping] = useState<string | null>(
    null
  );

  const [expandedShipping, setExpandedShipping] = useState<
    Record<string, boolean>
  >({});

  async function loadOrders() {
    setLoading(true);
    setMessage("");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setMessage(
        "Please sign in to access the admin dashboard."
      );
      setLoading(false);
      return;
    }

    const { data: profile, error: profileError } =
      await supabase
        .from("profiles")
        .select("is_admin")
        .eq("id", user.id)
        .single();

    if (profileError || !profile?.is_admin) {
      setMessage("You do not have admin access.");
      setLoading(false);
      return;
    }

    const { data, error } =
      await supabase.rpc("admin_get_orders");

    if (error) {
      console.error(error);
      setMessage(error.message);
      setLoading(false);
      return;
    }

    const loadedOrders = (data || []) as Order[];

    setOrders(loadedOrders);

    const providerValues: Record<string, string> = {};
    const trackingValues: Record<string, string> = {};
    const trackingUrlValues: Record<string, string> = {};

    loadedOrders.forEach((order) => {
      /*
       * carrier is the new V2 field.
       *
       * shipping_provider is kept as a fallback so any
       * older shipping data already stored in your database
       * does not suddenly disappear from the admin UI.
       */
      providerValues[order.id] =
        order.carrier ||
        order.shipping_provider ||
        "";

      trackingValues[order.id] =
        order.tracking_number || "";

      trackingUrlValues[order.id] =
        order.tracking_url || "";
    });

    setShippingProvider(providerValues);
    setTrackingNumber(trackingValues);
    setTrackingUrl(trackingUrlValues);

    setLoading(false);
  }

  useEffect(() => {
    loadOrders();
  }, []);

  async function updateOrderStatus(
    orderId: string,
    newStatus: string,
    currentStatus: string
  ) {
    if (newStatus === currentStatus) {
      return;
    }

    const note = window.prompt(
      `Optional note for changing this order to "${formatStatus(
        newStatus
      )}":`
    );

    const { data, error } = await supabase.rpc(
      "admin_update_order_status",
      {
        p_order_id: orderId,
        p_new_status: newStatus,
        p_note: note || null,
      }
    );

    if (error) {
      console.error(error);

      if (error.message.includes("AUTH_REQUIRED")) {
        setMessage("Please sign in again.");
      } else if (
        error.message.includes("ADMIN_REQUIRED")
      ) {
        setMessage(
          "You do not have admin access."
        );
      } else if (
        error.message.includes("STATUS_ALREADY_SET")
      ) {
        setMessage(
          "This order already has that status."
        );
      } else if (
        error.message.includes("ORDER_NOT_FOUND")
      ) {
        setMessage("Order not found.");
      } else {
        setMessage(error.message);
      }

      return;
    }

    if (data?.success) {
      setMessage(
        `${data.order_number} updated to ${formatStatus(
          newStatus
        )}.`
      );

      await loadOrders();
    }
  }

  async function saveShippingDetails(
    orderId: string
  ) {
    setSavingShipping(orderId);
    setMessage("");

    const provider =
      shippingProvider[orderId] || "";

    const tracking =
      trackingNumber[orderId] || "";

    const url =
      trackingUrl[orderId] || "";

    /*
     * New secure V2 shipping function.
     *
     * This stores:
     * carrier
     * tracking_number
     * tracking_url
     */
    const { data, error } =
      await supabase.rpc(
        "admin_update_order_shipping",
        {
          p_order_id: orderId,
          p_carrier: provider,
          p_tracking_number: tracking,
          p_tracking_url: url,
        }
      );

    if (error) {
      console.error(error);

      if (
        error.message.includes(
          "AUTH_REQUIRED"
        )
      ) {
        setMessage(
          "Please sign in again."
        );
      } else if (
        error.message.includes(
          "ADMIN_REQUIRED"
        )
      ) {
        setMessage(
          "You do not have admin access."
        );
      } else if (
        error.message.includes(
          "ORDER_NOT_FOUND"
        )
      ) {
        setMessage(
          "Order not found."
        );
      } else {
        setMessage(error.message);
      }

      setSavingShipping(null);
      return;
    }

    if (data?.success) {
      setMessage(
        `${data.order_number} shipping details saved.`
      );

      await loadOrders();
    }

    setSavingShipping(null);
  }

  function toggleShipping(orderId: string) {
    setExpandedShipping((current) => ({
      ...current,
      [orderId]: !current[orderId],
    }));
  }

  const totalOrders = orders.length;

  const paidOrders = orders.filter(
    (order) =>
      order.status === "paid" ||
      order.status === "processing" ||
      order.status === "ready_to_ship" ||
      order.status === "shipped" ||
      order.status === "delivered"
  ).length;

  const pendingOrders = orders.filter(
    (order) =>
      order.status === "pending_payment"
  ).length;

  const deliveredOrders = orders.filter(
    (order) =>
      order.status === "delivered"
  ).length;

  return (
    <section className="section admin-page">
      <p className="eyebrow">
        PRIVATE ATELIER
      </p>

      <h1>Circa Lucia Admin</h1>

      <div className="admin-nav">
        {[
          "Overview",
          "Orders",
          "Products",
          "Customers",
          "Bespoke",
        ].map((item) => (
          <button
            key={item}
            onClick={() =>
              setTab(item)
            }
            className={
              tab === item
                ? "active"
                : ""
            }
          >
            {item}
          </button>
        ))}
      </div>

      {message && (
        <div className="admin-message">
          {message}
        </div>
      )}

      {loading ? (
        <p>Loading orders...</p>
      ) : (
        <>
          {tab === "Overview" && (
            <>
              <div className="admin-stats">
                <div>
                  <span>
                    Total orders
                  </span>

                  <strong>
                    {totalOrders}
                  </strong>
                </div>

                <div>
                  <span>
                    Paid / processing
                  </span>

                  <strong>
                    {paidOrders}
                  </strong>
                </div>

                <div>
                  <span>
                    Pending payment
                  </span>

                  <strong>
                    {pendingOrders}
                  </strong>
                </div>

                <div>
                  <span>
                    Delivered
                  </span>

                  <strong>
                    {deliveredOrders}
                  </strong>
                </div>
              </div>

              <div className="admin-table">
                <h2>
                  Recent orders
                </h2>

                {orders.length === 0 ? (
                  <p>
                    No orders yet.
                  </p>
                ) : (
                  orders
                    .slice(0, 10)
                    .map((order) => (
                      <div
                        className="table-row"
                        key={order.id}
                      >
                        <span>
                          {
                            order.order_number
                          }
                        </span>

                        <span>
                          {formatDate(
                            order.created_at
                          )}
                        </span>

                        <span>
                          {formatStatus(
                            order.status
                          )}
                        </span>

                        <span>
                          {formatINR(
                            order.total_amount
                          )}
                        </span>
                      </div>
                    ))
                )}
              </div>
            </>
          )}

          {tab === "Orders" && (
            <div className="admin-table">
              <h2>Orders</h2>

              {orders.length === 0 ? (
                <p>
                  No orders yet.
                </p>
              ) : (
                orders.map((order) => (
                  <div
                    className="admin-order-card"
                    key={order.id}
                  >
                    <div className="admin-order-header">
                      <div>
                        <strong>
                          {
                            order.order_number
                          }
                        </strong>

                        <span>
                          {formatDate(
                            order.created_at
                          )}
                        </span>
                      </div>

                      <strong>
                        {formatINR(
                          order.total_amount
                        )}
                      </strong>
                    </div>

                    <div className="admin-order-status">
                      <label>
                        Status
                      </label>

                      <select
                        value={
                          order.status
                        }
                        onChange={(
                          event
                        ) =>
                          updateOrderStatus(
                            order.id,
                            event.target
                              .value,
                            order.status
                          )
                        }
                      >
                        {STATUS_OPTIONS.map(
                          (status) => (
                            <option
                              key={
                                status
                              }
                              value={
                                status
                              }
                            >
                              {formatStatus(
                                status
                              )}
                            </option>
                          )
                        )}
                      </select>
                    </div>

                    <button
                      type="button"
                      className={`admin-shipping-toggle ${
                        expandedShipping[
                          order.id
                        ]
                          ? "open"
                          : ""
                      }`}
                      onClick={() =>
                        toggleShipping(
                          order.id
                        )
                      }
                    >
                      <span>
                        Shipping

                        {order.carrier ||
                        order.shipping_provider ||
                        order.tracking_number ? (
                          <small>
                            {order.carrier ||
                              order.shipping_provider ||
                              "Tracking added"}
                          </small>
                        ) : (
                          <small>
                            No shipping details yet
                          </small>
                        )}
                      </span>

                      <span className="admin-shipping-arrow">
                        {expandedShipping[
                          order.id
                        ]
                          ? "−"
                          : "+"}
                      </span>
                    </button>

                    {expandedShipping[
                      order.id
                    ] && (
                      <div className="admin-shipping-box">
                        <h3>
                          Shipping details
                        </h3>

                        <div className="admin-shipping-fields">
                          <div>
                            <label>
                              Shipping provider
                            </label>

                            <input
                              type="text"
                              placeholder="e.g. Delhivery"
                              value={
                                shippingProvider[
                                  order.id
                                ] || ""
                              }
                              onChange={(
                                event
                              ) =>
                                setShippingProvider(
                                  (
                                    current
                                  ) => ({
                                    ...current,
                                    [order.id]:
                                      event
                                        .target
                                        .value,
                                  })
                                )
                              }
                            />
                          </div>

                          <div>
                            <label>
                              Tracking / AWB number
                            </label>

                            <input
                              type="text"
                              placeholder="Enter tracking number"
                              value={
                                trackingNumber[
                                  order.id
                                ] || ""
                              }
                              onChange={(
                                event
                              ) =>
                                setTrackingNumber(
                                  (
                                    current
                                  ) => ({
                                    ...current,
                                    [order.id]:
                                      event
                                        .target
                                        .value,
                                  })
                                )
                              }
                            />
                          </div>

                          <div>
                            <label>
                              Tracking URL
                            </label>

                            <input
                              type="url"
                              placeholder="https://..."
                              value={
                                trackingUrl[
                                  order.id
                                ] || ""
                              }
                              onChange={(
                                event
                              ) =>
                                setTrackingUrl(
                                  (
                                    current
                                  ) => ({
                                    ...current,
                                    [order.id]:
                                      event
                                        .target
                                        .value,
                                  })
                                )
                              }
                            />
                          </div>
                        </div>

                        <button
                          type="button"
                          className="admin-save-shipping"
                          onClick={() =>
                            saveShippingDetails(
                              order.id
                            )
                          }
                          disabled={
                            savingShipping ===
                            order.id
                          }
                        >
                          {savingShipping ===
                          order.id
                            ? "Saving..."
                            : "Save shipping details"}
                        </button>

                        {order.shipped_at && (
                          <p className="admin-shipping-meta">
                            Shipped:{" "}
                            {formatDate(
                              order.shipped_at
                            )}
                          </p>
                        )}

                        {order.delivered_at && (
                          <p className="admin-shipping-meta">
                            Delivered:{" "}
                            {formatDate(
                              order.delivered_at
                            )}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {tab === "Products" && (
            <div className="admin-table">
              <h2>Products</h2>

              <p>
                Product management will be
                connected here next.
              </p>
            </div>
          )}

          {tab === "Customers" && (
            <div className="admin-table">
              <h2>Customers</h2>

              <p>
                Customer management will be
                connected here.
              </p>
            </div>
          )}

          {tab === "Bespoke" && (
            <div className="admin-table">
              <h2>
                Bespoke requests
              </h2>

              <p>
                Bespoke request management
                will be connected here.
              </p>
            </div>
          )}
        </>
      )}
    </section>
  );
}