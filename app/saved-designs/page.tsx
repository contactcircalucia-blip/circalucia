"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatINR, getProducts, type Product } from "@/lib/products";

const STORAGE_KEY = "cl-saved-designs";

export default function SavedDesignsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const loadSavedDesigns = async () => {
    try {
      const savedIds: string[] = JSON.parse(
        localStorage.getItem(STORAGE_KEY) || "[]"
      );

      if (savedIds.length === 0) {
        setProducts([]);
        setLoading(false);
        return;
      }

      const allProducts = await getProducts();

      const savedProducts = savedIds
        .map((id) => allProducts.find((product) => product.id === id))
        .filter((product): product is Product => Boolean(product));

      setProducts(savedProducts);
    } catch (error) {
      console.error("Unable to load saved designs:", error);
      setProducts([]);
    }

    setLoading(false);
  };

  useEffect(() => {
    loadSavedDesigns();

    const handleUpdate = () => {
      loadSavedDesigns();
    };

    window.addEventListener(
      "cl-saved-designs-updated",
      handleUpdate
    );

    return () => {
      window.removeEventListener(
        "cl-saved-designs-updated",
        handleUpdate
      );
    };
  }, []);

  const removeDesign = (productId: string) => {
    try {
      const savedIds: string[] = JSON.parse(
        localStorage.getItem(STORAGE_KEY) || "[]"
      );

      const updatedIds = savedIds.filter(
        (id) => id !== productId
      );

      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(updatedIds)
      );

      setProducts((current) =>
        current.filter((product) => product.id !== productId)
      );

      window.dispatchEvent(
        new Event("cl-saved-designs-updated")
      );
    } catch (error) {
      console.error("Unable to remove saved design:", error);
    }
  };

  if (loading) {
    return (
      <section className="section">
        <p className="eyebrow">CIRCA LUCIA</p>

        <h1 className="page-title">Saved Designs</h1>

        <p className="page-intro">Loading your saved designs...</p>
      </section>
    );
  }

  return (
    <section className="section">
      <p className="eyebrow">CIRCA LUCIA</p>

      <h1 className="page-title">Saved Designs</h1>

      <p className="page-intro">
        Designs you've chosen to keep close.
      </p>

      {products.length === 0 ? (
        <div
          style={{
            marginTop: "48px",
            padding: "48px 24px",
            borderTop: "1px solid var(--line)",
            borderBottom: "1px solid var(--line)",
            textAlign: "center",
          }}
        >
          <p
            style={{
              margin: "0 0 20px",
              fontFamily: '"Cormorant Garamond", serif',
              fontSize: "28px",
            }}
          >
            Nothing saved yet
          </p>

          <p
            style={{
              margin: "0 0 28px",
              color: "var(--muted)",
              fontSize: "13px",
            }}
          >
            Save the designs you love and return to them anytime.
          </p>

          <Link href="/collection" className="button">
            Explore the collection
          </Link>
        </div>
      ) : (
        <div className="product-grid product-grid-large">
          {products.map((product) => (
            <div
              className="product-card"
              key={product.id}
            >
              <Link
                href={`/product/${product.slug}`}
                style={{
                  display: "block",
                  textDecoration: "none",
                  color: "inherit",
                }}
              >
                <div className="product-placeholder">
                  {product.image_url ? (
                    <img
                      src={product.image_url}
                      alt={product.name}
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                      }}
                    />
                  ) : (
                    <span>{product.name}</span>
                  )}
                </div>

                <div className="product-meta">
                  <div>
                    <h3>{product.name}</h3>
                    <p>{product.collection}</p>
                  </div>

                  <strong>
                    {formatINR(product.price)}
                  </strong>
                </div>
              </Link>

              <button
                type="button"
                onClick={() => removeDesign(product.id)}
                style={{
                  marginTop: "12px",
                  border: "none",
                  background: "transparent",
                  padding: "0",
                  color: "var(--muted)",
                  fontFamily: "inherit",
                  fontSize: "11px",
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  cursor: "pointer",
                }}
              >
                Remove from saved
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}