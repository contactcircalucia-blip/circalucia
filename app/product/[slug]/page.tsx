import { notFound } from "next/navigation";
import Image from "next/image";
import {
  getProduct,
  getProductVariants,
  formatINR,
  getProductImage,
} from "@/lib/products";
import ProductPurchase from "@/components/ProductPurchase";
import SaveDesignButton from "@/components/SaveDesignButton";
import { supabase } from "@/lib/supabase";

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const product = await getProduct(slug);

  if (!product) {
    notFound();
  }

  const variants = await getProductVariants(product.id);

  const { data: inventoryData } = await supabase
    .from("product_inventory")
    .select("id, product_id, size, stock_quantity")
    .eq("product_id", product.id);

  const inventory = inventoryData ?? [];

  return (
    <section className="product-page section">
      <div className="product-visual">
        {getProductImage(product) ? (
          <Image
            src={getProductImage(product)!}
            alt={product.name}
            fill
            sizes="(max-width: 900px) 100vw, 55vw"
            className="product-image"
          />
        ) : (
          <span>{product.name}</span>
        )}
      </div>

      <div className="product-detail">
        <p className="eyebrow">{product.collection}</p>

        <h1>{product.name}</h1>

        <p className="price">{formatINR(product.price)}</p>

        <p className="detail-copy">{product.description}</p>

        <div className="spec-list">
          <div>
            <span>Material</span>
            <strong>{product.material}</strong>
          </div>

          <div>
            <span>Heel</span>
            <strong>{product.heel_height}</strong>
          </div>

          <div>
            <span>Made</span>
            <strong>Crafted to order</strong>
          </div>
        </div>

        <ProductPurchase
          product={product}
          variants={variants}
          inventory={inventory}
        />

        <SaveDesignButton productId={product.id} />

        <p className="small-note">
          Payment integration will be connected before launch. Orders are
          prepared after payment confirmation.
        </p>
      </div>
    </section>
  );
}