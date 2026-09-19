"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatINR } from "@/lib/products";
import { supabase } from "@/lib/supabase";

type CartItem = {
  slug: string;
  name: string;
  price: number;
  qty: number;
  variantId?: string;
  size?: string;
  stockQuantity?: number;
};

type OrderResult = {
  success: boolean;
  order_id: string;
  order_number: string;
  status: string;
  subtotal: number;
  shipping_amount: number;
  total_amount: number;
  currency: string;
};

export default function Checkout() {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [placingOrder, setPlacingOrder] = useState(false);

  const [userId, setUserId] = useState<string | null>(null);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [pinCode, setPinCode] = useState("");

  const [customerNotes, setCustomerNotes] = useState("");

  const [errorMessage, setErrorMessage] = useState("");

  const [order, setOrder] =
    useState<OrderResult | null>(null);

  useEffect(() => {
    async function loadCheckout() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          setErrorMessage(
            "Please log in before proceeding to checkout."
          );

          setLoading(false);
          return;
        }

        setUserId(user.id);

        setEmail(user.email || "");

        const savedCart = JSON.parse(
          localStorage.getItem("cl-cart") || "[]"
        );

        if (
          !Array.isArray(savedCart) ||
          savedCart.length === 0
        ) {
          setErrorMessage(
            "Your bag is empty. Please add a design before checking out."
          );

          setLoading(false);
          return;
        }

        setCart(savedCart);

        const { data: profile } =
          await supabase
            .from("profiles")
            .select("full_name, phone")
            .eq("id", user.id)
            .maybeSingle();

        if (profile) {
          setFullName(
            profile.full_name || ""
          );

          setPhone(
            profile.phone || ""
          );
        }
      } catch (error) {
        console.error(
          "Unable to load checkout:",
          error
        );

        setErrorMessage(
          "We couldn't load your checkout. Please try again."
        );
      } finally {
        setLoading(false);
      }
    }

    loadCheckout();
  }, []);

  const displayedSubtotal = cart.reduce(
    (sum, item) =>
      sum +
      Number(item.price || 0) *
        Number(item.qty || 0),
    0
  );

  const totalItems = cart.reduce(
    (sum, item) =>
      sum + Number(item.qty || 0),
    0
  );

  async function placeOrder() {
    if (placingOrder) {
      return;
    }

    setErrorMessage("");

    if (!userId) {
      setErrorMessage(
        "Please log in before placing your order."
      );

      return;
    }

    if (cart.length === 0) {
      setErrorMessage(
        "Your bag is empty."
      );

      return;
    }

    if (!fullName.trim()) {
      setErrorMessage(
        "Please enter your full name."
      );

      return;
    }

    if (!email.trim()) {
      setErrorMessage(
        "Please enter your email address."
      );

      return;
    }

    if (!phone.trim()) {
      setErrorMessage(
        "Please enter your phone number."
      );

      return;
    }

    if (!address.trim()) {
      setErrorMessage(
        "Please enter your shipping address."
      );

      return;
    }

    if (!city.trim()) {
      setErrorMessage(
        "Please enter your city."
      );

      return;
    }

    if (!state.trim()) {
      setErrorMessage(
        "Please enter your state."
      );

      return;
    }

    if (!pinCode.trim()) {
      setErrorMessage(
        "Please enter your PIN code."
      );

      return;
    }

    setPlacingOrder(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setErrorMessage(
          "Your login session has expired. Please log in again."
        );

        return;
      }

      const shippingAddress = {
        full_name: fullName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        address: address.trim(),
        city: city.trim(),
        state: state.trim(),
        pin_code: pinCode.trim(),
        country: "India",
      };

      const { data, error } =
        await supabase.rpc(
          "create_pending_order",
          {
            p_items: cart.map(
              (item) => ({
                slug: item.slug,
                name: item.name,
                price: item.price,
                qty: item.qty,
                variantId:
                  item.variantId,
                size: item.size,
              })
            ),

            p_shipping_address:
              shippingAddress,

            p_customer_notes:
              customerNotes.trim() ||
              null,
          }
        );

      if (error) {
        console.error(
          "Order creation error:",
          error
        );

        const message =
          error.message || "";

        if (
          message.includes(
            "INSUFFICIENT_STOCK"
          )
        ) {
          setErrorMessage(
            "One or more items no longer have enough stock. Please return to your bag and update it."
          );
        } else if (
          message.includes(
            "VARIANT_NOT_FOUND"
          )
        ) {
          setErrorMessage(
            "One of the selected variants is no longer available. Please return to your bag and select it again."
          );
        } else if (
          message.includes(
            "VARIANT_INACTIVE"
          )
        ) {
          setErrorMessage(
            "One of the selected variants is no longer available. Please return to your bag and select it again."
          );
        } else {
          setErrorMessage(
            "We couldn't create your order. Please try again."
          );
        }

        return;
      }

      if (!data || data.success !== true) {
        setErrorMessage(
          "We couldn't create your order. Please try again."
        );

        return;
      }

      setOrder(data as OrderResult);

      localStorage.removeItem(
        "cl-cart"
      );

      window.dispatchEvent(
        new Event("cl-cart-updated")
      );
    } catch (error) {
      console.error(
        "Unable to place order:",
        error
      );

      setErrorMessage(
        "Something went wrong while creating your order. Please try again."
      );
    } finally {
      setPlacingOrder(false);
    }
  }

  if (loading) {
    return (
      <section className="section">
        <p className="eyebrow">
          CHECKOUT
        </p>

        <h1>Loading...</h1>
      </section>
    );
  }

  if (order) {
    return (
      <section className="success-page section">
        <p className="eyebrow">
          ORDER RECEIVED
        </p>

        <h1>
          Thank you.
        </h1>

        <p>
          Your order has been created
          successfully.
        </p>

        <div
          style={{
            marginTop: "28px",
            padding: "22px",
            border: "1px solid #d9d0c4",
            background: "#faf8f4",
          }}
        >
          <p
            style={{
              margin: "0 0 8px",
              color: "#716b64",
              fontSize: "11px",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
            }}
          >
            Order number
          </p>

          <strong
            style={{
              fontSize: "20px",
              letterSpacing: "0.04em",
            }}
          >
            {order.order_number}
          </strong>
        </div>

        <p
          className="small-note"
          style={{
            marginTop: "22px",
          }}
        >
          Your order is currently
          awaiting payment. Payment
          gateway integration will be
          connected before launch. Once
          payment is confirmed, the
          atelier will begin preparing
          your pair.
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
            View my account
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

  if (
    errorMessage &&
    (!userId || cart.length === 0)
  ) {
    return (
      <section className="section">
        <p className="eyebrow">
          CHECKOUT
        </p>

        <h1>
          Checkout unavailable.
        </h1>

        <p className="page-intro">
          {errorMessage}
        </p>

        <Link
          href={
            userId
              ? "/cart"
              : "/account"
          }
          className="button button-dark"
        >
          {userId
            ? "Return to bag"
            : "Log in"}
        </Link>
      </section>
    );
  }

  return (
    <section className="section checkout-page">
      <div>
        <p className="eyebrow">
          CHECKOUT
        </p>

        <h1>
          Your details.
        </h1>

        <p className="page-intro">
          Please enter the details
          required for your order.
        </p>

        <div
          style={{
            marginTop: "28px",
          }}
        >
          <input
            className="input"
            placeholder="Full name"
            value={fullName}
            onChange={(event) =>
              setFullName(
                event.target.value
              )
            }
          />

          <input
            className="input"
            placeholder="Email"
            type="email"
            value={email}
            onChange={(event) =>
              setEmail(
                event.target.value
              )
            }
          />

          <input
            className="input"
            placeholder="Phone"
            value={phone}
            onChange={(event) =>
              setPhone(
                event.target.value
              )
            }
          />

          <input
            className="input"
            placeholder="Address"
            value={address}
            onChange={(event) =>
              setAddress(
                event.target.value
              )
            }
          />

          <div className="two-inputs">
            <input
              className="input"
              placeholder="City"
              value={city}
              onChange={(event) =>
                setCity(
                  event.target.value
                )
              }
            />

            <input
              className="input"
              placeholder="State"
              value={state}
              onChange={(event) =>
                setState(
                  event.target.value
                )
              }
            />
          </div>

          <input
            className="input"
            placeholder="PIN code"
            value={pinCode}
            onChange={(event) =>
              setPinCode(
                event.target.value
              )
            }
          />

          <textarea
            className="input"
            placeholder="Order notes (optional)"
            value={customerNotes}
            onChange={(event) =>
              setCustomerNotes(
                event.target.value
              )
            }
            rows={4}
            style={{
              resize: "vertical",
              minHeight: "110px",
            }}
          />
        </div>

        {errorMessage && (
          <div
            style={{
              marginTop: "18px",
              padding: "14px 16px",
              border: "1px solid #7a263a",
              background: "#faf8f4",
              color: "#7a263a",
              fontSize: "13px",
              lineHeight: 1.5,
            }}
          >
            {errorMessage}
          </div>
        )}
      </div>

      <aside className="summary">
        <p className="eyebrow">
          ORDER SUMMARY
        </p>

        <h2>
          Your order
        </h2>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "16px",
          }}
        >
          {cart.map(
            (item, index) => (
              <div
                key={`${item.slug}-${item.variantId ?? "default"}-${index}`}
                style={{
                  display: "flex",
                  justifyContent:
                    "space-between",
                  gap: "18px",
                  fontSize: "13px",
                }}
              >
                <div>
                  <strong>
                    {item.name}
                  </strong>

                  {item.size && (
                    <p
                      style={{
                        margin:
                          "4px 0 0",
                        color:
                          "#716b64",
                        fontSize:
                          "11px",
                      }}
                    >
                      Size {item.size}
                    </p>
                  )}

                  <p
                    style={{
                      margin:
                        "4px 0 0",
                      color:
                        "#716b64",
                      fontSize:
                        "11px",
                    }}
                  >
                    Quantity{" "}
                    {item.qty}
                  </p>
                </div>

                <strong>
                  {formatINR(
                    item.price *
                      item.qty
                  )}
                </strong>
              </div>
            )
          )}
        </div>

        <div
          style={{
            height: "1px",
            background: "#d9d0c4",
            margin: "22px 0",
          }}
        />

        <div className="billing-line">
          <span>
            Items ({totalItems})
          </span>

          <span>
            {formatINR(
              displayedSubtotal
            )}
          </span>
        </div>

        <div className="billing-line">
          <span>
            Subtotal
          </span>

          <span>
            {formatINR(
              displayedSubtotal
            )}
          </span>
        </div>

        <div className="billing-line muted">
          <span>
            Shipping
          </span>

          <span>
            To be calculated
          </span>
        </div>

        <div className="billing-line muted">
          <span>
            Taxes
          </span>

          <span>
            To be calculated
          </span>
        </div>

        <div
          style={{
            height: "1px",
            background: "#d9d0c4",
            margin: "22px 0",
          }}
        />

        <div className="billing-total">
          <span>
            Current total
          </span>

          <strong>
            {formatINR(
              displayedSubtotal
            )}
          </strong>
        </div>

        <p
          className="small-note"
          style={{
            marginTop: "14px",
          }}
        >
          Payment is not connected
          yet. Placing this order
          creates a pending-payment
          order only.
        </p>

        <button
          type="button"
          className="button button-dark"
          onClick={placeOrder}
          disabled={placingOrder}
          style={{
            width: "100%",
            marginTop: "20px",
            opacity: placingOrder
              ? 0.6
              : 1,
            cursor: placingOrder
              ? "wait"
              : "pointer",
          }}
        >
          {placingOrder
            ? "Creating order..."
            : "Place order"}
        </button>

        <Link
          href="/cart"
          style={{
            display: "block",
            marginTop: "14px",
            textAlign: "center",
            color: "#716b64",
            fontSize: "12px",
            textDecoration:
              "underline",
            textUnderlineOffset:
              "3px",
          }}
        >
          Return to bag
        </Link>
      </aside>
    </section>
  );
}