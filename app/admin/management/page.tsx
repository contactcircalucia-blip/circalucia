"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import AdminNav from "@/components/AdminNav";

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
  video_url: string | null;
  product_details: string | null;
  size_and_fit: string | null;
  material_and_care: string | null;
  delivery_note: string | null;
  return_note: string | null;
  specifications: Record<string, string> | null;
};

type ProductImage = {
  id: string;
  product_id: string;
  image_url: string;
  sort_order: number;
  created_at: string;
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
  final_price: number | null;
  approved_at: string | null;
  ordered_at: string | null;
  order_id: string | null;
  customer_message: string | null;
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
  video_url: "",
  product_details: "",
  size_and_fit: "",
  material_and_care: "",
  delivery_note: "",
  return_note: "",
  spec_colour: "",
  spec_heel_type: "",
  spec_toe_shape: "",
  spec_fastening: "",
  spec_upper_material: "",
  spec_sole_material: "",
  spec_occasion: "",
  spec_ornamentation: "",
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


function mediaFileName(value: string | null | undefined) {
  const clean = (value || "").trim().split("?")[0].split("#")[0];
  if (!clean) return "";
  const parts = clean.split("/");
  return decodeURIComponent(parts[parts.length - 1] || clean);
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
  const [showProductForm, setShowProductForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [productImages, setProductImages] = useState<ProductImage[]>([]);
  const [newImageUrl, setNewImageUrl] = useState("");
  const [savingImage, setSavingImage] = useState(false);

  const [requestFilter, setRequestFilter] = useState("all");
  const [notesDraft, setNotesDraft] = useState<Record<string, string>>({});
  const [priceDraft, setPriceDraft] = useState<Record<string, string>>({});
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

  async function startEdit(product: Product) {
    setShowProductForm(true);
    setEditingId(product.id);
    setProductImages([]);
    setNewImageUrl("");

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
      video_url: product.video_url || "",
      product_details: product.product_details || "",
      size_and_fit: product.size_and_fit || "",
      material_and_care: product.material_and_care || "",
      delivery_note: product.delivery_note || "",
      return_note: product.return_note || "",
      spec_colour: product.specifications?.colour || "",
      spec_heel_type: product.specifications?.heel_type || "",
      spec_toe_shape: product.specifications?.toe_shape || "",
      spec_fastening: product.specifications?.fastening || "",
      spec_upper_material: product.specifications?.upper_material || "",
      spec_sole_material: product.specifications?.sole_material || "",
      spec_occasion: product.specifications?.occasion || "",
      spec_ornamentation: product.specifications?.ornamentation || "",
      is_active: product.is_active,
      is_bespoke: product.is_bespoke,
      featured_home: product.featured_home === true,
    });

    const { data: imageRows, error: imageError } = await supabase
      .from("product_images")
      .select("*")
      .eq("product_id", product.id)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (imageError) {
      console.error(imageError);
      setError(imageError.message || "Unable to load additional product photos.");
    } else {
      setProductImages((imageRows || []) as ProductImage[]);
    }

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function reloadProductImages(productId: string) {
    const { data, error } = await supabase
      .from("product_images")
      .select("*")
      .eq("product_id", productId)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) throw error;
    setProductImages((data || []) as ProductImage[]);
  }

  async function addProductImage() {
    if (!editingId) {
      setError("Save the product first, then add additional photos.");
      return;
    }

    const imageUrl = newImageUrl.trim();

    if (!imageUrl) {
      setError("Enter an additional image URL.");
      return;
    }

    if (productImages.length >= 5) {
      setError("Maximum 5 gallery photos allowed per product.");
      return;
    }

    setSavingImage(true);
    setError("");
    setMessage("");

    try {
      const nextSortOrder =
        productImages.length === 0
          ? 0
          : Math.max(
              ...productImages.map((image) => image.sort_order || 0)
            ) + 1;

      const { data, error: insertError } = await supabase
        .from("product_images")
        .insert({
          product_id: editingId,
          image_url: imageUrl,
          sort_order: nextSortOrder,
        })
        .select("id, product_id, image_url, sort_order, created_at");

      if (insertError) {
        const readableError = [
          insertError.message,
          insertError.details,
          insertError.hint,
          insertError.code ? `Code: ${insertError.code}` : "",
        ]
          .filter(Boolean)
          .join(" | ");

        console.error(
          "ADD PRODUCT IMAGE SUPABASE ERROR:",
          JSON.stringify(
            {
              message: insertError.message || "",
              details: insertError.details || "",
              hint: insertError.hint || "",
              code: insertError.code || "",
              product_id: editingId,
              image_url: imageUrl,
              sort_order: nextSortOrder,
            },
            null,
            2
          )
        );

        setError(
          readableError ||
            "Supabase rejected the gallery photo insert. Check the browser console."
        );
        return;
      }

      console.log("PRODUCT IMAGE INSERT SUCCESS:", data);

      setNewImageUrl("");
      await reloadProductImages(editingId);
      setMessage("Additional product photo added.");
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : typeof err === "string"
          ? err
          : "Unexpected error while adding product photo.";

      console.error("ADD PRODUCT IMAGE UNEXPECTED ERROR:", message);
      setError(message);
    } finally {
      setSavingImage(false);
    }
  }

  async function removeProductImage(imageId: string) {
    if (!editingId) return;

    setSavingImage(true);
    setError("");
    setMessage("");

    try {
      const { error } = await supabase
        .from("product_images")
        .delete()
        .eq("id", imageId);

      if (error) throw error;

      await reloadProductImages(editingId);
      setMessage("Additional product photo removed.");
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "Could not remove product photo.");
    } finally {
      setSavingImage(false);
    }
  }

  async function moveProductImage(imageId: string, direction: -1 | 1) {
    if (!editingId) return;

    const currentIndex = productImages.findIndex((image) => image.id === imageId);
    const targetIndex = currentIndex + direction;

    if (
      currentIndex < 0 ||
      targetIndex < 0 ||
      targetIndex >= productImages.length
    ) {
      return;
    }

    setSavingImage(true);
    setError("");
    setMessage("");

    try {
      const current = productImages[currentIndex];
      const target = productImages[targetIndex];

      const currentOrder = current.sort_order ?? currentIndex;
      const targetOrder = target.sort_order ?? targetIndex;

      const { error: currentError } = await supabase
        .from("product_images")
        .update({ sort_order: targetOrder })
        .eq("id", current.id);

      if (currentError) throw currentError;

      const { error: targetError } = await supabase
        .from("product_images")
        .update({ sort_order: currentOrder })
        .eq("id", target.id);

      if (targetError) throw targetError;

      await reloadProductImages(editingId);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "Could not reorder product photos.");
    } finally {
      setSavingImage(false);
    }
  }

  function resetProductForm() {
    setShowProductForm(false);
    setEditingId(null);
    setProductForm({ ...emptyProduct });
    setProductImages([]);
    setNewImageUrl("");
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

      if (!productForm.image_url.trim()) {
        throw new Error(
          "Main Product Photo is required. Add the cover image URL before saving."
        );
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
        video_url: productForm.video_url.trim() || null,
        product_details: productForm.product_details.trim() || null,
        size_and_fit: productForm.size_and_fit.trim() || null,
        material_and_care: productForm.material_and_care.trim() || null,
        delivery_note: productForm.delivery_note.trim() || null,
        return_note: productForm.return_note.trim() || null,
        specifications: {
          colour: productForm.spec_colour.trim(),
          heel_type: productForm.spec_heel_type.trim(),
          toe_shape: productForm.spec_toe_shape.trim(),
          fastening: productForm.spec_fastening.trim(),
          upper_material: productForm.spec_upper_material.trim(),
          sole_material: productForm.spec_sole_material.trim(),
          occasion: productForm.spec_occasion.trim(),
          ornamentation: productForm.spec_ornamentation.trim(),
        },
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

        const savedSpecifications = Object.values(
          updatedProduct.specifications || {}
        ).filter((value) => String(value || "").trim()).length;

        const savedItems = [
          updatedProduct.image_url ? "Main photo" : "",
          productImages.length > 0
            ? `${productImages.length} gallery photo${
                productImages.length === 1 ? "" : "s"
              }`
            : "",
          updatedProduct.video_url ? "Product video" : "",
          updatedProduct.description ? "Product description" : "",
          updatedProduct.product_details ? "Product details" : "",
          updatedProduct.size_and_fit ? "Size & Fit" : "",
          updatedProduct.material_and_care ? "Material & Care" : "",
          savedSpecifications > 0
            ? `${savedSpecifications} specification${
                savedSpecifications === 1 ? "" : "s"
              }`
            : "",
          updatedProduct.delivery_note ? "Delivery note" : "",
          updatedProduct.return_note ? "Returns note" : "",
          updatedProduct.featured_home ? "Homepage display" : "",
        ].filter(Boolean);

        setMessage(
          `${updatedProduct.name} updated successfully.${
            savedItems.length
              ? ` Saved: ${savedItems.join(" · ")}.`
              : ""
          }`
        );
      } else {
        const { error } = await supabase
          .from("products")
          .insert(payload);

        if (error) throw error;

        setMessage(
          `Product added successfully.${
            productForm.video_url.trim() ? " Product video saved." : ""
          }${
            productForm.featured_home ? " Homepage display enabled." : ""
          }`
        );
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

  async function approveAndCreateBespokeOrder(request: BespokeRequest) {
    setSavingRequest(request.id);
    setError("");
    setMessage("");

    try {
      if (request.order_id) {
        throw new Error("This bespoke request already has an order.");
      }

      const finalPrice = Number(
        priceDraft[request.id] ?? request.final_price ?? ""
      );

      if (!Number.isFinite(finalPrice) || finalPrice <= 0) {
        throw new Error("Enter a valid final bespoke price before approval.");
      }

      const { data, error: rpcError } = await supabase.rpc(
        "admin_approve_bespoke_and_create_order",
        {
          p_request_id: request.id,
          p_final_price: finalPrice,
          p_admin_notes: notesDraft[request.id] ?? request.admin_notes ?? null,
        }
      );

      if (rpcError) throw rpcError;

      const result = data as {
        order_id?: string;
        order_number?: string;
        already_created?: boolean;
      } | null;

      setMessage(
        result?.already_created
          ? `Bespoke order ${result.order_number || ""} already exists.`
          : `Bespoke request approved. Order ${result?.order_number || ""} created for the customer.`
      );

      await loadData();
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "Could not approve bespoke request.");
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

          <AdminNav />

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

              {!showProductForm && !editingId && (
                <button
                  type="button"
                  onClick={() => {
                    resetProductForm();
                    setShowProductForm(true);
                    setError("");
                    setMessage("");
                  }}
                  style={{
                    ...buttonStyle,
                    marginBottom: 30,
                    minWidth: 150,
                  }}
                >
                  + Add product
                </button>
              )}

              {(showProductForm || editingId) && (
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

                  <div>
                    <label
                      style={{
                        display: "block",
                        marginBottom: 6,
                        fontSize: 12,
                        color: "var(--muted)",
                      }}
                    >
                      Main Product Photo · required
                    </label>

                    {productForm.image_url.trim() && (
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          marginBottom: 8,
                          padding: 8,
                          border: "1px solid var(--line)",
                          background: "var(--cream)",
                        }}
                      >
                        <img
                          src={productForm.image_url.trim()}
                          alt="Main product photo"
                          style={{
                            width: 72,
                            height: 72,
                            objectFit: "cover",
                            display: "block",
                            border: "1px solid var(--line)",
                            background: "var(--paper)",
                          }}
                          onError={(event) => {
                            event.currentTarget.style.display = "none";
                          }}
                        />
                        <div style={{ minWidth: 0, fontSize: 12 }}>
                          <strong style={{ display: "block", marginBottom: 4 }}>
                            {mediaFileName(productForm.image_url)}
                          </strong>
                          <span
                            style={{
                              color: "var(--muted)",
                              overflowWrap: "anywhere",
                            }}
                          >
                            Path: {productForm.image_url}
                          </span>
                        </div>
                      </div>
                    )}

                    <input
                      required
                      placeholder="/products/luciana.jpg"
                      value={productForm.image_url}
                      onChange={(e) =>
                        setProductForm((p) => ({
                          ...p,
                          image_url: e.target.value,
                        }))
                      }
                      style={inputStyle}
                    />
                    <div
                      style={{
                        marginTop: 5,
                        color: "var(--muted)",
                        fontSize: 11,
                        lineHeight: 1.4,
                      }}
                    >
                      For files inside public/products, use /products/filename.jpg.
                      This is the cover image used on Homepage, Collection and the
                      product page.
                    </div>
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
                      Product video · maximum 1
                    </label>
                    {productForm.video_url.trim() && (
                      <div
                        style={{
                          marginBottom: 8,
                          padding: 8,
                          border: "1px solid var(--line)",
                          background: "var(--cream)",
                        }}
                      >
                        <video
                          key={productForm.video_url.trim()}
                          src={productForm.video_url.trim()}
                          muted
                          autoPlay
                          loop
                          playsInline
                          preload="metadata"
                          style={{
                            display: "block",
                            width: "100%",
                            maxWidth: 220,
                            aspectRatio: "4 / 5",
                            objectFit: "cover",
                            border: "1px solid var(--line)",
                            background: "var(--paper)",
                          }}
                        />

                        <div
                          style={{
                            marginTop: 8,
                            minWidth: 0,
                            fontSize: 12,
                          }}
                        >
                          <strong style={{ display: "block", marginBottom: 4 }}>
                            {mediaFileName(productForm.video_url)}
                          </strong>

                          <span
                            style={{
                              color: "var(--muted)",
                              overflowWrap: "anywhere",
                            }}
                          >
                            Path: {productForm.video_url}
                          </span>
                        </div>
                      </div>
                    )}

                    <input
                      type="text"
                      placeholder="/additonal/luciana/video.mp4"
                      value={productForm.video_url}
                      onChange={(e) =>
                        setProductForm((p) => ({
                          ...p,
                          video_url: e.target.value,
                        }))
                      }
                      style={inputStyle}
                    />

                    <div
                      style={{
                        marginTop: 5,
                        color: "var(--muted)",
                        fontSize: 11,
                        lineHeight: 1.4,
                      }}
                    >
                      Optional product-page video. One video per product. For a
                      file inside public, use its browser path such as
                      /additonal/luciana/video.mp4.
                    </div>
                  </div>
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
                    marginTop: 16,
                    padding: 18,
                    border: "1px solid var(--line)",
                    background: "var(--cream)",
                  }}
                >
                  <div style={{ marginBottom: 14 }}>
                    <strong>Product page information</strong>
                    <div
                      style={{
                        marginTop: 4,
                        color: "var(--muted)",
                        fontSize: 13,
                      }}
                    >
                      Optional details shown in the premium information sections
                      on the product page.
                    </div>
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "repeat(auto-fit, minmax(260px, 1fr))",
                      gap: 12,
                    }}
                  >
                    <textarea
                      rows={4}
                      placeholder="Product Details"
                      value={productForm.product_details}
                      onChange={(e) =>
                        setProductForm((p) => ({
                          ...p,
                          product_details: e.target.value,
                        }))
                      }
                      style={inputStyle}
                    />

                    <textarea
                      rows={4}
                      placeholder="Size & Fit"
                      value={productForm.size_and_fit}
                      onChange={(e) =>
                        setProductForm((p) => ({
                          ...p,
                          size_and_fit: e.target.value,
                        }))
                      }
                      style={inputStyle}
                    />

                    <textarea
                      rows={4}
                      placeholder="Material & Care"
                      value={productForm.material_and_care}
                      onChange={(e) =>
                        setProductForm((p) => ({
                          ...p,
                          material_and_care: e.target.value,
                        }))
                      }
                      style={inputStyle}
                    />

                    <textarea
                      rows={4}
                      placeholder="Delivery note"
                      value={productForm.delivery_note}
                      onChange={(e) =>
                        setProductForm((p) => ({
                          ...p,
                          delivery_note: e.target.value,
                        }))
                      }
                      style={inputStyle}
                    />

                    <textarea
                      rows={4}
                      placeholder="Returns / replacements note"
                      value={productForm.return_note}
                      onChange={(e) =>
                        setProductForm((p) => ({
                          ...p,
                          return_note: e.target.value,
                        }))
                      }
                      style={inputStyle}
                    />
                  </div>

                  <div style={{ marginTop: 18, marginBottom: 10 }}>
                    <strong>Specifications</strong>
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "repeat(auto-fit, minmax(210px, 1fr))",
                      gap: 12,
                    }}
                  >
                    {[
                      ["spec_colour", "Colour"],
                      ["spec_heel_type", "Heel type"],
                      ["spec_toe_shape", "Toe shape"],
                      ["spec_fastening", "Fastening"],
                      ["spec_upper_material", "Upper material"],
                      ["spec_sole_material", "Sole material"],
                      ["spec_occasion", "Occasion"],
                      ["spec_ornamentation", "Ornamentation"],
                    ].map(([field, label]) => (
                      <input
                        key={field}
                        placeholder={label}
                        value={
                          productForm[
                            field as keyof typeof productForm
                          ] as string
                        }
                        onChange={(e) =>
                          setProductForm((p) => ({
                            ...p,
                            [field]: e.target.value,
                          }))
                        }
                        style={inputStyle}
                      />
                    ))}
                  </div>
                </div>

                {editingId && (
                  <div
                    style={{
                      marginTop: 16,
                      padding: 18,
                      border: "1px solid var(--line)",
                      background: "var(--cream)",
                    }}
                  >
                    <div style={{ marginBottom: 12 }}>
                      <strong>Gallery photos ({productImages.length}/5)</strong>
                      <div
                        style={{
                          marginTop: 4,
                          color: "var(--muted)",
                          fontSize: 13,
                        }}
                      >
                        Add up to 5 gallery photos. They appear only on the
                        individual product page. The Main Product Photo above
                        remains the cover image used on Homepage and Collection.
                      </div>
                    </div>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "minmax(0, 1fr) auto",
                        gap: 10,
                      }}
                    >
                      <input
                        type="url"
                        placeholder={
                          productImages.length >= 5
                            ? "Maximum 5 gallery photos reached"
                            : "Gallery photo URL"
                        }
                        value={newImageUrl}
                        disabled={productImages.length >= 5}
                        onChange={(e) => setNewImageUrl(e.target.value)}
                        style={inputStyle}
                      />
                      <button
                        type="button"
                        onClick={addProductImage}
                        disabled={savingImage || productImages.length >= 5}
                        style={{
                          ...buttonStyle,
                          opacity: productImages.length >= 5 ? 0.45 : 1,
                          cursor:
                            savingImage || productImages.length >= 5
                              ? "not-allowed"
                              : "pointer",
                        }}
                      >
                        {savingImage
                          ? "Saving…"
                          : productImages.length >= 5
                          ? "5 photos added"
                          : "Add photo"}
                      </button>
                    </div>

                    {productImages.length > 0 && (
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns:
                            "repeat(auto-fill, minmax(120px, 140px))",
                          gap: 12,
                          marginTop: 16,
                        }}
                      >
                        {productImages.map((image, index) => (
                          <div
                            key={image.id}
                            style={{
                              border: "1px solid var(--line)",
                              background: "var(--paper)",
                              padding: 10,
                            }}
                          >
                            <div
                              style={{
                                position: "relative",
                                width: 120,
                                height: 120,
                                maxWidth: "100%",
                                margin: "0 auto 8px",
                                border: "1px solid var(--line)",
                                background: "var(--cream)",
                                overflow: "hidden",
                              }}
                            >
                              <img
                                src={image.image_url}
                                alt=""
                                style={{
                                  display: "block",
                                  width: "100%",
                                  height: "100%",
                                  objectFit: "cover",
                                }}
                                onError={(event) => {
                                  event.currentTarget.style.display = "none";
                                  const fallback =
                                    event.currentTarget.nextElementSibling as HTMLElement | null;
                                  if (fallback) fallback.style.display = "grid";
                                }}
                              />
                              <div
                                style={{
                                  display: "none",
                                  position: "absolute",
                                  inset: 0,
                                  placeItems: "center",
                                  padding: 8,
                                  textAlign: "center",
                                  color: "var(--muted)",
                                  fontSize: 11,
                                }}
                              >
                                Image unavailable
                              </div>
                            </div>

                            <div
                              style={{
                                fontSize: 11,
                                lineHeight: 1.35,
                                marginBottom: 8,
                                overflowWrap: "anywhere",
                              }}
                            >
                              <strong style={{ display: "block" }}>
                                {mediaFileName(image.image_url)}
                              </strong>
                              <span style={{ color: "var(--muted)" }}>
                                {image.image_url}
                              </span>
                            </div>

                            <div
                              style={{
                                display: "flex",
                                gap: 6,
                                flexWrap: "wrap",
                              }}
                            >
                              <button
                                type="button"
                                disabled={savingImage || index === 0}
                                onClick={() => moveProductImage(image.id, -1)}
                                style={{
                                  ...buttonStyle,
                                  padding: "7px 10px",
                                  opacity: index === 0 ? 0.4 : 1,
                                }}
                              >
                                ←
                              </button>

                              <button
                                type="button"
                                disabled={
                                  savingImage ||
                                  index === productImages.length - 1
                                }
                                onClick={() => moveProductImage(image.id, 1)}
                                style={{
                                  ...buttonStyle,
                                  padding: "7px 10px",
                                  opacity:
                                    index === productImages.length - 1
                                      ? 0.4
                                      : 1,
                                }}
                              >
                                →
                              </button>

                              <button
                                type="button"
                                disabled={savingImage}
                                onClick={() => removeProductImage(image.id)}
                                style={{
                                  ...buttonStyle,
                                  padding: "7px 10px",
                                  background: "transparent",
                                  color: "var(--ink)",
                                }}
                              >
                                Remove
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

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

                  <button
                    type="button"
                    onClick={resetProductForm}
                    style={{
                      ...buttonStyle,
                      background: "transparent",
                      color: "var(--ink)",
                    }}
                  >
                    {editingId ? "Cancel edit" : "Close"}
                  </button>
                </div>
              </form>
              )}

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
                            {request.status === "accepted" && (
                              <option value="accepted">
                                Accepted · Bespoke order created
                              </option>
                            )}
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
                            Final bespoke price (₹)
                          </label>

                          <input
                            type="number"
                            min="1"
                            step="0.01"
                            value={
                              priceDraft[request.id] ??
                              (request.final_price != null
                                ? String(request.final_price)
                                : "")
                            }
                            onChange={(e) =>
                              setPriceDraft((previous) => ({
                                ...previous,
                                [request.id]: e.target.value,
                              }))
                            }
                            disabled={Boolean(request.order_id)}
                            placeholder="Final approved price"
                            style={inputStyle}
                          />

                          {request.order_id && (
                            <div
                              style={{
                                marginTop: 8,
                                fontSize: 12,
                                color: "var(--muted)",
                              }}
                            >
                              BESPOKE ORDER CREATED · {request.order_id}
                            </div>
                          )}
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

                      <div
                        style={{
                          display: "flex",
                          gap: 10,
                          flexWrap: "wrap",
                          marginTop: 14,
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => saveBespokeRequest(request)}
                          disabled={savingRequest === request.id}
                          style={buttonStyle}
                        >
                          {savingRequest === request.id
                            ? "Saving…"
                            : "Save request"}
                        </button>

                        {!request.order_id && (
                          <button
                            type="button"
                            onClick={() =>
                              approveAndCreateBespokeOrder(request)
                            }
                            disabled={savingRequest === request.id}
                            className="button button-dark"
                          >
                            {savingRequest === request.id
                              ? "Creating…"
                              : "Approve & Create Bespoke Order"}
                          </button>
                        )}

                        {request.order_id && (
                          <a
                            href="/admin"
                            className="button button-dark"
                          >
                            View Bespoke Order
                          </a>
                        )}
                      </div>
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