"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

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
      className={`w-full rounded-xl px-4 py-3 text-left text-sm font-medium transition ${
        active
          ? "bg-[#332920] text-white"
          : "bg-white text-[#66594d] hover:bg-[#f4eee7]"
      }`}
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
    <main className={styles.page}>
      <div className="mx-auto max-w-5xl space-y-6">

        {/* TOP NAVIGATION */}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/admin"
            className="text-sm text-[#74685d] hover:text-black"
          >
            ← Admin dashboard
          </Link>

          <button
            type="button"
            onClick={() => void loadCustomers()}
            className="rounded-lg border border-[#d9cbbd] bg-white px-4 py-2 text-sm transition hover:bg-[#f1e9df]"
          >
            Refresh list
          </button>
        </div>

        {/* HEADER */}

        <header className="border-b border-[#e5dbd0] pb-5">
          <p className={styles.label}>
            Circa Lucia · Admin
          </p>

          <h1 className="mt-2 font-serif text-4xl sm:text-5xl">
            Customers
          </h1>
        </header>

        {/* ERROR */}

        {error && (
          <div
            role="alert"
            className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"
          >
            {error}
          </div>
        )}

        {/* SAVE MESSAGE */}

        {saveMessage && (
          <div
            role="status"
            className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
          >
            {saveMessage}
          </div>
        )}

        {/* CUSTOMER DIRECTORY */}

        <section className={`${styles.panel} overflow-hidden`}>

          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#eee6dd] p-4 sm:p-5">
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
              className="w-full rounded-xl border border-[#e3d9ce] bg-[#fcfaf7] px-4 py-3 text-sm outline-none transition focus:border-[#ad9278] sm:max-w-sm"
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
                      className={`flex w-full items-center gap-3 px-4 py-4 text-left transition sm:px-5 ${
                        isExpanded
                          ? "bg-[#f6efe7]"
                          : "bg-white hover:bg-[#fcfaf7]"
                      }`}
                    >
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#eee5da] font-serif text-lg text-[#7d6855]">
                        {initials(
                          customer.full_name
                        )}
                      </span>

                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">
                          {customer.full_name ||
                            "Unnamed customer"}
                        </span>

                        <span className="mt-0.5 block truncate text-xs text-[#82776d]">
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
                      <div className="border-t border-[#e9dfd5] bg-[#fcfaf7] p-4 sm:p-6">

                        {detailLoading ? (
                          <div className="space-y-3 animate-pulse">
                            <div className="h-6 w-40 rounded bg-stone-200" />
                            <div className="h-24 rounded-xl bg-stone-100" />
                          </div>
                        ) : selectedCustomer ? (
                          <div className="space-y-5">

                            {/* CUSTOMER HEADER */}

                            <div className="flex flex-wrap items-start justify-between gap-4 rounded-xl border border-[#e6ddd3] bg-white p-4 sm:p-5">

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

                              <div className="flex flex-wrap gap-2">
                                {!editing ? (
                                  <button
                                    type="button"
                                    onClick={startEditing}
                                    className="rounded-lg border border-[#d4c4b4] bg-white px-4 py-2 text-sm font-medium text-[#715e4c] transition hover:bg-[#f4eee7]"
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
                                      className="rounded-lg bg-[#332920] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#211a16] disabled:opacity-50"
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

                            <div className={`${styles.panel} overflow-hidden`}>

                              <div className="border-b border-[#eee6dd] px-4 py-4 sm:px-5">
                                <p className={styles.label}>
                                  Customer information
                                </p>

                                <h3 className="mt-1 font-serif text-2xl">
                                  Profile details
                                </h3>
                              </div>

                              <div className="overflow-x-auto">
                                <table className="w-full min-w-[600px] text-left">
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
                                          <span className="text-sm font-medium">
                                            {selectedCustomer.phone ||
                                              "Not provided"}
                                          </span>
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

                            <div className="grid gap-5 md:grid-cols-[190px_minmax(0,1fr)]">

                              <nav
                                aria-label="Customer records"
                                className="flex gap-2 overflow-x-auto md:flex-col md:overflow-visible"
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

                              <div className={`${styles.panel} min-w-0 p-4 sm:p-6`}>

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

        <footer className="border-t border-[#e5dbd0] pt-4 text-xs text-[#a09589]">
          Circa Lucia · Private customer management
        </footer>

      </div>
    </main>
  );
}