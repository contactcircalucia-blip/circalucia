"use client";

import { useState } from "react";
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

type ProductPurchaseProps = {
  product: Product;
  variants: ProductVariant[];
};

export default function ProductPurchase({
  product,
  variants,
}: ProductPurchaseProps) {
  const [selectedVariantId, setSelectedVariantId] = useState("");

  const selectedVariant = variants.find(
    (variant) => variant.id === selectedVariantId
  );

  const isOutOfStock =
    selectedVariant
      ? selectedVariant.stock_quantity <= 0
      : false;

  const isLowStock =
    selectedVariant
      ? selectedVariant.stock_quantity > 0 &&
        selectedVariant.stock_quantity <= 3
      : false;

  const finalPrice =
    product.price +
    (selectedVariant?.price_adjustment ?? 0);

  return (
    <>
      <label
        className="field-label"
        htmlFor="product-size"
      >
        Size
      </label>

      <select
        id="product-size"
        className="select"
        value={selectedVariantId}
        onChange={(event) =>
          setSelectedVariantId(event.target.value)
        }
      >
        <option value="">Select size</option>

        {variants.map((variant) => (
          <option
            key={variant.id}
            value={variant.id}
          >
            {variant.size}
            {variant.stock_quantity <= 0
              ? " — Out of stock"
              : ""}
          </option>
        ))}
      </select>

      {selectedVariant && (
        <p className="small-note">
          {selectedVariant.price_adjustment !== 0
            ? `Selected size price: ${formatINR(finalPrice)}`
            : `Price: ${formatINR(finalPrice)}`}
        </p>
      )}

      {selectedVariant && isLowStock && (
        <p
          className="small-note"
          style={{
            color: "#7A263A",
            fontWeight: 500,
          }}
        >
          Only {selectedVariant.stock_quantity} left
        </p>
      )}

      {selectedVariant && isOutOfStock && (
        <p
          className="small-note"
          style={{
            color: "#7A263A",
            fontWeight: 500,
          }}
        >
          This size is currently out of stock and
          cannot be ordered.
        </p>
      )}

      <CartButton
        product={product}
        variantId={selectedVariant?.id}
        size={selectedVariant?.size ?? undefined}
        price={finalPrice}
        stockQuantity={
          selectedVariant?.stock_quantity ?? 0
        }
        disabled={
          !selectedVariant || isOutOfStock
        }
      />
    </>
  );
}