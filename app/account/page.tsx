
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
  const [showForgotPassword, setShowForgotPassword] = useState(false);

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

  // Password reset cooldown
  const [resetCooldown, setResetCooldown] = useState(0);

  // Orders
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);

  const countryNames = useMemo(() => {
    return new Intl.DisplayNames(["en"], {
      type: "region",
    });
  }, []);

  // Countdown timer for password reset requests
  useEffect(() => {
    if (resetCooldown <= 0) return;

    const timer = window.setTimeout(() => {
      setResetCooldown((current) =>
        Math.max(0, current - 1)
      );
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [resetCooldown]);

  async function sendWelcomeEmail() {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const accessToken = session?.access_token;

      if (!accessToken) {
        return false;
      }

      const response = await fetch(
        "/api/email/account-event",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            accessToken,
            event: "welcome",
          }),
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        console.error("Welcome email failed:", result);
        return false;
      }

      console.log(
        "Circa Lucia welcome email sent successfully."
      );

      return true;
    } catch (error) {
      console.error(
        "Welcome email request failed:",
        error
      );

      return false;
    }
  }

  async function sendLoginEmail() {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const accessToken = session?.access_token;

      if (!accessToken) {
        console.error(
          "Login notification email skipped: no access token."
        );

        return false;
      }

      const response = await fetch(
        "/api/email/account-event",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            accessToken,
            event: "login",
          }),
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        console.error(
          "Login notification email failed:",
          result
        );

        return false;
      }

      console.log(
        "Circa Lucia login notification sent successfully."
      );

      return true;
    } catch (error) {
      console.error(
        "Login notification email request failed:",
        error
      );

      return false;
    }
  }

  async function handleAuthenticatedSession(
    sessionUser: {
      id: string;
      email?: string;
      user_metadata?: {
        full_name?: string;
        phone?: string;
      };
    }
  ) {
    setUserEmail(sessionUser.email || "");

    const {
      data: profileData,
      error: profileError,
    } = await supabase
      .from("profiles")
      .select("full_name, phone")
      .eq("id", sessionUser.id)
      .single();

    if (profileError) {
      console.error(profileError);
    } else {
      setProfile(profileData);
    }

    await loadOrders(sessionUser.id);

    // Send pending welcome email after authentication.
    if (
      typeof window !== "undefined" &&
      localStorage.getItem(
        "circa_lucia_pending_welcome"
      ) === "true"
    ) {
      const sent = await sendWelcomeEmail();

      if (sent) {
        localStorage.removeItem(
          "circa_lucia_pending_welcome"
        );
      }
    }
  }

  useEffect(() => {
    async function loadSession() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      setLogged(!!session);

      if (session?.user) {
        await handleAuthenticatedSession(
          session.user
        );
      }
    }

    loadSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setLogged(!!session);

        if (session?.user) {
          await handleAuthenticatedSession(
            session.user
          );
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

    try {
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
        console.error(
          "Error loading orders:",
          error
        );

        setOrders([]);
      } else {
        setOrders(
          (data || []) as OrderSummary[]
        );
      }
    } finally {
      setOrdersLoading(false);
    }
  }

  function handlePhoneChange(value: string) {
    const digitsOnly = value.replace(/\D/g, "");
    setPhone(digitsOnly.slice(0, 10));
  }

  async function handleSignIn(
    e: FormEvent<HTMLFormElement>
  ) {
    e.preventDefault();

    setLoading(true);
    setError("");
    setMessage("");
    setShowWrongCredentials(false);

    try {
      const { data, error } =
        await supabase.auth.signInWithPassword({
          email: email.trim().toLowerCase(),
          password,
        });

      if (error) {
        console.error(error);
        setShowWrongCredentials(true);
        return;
      }

      if (data.session) {
        await sendLoginEmail();
      }
    } catch (signInError) {
      console.error(signInError);
      setError(
        "Something went wrong while signing in. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleForgotPassword(
    e: FormEvent<HTMLFormElement>
  ) {
    e.preventDefault();

    if (loading) return;

    setLoading(true);
    setError("");
    setMessage("");

    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail) {
      setError(
        "Please return to sign in and enter your account email first."
      );
      setLoading(false);
      return;
    }

    if (resetCooldown > 0) {
      setError(
        `Please wait ${resetCooldown} seconds before requesting another reset email.`
      );
      setLoading(false);
      return;
    }

    try {
      const { error: resetError } =
        await supabase.auth.resetPasswordForEmail(
          normalizedEmail,
          {
            redirectTo: `${window.location.origin}/account/reset-password`,
          }
        );

      // Apply cooldown after each attempt.
      // Supabase's server-side limit remains authoritative.
      setResetCooldown(60);

      if (resetError) {
        console.error(
          "Password reset request failed:",
          resetError
        );

        const errorText =
          resetError.message.toLowerCase();

        if (
          errorText.includes("rate limit") ||
          errorText.includes("too many requests")
        ) {
          setError(
            "Too many password-reset requests. Please wait before trying again. Supabase has not confirmed that a new email was sent."
          );
        } else {
          setError(
            "We couldn't send your password-reset link. Please try again later."
          );
        }

        return;
      }

      setMessage(
        "If an account exists for this email, a password-reset link has been requested. Please check your inbox and spam folder."
      );
    } catch (requestError) {
      console.error(
        "Unexpected password reset error:",
        requestError
      );

      setResetCooldown(60);

      setError(
        "Something went wrong while requesting your reset link. Please wait before trying again."
      );
    } finally {
      setLoading(false);
    }
  }

  function confirmReenterPassword() {
    setShowWrongCredentials(false);
    setError("");
    setPassword("");

    window.location.reload();
  }

  async function handleSignup(
    e: FormEvent<HTMLFormElement>
  ) {
    e.preventDefault();

    setLoading(true);
    setError("");
    setMessage("");
    setShowWrongCredentials(false);

    try {
      if (!/^\d{10}$/.test(phone)) {
        setError(
          "Phone number must contain exactly 10 digits."
        );
        return;
      }

      const fullPhone =
        `+${getCountryCallingCode(country)}${phone}`;

      // Secure duplicate phone-number check.
      const {
        data: phoneRegistered,
        error: phoneCheckError,
      } = await supabase.rpc(
        "is_phone_registered",
        {
          p_phone: fullPhone,
        }
      );

      if (phoneCheckError) {
        console.error(
          "Phone check error:",
          phoneCheckError
        );

        setError(
          "Unable to verify the phone number. Please try again."
        );

        return;
      }

      if (phoneRegistered === true) {
        setError(
          "This mobile number is already registered. Please sign in instead."
        );

        return;
      }

      const {
        data,
        error: signupError,
      } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          data: {
            full_name: fullName,
            phone: fullPhone,
          },
        },
      });

      if (signupError) {
        const signupErrorText =
          signupError.message.toLowerCase();

        if (
          signupErrorText.includes("already registered") ||
          signupErrorText.includes("already exists")
        ) {
          setError(
            "This email address is already registered. Please sign in instead."
          );
        } else {
          setError(signupError.message);
        }

        return;
      }

      if (data.user) {
        if (data.session) {
          const { error: profileError } =
            await supabase
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

            return;
          }

          await sendWelcomeEmail();
        } else {
          // Email confirmation is enabled.
          if (typeof window !== "undefined") {
            localStorage.setItem(
              "circa_lucia_pending_welcome",
              "true"
            );
          }
        }
      }

      setMessage(
        data.session
          ? "Your account has been created successfully."
          : "Your account has been created. Please check your email to continue."
      );
    } catch (signupError) {
      console.error(signupError);

      setError(
        "Something went wrong while creating your account. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleSignOut() {
    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error("Sign out failed:", error);
      setError("Unable to sign out. Please try again.");
      return;
    }

    setLogged(false);
    setOrders([]);
    setProfile(null);
    setUserEmail("");
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
        <p className="eyebrow">
          CLIENT PRIVILEGES
        </p>

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
              <span className="warning-icon">
                !
              </span>

              <div>
                <strong>
                  Incorrect credentials
                </strong>

                <p>
                  The email or password you entered
                  is incorrect. Please check your
                  credentials and try again.
                </p>
              </div>
            </div>

            <button
              type="button"
              className="warning-confirm"
              onClick={confirmReenterPassword}
            >
              Confirm &amp; Re-enter
            </button>
          </div>
        )}

        {showForgotPassword ? (
          <form onSubmit={handleForgotPassword}>
            <p>
              We’ll send a secure password-reset
              link to the email address you entered
              on the sign-in form. You cannot change
              the email address here.
            </p>

            <input
              className="input"
              type="email"
              placeholder="Account email address"
              value={email}
              readOnly
              required
            />

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
              disabled={
                loading || resetCooldown > 0
              }
            >
              {loading
                ? "Sending link..."
                : resetCooldown > 0
                  ? `Try again in ${resetCooldown}s`
                  : "Send reset link"}
            </button>

            <button
              type="button"
              className="text-link"
              onClick={() => {
                setShowForgotPassword(false);
                setError("");
                setMessage("");
              }}
            >
              Back to sign in
            </button>
          </form>
        ) : showSignup ? (
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
              Enter exactly 10 digits. Country code
              is selected separately.
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
                {showPassword ? "Hide" : "Show"}
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
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>

            <div
              style={{
                textAlign: "right",
                marginTop: "-8px",
                marginBottom: "16px",
              }}
            >
              <button
                type="button"
                className="text-link"
                onClick={() => {
                  setShowForgotPassword(true);
                  setError("");
                  setMessage("");
                  setShowWrongCredentials(false);
                }}
              >
                Forgot password?
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
      <p className="eyebrow">
        MY CIRCA LUCIA
      </p>

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
                  Number(
                    orders[0].total_amount
                  )
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
            Your wishlist and designs you are
            considering.
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
            Personal information and saved
            addresses.
          </p>

          <strong>Manage details →</strong>
        </div>

        <div className="account-card">
          <span>04</span>

          <h2>Bespoke</h2>

          <p>
            Your custom requests and conversations
            with our atelier.
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