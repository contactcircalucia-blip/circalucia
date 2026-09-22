"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type SaveDesignButtonProps = {
  productId: string;
};

export default function SaveDesignButton({ productId }: SaveDesignButtonProps) {
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [loginRequired, setLoginRequired] = useState(false);

  const loadSavedState = useCallback(async () => {
    setLoading(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setSaved(false);
        return;
      }

      const { data, error } = await supabase
        .from("saved_products")
        .select("id")
        .eq("user_id", user.id)
        .eq("product_id", productId)
        .maybeSingle();

      if (error) throw error;

      setSaved(Boolean(data));
    } catch (error) {
      console.error("Unable to check saved product:", error);
      setSaved(false);
    } finally {
      setLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    loadSavedState();
  }, [loadSavedState]);

  async function toggleSaved() {
    if (working) return;

    setWorking(true);
    setLoginRequired(false);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setLoginRequired(true);
        return;
      }

      if (saved) {
        const { error } = await supabase
          .from("saved_products")
          .delete()
          .eq("user_id", user.id)
          .eq("product_id", productId);

        if (error) throw error;
        setSaved(false);
      } else {
        const { error } = await supabase
          .from("saved_products")
          .upsert(
            {
              user_id: user.id,
              product_id: productId,
            },
            {
              onConflict: "user_id,product_id",
              ignoreDuplicates: true,
            }
          );

        if (error) throw error;
        setSaved(true);
      }

      window.dispatchEvent(new Event("cl-saved-designs-updated"));
    } catch (error) {
      console.error("Unable to update saved product:", error);
    } finally {
      setWorking(false);
    }
  }

  const disabled = loading || working;

  return (
    <div style={{ marginTop: "12px" }}>
      <button
        type="button"
        onClick={toggleSaved}
        disabled={disabled}
        aria-pressed={saved}
        className="button"
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "9px",
          opacity: disabled ? 0.6 : 1,
          cursor: disabled ? "not-allowed" : "pointer",
        }}
      >
        <span aria-hidden="true" style={{ fontSize: "18px", lineHeight: 1 }}>
          {saved ? "♥" : "♡"}
        </span>
        <span>
          {loading
            ? "LOADING..."
            : working
            ? "SAVING..."
            : saved
            ? "SAVED FOR LATER"
            : "SAVE FOR LATER"}
        </span>
      </button>

      {loginRequired && (
        <div
          style={{
            marginTop: "12px",
            padding: "12px 14px",
            border: "1px solid var(--line)",
            background: "var(--cream)",
            fontSize: "12px",
          }}
        >
          Please{" "}
          <Link href="/account" style={{ color: "inherit", textDecoration: "underline" }}>
            log in
          </Link>{" "}
          to save this design.
        </div>
      )}
    </div>
  );
}
