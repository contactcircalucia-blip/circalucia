"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatINR } from "@/lib/products";
import { supabase } from "@/lib/supabase";

type Item = {
  productId?: string;
  slug: string;
  name: string;
  price: number;
  qty: number;
  variantId?: string;
  size?: string;
  stockQuantity?: number;
  image?: string;
};

type AppliedPromo = {
  promotionId: string;
  code: string;
  discountType: "percentage" | "fixed";
  discountValue: number;
  discountAmount: number;
  minimumOrderValue: number;
  maximumDiscount: number | null;
};

type AvailablePromo = {
  promotionId: string;
  code: string;
  description: string | null;
  discountType: "percentage" | "fixed";
  discountValue: number;
  minimumOrderValue: number;
  maximumDiscount: number | null;
  discountAmount: number;
};

export default function Cart() {
  const [items, setItems] = useState<Item[]>([]);

  const [promoCode, setPromoCode] = useState("");
  const [appliedPromo, setAppliedPromo] =
    useState<AppliedPromo | null>(null);

  const [promoMessage, setPromoMessage] =
    useState("");

  const [promoError, setPromoError] =
    useState(false);

  const [promoLoading, setPromoLoading] =
    useState(false);

  const [promoListOpen, setPromoListOpen] =
    useState(false);

  const [availablePromos, setAvailablePromos] =
    useState<AvailablePromo[]>([]);

  const [promoListLoaded, setPromoListLoaded] =
    useState(false);


  async function syncCartToSupabase(
    updatedItems: Item[]
  ) {
    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        console.error(
          "Unable to get customer for bag sync:",
          userError.message,
          userError.code
        );
        return;
      }

      if (!user) {
        return;
      }

      const now = new Date().toISOString();

      const { data: bag, error: bagError } =
        await supabase
          .from("customer_bags")
          .upsert(
            {
              user_id: user.id,
              updated_at: now,
            },
            {
              onConflict: "user_id",
            }
          )
          .select("id")
          .single();

      if (bagError || !bag) {
        console.error(
          "Unable to sync customer bag:",
          bagError?.message,
          bagError?.code,
          bagError?.details,
          bagError?.hint
        );
        return;
      }

      const { error: deleteError } =
        await supabase
          .from("customer_bag_items")
          .delete()
          .eq("bag_id", bag.id);

      if (deleteError) {
        console.error(
          "Unable to refresh customer bag items:",
          deleteError.message,
          deleteError.code,
          deleteError.details,
          deleteError.hint
        );
        return;
      }

      if (updatedItems.length === 0) {
        return;
      }

      const rows = updatedItems.map((item) => ({
        bag_id: bag.id,
        product_id: item.productId ?? null,
        slug: item.slug,
        product_name: item.name,
        selected_size: item.size ?? null,
        quantity: Math.max(1, Number(item.qty || 1)),
        unit_price: Number(item.price || 0),
        image_url: item.image ?? null,
        updated_at: now,
      }));

      const { error: insertError } =
        await supabase
          .from("customer_bag_items")
          .insert(rows);

      if (insertError) {
        console.error(
          "Unable to save customer bag items:",
          insertError.message,
          insertError.code,
          insertError.details,
          insertError.hint
        );

        console.error(
          "Customer bag rows that failed:",
          rows
        );

        return;
      }
    } catch (error) {
      console.error(
        "Unable to sync bag with Supabase:",
        error
      );
    }
  }

  function getCartImage(item: Item) {
    if (item.image?.trim()) {
      return item.image.trim();
    }

    const slug = item.slug.toLowerCase();

    if (slug === "the-aurora") return "/products/aurora.jpg";
    if (slug === "the-luciana") return "/products/luciana.jpg";
    if (slug === "the-celeste") return "/products/celeste.jpg";

    return "";
  }

  const subtotal = items.reduce(
    (sum, item) =>
      sum + item.price * item.qty,
    0
  );

  const totalItems = items.reduce(
    (sum, item) =>
      sum + item.qty,
    0
  );

  const discount = appliedPromo
    ? Math.min(
        appliedPromo.discountAmount,
        subtotal
      )
    : 0;

  const total = subtotal - discount;

  // A stable fingerprint lets us re-check promotions whenever the bag
  // contents, quantities, sizes or variants change.
  const cartFingerprint = JSON.stringify(
    items.map((item) => ({
      slug: item.slug,
      qty: item.qty,
      size: item.size ?? null,
      variantId: item.variantId ?? null,
    }))
  );

  useEffect(() => {
    function loadCart() {
      try {
        const savedCart = JSON.parse(
          localStorage.getItem("cl-cart") || "[]"
        );

        const normalizedCart =
          Array.isArray(savedCart)
            ? savedCart
            : [];

        setItems(normalizedCart);

      } catch {
        setItems([]);
      }
    }

    loadCart();

    window.addEventListener(
      "cl-cart-updated",
      loadCart
    );

    return () => {
      window.removeEventListener(
        "cl-cart-updated",
        loadCart
      );
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function syncPromotionsWithBag() {
      // Any bag change invalidates the cached Available Offers list.
      setPromoListLoaded(false);
      setAvailablePromos([]);

      if (subtotal <= 0) {
        if (!cancelled) {
          setAppliedPromo(null);
          setPromoMessage("");
          setPromoError(false);
        }
        return;
      }

      // If a code is already applied, revalidate it against the NEW bag.
      // This also recalculates the discount when an eligible item's
      // quantity changes or when eligible products are removed.
      if (appliedPromo?.code) {
        const { data, error } = await supabase.rpc(
          "validate_promotion",
          {
            p_code: appliedPromo.code,
            p_subtotal: subtotal,
            p_items: items.map((item) => ({
              slug: item.slug,
              qty: item.qty,
              variantId: item.variantId ?? null,
            })),
          }
        );

        if (cancelled) return;

        if (error) {
          console.error(
            "Promotion revalidation error:",
            error
          );
          setAppliedPromo(null);
          setPromoError(true);
          setPromoMessage(
            "Your bag changed, so the promo code was removed. Please apply it again."
          );
        } else if (!data || data.valid !== true) {
          setAppliedPromo(null);
          setPromoError(true);
          setPromoMessage(
            data?.message ||
              "This promo no longer applies to the products in your bag."
          );
        } else {
          setAppliedPromo({
            promotionId: data.promotion_id,
            code: data.code,
            discountType: data.discount_type,
            discountValue: Number(data.discount_value),
            discountAmount: Number(data.discount_amount),
            minimumOrderValue: Number(
              data.minimum_order_value || 0
            ),
            maximumDiscount:
              data.maximum_discount !== null &&
              data.maximum_discount !== undefined
                ? Number(data.maximum_discount)
                : null,
          });
          setPromoError(false);
          setPromoMessage(
            data.message ||
              `${data.code} applied successfully.`
          );
        }
      }

      // If the offer drawer is open, immediately refresh it for the
      // current bag so stale/ineligible offers disappear.
      if (promoListOpen && !cancelled) {
        await loadApplicablePromotions();
      }
    }

    syncPromotionsWithBag();

    return () => {
      cancelled = true;
    };
    // appliedPromo.code is intentionally the only promo dependency:
    // discountAmount updates must not cause a validation loop.
  }, [cartFingerprint, appliedPromo?.code, promoListOpen]);

  function saveCart(updatedItems: Item[]) {
    setItems(updatedItems);

    localStorage.setItem(
      "cl-cart",
      JSON.stringify(updatedItems)
    );

    window.dispatchEvent(
      new Event("cl-cart-updated")
    );

    void syncCartToSupabase(
      updatedItems
    );
  }

  function increaseQuantity(index: number) {
    const updatedItems = [...items];
    const item = updatedItems[index];

    const maximumQuantity =
      item.stockQuantity ?? 0;

    if (item.qty >= maximumQuantity) {
      return;
    }

    item.qty += 1;

    saveCart(updatedItems);
  }

  function decreaseQuantity(index: number) {
    const updatedItems = [...items];

    if (updatedItems[index].qty > 1) {
      updatedItems[index].qty -= 1;

      saveCart(updatedItems);
    }
  }

  function removeItem(index: number) {
    const updatedItems = items.filter(
      (_, itemIndex) =>
        itemIndex !== index
    );

    saveCart(updatedItems);
  }

  async function loadApplicablePromotions() {
    if (subtotal <= 0) {
      setAvailablePromos([]);
      setPromoListLoaded(true);
      return;
    }

    setPromoLoading(true);
    setPromoError(false);
    setPromoMessage("");

    try {
      const { data, error } =
        await supabase.rpc(
          "get_applicable_promotions",
          {
            p_subtotal: subtotal,
            p_items: items.map((item) => ({
              slug: item.slug,
              qty: item.qty,
              variantId: item.variantId ?? null,
            })),
          }
        );

      if (error) {
        console.error(
          "Promotion list error:",
          error
        );

        setAvailablePromos([]);
        setPromoError(true);
        setPromoMessage(
          "We couldn't load the available promotions. Please try again."
        );

        return;
      }

      const promotions =
        Array.isArray(data)
          ? data
          : [];

      setAvailablePromos(
        promotions.map((promo: any) => ({
          promotionId:
            promo.promotion_id,
          code: promo.code,
          description:
            promo.description ?? null,
          discountType:
            promo.discount_type,
          discountValue:
            Number(
              promo.discount_value
            ),
          minimumOrderValue:
            Number(
              promo.minimum_order_value || 0
            ),
          maximumDiscount:
            promo.maximum_discount !==
              null &&
            promo.maximum_discount !==
              undefined
              ? Number(
                  promo.maximum_discount
                )
              : null,
          discountAmount:
            Number(
              promo.discount_amount || 0
            ),
        }))
      );

      setPromoListLoaded(true);
    } catch (error) {
      console.error(
        "Unable to load promotions:",
        error
      );

      setAvailablePromos([]);
      setPromoError(true);
      setPromoMessage(
        "Something went wrong while loading promotions."
      );
    } finally {
      setPromoLoading(false);
    }
  }

  async function togglePromoList() {
    const willOpen = !promoListOpen;

    setPromoListOpen(willOpen);

    if (
      willOpen &&
      !promoListLoaded
    ) {
      await loadApplicablePromotions();
    }
  }

  async function applyPromo(
    codeOverride?: string
  ) {
    const enteredCode = (
      codeOverride ?? promoCode
    )
      .trim()
      .toUpperCase();

    if (!enteredCode) {
      setPromoError(true);
      setPromoMessage(
        "Please enter a promo code."
      );
      return;
    }

    if (subtotal <= 0) {
      setPromoError(true);
      setPromoMessage(
        "Your bag is empty."
      );
      return;
    }

    setPromoLoading(true);
    setPromoError(false);
    setPromoMessage("");

    try {
      const { data, error } =
        await supabase.rpc(
          "validate_promotion",
          {
            p_code: enteredCode,
            p_subtotal: subtotal,
            p_items: items.map((item) => ({
              slug: item.slug,
              qty: item.qty,
              variantId: item.variantId ?? null,
            })),
          }
        );

      if (error) {
        console.error(
          "Promotion validation error:",
          error
        );

        setPromoError(true);
        setPromoMessage(
          "We couldn't validate this promo code. Please try again."
        );

        return;
      }

      if (!data || data.valid !== true) {
        setPromoError(true);
        setPromoMessage(
          data?.message ||
            "This promo code is not valid."
        );

        return;
      }

      setAppliedPromo({
        promotionId:
          data.promotion_id,
        code: data.code,
        discountType:
          data.discount_type,
        discountValue:
          Number(
            data.discount_value
          ),
        discountAmount:
          Number(
            data.discount_amount
          ),
        minimumOrderValue:
          Number(
            data.minimum_order_value
          ),
        maximumDiscount:
          data.maximum_discount !==
          null
            ? Number(
                data.maximum_discount
              )
            : null,
      });

      setPromoCode("");
      setPromoError(false);
      setPromoMessage(
        data.message ||
          `${data.code} applied successfully.`
      );

      setPromoListOpen(false);
    } catch (error) {
      console.error(
        "Unable to apply promotion:",
        error
      );

      setPromoError(true);
      setPromoMessage(
        "Something went wrong. Please try again."
      );
    } finally {
      setPromoLoading(false);
    }
  }

  function removePromo() {
    setAppliedPromo(null);
    setPromoMessage("");
    setPromoError(false);
  }

  return (
    <section className="section cart-page">
      <p className="eyebrow">
        YOUR SELECTION
      </p>

      <h1>The Bag</h1>

      {items.length === 0 ? (
        <div className="empty-state">
          <p>
            Your bag is waiting for
            something extraordinary.
          </p>

          <Link
            href="/collection"
            className="button button-dark"
          >
            Explore collection
          </Link>
        </div>
      ) : (
        <div className="cart-layout">
          <div className="cart-items">
            {items.map(
              (item, index) => {
                const maximumQuantity =
                  item.stockQuantity ??
                  0;

                const atStockLimit =
                  maximumQuantity > 0 &&
                  item.qty >=
                    maximumQuantity;

                return (
                  <div
                    className="cart-item"
                    key={`${item.slug}-${item.variantId ?? "default"}-${index}`}
                  >
                    <Link
                      href={`/product/${item.slug}`}
                      className="mini-image-link"
                      aria-label={`View ${item.name}`}
                    >
                      <div className="mini-image">
                        {getCartImage(item) ? (
                          <img
                            src={getCartImage(item)}
                            alt={item.name}
                            className="mini-image-photo"
                            onError={(event) => {
                              event.currentTarget.style.display = "none";
                            }}
                          />
                        ) : (
                          <span>{item.name}</span>
                        )}
                      </div>
                    </Link>

                    <div className="cart-item-details">
                      <Link
                        href={`/product/${item.slug}`}
                        className="product-name-link"
                      >
                        <h2>
                          {item.name}
                        </h2>
                      </Link>

                      {item.size && (
                        <p className="cart-size">
                          Size: {item.size}
                        </p>
                      )}

                      <strong>
                        {formatINR(
                          item.price
                        )}
                      </strong>

                      <div className="quantity-row">
                        <span className="quantity-label">
                          Quantity
                        </span>

                        <div className="quantity-control">
                          <button
                            type="button"
                            onClick={() =>
                              decreaseQuantity(
                                index
                              )
                            }
                            aria-label="Decrease quantity"
                            disabled={
                              item.qty <=
                              1
                            }
                          >
                            −
                          </button>

                          <span>
                            {item.qty}
                          </span>

                          <button
                            type="button"
                            onClick={() =>
                              increaseQuantity(
                                index
                              )
                            }
                            aria-label="Increase quantity"
                            disabled={
                              atStockLimit
                            }
                          >
                            +
                          </button>
                        </div>
                      </div>

                      {atStockLimit && (
                        <p className="stock-limit-message">
                          Maximum available
                          quantity reached.
                        </p>
                      )}

                      <p className="item-total">
                        {formatINR(
                          item.price *
                            item.qty
                        )}
                      </p>

                      <button
                        type="button"
                        className="remove-item"
                        onClick={() =>
                          removeItem(index)
                        }
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                );
              }
            )}
          </div>

          <aside className="summary">
            <p className="eyebrow">
              BILLING DETAILS
            </p>

            <h2>
              Order summary
            </h2>

            <div className="billing-items">
              {items.map(
                (item, index) => (
                  <div
                    className="billing-item"
                    key={`${item.slug}-${item.variantId ?? "default"}-billing-${index}`}
                  >
                    <div className="billing-item-name">
                      <Link
                        href={`/product/${item.slug}`}
                        className="billing-product-link"
                      >
                        <span>
                          {item.name}
                        </span>
                      </Link>

                      {item.size && (
                        <small>
                          Size{" "}
                          {item.size}
                        </small>
                      )}
                    </div>

                    <div className="billing-item-price">
                      <span>
                        ×{" "}
                        {item.qty}
                      </span>

                      <strong>
                        {formatINR(
                          item.price *
                            item.qty
                        )}
                      </strong>
                    </div>
                  </div>
                )
              )}
            </div>

            <div className="billing-divider" />

            <div className="promo-section">
              <button
                type="button"
                className="promo-title promo-title-button"
                onClick={
                  togglePromoList
                }
                aria-expanded={
                  promoListOpen
                }
              >
                <span>
                  Have a promo code?
                </span>

                <span
                  className={
                    promoListOpen
                      ? "promo-arrow promo-arrow-open"
                      : "promo-arrow"
                  }
                >
                  +
                </span>
              </button>

              {promoListOpen && (
                <div className="promo-list">
                  {promoLoading &&
                    !promoListLoaded && (
                      <p className="promo-list-message">
                        Checking available
                        promotions...
                      </p>
                    )}

                  {!promoLoading &&
                    promoListLoaded &&
                    availablePromos.length ===
                      0 && (
                      <p className="promo-list-message">
                        No promotions are
                        currently applicable
                        to your order.
                      </p>
                    )}

                  {availablePromos.length >
                    0 && (
                    <div className="available-promos">
                      <p className="available-promos-title">
                        Available offers
                      </p>

                      {availablePromos.map(
                        (promo) => (
                          <div
                            key={
                              promo.promotionId
                            }
                            className="available-promo"
                          >
                            <div className="available-promo-details">
                              <strong>
                                {promo.code}
                              </strong>

                              <span>
                                {promo.description ||
                                  (promo.discountType ===
                                  "percentage"
                                    ? `${promo.discountValue}% off`
                                    : `${formatINR(
                                        promo.discountValue
                                      )} off`)}
                              </span>

                              {promo.discountType ===
                                "percentage" &&
                                promo.maximumDiscount !==
                                  null && (
                                  <small>
                                    Up to{" "}
                                    {formatINR(
                                      promo.maximumDiscount
                                    )}{" "}
                                    off
                                  </small>
                                )}

                              {promo.minimumOrderValue >
                                0 && (
                                <small>
                                  Minimum order{" "}
                                  {formatINR(
                                    promo.minimumOrderValue
                                  )}
                                </small>
                              )}
                            </div>

                            <button
                              type="button"
                              className="promo-button available-promo-button"
                              onClick={() =>
                                applyPromo(
                                  promo.code
                                )
                              }
                              disabled={
                                promoLoading
                              }
                            >
                              Apply
                            </button>
                          </div>
                        )
                      )}
                    </div>
                  )}

                  <div className="manual-promo">
                    <p className="manual-promo-title">
                      Have another code?
                    </p>

                    {!appliedPromo && (
                      <div className="promo-row">
                        <input
                          type="text"
                          value={
                            promoCode
                          }
                          onChange={(
                            event
                          ) =>
                            setPromoCode(
                              event.target
                                .value
                            )
                          }
                          onKeyDown={(
                            event
                          ) => {
                            if (
                              event.key ===
                              "Enter"
                            ) {
                              applyPromo();
                            }
                          }}
                          placeholder="Enter code"
                          className="promo-input"
                          autoComplete="off"
                          disabled={
                            promoLoading
                          }
                        />

                        <button
                          type="button"
                          className="promo-button"
                          onClick={
                            () =>
                              applyPromo()
                          }
                          disabled={
                            promoLoading
                          }
                        >
                          {promoLoading
                            ? "Checking..."
                            : "Apply"}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {appliedPromo && (
                <div className="applied-promo">
                  <div>
                    <span className="applied-promo-label">
                      {appliedPromo.code}
                    </span>

                    <span className="applied-promo-text">
                      {appliedPromo.discountType ===
                      "percentage"
                        ? `${appliedPromo.discountValue}% off`
                        : `${formatINR(
                            appliedPromo.discountValue
                          )} off`}
                    </span>
                  </div>

                  <button
                    type="button"
                    className="remove-promo"
                    onClick={
                      removePromo
                    }
                  >
                    Remove
                  </button>
                </div>
              )}

              {promoMessage && (
                <p
                  className={
                    promoError
                      ? "promo-message promo-error"
                      : "promo-message"
                  }
                >
                  {promoMessage}
                </p>
              )}

              <p className="promo-note">
                Enter your promo code to
                receive an eligible
                discount.
              </p>
            </div>

            <div className="billing-divider" />

            <div className="billing-line">
              <span>
                Items ({totalItems})
              </span>

              <span>
                {formatINR(
                  subtotal
                )}
              </span>
            </div>

            <div className="billing-line">
              <span>
                Subtotal
              </span>

              <span>
                {formatINR(
                  subtotal
                )}
              </span>
            </div>

            {discount > 0 && (
              <div className="billing-line discount-line">
                <span>
                  Promo discount
                </span>

                <span>
                  −{" "}
                  {formatINR(
                    discount
                  )}
                </span>
              </div>
            )}

            <div className="billing-line muted">
              <span>
                Shipping
              </span>

              <span>
                Calculated at
                checkout
              </span>
            </div>

            <div className="billing-line muted">
              <span>
                Taxes
              </span>

              <span>
                Calculated at
                checkout
              </span>
            </div>

            <div className="billing-divider" />

            <div className="billing-total">
              <span>
                Total
              </span>

              <strong>
                {formatINR(
                  total
                )}
              </strong>
            </div>

            <p className="small-note">
              Final shipping charges
              and applicable taxes
              will be confirmed at
              checkout.
            </p>

            <Link
              href="/checkout"
              className="button button-dark checkout-button"
            >
              Continue to checkout
            </Link>
          </aside>
        </div>
      )}

      <style jsx>{`
        .cart-items {
          width: 100%;
        }

        .cart-item {
          display: flex;
          gap: 24px;
          padding: 24px 0;
          border-bottom: 1px solid #d9d0c4;
        }

        .mini-image-link {
          text-decoration: none;
          color: inherit;
          flex-shrink: 0;
        }

        .mini-image {
          width: 122px;
          height: 122px;
          background: #f3eee6;
          overflow: hidden;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .mini-image-photo {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }

        .cart-item-details {
          flex: 1;
        }

        .product-name-link {
          color: inherit;
          text-decoration: none;
        }

        .product-name-link h2 {
          margin: 0 0 8px;
          transition: color 0.2s ease;
        }

        .product-name-link:hover h2 {
          color: #7a263a;
        }

        .cart-size {
          margin: 0 0 8px;
          color: #716b64;
          font-size: 14px;
        }

        .quantity-row {
          display: flex;
          align-items: center;
          gap: 16px;
          margin-top: 18px;
        }

        .quantity-label {
          font-size: 13px;
          color: #716b64;
        }

        .quantity-control {
          display: inline-flex;
          align-items: center;
          border: 1px solid #d9d0c4;
        }

        .quantity-control button {
          width: 34px;
          height: 32px;
          border: none;
          background: transparent;
          color: #141210;
          font-size: 18px;
          cursor: pointer;
        }

        .quantity-control button:hover {
          background: #f3eee6;
        }

        .quantity-control button:disabled {
          opacity: 0.3;
          cursor: not-allowed;
        }

        .quantity-control span {
          min-width: 32px;
          text-align: center;
          font-size: 14px;
        }

        .stock-limit-message {
          margin: 8px 0 0;
          color: #7a263a;
          font-size: 11px;
        }

        .item-total {
          margin: 16px 0 8px;
          font-weight: 600;
        }

        .remove-item {
          border: none;
          padding: 0;
          background: none;
          color: #716b64;
          font-size: 12px;
          text-decoration: underline;
          text-underline-offset: 3px;
          cursor: pointer;
        }

        .remove-item:hover {
          color: #7a263a;
        }

        .billing-items {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .billing-item {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 20px;
          font-size: 14px;
        }

        .billing-item-name {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .billing-product-link {
          color: inherit;
          text-decoration: none;
        }

        .billing-product-link span {
          font-weight: 500;
          transition: color 0.2s ease;
        }

        .billing-product-link:hover span {
          color: #7a263a;
        }

        .billing-item-name small {
          color: #716b64;
          font-size: 11px;
        }

        .billing-item-price {
          display: flex;
          align-items: center;
          gap: 12px;
          white-space: nowrap;
        }

        .billing-item-price span {
          color: #716b64;
          font-size: 12px;
        }

        .billing-item-price strong {
          font-weight: 500;
        }

        .summary h2 {
          margin-top: 8px;
          margin-bottom: 28px;
        }

        .billing-line {
          display: flex;
          justify-content: space-between;
          gap: 20px;
          margin-bottom: 14px;
          font-size: 14px;
        }

        .billing-line.muted {
          color: #716b64;
          font-size: 12px;
        }

        .discount-line {
          color: #7a263a;
        }

        .billing-divider {
          height: 1px;
          background: #d9d0c4;
          margin: 22px 0;
        }

        .billing-total {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 16px;
        }

        .billing-total strong {
          font-size: 20px;
        }

        .checkout-button {
          width: 100%;
          margin-top: 20px;
          text-align: center;
        }

        .promo-section {
          padding: 20px 0;
          border-top: 1px solid #d9d0c4;
          border-bottom: 1px solid #d9d0c4;
        }

        .promo-title {
          margin: 0 0 12px;
          font-size: 13px;
          font-weight: 500;
        }

        .promo-title-button {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: space-between;
          border: none;
          padding: 0;
          background: transparent;
          color: #141210;
          font-family: inherit;
          text-align: left;
          cursor: pointer;
        }

        .promo-arrow {
          font-size: 18px;
          line-height: 1;
          transition: transform 0.2s ease;
        }

        .promo-arrow-open {
          transform: rotate(45deg);
        }

        .promo-row {
          display: flex;
          gap: 8px;
        }

        .promo-input {
          flex: 1;
          min-width: 0;
          height: 42px;
          padding: 0 12px;
          border: 1px solid #d9d0c4;
          background: #faf8f4;
          color: #141210;
          font-family: inherit;
          font-size: 13px;
          outline: none;
          text-transform: uppercase;
        }

        .promo-input:focus {
          border-color: #141210;
        }

        .promo-input:disabled {
          opacity: 0.6;
          cursor: wait;
        }

        .promo-button {
          height: 42px;
          padding: 0 18px;
          border: 1px solid #141210;
          background: #141210;
          color: #f3eee6;
          font-family: inherit;
          font-size: 12px;
          cursor: pointer;
        }

        .promo-button:hover {
          opacity: 0.88;
        }

        .promo-button:disabled {
          opacity: 0.55;
          cursor: wait;
        }

        .promo-message {
          margin: 10px 0 0;
          color: #3f5945;
          font-size: 11px;
        }

        .promo-error {
          color: #7a263a;
        }

        .promo-note {
          margin: 8px 0 0;
          color: #716b64;
          font-size: 11px;
        }

        .promo-list {
          margin-top: 14px;
          padding: 14px;
          border: 1px solid #d9d0c4;
          background: #faf8f4;
        }

        .promo-list-message {
          margin: 0;
          color: #716b64;
          font-size: 11px;
          line-height: 1.5;
        }

        .available-promos {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .available-promos-title {
          margin: 0 0 2px;
          color: #716b64;
          font-size: 10px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .available-promo {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
          padding: 12px;
          border: 1px solid #d9d0c4;
          background: #f3eee6;
        }

        .available-promo-details {
          display: flex;
          flex-direction: column;
          gap: 3px;
          min-width: 0;
        }

        .available-promo-details strong {
          font-size: 12px;
          letter-spacing: 0.05em;
        }

        .available-promo-details span {
          font-size: 11px;
          color: #141210;
        }

        .available-promo-details small {
          color: #716b64;
          font-size: 10px;
        }

        .available-promo-button {
          flex-shrink: 0;
        }

        .manual-promo {
          margin-top: 14px;
          padding-top: 14px;
          border-top: 1px solid #d9d0c4;
        }

        .manual-promo-title {
          margin: 0 0 10px;
          color: #716b64;
          font-size: 10px;
          letter-spacing: 0.05em;
          text-transform: uppercase;
        }

        .applied-promo {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          padding: 12px 14px;
          border: 1px solid #d9d0c4;
          background: #f3eee6;
        }

        .applied-promo > div {
          display: flex;
          flex-direction: column;
          gap: 3px;
        }

        .applied-promo-label {
          font-size: 12px;
          font-weight: 600;
          letter-spacing: 0.05em;
        }

        .applied-promo-text {
          color: #716b64;
          font-size: 11px;
        }

        .remove-promo {
          border: none;
          padding: 0;
          background: transparent;
          color: #716b64;
          font-family: inherit;
          font-size: 11px;
          text-decoration: underline;
          text-underline-offset: 3px;
          cursor: pointer;
        }

        .remove-promo:hover {
          color: #7a263a;
        }

        @media (max-width: 700px) {
          .cart-item {
            gap: 16px;
          }

          .cart-layout {
            display: block;
          }

          .summary {
            margin-top: 32px;
          }

          .billing-item {
            gap: 12px;
          }

          .billing-item-price {
            gap: 8px;
          }
        }
      `}</style>
    </section>
  );
}