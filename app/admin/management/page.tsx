"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type Product = {
  id: string;
  name: string;
  slug: string;
  collection: string | null;
  description: string | null;
  price: number;
  shipping_charge: number;
  tax_percent: number;
  material: string | null;
  heel_height: string | null;
  is_active: boolean;
  is_bespoke: boolean;
  featured_home: boolean;
  image_url: string | null;
};

type BespokeRequest = {
  id: string;
  request_number: string | null;
  user_id: string | null;
  name: string;
  email: string;
  phone: string | null;
  design_description: string | null;
  inspiration: string | null;
  preferred_material: string | null;
  preferred_color: string | null;
  budget: string | null;
  timing: string | null;
  status: string;
  admin_notes: string | null;
  created_at: string;
};

type Tab = "products" | "bespoke";

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "12px",
  border: "1px solid var(--line)",
  background: "var(--paper)",
  color: "var(--ink)",
  boxSizing: "border-box",
};

const buttonStyle: React.CSSProperties = {
  padding: "11px 16px",
  border: "1px solid var(--ink)",
  background: "var(--ink)",
  color: "var(--paper)",
  cursor: "pointer",
};

const emptyProduct = {
  name: "",
  slug: "",
  collection: "",
  description: "",
  price: "",
  shipping_charge: "0",
  tax_percent: "0",
  material: "",
  heel_height: "",
  image_url: "",
  is_active: true,
  is_bespoke: false,
  featured_home: false,
};

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function formatDate(value: string) {
  return new Date(value).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function money(value: number) {
  return `₹${Number(value || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export default function AdminManagementPage() {
  const [checked, setChecked] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  const [tab, setTab] = useState<Tab>("products");
  const [products, setProducts] = useState<Product[]>([]);
  const [requests, setRequests] = useState<BespokeRequest[]>([]);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [search, setSearch] = useState("");
  const [productForm, setProductForm] = useState({ ...emptyProduct });
  const [editingId, setEditingId] = useState<string | null>(null);

  const [requestFilter, setRequestFilter] = useState("all");
  const [notesDraft, setNotesDraft] = useState<Record<string, string>>({});
  const [savingRequest, setSavingRequest] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    async function checkAdmin() {
      try {
        const { data: authData, error: authError } =
          await supabase.auth.getUser();

        if (authError || !authData.user) {
          if (alive) {
            setIsAdmin(false);
            setChecked(true);
          }
          return;
        }

        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("is_admin")
          .eq("id", authData.user.id)
          .maybeSingle();

        if (profileError) throw profileError;

        if (alive) {
          setIsAdmin(profile?.is_admin === true);
          setChecked(true);
        }
      } catch (err) {
        console.error(err);

        if (alive) {
          setError("Could not verify admin access.");
          setChecked(true);
        }
      }
    }

    checkAdmin();

    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!isAdmin) return;

    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, tab]);

  async function loadData() {
    setLoading(true);
    setError("");

    try {
      if (tab === "products") {
        const { data, error } = await supabase
          .from("products")
          .select("*")
          .order("created_at", { ascending: false });

        if (error) throw error;

        setProducts((data || []) as Product[]);
      } else {
        const { data, error } = await supabase
          .from("bespoke_requests")
          .select("*")
          .order("created_at", { ascending: false });

        if (error) throw error;

        setRequests((data || []) as BespokeRequest[]);
      }
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "Unable to load data.");
    } finally {
      setLoading(false);
    }
  }

  const featuredCount = useMemo(
    () =>
      products.filter(
        (product) => product.featured_home && product.is_active
      ).length,
    [products]
  );

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();

    if (!q) return products;

    return products.filter((p) =>
      [p.name, p.slug, p.collection, p.material]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [products, search]);

  const filteredRequests = useMemo(() => {
    const q = search.trim().toLowerCase();

    return requests.filter((r) => {
      const matchesStatus =
        requestFilter === "all" || r.status === requestFilter;

      const matchesSearch =
        !q ||
        [
          r.request_number,
          r.name,
          r.email,
          r.phone,
          r.preferred_color,
          r.preferred_material,
          r.status,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(q);

      return matchesStatus && matchesSearch;
    });
  }, [requests, search, requestFilter]);

  function startEdit(product: Product) {
    setEditingId(product.id);

    setProductForm({
      name: product.name || "",
      slug: product.slug || "",
      collection: product.collection || "",
      description: product.description || "",
      price: String(product.price ?? ""),
      shipping_charge: String(product.shipping_charge ?? 0),
      tax_percent: String(product.tax_percent ?? 0),
      material: product.material || "",
      heel_height: product.heel_height || "",
      image_url: product.image_url || "",
      is_active: product.is_active,
      is_bespoke: product.is_bespoke,
      featured_home: product.featured_home === true,
    });

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function resetProductForm() {
    setEditingId(null);
    setProductForm({ ...emptyProduct });
  }

  async function saveProduct(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const name = productForm.name.trim();
      const slug = slugify(productForm.slug || name);
      const price = Number(productForm.price);
      const shippingCharge = Number(productForm.shipping_charge || 0);
      const taxPercent = Number(productForm.tax_percent || 0);

      if (!name) {
        throw new Error("Enter a product name.");
      }

      if (!slug) {
        throw new Error("Enter a valid product slug.");
      }

      if (!Number.isFinite(price) || price < 0) {
        throw new Error("Enter a valid price.");
      }

      if (!Number.isFinite(shippingCharge) || shippingCharge < 0) {
        throw new Error("Enter a valid shipping charge.");
      }

      if (
        !Number.isFinite(taxPercent) ||
        taxPercent < 0 ||
        taxPercent > 100
      ) {
        throw new Error("Enter a valid tax percentage between 0 and 100.");
      }

      const currentProduct = editingId
        ? products.find((product) => product.id === editingId)
        : null;

      const isAddingNewHomepageProduct =
        productForm.featured_home &&
        productForm.is_active &&
        !(
          currentProduct?.featured_home === true &&
          currentProduct?.is_active === true
        );

      if (isAddingNewHomepageProduct && featuredCount >= 3) {
        throw new Error(
          "Maximum 3 homepage products allowed. Remove one existing homepage product first."
        );
      }

      const payload = {
        name,
        slug,
        collection: productForm.collection.trim() || null,
        description: productForm.description.trim() || null,
        price,
        shipping_charge: shippingCharge,
        tax_percent: taxPercent,
        material: productForm.material.trim() || null,
        heel_height: productForm.heel_height.trim() || null,
        image_url: productForm.image_url.trim() || null,
        is_active: productForm.is_active,
        is_bespoke: productForm.is_bespoke,
        featured_home: productForm.featured_home,
        updated_at: new Date().toISOString(),
      };

      if (editingId) {
        const { data: updatedProduct, error } = await supabase
          .from("products")
          .update(payload)
          .eq("id", editingId)
          .select("*")
          .single();

        if (error) throw error;

        if (!updatedProduct) {
          throw new Error("Product was not updated. Check the products update policy.");
        }

        setProducts((previous) =>
          previous.map((product) =>
            product.id === editingId
              ? (updatedProduct as Product)
              : product
          )
        );

        setMessage(
          `Product updated successfully. Image: ${
            updatedProduct.image_url || "No image"
          }`
        );
      } else {
        const { error } = await supabase
          .from("products")
          .insert(payload);

        if (error) throw error;

        setMessage("Product added.");
      }

      resetProductForm();
      await loadData();
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "Could not save product.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleProduct(product: Product) {
    setError("");
    setMessage("");

    try {
      const nextActive = !product.is_active;

      if (
        nextActive &&
        product.featured_home &&
        featuredCount >= 3
      ) {
        const alreadyCounted =
          product.featured_home && product.is_active;

        if (!alreadyCounted) {
          throw new Error(
            "Maximum 3 homepage products allowed. Remove one existing homepage product first."
          );
        }
      }

      const { error } = await supabase
        .from("products")
        .update({
          is_active: nextActive,
          updated_at: new Date().toISOString(),
        })
        .eq("id", product.id);

      if (error) throw error;

      setMessage(
        nextActive
          ? "Product activated."
          : "Product deactivated."
      );

      await loadData();
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "Could not update product.");
    }
  }

  async function toggleHomepageProduct(product: Product) {
    setError("");
    setMessage("");

    try {
      const nextFeatured = !product.featured_home;

      if (nextFeatured && !product.is_active) {
        throw new Error(
          "Activate this product before displaying it on the homepage."
        );
      }

      if (nextFeatured && featuredCount >= 3) {
        throw new Error(
          "Maximum 3 homepage products allowed. Remove one existing homepage product first."
        );
      }

      const { error } = await supabase
        .from("products")
        .update({
          featured_home: nextFeatured,
          updated_at: new Date().toISOString(),
        })
        .eq("id", product.id);

      if (error) throw error;

      setMessage(
        nextFeatured
          ? `${product.name} added to homepage.`
          : `${product.name} removed from homepage.`
      );

      await loadData();
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "Could not update homepage product.");
    }
  }

  async function saveBespokeRequest(request: BespokeRequest) {
    setSavingRequest(request.id);
    setError("");
    setMessage("");

    try {
      const { error } = await supabase
        .from("bespoke_requests")
        .update({
          status: request.status,
          admin_notes: notesDraft[request.id] ?? request.admin_notes,
          updated_at: new Date().toISOString(),
        })
        .eq("id", request.id);

      if (error) throw error;

      setMessage(
        `Request ${request.request_number || request.id} updated.`
      );

      await loadData();
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "Could not update request.");
    } finally {
      setSavingRequest(null);
    }
  }

  if (!checked) {
    return (
      <main className="page">
        <section className="section">
          <div className="container">Checking admin access…</div>
        </section>
      </main>
    );
  }

  if (!isAdmin) {
    return (
      <main className="page">
        <section className="section">
          <div className="container">
            <h1>Admin access required</h1>
            <p>You do not have permission to view this page.</p>
            <a href="/admin">Return to admin</a>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="page">
      <section className="section">
        <div className="container">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-end",
              gap: 20,
              flexWrap: "wrap",
              marginBottom: 22,
            }}
          >
            <div>
              <p
                style={{
                  margin: "0 0 8px",
                  fontSize: 12,
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
                  fontSize: 48,
                  fontWeight: 500,
                }}
              >
                Bespoke &amp; Catalogue
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
                color: "var(--ink)",
                cursor: loading ? "not-allowed" : "pointer",
                opacity: loading ? 0.6 : 1,
              }}
            >
              {loading ? "Refreshing…" : "Refresh"}
            </button>
          </div>

          <nav
            aria-label="Admin sections"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 28,
              flexWrap: "wrap",
              borderTop: "1px solid var(--line)",
              borderBottom: "1px solid var(--line)",
              padding: "14px 0",
              marginBottom: 22,
            }}
          >
            <Link href="/admin" style={{ color:"var(--ink)", textDecoration:"none", fontSize:12, letterSpacing:"0.08em", textTransform:"uppercase" }}>Orders</Link>
            <Link href="/admin/customers" style={{ color:"var(--ink)", textDecoration:"none", fontSize:12, letterSpacing:"0.08em", textTransform:"uppercase" }}>Customers</Link>
            <Link href="/admin/management" style={{ color:"var(--ink)", textDecoration:"underline", textUnderlineOffset:6, fontWeight:600, fontSize:12, letterSpacing:"0.08em", textTransform:"uppercase" }}>Bespoke &amp; Catalogue</Link>
            <Link href="/admin/stock" style={{ color:"var(--ink)", textDecoration:"none", fontSize:12, letterSpacing:"0.08em", textTransform:"uppercase" }}>Stock Management</Link>
          </nav>

          <div
            style={{
              display: "flex",
              gap: 10,
              flexWrap: "wrap",
              marginBottom: 22,
            }}
          >
            <button
              type="button"
              style={{
                ...buttonStyle,
                background:
                  tab === "products"
                    ? "var(--ink)"
                    : "transparent",
                color:
                  tab === "products"
                    ? "var(--paper)"
                    : "var(--ink)",
              }}
              onClick={() => {
                setTab("products");
                setSearch("");
                setError("");
                setMessage("");
              }}
            >
              Products ({products.length})
            </button>

            <button
              type="button"
              style={{
                ...buttonStyle,
                background:
                  tab === "bespoke"
                    ? "var(--ink)"
                    : "transparent",
                color:
                  tab === "bespoke"
                    ? "var(--paper)"
                    : "var(--ink)",
              }}
              onClick={() => {
                setTab("bespoke");
                setSearch("");
                setError("");
                setMessage("");
              }}
            >
              Bespoke requests ({requests.length})
            </button>
          </div>

          {message && (
            <div
              style={{
                padding: 14,
                marginBottom: 16,
                background: "var(--cream)",
                border: "1px solid var(--line)",
              }}
            >
              {message}
            </div>
          )}

          {error && (
            <div
              style={{
                padding: 14,
                marginBottom: 16,
                background: "#faf1ee",
                border: "1px solid #c7aaa0",
                color: "#7c3f30",
              }}
            >
              {error}
            </div>
          )}

          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={
              tab === "products"
                ? "Search products…"
                : "Search requests by name, email, phone…"
            }
            style={{ ...inputStyle, marginBottom: 24 }}
          />

          {tab === "products" && (
            <>
              <div
                style={{
                  marginBottom: 18,
                  padding: "14px 16px",
                  border: "1px solid var(--line)",
                  background: "var(--cream)",
                }}
              >
                <strong>Homepage products: {featuredCount}/3</strong>
                <div
                  style={{
                    marginTop: 4,
                    color: "var(--muted)",
                    fontSize: 14,
                  }}
                >
                  Choose up to three active products for the
                  “Designed to be remembered.” section.
                </div>
              </div>

              <form
                onSubmit={saveProduct}
                style={{
                  border: "1px solid var(--line)",
                  padding: 22,
                  marginBottom: 30,
                  background: "var(--paper)",
                }}
              >
                <h2 style={{ marginTop: 0 }}>
                  {editingId ? "Edit product" : "Add product"}
                </h2>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "repeat(auto-fit, minmax(220px, 1fr))",
                    gap: 12,
                  }}
                >
                  <input
                    required
                    placeholder="Product name"
                    value={productForm.name}
                    onChange={(e) =>
                      setProductForm((p) => ({
                        ...p,
                        name: e.target.value,
                        slug: editingId
                          ? p.slug
                          : slugify(e.target.value),
                      }))
                    }
                    style={inputStyle}
                  />

                  <input
                    required
                    placeholder="URL slug"
                    value={productForm.slug}
                    onChange={(e) =>
                      setProductForm((p) => ({
                        ...p,
                        slug: slugify(e.target.value),
                      }))
                    }
                    style={inputStyle}
                  />

                  <input
                    required
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="Price (INR)"
                    value={productForm.price}
                    onChange={(e) =>
                      setProductForm((p) => ({
                        ...p,
                        price: e.target.value,
                      }))
                    }
                    style={inputStyle}
                  />

                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="Shipping charge (INR)"
                    value={productForm.shipping_charge}
                    onChange={(e) =>
                      setProductForm((p) => ({
                        ...p,
                        shipping_charge: e.target.value,
                      }))
                    }
                    style={inputStyle}
                  />

                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    placeholder="Tax (%)"
                    value={productForm.tax_percent}
                    onChange={(e) =>
                      setProductForm((p) => ({
                        ...p,
                        tax_percent: e.target.value,
                      }))
                    }
                    style={inputStyle}
                  />

                  <input
                    placeholder="Collection"
                    value={productForm.collection}
                    onChange={(e) =>
                      setProductForm((p) => ({
                        ...p,
                        collection: e.target.value,
                      }))
                    }
                    style={inputStyle}
                  />

                  <input
                    placeholder="Material"
                    value={productForm.material}
                    onChange={(e) =>
                      setProductForm((p) => ({
                        ...p,
                        material: e.target.value,
                      }))
                    }
                    style={inputStyle}
                  />

                  <input
                    placeholder="Heel height"
                    value={productForm.heel_height}
                    onChange={(e) =>
                      setProductForm((p) => ({
                        ...p,
                        heel_height: e.target.value,
                      }))
                    }
                    style={inputStyle}
                  />

                  <input
                    placeholder="Image URL (optional)"
                    value={productForm.image_url}
                    onChange={(e) =>
                      setProductForm((p) => ({
                        ...p,
                        image_url: e.target.value,
                      }))
                    }
                    style={inputStyle}
                  />
                </div>

                <textarea
                  placeholder="Product description"
                  value={productForm.description}
                  onChange={(e) =>
                    setProductForm((p) => ({
                      ...p,
                      description: e.target.value,
                    }))
                  }
                  rows={4}
                  style={{ ...inputStyle, marginTop: 12 }}
                />

                <div
                  style={{
                    display: "flex",
                    gap: 22,
                    flexWrap: "wrap",
                    margin: "16px 0",
                  }}
                >
                  <label>
                    <input
                      type="checkbox"
                      checked={productForm.is_active}
                      onChange={(e) =>
                        setProductForm((p) => ({
                          ...p,
                          is_active: e.target.checked,
                        }))
                      }
                    />{" "}
                    Active / visible
                  </label>

                  <label>
                    <input
                      type="checkbox"
                      checked={productForm.is_bespoke}
                      onChange={(e) =>
                        setProductForm((p) => ({
                          ...p,
                          is_bespoke: e.target.checked,
                        }))
                      }
                    />{" "}
                    Bespoke product
                  </label>

                  <label>
                    <input
                      type="checkbox"
                      checked={productForm.featured_home}
                      onChange={(e) =>
                        setProductForm((p) => ({
                          ...p,
                          featured_home: e.target.checked,
                        }))
                      }
                    />{" "}
                    Display on homepage
                  </label>
                </div>

                <div style={{ display: "flex", gap: 10 }}>
                  <button
                    type="submit"
                    disabled={saving}
                    style={buttonStyle}
                  >
                    {saving
                      ? "Saving…"
                      : editingId
                      ? "Save changes"
                      : "Add product"}
                  </button>

                  {editingId && (
                    <button
                      type="button"
                      onClick={resetProductForm}
                      style={{
                        ...buttonStyle,
                        background: "transparent",
                        color: "var(--ink)",
                      }}
                    >
                      Cancel edit
                    </button>
                  )}
                </div>
              </form>

              {loading ? (
                <p>Loading products…</p>
              ) : filteredProducts.length === 0 ? (
                <p>No products found.</p>
              ) : (
                <div style={{ display: "grid", gap: 12 }}>
                  {filteredProducts.map((product) => (
                    <article
                      key={product.id}
                      style={{
                        border: "1px solid var(--line)",
                        padding: 18,
                        display: "grid",
                        gridTemplateColumns:
                          "minmax(0, 1fr) auto",
                        gap: 18,
                        alignItems: "center",
                        background: "var(--paper)",
                      }}
                    >
                      <div>
                        <strong
                          style={{
                            fontFamily:
                              "Cormorant Garamond, serif",
                            fontSize: 24,
                          }}
                        >
                          {product.name}
                        </strong>

                        <p
                          style={{
                            margin: "6px 0",
                            color: "var(--muted)",
                          }}
                        >
                          {product.slug} ·{" "}
                          {product.collection ||
                            "No collection"}
                        </p>

                        <p style={{ margin: "6px 0" }}>
                          {money(product.price)} ·{" "}
                          {product.material ||
                            "Material not set"}
                          {product.heel_height
                            ? ` · ${product.heel_height}`
                            : ""}
                        </p>

                        <p style={{ margin: "6px 0", color: "var(--muted)" }}>
                          Shipping: {money(product.shipping_charge || 0)} · Tax:{" "}
                          {Number(product.tax_percent || 0).toLocaleString("en-IN", {
                            maximumFractionDigits: 2,
                          })}
                          %
                        </p>

                        <p style={{ margin: "6px 0" }}>
                          <strong>
                            {product.is_active
                              ? "Active"
                              : "Inactive"}
                          </strong>

                          {product.is_bespoke
                            ? " · Bespoke"
                            : ""}

                          {product.featured_home
                            ? " · Homepage"
                            : ""}
                        </p>
                      </div>

                      <div
                        style={{
                          display: "flex",
                          gap: 8,
                          flexWrap: "wrap",
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => startEdit(product)}
                          style={buttonStyle}
                        >
                          Edit
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            toggleHomepageProduct(product)
                          }
                          style={{
                            ...buttonStyle,
                            background:
                              product.featured_home
                                ? "var(--cream)"
                                : "transparent",
                            color: "var(--ink)",
                          }}
                        >
                          {product.featured_home
                            ? "Remove from homepage"
                            : "Display on homepage"}
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            toggleProduct(product)
                          }
                          style={{
                            ...buttonStyle,
                            background: "transparent",
                            color: "var(--ink)",
                          }}
                        >
                          {product.is_active
                            ? "Deactivate"
                            : "Activate"}
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </>
          )}

          {tab === "bespoke" && (
            <>
              <div style={{ marginBottom: 20, maxWidth: 320 }}>
                <select
                  value={requestFilter}
                  onChange={(e) =>
                    setRequestFilter(e.target.value)
                  }
                  style={inputStyle}
                >
                  <option value="all">All statuses</option>
                  <option value="pending">Pending</option>
                  <option value="reviewing">Reviewing</option>
                  <option value="contacted">Contacted</option>
                  <option value="accepted">Accepted</option>
                  <option value="rejected">Rejected</option>
                  <option value="completed">Completed</option>
                </select>
              </div>

              {loading ? (
                <p>Loading bespoke requests…</p>
              ) : filteredRequests.length === 0 ? (
                <p>No bespoke requests found.</p>
              ) : (
                <div style={{ display: "grid", gap: 16 }}>
                  {filteredRequests.map((request) => (
                    <article
                      key={request.id}
                      style={{
                        border: "1px solid var(--line)",
                        padding: 22,
                        background: "var(--paper)",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: 12,
                          flexWrap: "wrap",
                        }}
                      >
                        <div>
                          <h2
                            style={{
                              fontFamily:
                                "Cormorant Garamond, serif",
                              fontWeight: 500,
                              margin: 0,
                            }}
                          >
                            {request.request_number ||
                              request.id}
                          </h2>

                          <p
                            style={{
                              color: "var(--muted)",
                            }}
                          >
                            {formatDate(request.created_at)}
                          </p>
                        </div>

                        <div>
                          <strong>{request.name}</strong>
                          <div>{request.email}</div>
                          <div>
                            {request.phone || "No phone"}
                          </div>
                        </div>
                      </div>

                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns:
                            "repeat(auto-fit, minmax(220px, 1fr))",
                          gap: 18,
                          margin: "20px 0",
                        }}
                      >
                        <div>
                          <strong>Design</strong>
                          <p>
                            {request.design_description ||
                              "—"}
                          </p>
                        </div>

                        <div>
                          <strong>Inspiration</strong>
                          <p>
                            {request.inspiration || "—"}
                          </p>
                        </div>

                        <div>
                          <strong>Preferences</strong>
                          <p>
                            Material:{" "}
                            {request.preferred_material ||
                              "—"}
                            <br />
                            Color:{" "}
                            {request.preferred_color || "—"}
                            <br />
                            Budget:{" "}
                            {request.budget || "—"}
                            <br />
                            Timing:{" "}
                            {request.timing || "—"}
                          </p>
                        </div>
                      </div>

                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns:
                            "repeat(auto-fit, minmax(220px, 1fr))",
                          gap: 12,
                        }}
                      >
                        <div>
                          <label
                            style={{
                              display: "block",
                              marginBottom: 6,
                              fontSize: 12,
                              color: "var(--muted)",
                            }}
                          >
                            Request status
                          </label>

                          <select
                            value={request.status}
                            onChange={(e) =>
                              setRequests((previous) =>
                                previous.map((r) =>
                                  r.id === request.id
                                    ? {
                                        ...r,
                                        status:
                                          e.target.value,
                                      }
                                    : r
                                )
                              )
                            }
                            style={inputStyle}
                          >
                            <option value="pending">
                              Pending
                            </option>
                            <option value="reviewing">
                              Reviewing
                            </option>
                            <option value="contacted">
                              Contacted
                            </option>
                            <option value="accepted">
                              Accepted
                            </option>
                            <option value="rejected">
                              Rejected
                            </option>
                            <option value="completed">
                              Completed
                            </option>
                          </select>
                        </div>

                        <div>
                          <label
                            style={{
                              display: "block",
                              marginBottom: 6,
                              fontSize: 12,
                              color: "var(--muted)",
                            }}
                          >
                            Admin notes
                          </label>

                          <textarea
                            rows={3}
                            value={
                              notesDraft[request.id] ??
                              request.admin_notes ??
                              ""
                            }
                            onChange={(e) =>
                              setNotesDraft((previous) => ({
                                ...previous,
                                [request.id]:
                                  e.target.value,
                              }))
                            }
                            placeholder="Internal notes…"
                            style={inputStyle}
                          />
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          saveBespokeRequest(request)
                        }
                        disabled={
                          savingRequest === request.id
                        }
                        style={{
                          ...buttonStyle,
                          marginTop: 14,
                        }}
                      >
                        {savingRequest === request.id
                          ? "Saving…"
                          : "Save request"}
                      </button>
                    </article>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </section>
    </main>
  );
}