
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatINR, getProducts, type Product } from "@/lib/products";

export default function Header() {
  const [count, setCount] = useState(0);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoaded, setProductsLoaded] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const update = () => {
      try {
        const cart = JSON.parse(localStorage.getItem("cl-cart") || "[]");

        setCount(
          cart.reduce(
            (sum: number, item: { qty: number }) => sum + item.qty,
            0
          )
        );
      } catch {}
    };

    update();

    window.addEventListener("storage", update);
    window.addEventListener("cl-cart-updated", update);

    return () => {
      window.removeEventListener("storage", update);
      window.removeEventListener("cl-cart-updated", update);
    };
  }, []);

  useEffect(() => {
    if (!searchOpen || productsLoaded) return;

    const loadProducts = async () => {
      const data = await getProducts();
      setProducts(data);
      setProductsLoaded(true);
    };

    loadProducts();
  }, [searchOpen, productsLoaded]);

  const query = searchQuery.trim().toLowerCase();

  const suggestions =
    query.length > 0
      ? products
          .filter((product) => {
            const searchableText = [
              product.name,
              product.collection,
              product.description,
              product.material,
              product.slug,
            ]
              .filter(Boolean)
              .join(" ")
              .toLowerCase();

            return searchableText.includes(query);
          })
          .slice(0, 5)
      : [];

  const closeMenu = () => setMenuOpen(false);

  return (
    <header className="site-header">
      <div className="header-inner">
        <button
          type="button"
          className="menu-button"
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          aria-expanded={menuOpen}
          aria-controls="mobile-navigation"
          onClick={() => setMenuOpen((open) => !open)}
        >
          {menuOpen ? "×" : "☰"}
        </button>

        <Link href="/" className="wordmark" onClick={closeMenu}>
          CIRCA LUCIA
        </Link>

        <nav className="desktop-nav">
          <Link href="/#collection">Collection</Link>
          <Link href="/#maison">Maison</Link>
          <Link href="/#bespoke">Bespoke</Link>
          <Link href="/#journal">Journal</Link>
          <Link href="/#about">About us</Link>
        </nav>

        <div className="header-actions">
          <button
            type="button"
            className="header-icon-button"
            aria-label={searchOpen ? "Close search" : "Open search"}
            title={searchOpen ? "Close search" : "Search"}
            onClick={() => {
              setSearchOpen(!searchOpen);

              if (searchOpen) {
                setSearchQuery("");
              }

              setMenuOpen(false);
            }}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-4-4" />
            </svg>
          </button>

          <Link
            href="/saved-designs"
            className="header-icon-button"
            aria-label="Saved designs"
            title="Saved designs"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z" />
            </svg>
          </Link>

          <Link href="/account" aria-label="Account">
            Account
          </Link>

          <Link href="/cart" aria-label="Shopping bag">
            Bag ({count})
          </Link>
        </div>
      </div>

      {menuOpen && (
        <nav
          id="mobile-navigation"
          className="mobile-nav"
          aria-label="Mobile navigation"
        >
          <Link href="/#collection" onClick={closeMenu}>
            Collection
          </Link>
          <Link href="/#maison" onClick={closeMenu}>
            Maison
          </Link>
          <Link href="/#bespoke" onClick={closeMenu}>
            Bespoke
          </Link>
          <Link href="/#journal" onClick={closeMenu}>
            Journal
          </Link>
          <Link href="/#about" onClick={closeMenu}>
            About us
          </Link>
          <Link href="/account" onClick={closeMenu}>
            Account
          </Link>
          <Link href="/saved-designs" onClick={closeMenu}>
            Saved designs
          </Link>
          <Link href="/cart" onClick={closeMenu}>
            Shopping bag ({count})
          </Link>
        </nav>
      )}

      {searchOpen && (
        <div className="header-search">
          <form action="/collection" method="GET">
            <div className="header-search-input-wrap">
              <input
                type="search"
                name="q"
                placeholder="Search footwear..."
                aria-label="Search footwear"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                autoFocus
              />

              {searchQuery && (
                <button
                  type="button"
                  className="header-search-clear"
                  aria-label="Clear search"
                  onClick={() => setSearchQuery("")}
                >
                  ×
                </button>
              )}
            </div>

            <button
              type="submit"
              className="header-search-submit"
              disabled={!searchQuery.trim()}
            >
              Search
            </button>
          </form>

          {query.length > 0 && (
            <div className="search-suggestions">
              {suggestions.length > 0 ? (
                <>
                  <p className="search-suggestions-label">
                    Matching designs
                  </p>

                  {suggestions.map((product) => (
                    <Link
                      key={product.id}
                      href={`/product/${product.slug}`}
                      className="search-suggestion"
                      onClick={() => {
                        setSearchOpen(false);
                        setSearchQuery("");
                      }}
                    >
                      <div className="search-suggestion-image">
                        {product.image_url ? (
                          <img
                            src={product.image_url}
                            alt={product.name}
                          />
                        ) : (
                          <span>CIRCA LUCIA</span>
                        )}
                      </div>

                      <div className="search-suggestion-info">
                        <strong>{product.name}</strong>

                        <span>
                          {product.collection || "Circa Lucia"}
                        </span>
                      </div>

                      <strong className="search-suggestion-price">
                        {formatINR(product.price)}
                      </strong>
                    </Link>
                  ))}
                </>
              ) : (
                <div className="search-no-results">
                  <p>No matching designs found.</p>
                  <span>
                    Try searching by name, collection, or material.
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </header>
  );
}