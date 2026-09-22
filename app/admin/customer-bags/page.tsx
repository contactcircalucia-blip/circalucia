"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import AdminNav from "@/components/AdminNav";

type BagItem = {
  id: string;
  product_id: string | null;
  slug: string;
  product_name: string;
  selected_size: string | null;
  quantity: number;
  unit_price: number | string;
  image_url: string | null;
};

type CustomerBag = {
  id: string;
  user_id: string;
  updated_at: string;
  profile?: {
    full_name: string | null;
    phone: string | null;
  } | null;
  items: BagItem[];
};

type Promotion = {
  id: string;
  code: string;
  description: string | null;
  discount_type: string;
  discount_value: number | string;
  minimum_order_value: number | string | null;
  maximum_discount: number | string | null;
  is_active: boolean;
};

function money(value: number) {
  return `₹${value.toLocaleString("en-IN", {
    maximumFractionDigits: 2,
  })}`;
}

function dateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function cleanPhone(value: string | null) {
  if (!value) return "";
  const digits = value.replace(/\D/g, "");
  if (digits.length === 10) return `91${digits}`;
  return digits;
}

function promoLabel(promo: Promotion) {
  if (promo.discount_type === "percentage") {
    return `${Number(promo.discount_value)}% off`;
  }
  return `${money(Number(promo.discount_value))} off`;
}

