"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import AdminNav from "@/components/AdminNav";

type Customer = {
  id: string;
  full_name: string | null;
  phone: string | null;
  created_at?: string;
};

type CustomerOrder = {
  id: string;
  order_number: string | null;
  status: string | null;
  total_amount: number | string | null;
  currency: string | null;
  created_at: string;
  tracking_number?: string | null;
  carrier?: string | null;
  tracking_url?: string | null;
};

type CustomerAddress = {
  id: string;
  full_name: string | null;
  phone: string | null;
  address_line_1: string | null;
  address_line_2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country: string | null;
  is_default: boolean | null;
  created_at: string;
};

type BespokeRequest = {
  id: string;
  request_number: string | null;
  status: string | null;
  design_description: string | null;
  created_at: string;
  admin_notes?: string | null;
};

type Section = "orders" | "addresses" | "bespoke";

const styles = {
  page: "min-h-screen bg-[#f7f4ef] px-4 py-6 text-[#28231f] sm:px-6 md:px-10 md:py-9",
  panel: "rounded-2xl border border-[#e7ded3] bg-white",
  label:
    "text-[10px] font-semibold uppercase tracking-[0.18em] text-[#9a806b]",
  muted: "text-sm text-[#82776d]",
};

function dateLabel(value?: string) {
  if (!value) return "—";

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
}

function initials(name: string | null) {
  return (
    (name || "Customer")
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "C"
  );
}

function money(
  amount: number | string | null,
  currency: string | null
) {
  const value = Number(amount ?? 0);

  return `${currency || "INR"} ${
    Number.isFinite(value)
      ? value.toLocaleString("en-IN", {
          maximumFractionDigits: 2,
        })
      : "0"
  }`;
}

function statusStyle(status: string | null) {
  const value = (status || "").toLowerCase();

  if (
    ["paid", "completed", "delivered", "approved"].includes(
      value
    )
  ) {
    return "bg-emerald-50 text-emerald-700";
  }

  if (
    ["cancelled", "canceled", "rejected", "failed"].includes(
      value
    )
  ) {
    return "bg-rose-50 text-rose-700";
  }

  if (
    [
      "pending",
      "pending_payment",
      "processing",
      "in_progress",
    ].includes(value)
  ) {
    return "bg-amber-50 text-amber-800";
  }

  return "bg-stone-100 text-stone-700";
}

function SectionButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={active ? "active" : ""}
    >
      {children}
    </button>
  );
}

function EmptyState({
  title,
  detail,
}: {
  title: string;
  detail: string;
}) {
  return (
    <div className="rounded-xl border border-dashed border-[#e3d8cb] bg-[#fcfaf7] px-5 py-10 text-center">
      <p className="font-serif text-xl">{title}</p>
      <p className="mt-2 text-sm leading-6 text-[#8b8075]">
        {detail}
      </p>
    </div>
  );
}

