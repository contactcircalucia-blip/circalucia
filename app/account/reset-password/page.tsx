"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function ResetPasswordPage() {
  const router = useRouter();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [checking, setChecking] = useState(true);
  const [saving, setSaving] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;

    async function checkSession() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!active) return;

      if (session) {
        setReady(true);
      } else {
        setError(
          "This reset link is invalid or has expired. Please request a new one."
        );
      }

      setChecking(false);
    }

    checkSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;

      if (event === "PASSWORD_RECOVERY" && session) {
        setReady(true);
        setError("");
        setChecking(false);
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setMessage("");

    if (password.length < 6) {
      setError("Your password must be at least 6 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("The passwords do not match.");
      return;
    }

    setSaving(true);

    const { error: updateError } = await supabase.auth.updateUser({
      password,
    });

    if (updateError) {
      setError(updateError.message);
      setSaving(false);
      return;
    }

    setMessage("Your password has been changed successfully.");

    await supabase.auth.signOut();

    setSaving(false);
  }

  return (
    <section className="auth-page section">
      <p className="eyebrow">ACCOUNT SECURITY</p>

      <h1>Reset your password.</h1>

      <p>
        Choose a new password for your Circa Lucia account.
      </p>

      {checking ? (
        <p>Verifying your reset link...</p>
      ) : ready ? (
        <form onSubmit={handleSubmit}>
          <input
            className="input"
            type="password"
            placeholder="New password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={6}
            required
          />

          <input
            className="input"
            type="password"
            placeholder="Confirm new password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            minLength={6}
            required
          />

          {error && <div className="error-box">{error}</div>}

          {message && (
            <div className="success-box">{message}</div>
          )}

          {!message && (
            <button
              className="button button-dark"
              type="submit"
              disabled={saving}
            >
              {saving ? "Updating..." : "Update password"}
            </button>
          )}

          {message && (
            <button
              className="button button-dark"
              type="button"
              onClick={() => router.push("/account")}
            >
              Back to sign in
            </button>
          )}
        </form>
      ) : (
        <>
          {error && <div className="error-box">{error}</div>}

          <button
            className="button button-dark"
            type="button"
            onClick={() => router.push("/account")}
          >
            Back to account
          </button>
        </>
      )}
    </section>
  );
}