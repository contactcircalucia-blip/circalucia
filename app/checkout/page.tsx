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

type SavedAddress = {
  id: string;
  full_name: string;
  phone: string;
  address_line_1: string;
  address_line_2: string | null;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  is_default: boolean;
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
  const [addressLine2, setAddressLine2] = useState("");
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [addingAddress, setAddingAddress] = useState(false);

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

        const { data: addressRows, error: addressError } = await supabase
          .from("addresses")
          .select("id, full_name, phone, address_line_1, address_line_2, city, state, postal_code, country, is_default")
          .eq("user_id", user.id)
          .order("is_default", { ascending: false })
          .order("created_at", { ascending: false });

        if (addressError) {
          console.error("Unable to load saved addresses:", addressError);
        } else if (addressRows?.length) {
          const rows = addressRows as SavedAddress[];
          setSavedAddresses(rows);
          const preferred = rows.find((item) => item.is_default) || rows[0];
          setSelectedAddressId(preferred.id);
          setFullName(preferred.full_name || profile?.full_name || "");
          setPhone(preferred.phone || profile?.phone || "");
          setAddress(preferred.address_line_1 || "");
          setAddressLine2(preferred.address_line_2 || "");
          setCity(preferred.city || "");
          setState(preferred.state || "");
          setPinCode(preferred.postal_code || "");
          setAddingAddress(false);
        } else {
          setAddingAddress(true);
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

  function chooseAddress(saved: SavedAddress) {
    setSelectedAddressId(saved.id);
    setAddingAddress(false);
    setFullName(saved.full_name || "");
    setPhone(saved.phone || "");
    setAddress(saved.address_line_1 || "");
    setAddressLine2(saved.address_line_2 || "");
    setCity(saved.city || "");
    setState(saved.state || "");
    setPinCode(saved.postal_code || "");
  }

  function startNewAddress() {
    setSelectedAddressId(null);
    setAddingAddress(true);
    setAddress("");
    setAddressLine2("");
    setCity("");
    setState("");
    setPinCode("");
  }

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

      // Save a newly entered address to this customer's Supabase address book.
      if (addingAddress || !selectedAddressId) {
        const { data: existingAddresses, error: existingError } = await supabase
          .from("addresses")
          .select("id")
          .eq("user_id", user.id)
          .limit(1);

        if (existingError) {
          console.error("Could not check saved addresses:", existingError);
          setErrorMessage("We couldn't verify your saved addresses. Please try again.");
          return;
        }

        const { data: insertedAddress, error: insertAddressError } = await supabase
          .from("addresses")
          .insert({
            user_id: user.id,
            full_name: fullName.trim(),
            phone: phone.trim(),
            address_line_1: address.trim(),
            address_line_2: addressLine2.trim() || null,
            city: city.trim(),
            state: state.trim(),
            postal_code: pinCode.trim(),
            country: "India",
            is_default: !existingAddresses?.length,
          })
          .select("id, full_name, phone, address_line_1, address_line_2, city, state, postal_code, country, is_default")
          .single();

        if (insertAddressError || !insertedAddress) {
          console.error("Address save error:", insertAddressError);
          setErrorMessage("Your address could not be saved. Please check your connection and try again.");
          return;
        }

        const newlySaved = insertedAddress as SavedAddress;
        setSavedAddresses((current) => [newlySaved, ...current]);
        setSelectedAddressId(newlySaved.id);
        setAddingAddress(false);
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

      /*
       * The order has been successfully created.
       */
      const createdOrder =
        data as OrderResult;

      console.log(
        "CHECKOUT: Order created, starting email request",
        createdOrder
      );

      setOrder(createdOrder);

      /*
       * Send the order confirmation email.
       *
       * IMPORTANT:
       * If the email fails, the order remains
       * successfully created.
       */
      const {
        data: sessionData,
      } =
        await supabase.auth.getSession();

      const accessToken =
        sessionData.session
          ?.access_token;

      console.log(
        "CHECKOUT: Session checked",
        {
          hasAccessToken:
            Boolean(accessToken),
          orderId:
            createdOrder.order_id,
        }
      );

      if (accessToken) {
        try {
          console.log(
            "CHECKOUT: Calling order confirmation email API"
          );

          const emailResponse =
            await fetch(
              "/api/email/order-confirmation",
              {
                method: "POST",
                headers: {
                  "Content-Type":
                    "application/json",
                },
                body: JSON.stringify({
                  orderId:
                    createdOrder.order_id,
                  accessToken:
                    accessToken,
                }),
              }
            );

          console.log(
            "CHECKOUT: Email API response",
            emailResponse.status
          );

          const emailResult =
            await emailResponse.json();

          console.log(
            "CHECKOUT: Email API result",
            emailResult
          );

          if (!emailResponse.ok) {
            console.error(
              "Order confirmation email failed:",
              emailResult
            );
          } else {
            console.log(
              "Order confirmation email sent successfully:",
              emailResult
            );
          }
        } catch (emailError) {
          console.error(
            "Unable to send order confirmation email:",
            emailError
          );
        }
      } else {
        console.error(
          "CHECKOUT: Unable to send order confirmation email: No access token found."
        );
      }

      /*
       * Clear the cart only after the order
       * has been successfully created.
       */
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
            border:
              "1px solid #d9d0c4",
            background:
              "#faf8f4",
          }}
        >
          <p
            style={{
              margin:
                "0 0 8px",
              color:
                "#716b64",
              fontSize:
                "11px",
              letterSpacing:
                "0.08em",
              textTransform:
                "uppercase",
            }}
          >
            Order number
          </p>

          <strong
            style={{
              fontSize:
                "20px",
              letterSpacing:
                "0.04em",
            }}
          >
            {order.order_number}
          </strong>
        </div>

        <p
          className="small-note"
          style={{
            marginTop:
              "22px",
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
            display:
              "flex",
            gap: "12px",
            flexWrap:
              "wrap",
            marginTop:
              "28px",
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
    (!userId ||
      cart.length === 0)
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
            marginTop:
              "28px",
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

          {savedAddresses.length > 0 && (
            <div style={{ marginBottom: "22px" }}>
              <p className="eyebrow" style={{ marginBottom: "12px" }}>DELIVERY ADDRESS</p>
              <div style={{ display: "grid", gap: "10px" }}>
                {savedAddresses.map((saved) => {
                  const isSelected = selectedAddressId === saved.id && !addingAddress;
                  return (
                    <button
                      key={saved.id}
                      type="button"
                      onClick={() => chooseAddress(saved)}
                      aria-pressed={isSelected}
                      style={{
                        display: "block", width: "100%", textAlign: "left",
                        padding: "14px 16px", cursor: "pointer",
                        border: isSelected ? "2px solid #141210" : "1px solid #d9d0c4",
                        background: isSelected ? "#f3eee6" : "#faf8f4",
                      }}
                    >
                      <span style={{ display: "flex", justifyContent: "space-between", gap: "12px" }}>
                        <strong>{saved.full_name}</strong>
                        <span aria-hidden="true">{isSelected ? "●" : "○"}</span>
                      </span>
                      <span style={{ display: "block", marginTop: "5px", fontSize: "13px", lineHeight: 1.5 }}>
                        {saved.address_line_1}{saved.address_line_2 ? `, ${saved.address_line_2}` : ""}<br />
                        {saved.city}, {saved.state} {saved.postal_code}<br />
                        {saved.phone}
                      </span>
                      {saved.is_default && <span style={{ display: "inline-block", marginTop: "6px", fontSize: "11px", letterSpacing: ".06em" }}>DEFAULT ADDRESS</span>}
                    </button>
                  );
                })}
                <button type="button" className="button" onClick={startNewAddress} style={{ width: "100%" }}>
                  + Add another address
                </button>
              </div>
            </div>
          )}

          {(addingAddress || savedAddresses.length === 0) && (
            <div style={{ marginBottom: "18px" }}>
              {savedAddresses.length > 0 && <p className="eyebrow">NEW DELIVERY ADDRESS</p>}
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

          <input
            className="input"
            placeholder="Apartment, suite, landmark (optional)"
            value={addressLine2}
            onChange={(event) => setAddressLine2(event.target.value)}
          />
          </div>
          )}

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
              resize:
                "vertical",
              minHeight:
                "110px",
            }}
          />
        </div>

        {errorMessage && (
          <div
            style={{
              marginTop:
                "18px",
              padding:
                "14px 16px",
              border:
                "1px solid #7a263a",
              background:
                "#faf8f4",
              color:
                "#7a263a",
              fontSize:
                "13px",
              lineHeight:
                1.5,
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
            display:
              "flex",
            flexDirection:
              "column",
            gap:
              "16px",
          }}
        >
          {cart.map(
            (item, index) => (
              <div
                key={`${item.slug}-${item.variantId ?? "default"}-${index}`}
                style={{
                  display:
                    "flex",
                  justifyContent:
                    "space-between",
                  gap:
                    "18px",
                  fontSize:
                    "13px",
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
                      Size{" "}
                      {item.size}
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
            height:
              "1px",
            background:
              "#d9d0c4",
            margin:
              "22px 0",
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
            height:
              "1px",
            background:
              "#d9d0c4",
            margin:
              "22px 0",
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
            marginTop:
              "14px",
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
          disabled={
            placingOrder
          }
          style={{
            width:
              "100%",
            marginTop:
              "20px",
            opacity:
              placingOrder
                ? 0.6
                : 1,
            cursor:
              placingOrder
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
            display:
              "block",
            marginTop:
              "14px",
            textAlign:
              "center",
            color:
              "#716b64",
            fontSize:
              "12px",
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