function EditableField({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.14em] text-[#938579]">
        {label}
      </span>

      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-lg border border-[#ddd2c6] bg-white px-3 py-2.5 text-sm outline-none transition focus:border-[#a88c71] focus:ring-1 focus:ring-[#a88c71]"
      />
    </label>
  );
}

export default function AdminCustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [expandedCustomerId, setExpandedCustomerId] = useState<
    string | null
  >(null);

  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [addresses, setAddresses] = useState<CustomerAddress[]>(
    []
  );
  const [bespoke, setBespoke] = useState<BespokeRequest[]>([]);

  const [section, setSection] =
    useState<Section>("orders");

  const [search, setSearch] = useState("");

  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);

  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);

  const [error, setError] = useState("");
  const [saveMessage, setSaveMessage] = useState("");

  const [draftCustomer, setDraftCustomer] =
    useState<Customer | null>(null);

  const [draftAddresses, setDraftAddresses] = useState<
    CustomerAddress[]
  >([]);

  const loadCustomers = useCallback(async () => {
    setLoading(true);
    setError("");

    const {
      data: authData,
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !authData.user) {
      setError("Please sign in with your admin account.");
      setLoading(false);
      return;
    }

    const {
      data: admin,
      error: adminError,
    } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", authData.user.id)
      .single();

    if (adminError || !admin?.is_admin) {
      setError("This account does not have admin access.");
      setLoading(false);
      return;
    }

    const {
      data,
      error: customerError,
    } = await supabase
      .from("profiles")
      .select("id, full_name, phone, created_at")
      .order("created_at", {
        ascending: false,
      });

    if (customerError) {
      setError(customerError.message);
    } else {
      setCustomers(data ?? []);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    void loadCustomers();
  }, [loadCustomers]);

  const openCustomer = useCallback(
    async (customer: Customer) => {
      if (
        expandedCustomerId === customer.id &&
        editing
      ) {
        const shouldClose = window.confirm(
          "You have unsaved changes. Close this customer without saving?"
        );

        if (!shouldClose) {
          return;
        }

        setEditing(false);
        setDraftCustomer(null);
        setDraftAddresses([]);
      }

      if (expandedCustomerId === customer.id) {
        setExpandedCustomerId(null);
        return;
      }

      if (editing) {
        const shouldSwitch = window.confirm(
          "You have unsaved changes. Switch customer without saving?"
        );

        if (!shouldSwitch) {
          return;
        }
      }

      setExpandedCustomerId(customer.id);
      setSection("orders");

      setOrders([]);
      setAddresses([]);
      setBespoke([]);

      setError("");
      setSaveMessage("");

      setEditing(false);
      setDraftCustomer(null);
      setDraftAddresses([]);

      setDetailLoading(true);

      const [ordersResult, addressesResult, bespokeResult] =
        await Promise.all([
          supabase
            .from("orders")
            .select(
              "id, order_number, status, total_amount, currency, created_at, tracking_number, carrier, tracking_url"
            )
            .eq("user_id", customer.id)
            .order("created_at", {
              ascending: false,
            }),

          supabase
            .from("addresses")
            .select(
              "id, full_name, phone, address_line_1, address_line_2, city, state, postal_code, country, is_default, created_at"
            )
            .eq("user_id", customer.id)
            .order("created_at", {
              ascending: false,
            }),

          supabase
            .from("bespoke_requests")
            .select(
              "id, request_number, status, design_description, created_at, admin_notes"
            )
            .eq("user_id", customer.id)
            .order("created_at", {
              ascending: false,
            }),
        ]);

      const errors = [
        ordersResult.error,
        addressesResult.error,
        bespokeResult.error,
      ].filter(Boolean);

      if (errors.length) {
        setError(
          errors
            .map((item) => item?.message)
            .join(" · ")
        );
      }

      setOrders(ordersResult.data ?? []);
      setAddresses(addressesResult.data ?? []);
      setBespoke(bespokeResult.data ?? []);

      setDetailLoading(false);
    },
    [expandedCustomerId, editing]
  );

  const startEditing = () => {
    const customer = customers.find(
      (item) => item.id === expandedCustomerId
    );

    if (!customer) {
      return;
    }

    setDraftCustomer({
      ...customer,
    });

    setDraftAddresses(
      addresses.map((address) => ({
        ...address,
      }))
    );

    setEditing(true);
    setSaveMessage("");
    setError("");
  };

  const cancelEditing = () => {
    setEditing(false);
    setDraftCustomer(null);
    setDraftAddresses([]);
    setSaveMessage("");
    setError("");
  };

  const updateDraftAddress = (
    addressId: string,
    field: keyof CustomerAddress,
    value: string | boolean
  ) => {
    setDraftAddresses((current) =>
      current.map((address) =>
        address.id === addressId
          ? {
              ...address,
              [field]: value,
            }
          : address
      )
    );
  };

  const saveChanges = async () => {
    if (!draftCustomer) {
      return;
    }

    setSaving(true);
    setError("");
    setSaveMessage("");

    try {
      const cleanName =
        draftCustomer.full_name?.trim() || null;

      const cleanPhone =
        draftCustomer.phone?.trim() || null;

      const {
        error: customerUpdateError,
      } = await supabase
        .from("profiles")
        .update({
          full_name: cleanName,
          phone: cleanPhone,
        })
        .eq("id", draftCustomer.id);

      if (customerUpdateError) {
        throw new Error(
          customerUpdateError.message
        );
      }

      for (const address of draftAddresses) {
        const {
          error: addressError,
        } = await supabase
          .from("addresses")
          .update({
            full_name:
              address.full_name?.trim() || null,
            phone: address.phone?.trim() || null,
            address_line_1:
              address.address_line_1?.trim() || null,
            address_line_2:
              address.address_line_2?.trim() || null,
            city: address.city?.trim() || null,
            state: address.state?.trim() || null,
            postal_code:
              address.postal_code?.trim() || null,
            country:
              address.country?.trim() || null,
            is_default: address.is_default,
          })
          .eq("id", address.id)
          .eq("user_id", draftCustomer.id);

        if (addressError) {
          throw new Error(addressError.message);
        }
      }

      const updatedCustomer: Customer = {
        ...draftCustomer,
        full_name: cleanName,
        phone: cleanPhone,
      };

      setCustomers((current) =>
        current.map((customer) =>
          customer.id === updatedCustomer.id
            ? updatedCustomer
            : customer
        )
      );

      setAddresses(
        draftAddresses.map((address) => ({
          ...address,
          full_name:
            address.full_name?.trim() || null,
          phone: address.phone?.trim() || null,
          address_line_1:
            address.address_line_1?.trim() || null,
          address_line_2:
            address.address_line_2?.trim() || null,
          city: address.city?.trim() || null,
          state: address.state?.trim() || null,
          postal_code:
            address.postal_code?.trim() || null,
          country:
            address.country?.trim() || null,
        }))
      );

      setDraftCustomer(updatedCustomer);

      setSaveMessage(
        "Customer details saved successfully."
      );

      setEditing(false);
    } catch (saveError) {
      console.error(saveError);

      setError(
        saveError instanceof Error
          ? saveError.message
          : "Unable to save customer details."
      );
    } finally {
      setSaving(false);
    }
  };

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return customers;
    }

    return customers.filter((customer) =>
      [
        customer.full_name,
        customer.phone,
        customer.id,
      ].some((value) =>
        (value || "")
          .toLowerCase()
          .includes(query)
      )
    );
  }, [customers, search]);

  const selectedCustomer = useMemo(
    () =>
      customers.find(
        (customer) =>
          customer.id === expandedCustomerId
      ) ?? null,
    [customers, expandedCustomerId]
  );

  const totalSpent = orders.reduce(
    (sum, order) =>
      sum + Number(order.total_amount ?? 0),
    0
  );

  if (loading) {
    return (
      <main className={styles.page}>
        <div className="mx-auto max-w-5xl space-y-4 animate-pulse">
          <div className="h-8 w-52 rounded bg-stone-200" />
          <div className="h-40 rounded-2xl bg-white" />
        </div>
      </main>
    );
  }

  return (
    <main className="cl-customers-page">
      <style jsx global>{`
        .cl-customers-page {
          min-height: 100vh;
          background: #f7f4ef;
          color: #28231f;
          padding: 42px 28px 70px;
        }
        .cl-customers-shell {
          width: min(1180px, 100%);
          margin: 0 auto;
        }
        .cl-customers-page * { box-sizing: border-box; }
        .cl-topbar {
          display:flex; align-items:flex-end; justify-content:space-between;
          gap:20px; flex-wrap:wrap; margin-bottom:22px;
        }
        .cl-back { color:#74685d; text-decoration:none; font-size:14px; }
        .cl-back:hover { color:#17130f; }
        .cl-refresh, .cl-edit, .cl-secondary {
          border:1px solid #d9cbbd; background:#fff; color:#5f5145;
          padding:11px 17px; font:inherit; font-size:13px; cursor:pointer;
        }
        .cl-refresh:hover, .cl-edit:hover, .cl-secondary:hover { background:#f1e9df; }
        .cl-heading { margin:0; }
        .cl-admin-nav {
          display:flex; align-items:center; gap:28px; flex-wrap:wrap;
          border-top:1px solid #e5dbd0; border-bottom:1px solid #e5dbd0;
          padding:14px 0; margin-bottom:26px;
        }
        .cl-admin-nav a {
          color:#28231f; text-decoration:none; font-size:12px;
          letter-spacing:.08em; text-transform:uppercase;
        }
        .cl-admin-nav a.active {
          text-decoration:underline; text-underline-offset:6px; font-weight:600;
        }
        .cl-kicker { margin:0 0 8px; font-size:11px; letter-spacing:.17em; text-transform:uppercase; color:#967d68; }
        .cl-heading h1 { margin:0; font-family:"Cormorant Garamond", Georgia, serif; font-size:52px; font-weight:500; }
        .cl-panel { border:1px solid #e1d6ca; background:#fff; }
        .cl-directory-head {
          display:flex; justify-content:space-between; align-items:center;
          gap:22px; flex-wrap:wrap; padding:22px 24px; border-bottom:1px solid #eee6dd;
        }
        .cl-directory-head strong { font-size:20px; font-weight:500; }
        .cl-search {
          width:min(420px,100%); border:1px solid #ded2c6; background:#fcfaf7;
          padding:13px 15px; font:inherit; font-size:14px; outline:none;
        }
        .cl-search:focus { border-color:#9c8169; }
        .cl-customer-row {
          width:100%; border:0; border-bottom:1px solid #eee6dd; background:#fff;
          display:grid; grid-template-columns:48px minmax(0,1fr) auto;
          align-items:center; gap:16px; padding:18px 24px; text-align:left; cursor:pointer;
          color:#28231f; font:inherit;
        }
        .cl-customer-row:hover, .cl-customer-row.active { background:#f8f3ed; }
        .cl-avatar {
          width:44px; height:44px; border-radius:50%; display:flex; align-items:center;
          justify-content:center; background:#eee5da; color:#7d6855;
          font-family:"Cormorant Garamond", Georgia, serif; font-size:18px;
        }
        .cl-customer-name { display:block; font-size:15px; font-weight:600; }
        .cl-customer-phone { display:block; margin-top:4px; color:#82776d; font-size:13px; }
        .cl-expanded { padding:26px; background:#fcfaf7; border-bottom:1px solid #e9dfd5; }
        .cl-profile-head {
          display:flex; justify-content:space-between; align-items:flex-start; gap:18px;
          flex-wrap:wrap; padding:22px; border:1px solid #e6ddd3; background:#fff; margin-bottom:22px;
        }
        .cl-profile-head h2 { margin:0; font-family:"Cormorant Garamond", Georgia, serif; font-size:30px; font-weight:500; }
        .cl-profile-head p { margin:6px 0 0; color:#82776d; font-size:12px; }
        .cl-actions { display:flex; gap:9px; flex-wrap:wrap; }
        .cl-call, .cl-primary {
          display:inline-flex; align-items:center; justify-content:center; text-decoration:none;
          border:1px solid #211a16; background:#211a16; color:#fff;
          padding:11px 18px; font:inherit; font-size:13px; cursor:pointer;
        }
        .cl-call:hover, .cl-primary:hover { background:#3a2f28; }
        .cl-info-card { border:1px solid #e6ddd3; background:#fff; margin-bottom:22px; overflow:hidden; }
        .cl-card-title { padding:18px 22px; border-bottom:1px solid #eee6dd; }
        .cl-card-title h3 { margin:4px 0 0; font-family:"Cormorant Garamond", Georgia, serif; font-size:27px; font-weight:500; }
        .cl-info-table { width:100%; border-collapse:collapse; }
        .cl-info-table td { padding:15px 22px; border-bottom:1px solid #f0e9e2; vertical-align:top; font-size:14px; }
        .cl-info-table td:first-child { width:190px; color:#74685d; font-weight:500; }
        .cl-detail-grid { display:grid; grid-template-columns:210px minmax(0,1fr); gap:22px; }
        .cl-section-nav { display:flex; flex-direction:column; gap:8px; }
        .cl-section-nav button {
          width:100%; border:0; padding:13px 15px; text-align:left; font:inherit;
          font-size:13px; cursor:pointer; background:#fff; color:#66594d;
        }
        .cl-section-nav button.active { background:#332920; color:#fff; }
        .cl-record { border:1px solid #e6ddd3; background:#fff; padding:22px; min-width:0; }
        .cl-message { padding:14px 16px; margin-bottom:18px; border:1px solid #dfd4c9; background:#fff; font-size:13px; }
        .cl-error { border-color:#e8b8b0; background:#fff3f1; color:#7c3f30; }
        .cl-footer { border-top:1px solid #e5dbd0; margin-top:28px; padding-top:16px; color:#a09589; font-size:12px; }
        .cl-customers-page input { border-radius:0 !important; }
        @media (max-width: 760px) {
          .cl-customers-page { padding:28px 14px 50px; }
          .cl-heading h1 { font-size:42px; }
          .cl-directory-head, .cl-customer-row, .cl-expanded { padding-left:16px; padding-right:16px; }
          .cl-detail-grid { grid-template-columns:1fr; }
          .cl-section-nav { flex-direction:row; overflow:auto; }
          .cl-section-nav button { min-width:150px; }
          .cl-info-table td:first-child { width:125px; }
        }
      `}</style>
      <div className="cl-customers-shell">

        {/* ADMIN HEADER */}

        <div className="cl-topbar">
          <header className="cl-heading">
            <p className="cl-kicker">
              Circa Lucia · Administration
            </p>
            <h1>Customers</h1>
          </header>

          <button
            type="button"
            onClick={() => void loadCustomers()}
            className="cl-refresh"
          >
            Refresh list
          </button>
        </div>

        <AdminNav />

        {/* ERROR */}

        {error && (
          <div
            role="alert"
            className="cl-message cl-error"
          >
            {error}
          </div>
        )}

        {/* SAVE MESSAGE */}

        {saveMessage && (
          <div
            role="status"
            className="cl-message"
          >
            {saveMessage}
          </div>
        )}

        {/* CUSTOMER DIRECTORY */}

        <section className="cl-panel">

          <div className="cl-directory-head">
            <div>
              <p className={styles.label}>
                Customer directory
              </p>

              <p className="mt-1 text-lg font-semibold">
                {filtered.length}{" "}
                <span className="font-normal text-[#8b8075]">
                  customers
                </span>
              </p>
            </div>

            <input
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Search name, phone or ID"
              aria-label="Search customers"
              className="cl-search"
            />
          </div>

          {filtered.length === 0 ? (
            <div className="p-4">
              <EmptyState
                title="No customers found"
                detail="Try a different name, phone number or customer ID."
              />
            </div>
          ) : (
            <div className="divide-y divide-[#eee6dd]">

              {filtered.map((customer) => {
                const isExpanded =
                  expandedCustomerId ===
                  customer.id;

                return (
                  <div key={customer.id}>

                    {/* COLLAPSED CUSTOMER ROW */}

                    <button
                      type="button"
                      onClick={() =>
                        void openCustomer(customer)
                      }
                      className={`cl-customer-row ${isExpanded ? "active" : ""}`}
                    >
                      <span className="cl-avatar">
                        {initials(
                          customer.full_name
                        )}
                      </span>

                      <span className="min-w-0 flex-1">
                        <span className="cl-customer-name">
                          {customer.full_name ||
                            "Unnamed customer"}
                        </span>

                        <span className="cl-customer-phone">
                          {customer.phone ||
                            "Phone not provided"}
                        </span>
                      </span>

                      <span
                        aria-hidden="true"
                        className={`text-xl text-[#a08b77] transition-transform ${
                          isExpanded
                            ? "rotate-90"
                            : ""
                        }`}
                      >
                        ›
                      </span>
                    </button>

                    {/* EXPANDED CUSTOMER */}

                    {isExpanded && (
                      <div className="cl-expanded">

                        {detailLoading ? (
                          <div className="space-y-3 animate-pulse">
                            <div className="h-6 w-40 rounded bg-stone-200" />
                            <div className="h-24 rounded-xl bg-stone-100" />
                          </div>
                        ) : selectedCustomer ? (
                          <div className="space-y-5">

                            {/* CUSTOMER HEADER */}

                            <div className="cl-profile-head">

                              <div className="min-w-0">
                                <h2 className="break-words font-serif text-2xl">
                                  {selectedCustomer.full_name ||
                                    "Unnamed customer"}
                                </h2>

                                <p className="mt-1 text-xs text-[#82776d]">
                                  Joined{" "}
                                  {dateLabel(
                                    selectedCustomer.created_at
                                  )}
                                </p>
                              </div>

                              <div className="cl-actions">
                                {selectedCustomer.phone && (
                                  <a
                                    href={`tel:${selectedCustomer.phone.replace(/[^+\\d]/g, "")}`}
                                    className="cl-call"
                                    aria-label={`Call ${selectedCustomer.full_name || "customer"}`}
                                  >
                                    Call
                                  </a>
                                )}

                                {!editing ? (
                                  <button
                                    type="button"
                                    onClick={startEditing}
                                    className="cl-edit"
                                  >
                                    Edit details
                                  </button>
                                ) : (
                                  <>
                                    <button
                                      type="button"
                                      onClick={
                                        cancelEditing
                                      }
                                      disabled={saving}
                                      className="rounded-lg border border-[#d4c4b4] bg-white px-4 py-2 text-sm font-medium text-[#715e4c] transition hover:bg-[#f4eee7] disabled:opacity-50"
                                    >
                                      Cancel
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() =>
                                        void saveChanges()
                                      }
                                      disabled={saving}
                                      className="cl-primary"
                                    >
                                      {saving
                                        ? "Saving..."
                                        : "Save Changes"}
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>

                            {/* CUSTOMER INFORMATION — TABLE */}

                            <div className="cl-info-card">

                              <div className="cl-card-title">
                                <p className={styles.label}>
                                  Customer information
                                </p>

                                <h3 className="mt-1 font-serif text-2xl">
                                  Profile details
                                </h3>
                              </div>

                              <div className="overflow-x-auto">
                                <table className="cl-info-table">
                                  <thead>
                                    <tr className="border-b border-[#eee6dd] bg-[#fcfaf7]">
                                      <th className="w-[190px] px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#938579] sm:px-5">
                                        Information
                                      </th>

                                      <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#938579] sm:px-5">
                                        Details
                                      </th>
                                    </tr>
                                  </thead>

                                  <tbody className="divide-y divide-[#f0e9e2]">

                                    {/* NAME */}

                                    <tr>
                                      <td className="px-4 py-4 text-sm font-medium text-[#66594d] sm:px-5">
                                        Full name
                                      </td>

                                      <td className="px-4 py-4 sm:px-5">
                                        {editing &&
                                        draftCustomer ? (
                                          <input
                                            type="text"
                                            value={
                                              draftCustomer.full_name ||
                                              ""
                                            }
                                            onChange={(event) =>
                                              setDraftCustomer(
                                                (current) =>
                                                  current
                                                    ? {
                                                        ...current,
                                                        full_name:
                                                          event
                                                            .target
                                                            .value,
                                                      }
                                                    : current
                                              )
                                            }
                                            className="w-full max-w-lg rounded-lg border border-[#ddd2c6] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#a88c71]"
                                          />
                                        ) : (
                                          <span className="text-sm font-medium">
                                            {selectedCustomer.full_name ||
                                              "Not provided"}
                                          </span>
                                        )}
                                      </td>
                                    </tr>

                                    {/* PHONE */}

                                    <tr>
                                      <td className="px-4 py-4 text-sm font-medium text-[#66594d] sm:px-5">
                                        Phone
                                      </td>

                                      <td className="px-4 py-4 sm:px-5">
                                        {editing &&
                                        draftCustomer ? (
                                          <input
                                            type="tel"
                                            value={
                                              draftCustomer.phone ||
                                              ""
                                            }
                                            onChange={(event) =>
                                              setDraftCustomer(
                                                (current) =>
                                                  current
                                                    ? {
                                                        ...current,
                                                        phone:
                                                          event
                                                            .target
                                                            .value,
                                                      }
                                                    : current
                                              )
                                            }
                                            className="w-full max-w-lg rounded-lg border border-[#ddd2c6] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#a88c71]"
                                          />
                                        ) : (
                                          selectedCustomer.phone ? (
                                            <a
                                              href={`tel:${selectedCustomer.phone.replace(/[^+\\d]/g, "")}`}
                                              className="text-sm font-medium underline decoration-[#cdb9a5] underline-offset-4 hover:text-[#715e4c]"
                                            >
                                              {selectedCustomer.phone}
                                            </a>
                                          ) : (
                                            <span className="text-sm font-medium">
                                              Not provided
                                            </span>
                                          )
                                        )}
                                      </td>
                                    </tr>

                                    {/* CUSTOMER ID */}

                                    <tr>
                                      <td className="px-4 py-4 text-sm font-medium text-[#66594d] sm:px-5">
                                        Customer ID
                                      </td>

                                      <td className="px-4 py-4 sm:px-5">
                                        <div className="flex flex-wrap items-center gap-2">
                                          <span className="break-all font-mono text-xs text-[#554a42]">
                                            {selectedCustomer.id}
                                          </span>

                                          <button
                                            type="button"
                                            onClick={() =>
                                              void navigator.clipboard?.writeText(
                                                selectedCustomer.id
                                              )
                                            }
                                            className="rounded-md border border-[#ddd2c6] px-2 py-1 text-[10px] text-[#715e4c] hover:bg-[#f8f4ef]"
                                          >
                                            Copy
                                          </button>
                                        </div>
                                      </td>
                                    </tr>

                                    {/* REGISTERED */}

                                    <tr>
                                      <td className="px-4 py-4 text-sm font-medium text-[#66594d] sm:px-5">
                                        Registered on
                                      </td>

                                      <td className="px-4 py-4 text-sm sm:px-5">
                                        {dateLabel(
                                          selectedCustomer.created_at
                                        )}
                                      </td>
                                    </tr>

                                    {/* ORDERS COUNT */}

                                    <tr>
                                      <td className="px-4 py-4 text-sm font-medium text-[#66594d] sm:px-5">
                                        Total orders
                                      </td>

                                      <td className="px-4 py-4 text-sm font-medium sm:px-5">
                                        {orders.length}
                                      </td>
                                    </tr>

                                    {/* TOTAL SPEND */}

                                    <tr>
                                      <td className="px-4 py-4 text-sm font-medium text-[#66594d] sm:px-5">
                                        Recorded spend
                                      </td>

                                      <td className="px-4 py-4 text-sm font-medium sm:px-5">
                                        {money(
                                          totalSpent,
                                          orders[0]
                                            ?.currency ||
                                            "INR"
                                        )}
                                      </td>
                                    </tr>

                                  </tbody>
                                </table>
                              </div>
                            </div>

                            {/* SECTION NAVIGATION */}

                            <div className="cl-detail-grid">

                              <nav
                                aria-label="Customer records"
                                className="cl-section-nav"
                              >
                                <SectionButton
                                  active={
                                    section === "orders"
                                  }
                                  onClick={() =>
                                    setSection("orders")
                                  }
                                >
                                  01 · Orders ({orders.length})
                                </SectionButton>

                                <SectionButton
                                  active={
                                    section ===
                                    "addresses"
                                  }
                                  onClick={() =>
                                    setSection(
                                      "addresses"
                                    )
                                  }
                                >
                                  02 · Addresses (
                                  {addresses.length})
                                </SectionButton>

                                <SectionButton
                                  active={
                                    section ===
                                    "bespoke"
                                  }
                                  onClick={() =>
                                    setSection(
                                      "bespoke"
                                    )
                                  }
                                >
                                  03 · Bespoke (
                                  {bespoke.length})
                                </SectionButton>
                              </nav>

                              <div className="cl-record">

                                {/* ORDERS */}

                                {section === "orders" && (
                                  <div className="space-y-4">

                                    <div>
                                      <p className={styles.label}>
                                        Record 01
                                      </p>

                                      <h3 className="mt-1 font-serif text-2xl">
                                        Order history
                                      </h3>

                                      <p
                                        className={`mt-1 ${styles.muted}`}
                                      >
                                        {orders.length}{" "}
                                        {orders.length === 1
                                          ? "order"
                                          : "orders"}
                                      </p>
                                    </div>

                                    {orders.length === 0 ? (
                                      <EmptyState
                                        title="No orders yet"
                                        detail="Orders placed by this customer will appear here."
                                      />
                                    ) : (
                                      <div className="overflow-x-auto rounded-xl border border-[#e7ded3] bg-white">
                                        <table className="w-full min-w-[520px] text-left">
                                          <thead>
                                            <tr className="border-b border-[#e8dfd6] bg-[#fcfaf7]">
                                              <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#938579]">
                                                Order No.
                                              </th>

                                              <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#938579]">
                                                Date
                                              </th>
                                            </tr>
                                          </thead>

                                          <tbody className="divide-y divide-[#f0e9e2]">
                                            {orders.map(
                                              (order) => (
                                                <tr
                                                  key={
                                                    order.id
                                                  }
                                                  className="transition hover:bg-[#fcfaf7]"
                                                >
                                                  <td className="px-4 py-4 text-sm font-semibold">
                                                    {order.order_number ||
                                                      order.id}
                                                  </td>

                                                  <td className="px-4 py-4 text-sm text-[#66594d]">
                                                    {dateLabel(
                                                      order.created_at
                                                    )}
                                                  </td>
                                                </tr>
                                              )
                                            )}
                                          </tbody>
                                        </table>
                                      </div>
                                    )}
                                  </div>
                                )}

                                {/* ADDRESSES */}

                                {section ===
                                  "addresses" && (
                                  <div className="space-y-4">

                                    <div>
                                      <p
                                        className={
                                          styles.label
                                        }
                                      >
                                        Record 02
                                      </p>

                                      <h3 className="mt-1 font-serif text-2xl">
                                        Saved addresses
                                      </h3>

                                      <p
                                        className={`mt-1 ${styles.muted}`}
                                      >
                                        {addresses.length}{" "}
                                        saved{" "}
                                        {addresses.length ===
                                        1
                                          ? "address"
                                          : "addresses"}
                                      </p>
                                    </div>

                                    {addresses.length ===
                                    0 ? (
                                      <EmptyState
                                        title="No saved addresses"
                                        detail="Addresses saved during checkout will appear here."
                                      />
                                    ) : (
                                      <ol className="space-y-4">

                                        {addresses.map(
                                          (
                                            address,
                                            index
                                          ) => {
                                            const editableAddress =
                                              draftAddresses.find(
                                                (
                                                  item
                                                ) =>
                                                  item.id ===
                                                  address.id
                                              ) ||
                                              address;

                                            return (
                                              <li
                                                key={
                                                  address.id
                                                }
                                                className="rounded-xl border border-[#e7ded3] bg-white p-4 sm:p-5"
                                              >

                                                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#f0e9e2] pb-3">
                                                  <h4 className="font-serif text-xl">
                                                    Address{" "}
                                                    {String(
                                                      index +
                                                        1
                                                    ).padStart(
                                                      2,
                                                      "0"
                                                    )}
                                                  </h4>

                                                  {address.is_default && (
                                                    <span className="rounded-full bg-[#f2e8dc] px-3 py-1 text-[10px] font-semibold text-[#886d52]">
                                                      Default
                                                    </span>
                                                  )}
                                                </div>

                                                {editing ? (
                                                  <div className="mt-4 grid gap-4 sm:grid-cols-2">

                                                    <EditableField
                                                      label="Recipient"
                                                      value={
                                                        editableAddress.full_name ||
                                                        ""
                                                      }
                                                      onChange={(
                                                        value
                                                      ) =>
                                                        updateDraftAddress(
                                                          address.id,
                                                          "full_name",
                                                          value
                                                        )
                                                      }
                                                    />

                                                    <EditableField
                                                      label="Phone"
                                                      value={
                                                        editableAddress.phone ||
                                                        ""
                                                      }
                                                      onChange={(
                                                        value
                                                      ) =>
                                                        updateDraftAddress(
                                                          address.id,
                                                          "phone",
                                                          value
                                                        )
                                                      }
                                                    />

                                                    <div className="sm:col-span-2">
                                                      <EditableField
                                                        label="Address line 1"
                                                        value={
                                                          editableAddress.address_line_1 ||
                                                          ""
                                                        }
                                                        onChange={(
                                                          value
                                                        ) =>
                                                          updateDraftAddress(
                                                            address.id,
                                                            "address_line_1",
                                                            value
                                                          )
                                                        }
                                                      />
                                                    </div>

                                                    <div className="sm:col-span-2">
                                                      <EditableField
                                                        label="Address line 2"
                                                        value={
                                                          editableAddress.address_line_2 ||
                                                          ""
                                                        }
                                                        onChange={(
                                                          value
                                                        ) =>
                                                          updateDraftAddress(
                                                            address.id,
                                                            "address_line_2",
                                                            value
                                                          )
                                                        }
                                                      />
                                                    </div>

                                                    <EditableField
                                                      label="City"
                                                      value={
                                                        editableAddress.city ||
                                                        ""
                                                      }
                                                      onChange={(
                                                        value
                                                      ) =>
                                                        updateDraftAddress(
                                                          address.id,
                                                          "city",
                                                          value
                                                        )
                                                      }
                                                    />

                                                    <EditableField
                                                      label="State"
                                                      value={
                                                        editableAddress.state ||
                                                        ""
                                                      }
                                                      onChange={(
                                                        value
                                                      ) =>
                                                        updateDraftAddress(
                                                          address.id,
                                                          "state",
                                                          value
                                                        )
                                                      }
                                                    />

                                                    <EditableField
                                                      label="Postal code"
                                                      value={
                                                        editableAddress.postal_code ||
                                                        ""
                                                      }
                                                      onChange={(
                                                        value
                                                      ) =>
                                                        updateDraftAddress(
                                                          address.id,
                                                          "postal_code",
                                                          value
                                                        )
                                                      }
                                                    />

                                                    <EditableField
                                                      label="Country"
                                                      value={
                                                        editableAddress.country ||
                                                        ""
                                                      }
                                                      onChange={(
                                                        value
                                                      ) =>
                                                        updateDraftAddress(
                                                          address.id,
                                                          "country",
                                                          value
                                                        )
                                                      }
                                                    />

                                                    <label className="flex items-center gap-3 rounded-lg border border-[#e2d8cd] bg-[#fcfaf7] px-3 py-3 sm:col-span-2">
                                                      <input
                                                        type="checkbox"
                                                        checked={
                                                          Boolean(
                                                            editableAddress.is_default
                                                          )
                                                        }
                                                        onChange={(
                                                          event
                                                        ) =>
                                                          updateDraftAddress(
                                                            address.id,
                                                            "is_default",
                                                            event
                                                              .target
                                                              .checked
                                                          )
                                                        }
                                                        className="h-4 w-4 accent-[#332920]"
                                                      />

                                                      <span className="text-sm text-[#66594d]">
                                                        Set as default address
                                                      </span>
                                                    </label>

                                                  </div>
                                                ) : (
                                                  <table className="mt-3 w-full text-left">
                                                    <tbody className="divide-y divide-[#f3ece5]">

                                                      <tr>
                                                        <td className="w-[130px] py-3 pr-4 text-xs text-[#938579]">
                                                          Recipient
                                                        </td>

                                                        <td className="py-3 text-sm">
                                                          {address.full_name ||
                                                            "Not provided"}
                                                        </td>
                                                      </tr>

                                                      <tr>
                                                        <td className="w-[130px] py-3 pr-4 text-xs text-[#938579]">
                                                          Phone
                                                        </td>

                                                        <td className="py-3 text-sm">
                                                          {address.phone ||
                                                            "Not provided"}
                                                        </td>
                                                      </tr>

                                                      <tr>
                                                        <td className="w-[130px] py-3 pr-4 text-xs text-[#938579]">
                                                          Address
                                                        </td>

                                                        <td className="py-3 text-sm leading-6">
                                                          {[
                                                            address.address_line_1,
                                                            address.address_line_2,
                                                            address.city,
                                                            address.state,
                                                            address.postal_code,
                                                            address.country,
                                                          ]
                                                            .filter(
                                                              Boolean
                                                            )
                                                            .join(
                                                              ", "
                                                            ) ||
                                                            "Not provided"}
                                                        </td>
                                                      </tr>

                                                      <tr>
                                                        <td className="w-[130px] py-3 pr-4 text-xs text-[#938579]">
                                                          Added
                                                        </td>

                                                        <td className="py-3 text-sm">
                                                          {dateLabel(
                                                            address.created_at
                                                          )}
                                                        </td>
                                                      </tr>

                                                    </tbody>
                                                  </table>
                                                )}

                                              </li>
                                            );
                                          }
                                        )}

                                      </ol>
                                    )}
                                  </div>
                                )}

                                {/* BESPOKE */}

                                {section === "bespoke" && (
                                  <div className="space-y-4">

                                    <div>
                                      <p
                                        className={
                                          styles.label
                                        }
                                      >
                                        Record 03
                                      </p>

                                      <h3 className="mt-1 font-serif text-2xl">
                                        Bespoke requests
                                      </h3>

                                      <p
                                        className={`mt-1 ${styles.muted}`}
                                      >
                                        {bespoke.length}{" "}
                                        {bespoke.length ===
                                        1
                                          ? "request"
                                          : "requests"}
                                      </p>
                                    </div>

                                    {bespoke.length ===
                                    0 ? (
                                      <EmptyState
                                        title="No bespoke requests"
                                        detail="This customer has not submitted a bespoke enquiry yet."
                                      />
                                    ) : (
                                      <ol className="space-y-3">

                                        {bespoke.map(
                                          (
                                            request,
                                            index
                                          ) => (
                                            <li
                                              key={
                                                request.id
                                              }
                                              className="rounded-xl border border-[#eee6dd] bg-white p-4"
                                            >

                                              <div className="flex flex-wrap items-start justify-between gap-3">

                                                <div>
                                                  <p
                                                    className={
                                                      styles.label
                                                    }
                                                  >
                                                    Request{" "}
                                                    {String(
                                                      index +
                                                        1
                                                    ).padStart(
                                                      2,
                                                      "0"
                                                    )}
                                                  </p>

                                                  <h4 className="mt-1 break-all text-sm font-semibold">
                                                    {request.request_number ||
                                                      request.id}
                                                  </h4>

                                                  <p className="mt-1 text-xs text-[#94877b]">
                                                    {dateLabel(
                                                      request.created_at
                                                    )}
                                                  </p>
                                                </div>

                                                <span
                                                  className={`rounded-full px-3 py-1 text-xs font-semibold ${statusStyle(
                                                    request.status
                                                  )}`}
                                                >
                                                  {(
                                                    request.status ||
                                                    "Unknown"
                                                  ).replaceAll(
                                                    "_",
                                                    " "
                                                  )}
                                                </span>

                                              </div>

                                              <div className="mt-4 border-t border-[#f0e9e2] pt-3">
                                                <p className="text-xs text-[#938579]">
                                                  Design description
                                                </p>

                                                <p className="mt-2 whitespace-pre-wrap text-sm leading-6">
                                                  {request.design_description ||
                                                    "No description provided."}
                                                </p>
                                              </div>

                                              {request.admin_notes && (
                                                <div className="mt-3 rounded-lg bg-[#f8f4ef] p-3">
                                                  <p
                                                    className={
                                                      styles.label
                                                    }
                                                  >
                                                    Internal notes
                                                  </p>

                                                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6">
                                                    {
                                                      request.admin_notes
                                                    }
                                                  </p>
                                                </div>
                                              )}

                                            </li>
                                          )
                                        )}

                                      </ol>
                                    )}
                                  </div>
                                )}

                              </div>
                            </div>

                          </div>
                        ) : null}

                      </div>
                    )}

                  </div>
                );
              })}

            </div>
          )}

        </section>

        <footer className="cl-footer">
          Circa Lucia · Private customer management
        </footer>

      </div>
    </main>
  );
}