"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Product } from "@/lib/products";
import { supabase } from "@/lib/supabase";

type CartButtonProps = {
  product: Product;
  variantId?: string;
  size?: string;
  price?: number;
  stockQuantity?: number;
  disabled?: boolean;
};

export default function CartButton({
  product,
  variantId,
  size,
  price,
  stockQuantity = 0,
  disabled = false,
}: CartButtonProps) {
  const [added, setAdded] = useState(false);
  const [cartQty, setCartQty] = useState(0);
  const [loginRequired, setLoginRequired] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(false);

  /*
   * ------------------------------------------------------------
   * CART QUANTITY
   * ------------------------------------------------------------
   */

  function getCartQty() {
    try {
      const cart = JSON.parse(
        localStorage.getItem("cl-cart") || "[]"
      );

      if (!Array.isArray(cart)) {
        setCartQty(0);
        return;
      }

      const total = cart.reduce(
        (sum: number, item: any) =>
          sum + Number(item.qty || 0),
        0
      );

      setCartQty(total);
    } catch {
      setCartQty(0);
    }
  }

  useEffect(() => {
    getCartQty();

    function handleCartUpdate() {
      getCartQty();
    }

    window.addEventListener(
      "cl-cart-updated",
      handleCartUpdate
    );

    return () => {
      window.removeEventListener(
        "cl-cart-updated",
        handleCartUpdate
      );
    };
  }, []);

  /*
   * ------------------------------------------------------------
   * ADD PRODUCT TO CART
   * ------------------------------------------------------------
   *
   * IMPORTANT:
   *
   * product_inventory is now the main stock authority.
   *
   * A product DOES NOT need a product_variants row simply
   * to be added to the cart.
   *
   * variantId remains supported for older products that use it.
   */

  async function add() {
    if (
      disabled ||
      !size ||
      stockQuantity <= 0 ||
      checkingAuth
    ) {
      return;
    }

    setLoginRequired(false);
    setCheckingAuth(true);

    try {
      /*
       * --------------------------------------------------------
       * REQUIRE LOGIN
       * --------------------------------------------------------
       */

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setLoginRequired(true);
        return;
      }

      /*
       * --------------------------------------------------------
       * LOAD EXISTING CART
       * --------------------------------------------------------
       */

      let cart: any[] = [];

      try {
        const storedCart = JSON.parse(
          localStorage.getItem("cl-cart") || "[]"
        );

        if (Array.isArray(storedCart)) {
          cart = storedCart;
        }
      } catch {
        cart = [];
      }

      /*
       * --------------------------------------------------------
       * FIND SAME PRODUCT + SAME SIZE
       * --------------------------------------------------------
       *
       * We do NOT depend on variantId here.
       *
       * This allows every Admin-created product to work even
       * when it has inventory but no product_variants record.
       */

      const existing = cart.find(
        (item: any) =>
          item.slug === product.slug &&
          item.size === size
      );

      /*
       * --------------------------------------------------------
       * UPDATE EXISTING CART ITEM
       * --------------------------------------------------------
       */

      if (existing) {
        existing.productId = product.id;
        existing.name = product.name;
        existing.price = price ?? product.price;
        existing.shipping_charge = Number(product.shipping_charge || 0);
        existing.tax_percent = Number(product.tax_percent || 0);
        existing.stockQuantity = stockQuantity;

        /*
         * Keep variant ID when one exists.
         */

        if (variantId) {
          existing.variantId = variantId;
        }

        /*
         * Keep the current product image.
         */

        existing.image =
          product.image_url ?? existing.image ?? null;

        /*
         * Do not allow quantity above available stock.
         */

        if (
          Number(existing.qty || 0) >= stockQuantity
        ) {
          return;
        }

        existing.qty =
          Number(existing.qty || 0) + 1;
      } else {
        /*
         * ------------------------------------------------------
         * CREATE NEW CART ITEM
         * ------------------------------------------------------
         */

        cart.push({
          productId: product.id,
          slug: product.slug,
          name: product.name,

          price:
            price ?? product.price,

          /*
           * Product-level checkout charges.
           *
           * These values come from Admin -> Product Management
           * and travel with the cart item into checkout.
           */

          shipping_charge:
            Number(product.shipping_charge || 0),

          tax_percent:
            Number(product.tax_percent || 0),

          qty: 1,

          /*
           * Variant is optional.
           */

          variantId:
            variantId ?? null,

          size,

          /*
           * Stock available for this exact size.
           */

          stockQuantity,

          /*
           * Store the database image URL/path.
           *
           * Example:
           * /test.jpg
           *
           * Future Admin-created products will therefore carry
           * their own image into the cart.
           */

          image:
            product.image_url ?? null,
        });
      }

      /*
       * --------------------------------------------------------
       * SAVE CART
       * --------------------------------------------------------
       */

      localStorage.setItem(
        "cl-cart",
        JSON.stringify(cart)
      );

      /*
       * Notify Header / Cart / other listeners.
       */

      window.dispatchEvent(
        new Event("cl-cart-updated")
      );

      getCartQty();

      /*
       * --------------------------------------------------------
       * SHOW ADDED NOTIFICATION
       * --------------------------------------------------------
       */

      setAdded(true);

      setTimeout(() => {
        setAdded(false);
      }, 5000);
    } catch (error) {
      console.error(
        "Unable to add item to cart:",
        error
      );
    } finally {
      setCheckingAuth(false);
    }
  }

  /*
   * ------------------------------------------------------------
   * BUTTON AVAILABILITY
   * ------------------------------------------------------------
   *
   * variantId is deliberately NOT required.
   *
   * A selected in-stock size is enough.
   */

  const buttonDisabled =
    disabled ||
    !size ||
    stockQuantity <= 0 ||
    checkingAuth;

  return (
    <>
      {/* ======================================================
          COMMISSION / ADD TO BAG
          ====================================================== */}

      <button
        type="button"
        className="button button-dark"
        onClick={add}
        disabled={buttonDisabled}
        style={{
          opacity: buttonDisabled ? 0.5 : 1,

          cursor: buttonDisabled
            ? "not-allowed"
            : "pointer",
        }}
      >
        {checkingAuth
          ? "Checking..."
          : disabled || stockQuantity <= 0
          ? "Out of stock"
          : "Commission this design"}
      </button>

      {/* ======================================================
          LOGIN REQUIRED
          ====================================================== */}

      {loginRequired && (
        <div className="login-required">
          <span>
            Please log in to add designs to your bag.
          </span>

          <Link href="/account">
            Log in
          </Link>
        </div>
      )}

      {/* ======================================================
          ADDED TO CART NOTIFICATION
          ====================================================== */}

      {added && (
        <Link
          href="/cart"
          className="cart-added-notification"
          style={{
            position: "fixed",
            right: "24px",
            bottom: "24px",
            zIndex: 9999,

            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",

            gap: "20px",

            minWidth: "250px",
            minHeight: "54px",

            padding: "16px 20px",

            boxSizing: "border-box",

            background: "#141210",
            color: "#f3eee6",

            textDecoration: "none",

            border: "1px solid #7A263A",

            boxShadow:
              "0 12px 30px rgba(0, 0, 0, 0.18)",

            fontSize: "14px",
            fontFamily:
              "Inter, Arial, sans-serif",

            fontWeight: 300,

            letterSpacing: "0.02em",

            cursor: "pointer",
          }}
        >
          <span>
            Item added to cart
          </span>

          <span
            style={{
              fontSize: "12px",

              textDecoration:
                "underline",

              textUnderlineOffset:
                "3px",

              whiteSpace:
                "nowrap",
            }}
          >
            View bag
          </span>
        </Link>
      )}

      {/* ======================================================
          FLOATING CART BUTTON
          ====================================================== */}

      <Link
        href="/cart"
        aria-label={`Open bag, ${cartQty} item${
          cartQty === 1 ? "" : "s"
        }`}
        className="floating-cart-button"
      >
        <svg
          width="21"
          height="21"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M3 4H5L7.2 14.2C7.4 15.1 8.2 15.8 9.1 15.8H17.4C18.3 15.8 19.1 15.2 19.4 14.3L21 8H6"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          <circle
            cx="9.5"
            cy="19"
            r="1.2"
            fill="currentColor"
          />

          <circle
            cx="17"
            cy="19"
            r="1.2"
            fill="currentColor"
          />
        </svg>

        {cartQty > 0 && (
          <span className="floating-cart-count">
            {cartQty > 99
              ? "99+"
              : cartQty}
          </span>
        )}
      </Link>

      {/* ======================================================
          STYLES
          ====================================================== */}

      <style jsx>{`
        .login-required {
          margin-top: 12px;

          padding: 12px 14px;

          border: 1px solid #d9d0c4;

          background: #faf8f4;

          color: #716b64;

          font-size: 12px;

          line-height: 1.5;

          display: flex;

          align-items: center;

          justify-content:
            space-between;

          gap: 14px;
        }

        .login-required a {
          color: #141210;

          text-decoration:
            underline;

          text-underline-offset:
            3px;

          white-space:
            nowrap;
        }

        .floating-cart-button {
          position: fixed;

          right: 24px;
          bottom: 24px;

          z-index: 9998;

          width: 54px;
          height: 54px;

          display: flex;

          align-items: center;

          justify-content:
            center;

          background:
            #141210;

          color:
            #f3eee6;

          border:
            1px solid #7a263a;

          border-radius:
            50%;

          text-decoration:
            none;

          box-shadow:
            0 10px 30px
            rgba(0, 0, 0, 0.22);

          transition:
            transform 0.25s ease,
            box-shadow 0.25s ease;
        }

        .floating-cart-button:hover {
          transform:
            translateY(-3px);

          box-shadow:
            0 15px 35px
            rgba(0, 0, 0, 0.28);
        }

        .floating-cart-count {
          position:
            absolute;

          top: -5px;
          right: -5px;

          min-width: 19px;

          height: 19px;

          display: flex;

          align-items:
            center;

          justify-content:
            center;

          padding: 0 5px;

          background:
            #7a263a;

          color:
            #f3eee6;

          border:
            2px solid #f3eee6;

          border-radius:
            50%;

          font-size:
            10px;

          line-height: 1;

          font-weight:
            600;
        }

        @media (max-width: 600px) {
          .cart-added-notification {
            right:
              16px !important;

            bottom:
              16px !important;

            width:
              calc(
                100vw - 32px
              ) !important;

            min-width:
              0 !important;
          }

          .login-required {
            align-items:
              flex-start;

            flex-direction:
              column;

            gap: 6px;
          }

          .floating-cart-button {
            right: 16px;

            bottom: 16px;
          }
        }
      `}</style>
    </>
  );
}