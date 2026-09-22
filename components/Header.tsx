"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { formatINR, getProducts, type Product } from "@/lib/products";
import { supabase } from "@/lib/supabase";

export default function Header() {
  const router = useRouter();
  const [count, setCount] = useState(0);

  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoaded, setProductsLoaded] = useState(false);

  const [menuOpen, setMenuOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement | null>(null);

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
            setIsLoggedIn(false);
            setIsAdmin(false);
            setAccountMenuOpen(false);
          }

          return;
        }

        if (mounted) {
          setIsLoggedIn(true);
        }

        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("is_admin")
          .eq("id", user.id)
          .maybeSingle();

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
     CLOSE ACCOUNT MENU WHEN CLICKING OUTSIDE
  ========================================= */

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (
        accountMenuRef.current &&
        !accountMenuRef.current.contains(event.target as Node)
      ) {
        setAccountMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);

    return () => {
      document.removeEventListener(
        "mousedown",
        handleOutsideClick
      );
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
    setAccountMenuOpen(false);
  };

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error("Unable to log out:", error);
      return;
    }

    setIsLoggedIn(false);
    setIsAdmin(false);
    setAccountMenuOpen(false);
    setMenuOpen(false);
    router.replace("/");
    router.refresh();
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

          <div
            ref={accountMenuRef}
            style={{
              position: "relative",
              display: "contents",
            }}
          >
            <a
              href="#"
              aria-label="Account"
              aria-expanded={accountMenuOpen}
              aria-haspopup="menu"
              onClick={(event) => {
                event.preventDefault();

                setAccountMenuOpen(
                  (current) => !current
                );
              }}
            >
              Account
            </a>

            {accountMenuOpen && (
              <div
                role="menu"
                style={{
                  position: "absolute",
                  top: "100%",
                  right: "35px",
                  width: "230px",
                  background: "#faf9f6",
                  border:
                    "1px solid rgba(20,20,20,0.10)",
                  boxShadow:
                    "0 18px 45px rgba(20,20,20,0.08)",
                  padding: "8px 0",
                  zIndex: 9999,
                }}
              >
                <Link
                  href="/account"
                  role="menuitem"
                  onClick={() =>
                    setAccountMenuOpen(false)
                  }
                  style={{
                    display: "block",
                    padding: "14px 20px",
                    color: "#1a1a1a",
                    textDecoration: "none",
                    fontFamily: "inherit",
                    fontSize: "11px",
                    fontWeight: 400,
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                    whiteSpace: "nowrap",
                  }}
                >
                  My Account
                </Link>

                {isLoggedIn && (
                  <>
                    <div
                      style={{
                        height: "1px",
                        background:
                          "rgba(20,20,20,0.08)",
                        margin: "0 20px",
                      }}
                    />

                    <Link
                      href="/account/orders"
                      role="menuitem"
                      onClick={() =>
                        setAccountMenuOpen(false)
                      }
                      style={{
                        display: "block",
                        padding: "14px 20px",
                        color: "#1a1a1a",
                        textDecoration: "none",
                        fontFamily: "inherit",
                        fontSize: "11px",
                        fontWeight: 400,
                        letterSpacing: "0.12em",
                        textTransform: "uppercase",
                        whiteSpace: "nowrap",
                      }}
                    >
                      My Orders
                    </Link>
                    <div
                      style={{
                        height: "1px",
                        background:
                          "rgba(20,20,20,0.08)",
                        margin: "0 20px",
                      }}
                    />

                    <button
                      type="button"
                      role="menuitem"
                      onClick={handleLogout}
                      style={{
                        display: "block",
                        width: "100%",
                        border: "none",
                        background: "transparent",
                        padding: "14px 20px",
                        color: "#1a1a1a",
                        fontFamily: "inherit",
                        fontSize: "11px",
                        fontWeight: 400,
                        letterSpacing: "0.12em",
                        textTransform: "uppercase",
                        textAlign: "left",
                        cursor: "pointer",
                        whiteSpace: "nowrap",
                      }}
                    >
                      Log out
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

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

          <a
            href="#"
            onClick={(event) => {
              event.preventDefault();

              setAccountMenuOpen(
                (current) => !current
              );
            }}
          >
            Account
          </a>

          {accountMenuOpen && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "14px",
                paddingLeft: "18px",
              }}
            >
              <Link
                href="/account"
                onClick={closeMobileMenu}
              >
                My Account
              </Link>

              {isLoggedIn && (
                <Link
                  href="/account/orders"
                  onClick={closeMobileMenu}
                >
                  My Orders
                </Link>
              )}

              {isLoggedIn && (
                <button
                  type="button"
                  onClick={handleLogout}
                  style={{
                    border: "none",
                    background: "transparent",
                    padding: 0,
                    color: "inherit",
                    font: "inherit",
                    textAlign: "left",
                    cursor: "pointer",
                  }}
                >
                  Log out
                </button>
              )}
            </div>
          )}

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