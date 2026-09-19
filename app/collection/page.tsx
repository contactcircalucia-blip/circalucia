import Link from "next/link";
import Image from "next/image";
import { getProducts, formatINR } from "@/lib/products";

type CollectionProps = {
  searchParams: Promise<{
    q?: string | string[];
  }>;
};

const productImages: Record<string, string> = {
  luciana: "/products/luciana.jpeg",
  celeste: "/products/celeste.jpeg",
  aurora: "/products/aurora.jpeg",
};

export default async function Collection({ searchParams }: CollectionProps) {
  const products = await getProducts();
  const params = await searchParams;

  const rawQuery = Array.isArray(params.q) ? params.q[0] : params.q;
  const query = (rawQuery ?? "").trim().toLowerCase();

  const filteredProducts = query
    ? products.filter((p) =>
        [p.name, p.collection, p.slug].some((value) =>
          String(value ?? "").toLowerCase().includes(query)
        )
      )
    : products;

  return (
    <section className="section collection-page">
      <p className="eyebrow">CIRCA LUCIA</p>

      <h1 className="page-title">The Collection</h1>

      <p className="page-intro">
        A considered selection of designs, created in-house and crafted to order.
      </p>

      {query && (
        <div className="page-intro">
          <p>
            Showing results for <strong>“{rawQuery}”</strong>
          </p>
          <Link href="/collection" className="text-link">
            Clear search
          </Link>
        </div>
      )}

      <div className="filter-row">
        <span>All</span>
        <span>Signature</span>
        <span>Evening</span>
        <span>Bridal</span>
        <span>Statement</span>
      </div>

      <div className="product-grid product-grid-large">
        {filteredProducts.map((p) => (
          <Link
            className="product-card"
            href={`/product/${p.slug}`}
            key={p.id}
          >
            <div className="product-placeholder">
              {productImages[p.slug] ? (
                <Image
                  src={productImages[p.slug]}
                  alt={p.name}
                  fill
                  sizes="(max-width: 768px) 100vw, 33vw"
                  className="object-cover"
                />
              ) : (
                <span>{p.name}</span>
              )}
            </div>

            <div className="product-meta">
              <div>
                <h3>{p.name}</h3>
                <p>{p.collection}</p>
              </div>

              <strong>{formatINR(p.price)}</strong>
            </div>
          </Link>
        ))}
      </div>

      {filteredProducts.length === 0 && (
        <p className="page-intro">
          {query
            ? `No collection pieces found for “${rawQuery}”. Try another search.`
            : "No collection pieces are currently available."}
        </p>
      )}
    </section>
  );
}