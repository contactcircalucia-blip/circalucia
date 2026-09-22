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
  const [loginRequired, setLoginRequired] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(false);

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


  /*
   * ------------------------------------------------------------
   * SYNC CUSTOMER BAG TO SUPABASE
   * ------------------------------------------------------------
   */

  async function syncCartToSupabase(
    userId: string,
    cart: any[]
  ) {
    const now = new Date().toISOString();

    const { data: bag, error: bagError } =
      await supabase
        .from("customer_bags")
        .upsert(
          {
            user_id: userId,
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
        bagError
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
        deleteError
      );
      return;
    }

    if (cart.length === 0) {
      return;
    }

    const rows = cart.map((item: any) => ({
      bag_id: bag.id,
      product_id: item.productId ?? null,
      slug: item.slug,
      product_name: item.name,
      selected_size: item.size ?? null,
      quantity: Number(item.qty || 1),
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
        insertError
      );
    }
  }

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
       * Keep the authenticated customer's server-side bag in sync
       * so Admin can see the current bag.
       */
      await syncCartToSupabase(
        user.id,
        cart
      );

      /*
       * Notify Header / Cart / other listeners.
       */

      window.dispatchEvent(
        new Event("cl-cart-updated")
      );


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
          : "Add to bag"}
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

  
      `}</style>
    </>
  );
}