"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatINR, getProducts, type Product } from "@/lib/products";
import { supabase } from "@/lib/supabase";

export default function Header() {
  const [count, setCount] = useState(0);

  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoaded, setProductsLoaded] = useState(false);

  const [menuOpen, setMenuOpen] = useState(false);

  const [isAdmin, setIsAdmin] = useState(false);
  /* =========================================
     ADMIN CHECK
  ========================================= */

  useEffect(() => {
    let mounted = true;

    const checkAdmin = async () => {
      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError || !user) {
          if (mounted) {
            setIsAdmin(false);
          }

          return;
        }

        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("is_admin")
          .eq("id", user.id)
          .single();

        if (profileError) {
          console.error(
            "Unable to check admin status:",
            profileError
          );

          if (mounted) {
            setIsAdmin(false);
          }

          return;
        }

        if (mounted) {
          const admin = profile?.is_admin === true;

          setIsAdmin(admin);

          if (!admin) {
          }
        }
      } catch (error) {
        console.error(
          "Unable to check admin status:",
          error
        );

        if (mounted) {
          setIsAdmin(false);
        }
      }
    };

    checkAdmin();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      checkAdmin();
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);


  /* =========================================
     CART COUNT
  ========================================= */

  useEffect(() => {
    const update = () => {
      try {
        const cart = JSON.parse(
          localStorage.getItem("cl-cart") || "[]"
        );

        setCount(
          cart.reduce(
            (
              sum: number,
              item: {
                qty: number;
              }
            ) => sum + item.qty,
            0
          )
        );
      } catch {
        setCount(0);
      }
    };

    update();

    window.addEventListener("storage", update);
    window.addEventListener("cl-cart-updated", update);

    return () => {
      window.removeEventListener("storage", update);
      window.removeEventListener(
        "cl-cart-updated",
        update
      );
    };
  }, []);

  /* =========================================
     LOAD PRODUCTS WHEN SEARCH OPENS
  ========================================= */

  useEffect(() => {
    if (!searchOpen || productsLoaded) return;

    const loadProducts = async () => {
      try {
        const data = await getProducts();

        setProducts(data);
        setProductsLoaded(true);
      } catch (error) {
        console.error(
          "Unable to load products:",
          error
        );
      }
    };

    loadProducts();
  }, [searchOpen, productsLoaded]);

  /* =========================================
     STOP BODY SCROLL WHEN MOBILE MENU IS OPEN
  ========================================= */

  useEffect(() => {
    if (menuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }

    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  /* =========================================
     SEARCH
  ========================================= */

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

  /* =========================================
     CLOSE MOBILE MENU
  ========================================= */

  const closeMobileMenu = () => {
    setMenuOpen(false);
  };

  return (
    <header className="site-header">
      {/* =====================================
          MAIN HEADER
      ====================================== */}

      <div className="header-inner">
        {/* MOBILE HAMBURGER */}

        <button
          type="button"
          className="menu-button"
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          aria-expanded={menuOpen}
          aria-controls="mobile-navigation"
          onClick={() => {
            setMenuOpen((current) => !current);

            if (searchOpen) {
              setSearchOpen(false);
              setSearchQuery("");
            }
          }}
        >
          {menuOpen ? "×" : "☰"}
        </button>

        {/* LOGO */}

        <Link
          href="/"
          className="wordmark"
          onClick={closeMobileMenu}
        >
          CIRCA LUCIA
        </Link>

        {/* =====================================
            DESKTOP NAVIGATION
        ====================================== */}

        <nav className="desktop-nav">
          <Link href="/#collection">
            Collection
          </Link>

          <Link href="/#maison">
            Maison
          </Link>

          <Link href="/#bespoke">
            Bespoke
          </Link>

          <Link href="/#journal">
            Journal
          </Link>

          <Link href="/#about">
            About us
          </Link>
        </nav>

        {/* =====================================
            RIGHT HEADER ACTIONS
        ====================================== */}

        <div className="header-actions">
          {/* SEARCH */}

          <button
            type="button"
            className="header-icon-button"
            aria-label={
              searchOpen ? "Close search" : "Open search"
            }
            title={
              searchOpen ? "Close search" : "Search"
            }
            onClick={() => {
              setSearchOpen((current) => !current);

              if (searchOpen) {
                setSearchQuery("");
              }

              if (menuOpen) {
                setMenuOpen(false);
              }
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

          {/* SAVED DESIGNS */}

          <Link
            href="/saved-designs"
            className="header-icon-button"
            aria-label="Saved designs"
            title="Saved designs"
            onClick={closeMobileMenu}
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

          {/* ACCOUNT */}

          <Link
            href="/account"
            aria-label="Account"
            onClick={closeMobileMenu}
          >
            Account
          </Link>

          {/* BAG */}

          <Link
            href="/cart"
            aria-label="Shopping bag"
            onClick={closeMobileMenu}
          >
            Bag ({count})
          </Link>

          {/* ADMIN - DIRECT LINK */}

          {isAdmin && (
            <Link
              href="/admin"
              aria-label="Admin"
              onClick={closeMobileMenu}
            >
              Admin
            </Link>
          )}
        </div>
      </div>

      {/* =====================================
          MOBILE NAVIGATION
      ====================================== */}

      <div
        id="mobile-navigation"
        className={`mobile-navigation ${
          menuOpen
            ? "mobile-navigation-open"
            : ""
        }`}
      >
        <nav className="mobile-navigation-links">
          <Link
            href="/#collection"
            onClick={closeMobileMenu}
          >
            Collection
          </Link>

          <Link
            href="/#maison"
            onClick={closeMobileMenu}
          >
            Maison
          </Link>

          <Link
            href="/#bespoke"
            onClick={closeMobileMenu}
          >
            Bespoke
          </Link>

          <Link
            href="/#journal"
            onClick={closeMobileMenu}
          >
            Journal
          </Link>

          <Link
            href="/#about"
            onClick={closeMobileMenu}
          >
            About us
          </Link>

          <Link
            href="/account"
            onClick={closeMobileMenu}
          >
            Account
          </Link>

          <Link
            href="/saved-designs"
            onClick={closeMobileMenu}
          >
            Saved designs
          </Link>

          <Link
            href="/cart"
            onClick={closeMobileMenu}
          >
            Bag ({count})
          </Link>

          {/* ADMIN - DIRECT LINK, LAST ON MOBILE */}

          {isAdmin && (
            <Link
              href="/admin"
              onClick={closeMobileMenu}
            >
              Admin
            </Link>
          )}

        </nav>
      </div>

      {/* =====================================
          SEARCH PANEL
      ====================================== */}

      {searchOpen && (
        <div className="header-search">
          <form
            action="/collection"
            method="GET"
          >
            <div className="header-search-input-wrap">
              <input
                type="search"
                name="q"
                placeholder="Search footwear..."
                aria-label="Search footwear"
                value={searchQuery}
                onChange={(event) =>
                  setSearchQuery(
                    event.target.value
                  )
                }
                autoFocus
              />

              {searchQuery && (
                <button
                  type="button"
                  className="header-search-clear"
                  aria-label="Clear search"
                  onClick={() =>
                    setSearchQuery("")
                  }
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

          {/* SEARCH RESULTS */}

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
                          <span>
                            CIRCA LUCIA
                          </span>
                        )}
                      </div>

                      <div className="search-suggestion-info">
                        <strong>
                          {product.name}
                        </strong>

                        <span>
                          {product.collection ||
                            "Circa Lucia"}
                        </span>
                      </div>

                      <strong className="search-suggestion-price">
                        {formatINR(
                          product.price
                        )}
                      </strong>
                    </Link>
                  ))}
                </>
              ) : (
                <div className="search-no-results">
                  <p>
                    No matching designs found.
                  </p>

                  <span>
                    Try searching by name,
                    collection, or material.
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