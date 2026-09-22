"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const adminLinks = [
  { href: "/admin", label: "Orders" },
  { href: "/admin/customers", label: "Customers" },
  { href: "/admin/customer-bags", label: "Customer Bags" },
  {
    href: "/admin/management",
    label: "Bespoke & Catalogue",
  },
  {
    href: "/admin/stock",
    label: "Stock Management",
  },
  {
    href: "/admin/promotions",
    label: "Promotions",
  },
  {
    href: "/admin/returns",
    label: "Returns & Replacements",
  },
];

export default function AdminNav() {
  const pathname = usePathname();

  function isActive(href: string) {
    if (href === "/admin") {
      return pathname === "/admin";
    }

    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <nav
      aria-label="Admin sections"
      style={{
        display: "flex",
        alignItems: "center",
        gap: "28px",
        flexWrap: "wrap",
        borderTop: "1px solid var(--line)",
        borderBottom: "1px solid var(--line)",
        padding: "14px 0",
        marginBottom: "25px",
      }}
    >
      {adminLinks.map((item) => {
        const active = isActive(item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            style={{
              color: "var(--ink)",
              textDecoration: active ? "underline" : "none",
              textUnderlineOffset: "6px",
              fontWeight: active ? 600 : 400,
              fontSize: "12px",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              whiteSpace: "nowrap",
            }}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}