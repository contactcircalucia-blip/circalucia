"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "cl-saved-designs";

type SaveDesignButtonProps = {
  productId: string;
};

export default function SaveDesignButton({
  productId,
}: SaveDesignButtonProps) {
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    try {
      const savedDesigns = JSON.parse(
        localStorage.getItem(STORAGE_KEY) || "[]"
      );

      setSaved(savedDesigns.includes(productId));
    } catch {
      setSaved(false);
    }
  }, [productId]);

  const toggleSaved = () => {
    try {
      const savedDesigns: string[] = JSON.parse(
        localStorage.getItem(STORAGE_KEY) || "[]"
      );

      let updatedDesigns: string[];

      if (savedDesigns.includes(productId)) {
        updatedDesigns = savedDesigns.filter(
          (id) => id !== productId
        );

        setSaved(false);
      } else {
        updatedDesigns = [...savedDesigns, productId];

        setSaved(true);
      }

      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(updatedDesigns)
      );

      window.dispatchEvent(
        new Event("cl-saved-designs-updated")
      );
    } catch (error) {
      console.error("Unable to save design:", error);
    }
  };

  return (
    <div
      style={{
        marginTop: "18px",
      }}
    >
      <button
        type="button"
        onClick={toggleSaved}
        aria-label={
          saved
            ? "Remove from saved designs"
            : "Save design for later"
        }
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "9px",
          padding: 0,
          border: "none",
          background: "transparent",
          color: "inherit",
          fontFamily: "inherit",
          fontSize: "13px",
          lineHeight: 1.4,
          cursor: "pointer",
        }}
      >
        <span
          aria-hidden="true"
          style={{
            fontSize: "19px",
            lineHeight: 1,
            color: saved ? "#b3261e" : "inherit",
          }}
        >
          {saved ? "♥" : "♡"}
        </span>

        <span>
          {saved ? "Saved for later" : "Save for later"}
        </span>
      </button>
    </div>
  );
}
