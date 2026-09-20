"use client";

import { useMemo, useState } from "react";
import { formatINR, Product } from "@/lib/products";
import CartButton from "@/components/CartButton";

type ProductVariant = {
  id: string;
  product_id: string;
  size: string | null;
  color: string | null;
  material: string | null;
  heel_height: string | null;
  price_adjustment: number;
  stock_quantity: number;
  is_active: boolean;
  created_at: string;
};

type InventoryItem = {
  id: string;
  product_id: string;
  size: string;
  stock_quantity: number;
};

type ProductPurchaseProps = {
  product: Product;
  variants: ProductVariant[];
  inventory: InventoryItem[];
};

const ALL_SIZES = [
  "35",
  "36",
  "37",
  "38",
  "39",
  "40",
  "41",
  "42",
];

export default function ProductPurchase({
  product,
  variants,
  inventory,
}: ProductPurchaseProps) {
  const [selectedSize, setSelectedSize] = useState("");

  /*
   * ------------------------------------------------------------
   * ALWAYS DISPLAY ALL SIZES
   * ------------------------------------------------------------
   *
   * Sizes 35–42 are always displayed.
   *
   * If a size does not exist in product_inventory,
   * its stock is treated as 0.
   */

  const sizes = useMemo(() => {
    return ALL_SIZES.map((size) => {
      const inventoryItem = inventory.find(
        (item) => item.size === size
      );

      return {
        id: inventoryItem?.id ?? `size-${size}`,
        product_id: product.id,
        size,
        stock_quantity:
          inventoryItem?.stock_quantity ?? 0,
      };
    });
  }, [inventory, product.id]);

  /*
   * ------------------------------------------------------------
   * SELECTED INVENTORY
   * ------------------------------------------------------------
   */

  const selectedInventory = sizes.find(
    (item) => item.size === selectedSize
  );

  /*
   * ------------------------------------------------------------
   * MATCH EXISTING PRODUCT VARIANT
   * ------------------------------------------------------------
   *
   * We keep the old variant system for variant IDs
   * and price adjustments.
   */

  const selectedVariant = variants.find(
    (variant) =>
      variant.size === selectedSize &&
      variant.is_active !== false
  );

  /*
   * ------------------------------------------------------------
   * STOCK
   * ------------------------------------------------------------
   */

  const stockQuantity =
    selectedInventory?.stock_quantity ?? 0;

  const isLowStock =
    stockQuantity > 0 && stockQuantity <= 3;

  /*
   * ------------------------------------------------------------
   * PRICE
   * ------------------------------------------------------------
   */

  const finalPrice =
    product.price +
    (selectedVariant?.price_adjustment ?? 0);

  /*
   * ------------------------------------------------------------
   * PRODUCT STOCK STATUS
   * ------------------------------------------------------------
   */

  const hasAnyStock = sizes.some(
    (item) => item.stock_quantity > 0
  );

  return (
    <>
      {/* ======================================================
          SIZE HEADING
          ====================================================== */}

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
          marginTop: "34px",
          marginBottom: "16px",
        }}
      >
        <span
          style={{
            fontSize: "13px",
            fontWeight: 500,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
          }}
        >
          Select Size
        </span>

        <button
          type="button"
          style={{
            border: "none",
            background: "transparent",
            padding: 0,
            margin: 0,
            fontFamily: "inherit",
            fontSize: "13px",
            color: "var(--muted)",
            textDecoration: "underline",
            textUnderlineOffset: "3px",
            cursor: "pointer",
          }}
        >
          Size Guide
        </button>
      </div>

      {/* ======================================================
          SIZE BOXES
          ====================================================== */}

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "10px",
          marginBottom: "18px",
        }}
      >
        {sizes.map((item) => {
          const outOfStock =
            item.stock_quantity <= 0;

          const selected =
            selectedSize === item.size;

          return (
            <button
              key={item.size}
              type="button"
              disabled={outOfStock}
              onClick={() => {
                if (!outOfStock) {
                  setSelectedSize(item.size);
                }
              }}
              aria-label={
                outOfStock
                  ? `Size ${item.size}, out of stock`
                  : `Select size ${item.size}`
              }
              title={
                outOfStock
                  ? `Size ${item.size} — Out of stock`
                  : `Size ${item.size}`
              }
              style={{
                position: "relative",

                width: "58px",
                height: "54px",

                display: "flex",
                alignItems: "center",
                justifyContent: "center",

                padding: 0,

                border: selected
                  ? "1px solid var(--ink)"
                  : "1px solid var(--line)",

                borderRadius: "8px",

                background: selected
                  ? "var(--ink)"
                  : outOfStock
                  ? "rgba(0, 0, 0, 0.035)"
                  : "transparent",

                color: selected
                  ? "var(--paper)"
                  : outOfStock
                  ? "var(--muted)"
                  : "var(--ink)",

                fontFamily: "inherit",
                fontSize: "16px",
                fontWeight: 400,

                cursor: outOfStock
                  ? "not-allowed"
                  : "pointer",

                opacity: outOfStock ? 0.55 : 1,

                overflow: "hidden",

                transition:
                  "background 180ms ease, color 180ms ease, border-color 180ms ease, opacity 180ms ease",
              }}
            >
              {/* SIZE NUMBER */}

              <span
                style={{
                  position: "relative",
                  zIndex: 2,
                }}
              >
                {item.size}
              </span>

              {/* OUT OF STOCK CROSS LINE */}

              {outOfStock && (
                <span
                  aria-hidden="true"
                  style={{
                    position: "absolute",
                    left: "8px",
                    right: "8px",
                    top: "50%",
                    height: "1px",
                    background: "currentColor",
                    transform: "translateY(-50%)",
                    pointerEvents: "none",
                    zIndex: 3,
                  }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* ======================================================
          SELECTED SIZE
          ====================================================== */}

      {selectedSize && (
        <p
          className="small-note"
          style={{
            marginTop: "4px",
            marginBottom: "8px",
          }}
        >
          Selected size:{" "}
          <strong>{selectedSize}</strong>
        </p>
      )}

      {/* ======================================================
          PRICE ADJUSTMENT
          ====================================================== */}

      {selectedSize &&
        selectedVariant &&
        selectedVariant.price_adjustment !== 0 && (
          <p
            className="small-note"
            style={{
              marginBottom: "8px",
            }}
          >
            Selected size price:{" "}
            {formatINR(finalPrice)}
          </p>
        )}

      {/* ======================================================
          LOW STOCK
          ====================================================== */}

      {selectedInventory && isLowStock && (
        <p
          className="small-note"
          style={{
            color: "#7A263A",
            fontWeight: 500,
            marginBottom: "12px",
          }}
        >
          Only {stockQuantity} left
        </p>
      )}

      {/* ======================================================
          COMPLETE PRODUCT OUT OF STOCK
          ====================================================== */}

      {!hasAnyStock && (
        <p
          className="small-note"
          style={{
            color: "#7A263A",
            fontWeight: 500,
            marginTop: "4px",
            marginBottom: "12px",
          }}
        >
          This product is currently out of stock.
        </p>
      )}

      {/* ======================================================
          ADD TO BAG
          ====================================================== */}

      <CartButton
        product={product}
        variantId={selectedVariant?.id}
        size={selectedSize || undefined}
        price={finalPrice}
        stockQuantity={stockQuantity}
        disabled={
          !selectedSize ||
          !selectedInventory ||
          stockQuantity <= 0
        }
      />
    </>
  );
}