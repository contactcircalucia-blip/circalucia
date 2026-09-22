import { notFound } from "next/navigation";
import {
  getProduct,
  getProductVariants,
  formatINR,
  getProductImage,
} from "@/lib/products";
import ProductPurchase from "@/components/ProductPurchase";
import SaveDesignButton from "@/components/SaveDesignButton";
import ProductGallery from "@/components/ProductGallery";
import ProductInformation from "@/components/ProductInformation";
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

  const primaryImage = getProductImage(product);

  if (!primaryImage) {
    notFound();
  }

  const variants = await getProductVariants(product.id);

  const [
    { data: inventoryData, error: inventoryError },
    { data: imageData, error: imageError },
    { data: videoData, error: videoError },
  ] = await Promise.all([
    supabase
      .from("product_inventory")
      .select("id, product_id, size, stock_quantity")
      .eq("product_id", product.id),

    supabase
      .from("product_images")
      .select("id, image_url, sort_order")
      .eq("product_id", product.id)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true })
      .limit(5),

    supabase
      .from("products")
      .select("video_url")
      .eq("id", product.id)
      .single(),
  ]);

  if (inventoryError) {
    console.error("PRODUCT INVENTORY ERROR:", inventoryError);
  }

  if (imageError) {
    console.error("PRODUCT GALLERY ERROR:", imageError);
  }

  if (videoError) {
    console.error("PRODUCT VIDEO ERROR:", videoError);
  }

  const inventory = inventoryData ?? [];
  const additionalImages = imageData ?? [];

  const videoUrl =
    videoData?.video_url?.trim() ||
    product.video_url?.trim() ||
    null;

  console.log("PRODUCT VIDEO DEBUG:", {
    product: product.name,
    productVideoUrl: product.video_url,
    directVideoUrl: videoData?.video_url,
    finalVideoUrl: videoUrl,
  });

  return (
    <>
      <section className="product-page section">
        <ProductGallery
          productName={product.name}
          primaryImage={primaryImage}
          additionalImages={additionalImages}
          videoUrl={videoUrl}
        />

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
            Secure online payment. Your order is prepared after payment
            confirmation.
          </p>
        </div>
      </section>

      <ProductInformation product={product} />
    </>
  );
}