export default function AdminCustomerBagsPage() {
  const [bags, setBags] = useState<CustomerBag[]>([]);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [selectedPromo, setSelectedPromo] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error("Please sign in with your admin account.");
      }

      const { data: admin, error: adminError } = await supabase
        .from("profiles")
        .select("is_admin")
        .eq("id", user.id)
        .single();

      if (adminError || !admin?.is_admin) {
        throw new Error("This account does not have admin access.");
      }

      const { data: bagRows, error: bagError } = await supabase
        .from("customer_bags")
        .select("id, user_id, updated_at")
        .order("updated_at", { ascending: false });

      if (bagError) throw bagError;

      const userIds = (bagRows ?? []).map((bag) => bag.user_id);
      const bagIds = (bagRows ?? []).map((bag) => bag.id);

      const [profilesResult, itemsResult, promosResult] = await Promise.all([
        userIds.length
          ? supabase
              .from("profiles")
              .select("id, full_name, phone")
              .in("id", userIds)
          : Promise.resolve({ data: [], error: null }),
        bagIds.length
          ? supabase
              .from("customer_bag_items")
              .select(
                "id, bag_id, product_id, slug, product_name, selected_size, quantity, unit_price, image_url"
              )
              .in("bag_id", bagIds)
          : Promise.resolve({ data: [], error: null }),
        supabase
          .from("promotions")
          .select(
            "id, code, description, discount_type, discount_value, minimum_order_value, maximum_discount, is_active"
          )
          .eq("is_active", true)
          .order("created_at", { ascending: false }),
      ]);

      if (profilesResult.error) throw profilesResult.error;
      if (itemsResult.error) throw itemsResult.error;
      if (promosResult.error) throw promosResult.error;

      const profiles = new Map(
        (profilesResult.data ?? []).map((profile: any) => [
          profile.id,
          profile,
        ])
      );

      const groupedItems = new Map<string, BagItem[]>();
      for (const item of itemsResult.data ?? []) {
        const current = groupedItems.get((item as any).bag_id) ?? [];
        current.push(item as any);
        groupedItems.set((item as any).bag_id, current);
      }

      setBags(
        (bagRows ?? []).map((bag) => ({
          ...bag,
          profile: profiles.get(bag.user_id) ?? null,
          items: groupedItems.get(bag.id) ?? [],
        }))
      );

      setPromotions((promosResult.data ?? []) as Promotion[]);
    } catch (loadError) {
      console.error(loadError);
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load customer bags."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const visibleBags = useMemo(() => {
    const query = search.trim().toLowerCase();

    return bags.filter((bag) => {
      if (bag.items.length === 0) return false;
      if (!query) return true;

      return [
        bag.profile?.full_name,
        bag.profile?.phone,
        bag.user_id,
        ...bag.items.map((item) => item.product_name),
      ].some((value) => (value || "").toLowerCase().includes(query));
    });
  }, [bags, search]);

  function selectedPromotion(bagId: string) {
    return promotions.find(
      (promotion) => promotion.id === selectedPromo[bagId]
    );
  }

  function buildMessage(bag: CustomerBag, promo: Promotion) {
    const name = bag.profile?.full_name?.trim() || "there";
    const products = bag.items
      .map((item) => item.product_name)
      .filter(Boolean)
      .slice(0, 3)
      .join(", ");

    return `Hi ${name}, your CIRCA LUCIA selection${products ? ` — ${products}` : ""} is still waiting for you. Use code ${promo.code} for ${promoLabel(promo)} on eligible items. Complete your order at circalucia.vercel.app/cart. Terms and eligibility apply.`;
  }

  function openWhatsApp(bag: CustomerBag) {
    const promo = selectedPromotion(bag.id);
    if (!promo) {
      window.alert("Please select a promotion first.");
      return;
    }

    const phone = cleanPhone(bag.profile?.phone ?? null);
    if (!phone) {
      window.alert("This customer does not have a phone number.");
      return;
    }

    const message = buildMessage(bag, promo);
    window.open(
      `https://wa.me/${phone}?text=${encodeURIComponent(message)}`,
      "_blank",
      "noopener,noreferrer"
    );
  }

  if (loading) {
    return (
      <main className="bags-page">
        <div className="bags-shell">
          <p>Loading customer bags...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="bags-page">
      <style jsx global>{`
        .bags-page {
          min-height: 100vh;
          background: #f7f4ef;
          color: #28231f;
          padding: 42px 28px 70px;
        }
        .bags-shell { width: min(1180px, 100%); margin: 0 auto; }
        .bags-page * { box-sizing: border-box; }
        .bags-top {
          display: flex; justify-content: space-between; align-items: flex-end;
          gap: 20px; flex-wrap: wrap; margin-bottom: 22px;
        }
        .bags-kicker {
          margin: 0 0 8px; font-size: 11px; letter-spacing: .17em;
          text-transform: uppercase; color: #967d68;
        }
        .bags-title {
          margin: 0; font-family: "Cormorant Garamond", Georgia, serif;
          font-size: 52px; font-weight: 500;
        }
        .bags-refresh {
          border: 1px solid #d9cbbd; background: #fff; color: #5f5145;
          padding: 11px 17px; font: inherit; font-size: 13px; cursor: pointer;
        }
        .bags-nav {
          display: flex; align-items: center; gap: 28px; flex-wrap: wrap;
          border-top: 1px solid #e5dbd0; border-bottom: 1px solid #e5dbd0;
          padding: 14px 0; margin-bottom: 26px;
        }
        .bags-nav a {
          color: #28231f; text-decoration: none; font-size: 12px;
          letter-spacing: .08em; text-transform: uppercase;
        }
        .bags-nav a.active {
          text-decoration: underline; text-underline-offset: 6px; font-weight: 600;
        }
        .bags-toolbar {
          background: #fff; border: 1px solid #e1d6ca; padding: 22px 24px;
          display: flex; justify-content: space-between; align-items: center;
          gap: 20px; flex-wrap: wrap; margin-bottom: 16px;
        }
        .bags-toolbar strong { font-size: 20px; font-weight: 500; }
        .bags-search {
          width: min(420px, 100%); border: 1px solid #ded2c6;
          background: #fcfaf7; padding: 13px 15px; font: inherit;
          font-size: 14px; outline: none;
        }
        .bag-card {
          border: 1px solid #e1d6ca; background: #fff; margin-bottom: 16px;
        }
        .bag-head {
          padding: 22px 24px; border-bottom: 1px solid #eee6dd;
          display: flex; justify-content: space-between; gap: 18px;
          align-items: flex-start; flex-wrap: wrap;
        }
        .bag-name {
          margin: 0; font-family: "Cormorant Garamond", Georgia, serif;
          font-size: 30px; font-weight: 500;
        }
        .bag-meta { margin: 6px 0 0; color: #82776d; font-size: 12px; }
        .bag-value { text-align: right; }
        .bag-value span {
          display: block; font-size: 10px; letter-spacing: .14em;
          text-transform: uppercase; color: #938579;
        }
        .bag-value strong { display: block; margin-top: 4px; font-size: 22px; }
        .bag-items { padding: 0 24px; }
        .bag-item {
          display: grid; grid-template-columns: minmax(0, 1fr) auto;
          gap: 20px; padding: 17px 0; border-bottom: 1px solid #f0e9e2;
        }
        .bag-item:last-child { border-bottom: 0; }
        .bag-item h3 { margin: 0; font-size: 14px; font-weight: 600; }
        .bag-item p { margin: 5px 0 0; color: #82776d; font-size: 12px; }
        .bag-item-price { text-align: right; font-size: 13px; }
        .marketing {
          background: #fcfaf7; border-top: 1px solid #eee6dd; padding: 22px 24px;
        }
        .marketing-title {
          margin: 0 0 14px; font-size: 10px; font-weight: 600;
          letter-spacing: .16em; text-transform: uppercase; color: #967d68;
        }
        .marketing-row {
          display: grid; grid-template-columns: minmax(220px, 1fr) auto;
          gap: 10px;
        }
        .promo-select {
          width: 100%; border: 1px solid #d9cbbd; background: #fff;
          color: #28231f; padding: 12px 13px; font: inherit; font-size: 13px;
        }
        .whatsapp {
          border: 1px solid #211a16; background: #211a16; color: #fff;
          padding: 12px 18px; font: inherit; font-size: 13px; cursor: pointer;
        }
        .email-disabled {
          margin-top: 10px; color: #8b8075; font-size: 11px; line-height: 1.5;
        }
        .message {
          padding: 14px 16px; margin-bottom: 18px; border: 1px solid #dfd4c9;
          background: #fff; font-size: 13px;
        }
        .error { border-color: #e8b8b0; background: #fff3f1; color: #7c3f30; }
        .empty {
          border: 1px solid #e1d6ca; background: #fff; padding: 60px 24px;
          text-align: center; color: #82776d;
        }
        .bags-footer {
          border-top: 1px solid #e5dbd0; margin-top: 28px;
          padding-top: 16px; color: #a09589; font-size: 12px;
        }
        @media (max-width: 700px) {
          .bags-page { padding: 28px 14px 50px; }
          .bags-title { font-size: 42px; }
          .marketing-row { grid-template-columns: 1fr; }
          .bag-value { text-align: left; }
        }
      `}</style>

      <div className="bags-shell">
        <div className="bags-top">
          <header>
            <p className="bags-kicker">Circa Lucia · Administration</p>
            <h1 className="bags-title">Customer Bags</h1>
          </header>

          <button className="bags-refresh" onClick={() => void loadData()}>
            Refresh bags
          </button>
        </div>

        <AdminNav />

        {error && <div className="message error">{error}</div>}

        <section className="bags-toolbar">
          <div>
            <p className="bags-kicker">Live intent</p>
            <strong>{visibleBags.length} active customer bags</strong>
          </div>

          <input
            className="bags-search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search customer, phone or product"
          />
        </section>

        {visibleBags.length === 0 ? (
          <div className="empty">No active customer bags found.</div>
        ) : (
          visibleBags.map((bag) => {
            const total = bag.items.reduce(
              (sum, item) =>
                sum + Number(item.unit_price || 0) * Number(item.quantity || 0),
              0
            );

            return (
              <article className="bag-card" key={bag.id}>
                <div className="bag-head">
                  <div>
                    <h2 className="bag-name">
                      {bag.profile?.full_name || "Unnamed customer"}
                    </h2>
                    <p className="bag-meta">
                      {bag.profile?.phone || "Phone not provided"} · Last activity{" "}
                      {dateTime(bag.updated_at)}
                    </p>
                  </div>

                  <div className="bag-value">
                    <span>Bag value</span>
                    <strong>{money(total)}</strong>
                  </div>
                </div>

                <div className="bag-items">
                  {bag.items.map((item) => (
                    <div className="bag-item" key={item.id}>
                      <div>
                        <h3>{item.product_name}</h3>
                        <p>
                          Size {item.selected_size || "—"} · Quantity{" "}
                          {item.quantity}
                        </p>
                      </div>

                      <div className="bag-item-price">
                        {money(
                          Number(item.unit_price || 0) *
                            Number(item.quantity || 0)
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="marketing">
                  <p className="marketing-title">Promotion outreach</p>

                  <div className="marketing-row">
                    <select
                      className="promo-select"
                      value={selectedPromo[bag.id] || ""}
                      onChange={(event) =>
                        setSelectedPromo((current) => ({
                          ...current,
                          [bag.id]: event.target.value,
                        }))
                      }
                    >
                      <option value="">Select promotion</option>
                      {promotions.map((promo) => (
                        <option key={promo.id} value={promo.id}>
                          {promo.code} · {promoLabel(promo)}
                        </option>
                      ))}
                    </select>

                    <button
                      type="button"
                      className="whatsapp"
                      onClick={() => openWhatsApp(bag)}
                    >
                      WhatsApp Promotion
                    </button>
                  </div>

                  <p className="email-disabled">
                    Email promotion will be enabled through a protected server
                    route so customer Auth emails are never exposed through the
                    browser.
                  </p>
                </div>
              </article>
            );
          })
        )}

        <footer className="bags-footer">
          Circa Lucia · Private customer bag management
        </footer>
      </div>
    </main>
  );
}
