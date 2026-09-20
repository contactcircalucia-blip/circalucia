"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type Product = {
  id: string;
  name: string;
  slug: string | null;
  is_active: boolean;
};

type InventoryRow = {
  id: string;
  product_id: string;
  size: string;
  stock_quantity: number;
};

const DEFAULT_SIZES = ["35", "36", "37", "38", "39", "40", "41", "42"];

export default function StockManagementPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [inventory, setInventory] = useState<InventoryRow[]>([]);

  const [loading, setLoading] = useState(true);
  const [adminChecked, setAdminChecked] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  const [search, setSearch] = useState("");
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function checkAdmin() {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setIsAdmin(false);
        setAdminChecked(true);
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("is_admin")
        .eq("id", user.id)
        .single();

      if (profileError) {
        console.error(profileError);
        setIsAdmin(false);
        setAdminChecked(true);
        return;
      }

      setIsAdmin(profile?.is_admin === true);
      setAdminChecked(true);
    } catch (err) {
      console.error(err);
      setIsAdmin(false);
      setAdminChecked(true);
    }
  }

  async function loadData() {
    try {
      setLoading(true);
      setError("");

      const [
        { data: productData, error: productError },
        { data: inventoryData, error: inventoryError },
      ] = await Promise.all([
        supabase
          .from("products")
          .select("id, name, slug, is_active")
          .order("name", { ascending: true }),

        supabase
          .from("product_inventory")
          .select("*")
          .order("size", { ascending: true }),
      ]);

      if (productError) throw productError;
      if (inventoryError) throw inventoryError;

      setProducts((productData || []) as Product[]);
      setInventory((inventoryData || []) as InventoryRow[]);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "Unable to load stock.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    checkAdmin();
  }, []);

  useEffect(() => {
    if (adminChecked && isAdmin) {
      loadData();
    } else if (adminChecked) {
      setLoading(false);
    }
  }, [adminChecked, isAdmin]);

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return products;

    return products.filter((product) =>
      [product.name, product.slug]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }, [products, search]);

  function getStock(productId: string, size: string) {
    return (
      inventory.find(
        (row) => row.product_id === productId && row.size === size
      )?.stock_quantity || 0
    );
  }

  function getTotalStock(productId: string) {
    return inventory
      .filter((row) => row.product_id === productId)
      .reduce((sum, row) => sum + Number(row.stock_quantity || 0), 0);
  }

  async function updateStock(
    productId: string,
    size: string,
    quantity: number
  ) {
    const safeQuantity = Math.max(0, Math.floor(Number(quantity) || 0));
    const key = `${productId}-${size}`;

    try {
      setSavingKey(key);
      setMessage("");
      setError("");

      const { data, error: upsertError } = await supabase
        .from("product_inventory")
        .upsert(
          {
            product_id: productId,
            size,
            stock_quantity: safeQuantity,
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: "product_id,size",
          }
        )
        .select()
        .single();

      if (upsertError) throw upsertError;

      setInventory((previous) => {
        const exists = previous.some(
          (row) =>
            row.product_id === productId &&
            row.size === size
        );

        if (exists) {
          return previous.map((row) =>
            row.product_id === productId &&
            row.size === size
              ? (data as InventoryRow)
              : row
          );
        }

        return [...previous, data as InventoryRow];
      });

      setMessage(`Size ${size} stock updated successfully.`);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "Unable to update stock.");
    } finally {
      setSavingKey(null);
    }
  }

  if (!adminChecked) {
    return (
      <main className="page">
        <section className="section">
          <div className="container">
            <p>Checking admin access...</p>
          </div>
        </section>
      </main>
    );
  }

  if (!isAdmin) {
    return (
      <main className="page">
        <section className="section">
          <div className="container">
            <div
              style={{
                maxWidth: "700px",
                margin: "80px auto",
                padding: "40px",
                border: "1px solid var(--line)",
                background: "var(--paper)",
              }}
            >
              <p
                style={{
                  fontSize: "12px",
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  color: "var(--muted)",
                }}
              >
                Circa Lucia
              </p>

              <h1
                style={{
                  fontFamily: "Cormorant Garamond, serif",
                  fontSize: "42px",
                  fontWeight: 500,
                }}
              >
                Admin access required
              </h1>

              <p style={{ color: "var(--muted)" }}>
                You do not have permission to access stock management.
              </p>
            </div>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="page">
      <section className="section">
        <div className="container">

          {/* HEADER */}

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-end",
              gap: "25px",
              flexWrap: "wrap",
              marginBottom: "28px",
            }}
          >
            <div>
              <p
                style={{
                  marginBottom: "8px",
                  fontSize: "12px",
                  letterSpacing: "0.16em",
                  textTransform: "uppercase",
                  color: "var(--muted)",
                }}
              >
                Circa Lucia · Administration
              </p>

              <h1
                style={{
                  margin: 0,
                  fontFamily: "Cormorant Garamond, serif",
                  fontSize: "48px",
                  fontWeight: 500,
                }}
              >
                Stock Management
              </h1>
            </div>

            <button
              type="button"
              onClick={loadData}
              disabled={loading}
              style={{
                padding: "12px 18px",
                border: "1px solid var(--line)",
                background: "transparent",
                cursor: loading ? "not-allowed" : "pointer",
              }}
            >
              {loading ? "Refreshing..." : "Refresh stock"}
            </button>
          </div>

          {/* ADMIN NAVIGATION */}

          <nav
            style={{
              display: "flex",
              gap: "28px",
              flexWrap: "wrap",
              borderTop: "1px solid var(--line)",
              borderBottom: "1px solid var(--line)",
              padding: "17px 0",
              marginBottom: "35px",
              fontSize: "12px",
              letterSpacing: "0.12em",
              textTransform: "uppercase",
            }}
          >
            <Link href="/admin">Orders</Link>

            <Link href="/admin/customers">
              Customers
            </Link>

            <Link href="/admin/management">
              Bespoke & Catalogue
            </Link>

            <Link
              href="/admin/stock"
              style={{
                fontWeight: 600,
                borderBottom: "1px solid currentColor",
              }}
            >
              Stock Management
            </Link>
          </nav>

          {/* MESSAGES */}

          {message && (
            <div
              style={{
                padding: "14px 16px",
                marginBottom: "20px",
                border: "1px solid var(--line)",
                background: "var(--cream)",
              }}
            >
              {message}
            </div>
          )}

          {error && (
            <div
              style={{
                padding: "14px 16px",
                marginBottom: "20px",
                border: "1px solid #c7aaa0",
                background: "#faf1ee",
                color: "#7c3f30",
              }}
            >
              {error}
            </div>
          )}

          {/* SEARCH */}

          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search products..."
            style={{
              width: "100%",
              padding: "15px 16px",
              border: "1px solid var(--line)",
              background: "var(--paper)",
              outline: "none",
              marginBottom: "30px",
              fontSize: "14px",
            }}
          />

          {/* STOCK */}

          {loading ? (
            <p style={{ color: "var(--muted)" }}>
              Loading stock...
            </p>
          ) : filteredProducts.length === 0 ? (
            <p style={{ color: "var(--muted)" }}>
              No products found.
            </p>
          ) : (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "20px",
              }}
            >
              {filteredProducts.map((product) => (
                <article
                  key={product.id}
                  style={{
                    border: "1px solid var(--line)",
                    background: "var(--paper)",
                  }}
                >
                  {/* PRODUCT HEADER */}

                  <div
                    style={{
                      padding: "22px 24px",
                      borderBottom: "1px solid var(--line)",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: "20px",
                      flexWrap: "wrap",
                    }}
                  >
                    <div>
                      <h2
                        style={{
                          margin: 0,
                          fontFamily: "Cormorant Garamond, serif",
                          fontWeight: 500,
                          fontSize: "27px",
                        }}
                      >
                        {product.name}
                      </h2>

                      <p
                        style={{
                          margin: "5px 0 0",
                          color: "var(--muted)",
                          fontSize: "13px",
                        }}
                      >
                        {product.slug || "No slug"} ·{" "}
                        {product.is_active ? "Active" : "Inactive"}
                      </p>
                    </div>

                    <div style={{ textAlign: "right" }}>
                      <div
                        style={{
                          fontSize: "11px",
                          textTransform: "uppercase",
                          letterSpacing: "0.1em",
                          color: "var(--muted)",
                          marginBottom: "5px",
                        }}
                      >
                        Total stock
                      </div>

                      <div
                        style={{
                          fontFamily: "Cormorant Garamond, serif",
                          fontSize: "30px",
                        }}
                      >
                        {getTotalStock(product.id)}
                      </div>
                    </div>
                  </div>

                  {/* SIZES */}

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "repeat(auto-fit, minmax(125px, 1fr))",
                      gap: "1px",
                      background: "var(--line)",
                    }}
                  >
                    {DEFAULT_SIZES.map((size) => {
                      const quantity = getStock(product.id, size);
                      const key = `${product.id}-${size}`;

                      return (
                        <div
                          key={size}
                          style={{
                            padding: "20px",
                            background: "var(--paper)",
                          }}
                        >
                          <div
                            style={{
                              fontSize: "11px",
                              letterSpacing: "0.12em",
                              textTransform: "uppercase",
                              color: "var(--muted)",
                              marginBottom: "10px",
                            }}
                          >
                            Size {size}
                          </div>

                          <input
                            type="number"
                            min="0"
                            value={quantity}
                            onChange={(event) => {
                              const value = Math.max(
                                0,
                                Math.floor(Number(event.target.value) || 0)
                              );

                              setInventory((previous) => {
                                const existing = previous.find(
                                  (row) =>
                                    row.product_id === product.id &&
                                    row.size === size
                                );

                                if (existing) {
                                  return previous.map((row) =>
                                    row.product_id === product.id &&
                                    row.size === size
                                      ? {
                                          ...row,
                                          stock_quantity: value,
                                        }
                                      : row
                                  );
                                }

                                return [
                                  ...previous,
                                  {
                                    id: `temp-${product.id}-${size}`,
                                    product_id: product.id,
                                    size,
                                    stock_quantity: value,
                                  },
                                ];
                              });
                            }}
                            onBlur={(event) => {
                              const value = Math.max(
                                0,
                                Math.floor(Number(event.target.value) || 0)
                              );

                              updateStock(product.id, size, value);
                            }}
                            onKeyDown={(event) => {
                              if (event.key === "Enter") {
                                event.currentTarget.blur();
                              }
                            }}
                            style={{
                              width: "100%",
                              padding: "11px",
                              border: "1px solid var(--line)",
                              background: "transparent",
                              fontSize: "16px",
                            }}
                          />

                          {savingKey === key && (
                            <div
                              style={{
                                marginTop: "8px",
                                fontSize: "10px",
                                letterSpacing: "0.1em",
                                textTransform: "uppercase",
                                color: "var(--muted)",
                              }}
                            >
                              Saving...
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}