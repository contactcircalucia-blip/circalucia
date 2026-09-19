'use client';

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  getCountries,
  getCountryCallingCode,
  Country,
} from "react-phone-number-input";
import { supabase } from "@/lib/supabase";

type OrderSummary = {
  id: string;
  order_number: string;
  status: string;
  total_amount: number;
  currency: string;
  created_at: string;
};

export default function Account() {
  const countries = useMemo(() => getCountries(), []);

  const [logged, setLogged] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const [profile, setProfile] = useState<any>(null);
  const [showSignup, setShowSignup] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [fullName, setFullName] = useState("");

  const [country, setCountry] = useState<Country>("IN");
  const [phone, setPhone] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  // Password visibility
  const [showPassword, setShowPassword] = useState(false);

  // Wrong credentials warning
  const [showWrongCredentials, setShowWrongCredentials] =
    useState(false);

  // Orders
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);

  const countryNames = useMemo(() => {
    return new Intl.DisplayNames(["en"], {
      type: "region",
    });
  }, []);

  useEffect(() => {
    async function loadSession() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      setLogged(!!session);

      if (session?.user) {
        setUserEmail(session.user.email || "");

        const { data: profileData, error: profileError } =
          await supabase
            .from("profiles")
            .select("full_name, phone")
            .eq("id", session.user.id)
            .single();

        if (profileError) {
          console.error(profileError);
        } else {
          setProfile(profileData);
        }

        await loadOrders(session.user.id);
      }
    }

    loadSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setLogged(!!session);

        if (session?.user) {
          setUserEmail(session.user.email || "");

          const { data: profileData, error: profileError } =
            await supabase
              .from("profiles")
              .select("full_name, phone")
              .eq("id", session.user.id)
              .single();

          if (profileError) {
            console.error(profileError);
          } else {
            setProfile(profileData);
          }

          await loadOrders(session.user.id);
        } else {
          setOrders([]);
          setProfile(null);
          setUserEmail("");
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  async function loadOrders(userId: string) {
    setOrdersLoading(true);

    const { data, error } = await supabase
      .from("orders")
      .select(
        "id, order_number, status, total_amount, currency, created_at"
      )
      .eq("user_id", userId)
      .order("created_at", {
        ascending: false,
      });

    if (error) {
      console.error("Error loading orders:", error);
      setOrders([]);
    } else {
      setOrders((data || []) as OrderSummary[]);
    }

    setOrdersLoading(false);
  }

  function handlePhoneChange(value: string) {
    const digitsOnly = value.replace(/\D/g, "");

    setPhone(digitsOnly.slice(0, 10));
  }

  async function handleSignIn(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setLoading(true);
    setError("");
    setMessage("");
    setShowWrongCredentials(false);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      console.error(error);

      setLoading(false);
      setShowWrongCredentials(true);

      return;
    }

    setLoading(false);
  }

  function confirmReenterPassword() {
    setShowWrongCredentials(false);
    setError("");
    setPassword("");

    window.location.reload();
  }

  async function handleSignup(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setLoading(true);
    setError("");
    setMessage("");
    setShowWrongCredentials(false);

    if (!/^\d{10}$/.test(phone)) {
      setError("Phone number must contain exactly 10 digits.");
      setLoading(false);
      return;
    }

    const fullPhone = `+${getCountryCallingCode(country)}${phone}`;

    const { data: existingProfile, error: phoneCheckError } =
      await supabase
        .from("profiles")
        .select("id")
        .eq("phone", fullPhone)
        .maybeSingle();

    if (phoneCheckError) {
      console.error(phoneCheckError);

      setError(
        "Unable to verify the phone number. Please try again."
      );

      setLoading(false);
      return;
    }

    if (existingProfile) {
      setError(
        "This mobile number is already registered. Please sign in instead."
      );

      setLoading(false);
      return;
    }

    const {
      data,
      error: signupError,
    } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          phone: fullPhone,
        },
      },
    });

    if (signupError) {
      if (
        signupError.message
          .toLowerCase()
          .includes("already registered") ||
        signupError.message
          .toLowerCase()
          .includes("already exists")
      ) {
        setError(
          "This email address is already registered. Please sign in instead."
        );
      } else {
        setError(signupError.message);
      }

      setLoading(false);
      return;
    }

    if (data.user) {
      if (data.session) {
        const { error: profileError } = await supabase
          .from("profiles")
          .update({
            full_name: fullName,
            phone: fullPhone,
          })
          .eq("id", data.user.id);

        if (profileError) {
          console.error(profileError);

          setError(
            "Your account was created, but we could not save your phone number. Please contact support."
          );

          setLoading(false);
          return;
        }
      }
    }

    setMessage(
      data.session
        ? "Your account has been created successfully."
        : "Your account has been created. Please check your email to continue."
    );

    setLoading(false);
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    setLogged(false);
    setOrders([]);
  }

  function formatOrderDate(date: string) {
    return new Intl.DateTimeFormat("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(new Date(date));
  }

  function formatINR(value: number) {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(value);
  }

  if (!logged) {
    return (
      <section className="auth-page section">
        <p className="eyebrow">CLIENT PRIVILEGES</p>

        <h1>
          {showSignup
            ? "Create your account."
            : "My Circa Lucia"}
        </h1>

        <p>
          {showSignup
            ? "Create your private Circa Lucia account to manage your orders, bespoke requests and personal details."
            : "Sign in to view orders, saved designs, addresses and your bespoke journey."}
        </p>

        {showWrongCredentials && (
          <div className="credentials-warning">
            <div className="credentials-warning-content">
              <span className="warning-icon">!</span>

              <div>
                <strong>Incorrect credentials</strong>

                <p>
                  The email or password you entered is
                  incorrect. Please check your credentials
                  and try again.
                </p>
              </div>
            </div>

            <button
              type="button"
              className="warning-confirm"
              onClick={confirmReenterPassword}
            >
              Confirm & Re-enter
            </button>
          </div>
        )}

        {showSignup ? (
          <form onSubmit={handleSignup}>
            <input
              className="input"
              placeholder="Full name"
              value={fullName}
              onChange={(e) =>
                setFullName(e.target.value)
              }
              required
            />

            <input
              className="input"
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) =>
                setEmail(e.target.value)
              }
              required
            />

            <div className="phone-row">
              <select
                className="input phone-country"
                value={country}
                onChange={(e) =>
                  setCountry(
                    e.target.value as Country
                  )
                }
              >
                {countries.map((countryCode) => {
                  const name =
                    countryNames.of(countryCode) ||
                    countryCode;

                  const callingCode =
                    getCountryCallingCode(
                      countryCode
                    );

                  return (
                    <option
                      key={countryCode}
                      value={countryCode}
                    >
                      {name} (+{callingCode})
                    </option>
                  );
                })}
              </select>

              <input
                className="input phone-number"
                type="tel"
                inputMode="numeric"
                placeholder="10-digit mobile number"
                value={phone}
                onChange={(e) =>
                  handlePhoneChange(
                    e.target.value
                  )
                }
                maxLength={10}
                pattern="[0-9]{10}"
                required
              />
            </div>

            <p className="phone-help">
              Enter exactly 10 digits. Country code is
              selected separately.
            </p>

            <div className="password-field">
              <input
                className="input"
                type={
                  showPassword
                    ? "text"
                    : "password"
                }
                placeholder="Password"
                value={password}
                onChange={(e) =>
                  setPassword(e.target.value)
                }
                minLength={6}
                required
              />

              <button
                type="button"
                className="password-toggle"
                onClick={() =>
                  setShowPassword(!showPassword)
                }
                aria-label={
                  showPassword
                    ? "Hide password"
                    : "Show password"
                }
              >
                {showPassword ? "◉" : "◉"}
              </button>
            </div>

            {error && (
              <div className="error-box">
                {error}
              </div>
            )}

            {message && (
              <div className="success-box">
                {message}
              </div>
            )}

            <button
              className="button button-dark"
              type="submit"
              disabled={loading}
            >
              {loading
                ? "Creating account..."
                : "Create account"}
            </button>

            <button
              type="button"
              className="text-link"
              onClick={() => {
                setShowSignup(false);
                setError("");
                setMessage("");
                setShowWrongCredentials(false);
              }}
            >
              Already have an account? Sign in
            </button>
          </form>
        ) : (
          <form onSubmit={handleSignIn}>
            <input
              className="input"
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) =>
                setEmail(e.target.value)
              }
              required
            />

            <div className="password-field">
              <input
                className="input"
                type={
                  showPassword
                    ? "text"
                    : "password"
                }
                placeholder="Password"
                value={password}
                onChange={(e) =>
                  setPassword(e.target.value)
                }
                required
              />

              <button
                type="button"
                className="password-toggle"
                onClick={() =>
                  setShowPassword(!showPassword)
                }
                aria-label={
                  showPassword
                    ? "Hide password"
                    : "Show password"
                }
              >
                {showPassword ? "◉" : "◉"}
              </button>
            </div>

            {error && (
              <div className="error-box">
                {error}
              </div>
            )}

            <button
              className="button button-dark"
              type="submit"
              disabled={loading}
            >
              {loading
                ? "Signing in..."
                : "Sign in"}
            </button>

            <button
              type="button"
              className="text-link"
              onClick={() => {
                setShowSignup(true);
                setError("");
                setMessage("");
                setShowWrongCredentials(false);
              }}
            >
              Create an account
            </button>
          </form>
        )}
      </section>
    );
  }

  return (
    <section className="section account-page">
      <p className="eyebrow">MY CIRCA LUCIA</p>

      <h1>Welcome back.</h1>

      <div className="account-grid">
        <div className="account-card">
          <span>00</span>

          <h2>Account details</h2>

          <p>
            <strong>Name</strong>
            <br />
            {profile?.full_name || "Not available"}
          </p>

          <p>
            <strong>Email</strong>
            <br />
            {userEmail || "Not available"}
          </p>

          <p>
            <strong>Mobile</strong>
            <br />
            {profile?.phone || "Not available"}
          </p>

          <p>
            <strong>Status</strong>
            <br />
            Verified
          </p>
        </div>

        <div className="account-card">
          <span>01</span>

          <h2>Orders</h2>

          {ordersLoading ? (
            <p>Loading your orders...</p>
          ) : orders.length === 0 ? (
            <>
              <p>
                You have not placed any orders yet.
              </p>

              <strong>View orders →</strong>
            </>
          ) : (
            <>
              <p>
                {orders.length === 1
                  ? "1 order"
                  : `${orders.length} orders`}{" "}
                in your Circa Lucia account.
              </p>

              <p>
                <strong>
                  Latest: {orders[0].order_number}
                </strong>
                <br />
                {formatOrderDate(
                  orders[0].created_at
                )}
                <br />
                {formatINR(
                  Number(orders[0].total_amount)
                )}
              </p>

              <a
                href="/account/orders"
                className="text-link"
              >
                View orders →
              </a>
            </>
          )}
        </div>

        <div className="account-card">
          <span>02</span>

          <h2>Saved designs</h2>

          <p>
            Your wishlist and designs you are considering.
          </p>

          <a
            href="/saved-designs"
            className="text-link"
          >
            View saved designs →
          </a>
        </div>

        <div className="account-card">
          <span>03</span>

          <h2>My details</h2>

          <p>
            Personal information and saved addresses.
          </p>

          <strong>Manage details →</strong>
        </div>

        <div className="account-card">
          <span>04</span>

          <h2>Bespoke</h2>

          <p>
            Your custom requests and conversations with
            our atelier.
          </p>

          <strong>View requests →</strong>
        </div>
      </div>

      <button
        className="button button-dark"
        onClick={handleSignOut}
      >
        Sign out
      </button>
    </section>
  );
}