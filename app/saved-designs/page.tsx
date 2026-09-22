"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  formatINR,
  getProductImage,
  getProducts,
  type Product,
} from "@/lib/products";
import { supabase } from "@/lib/supabase";

type SavedRow = {
  product_id: string;
};

export default function SavedDesignsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [loggedIn, setLoggedIn] = useState(true);
  const [error, setError] = useState("");

  const loadSavedDesigns = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) throw authError;

      if (!user) {
        setLoggedIn(false);
        setProducts([]);
        return;
      }

      setLoggedIn(true);

      const { data: savedRows, error: savedError } = await supabase
        .from("saved_products")
        .select("product_id")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (savedError) throw savedError;

      const rows = (savedRows || []) as SavedRow[];
      const savedIds = rows.map((row) => row.product_id);

      if (savedIds.length === 0) {
        setProducts([]);
        return;
      }

      // Use the exact same product loader already used by the CIRCA LUCIA
      // collection, then keep only products saved by this customer.
      const allActiveProducts = await getProducts();

      const productById = new Map(
        allActiveProducts.map((product) => [product.id, product])
      );

      const savedProducts = savedIds
        .map((id) => productById.get(id))
        .filter((product): product is Product => Boolean(product));

      setProducts(savedProducts);
    } catch (err) {
      console.error("Unable to load saved designs:", err);
      setError("Unable to load your saved designs.");
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSavedDesigns();

    const handleUpdate = () => loadSavedDesigns();
    window.addEventListener("cl-saved-designs-updated", handleUpdate);

    return () => {
      window.removeEventListener("cl-saved-designs-updated", handleUpdate);
    };
  }, [loadSavedDesigns]);

  async function removeDesign(productId: string) {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      const { error } = await supabase
        .from("saved_products")
        .delete()
        .eq("user_id", user.id)
        .eq("product_id", productId);

      if (error) throw error;

      setProducts((current) =>
        current.filter((product) => product.id !== productId)
      );

      window.dispatchEvent(new Event("cl-saved-designs-updated"));
    } catch (err) {
      console.error("Unable to remove saved design:", err);
      setError("Unable to remove this saved design.");
    }
  }

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
      <p className="page-intro">Designs you've chosen to keep close.</p>

      {error && (
        <p style={{ marginTop: 24, color: "#7c3f30" }}>{error}</p>
      )}

      {!loggedIn ? (
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
            Log in to view saved designs
          </p>

          <Link href="/account" className="button button-dark">
            Log in
          </Link>
        </div>
      ) : products.length === 0 ? (
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
          {products.map((product) => {
            const image = getProductImage(product);

            return (
              <div className="product-card" key={product.id}>
                <Link
                  href={`/product/${product.slug}`}
                  style={{
                    display: "block",
                    textDecoration: "none",
                    color: "inherit",
                  }}
                >
                  <div className="product-placeholder">
                    {image ? (
                      <img
                        src={image}
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

                    <strong>{formatINR(product.price)}</strong>
                  </div>
                </Link>

                <button
                  type="button"
                  onClick={() => removeDesign(product.id)}
                  className="button"
                  style={{ width: "100%", marginTop: "12px" }}
                >
                  Remove from saved
                </button>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
