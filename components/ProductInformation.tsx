"use client";

import { useState } from "react";
import type { Product } from "@/lib/products";

type RichProduct = Product & {
  product_details?: string | null;
  size_and_fit?: string | null;
  material_and_care?: string | null;
  delivery_note?: string | null;
  return_note?: string | null;
  specifications?: Record<string, string> | null;
};

function TextBlock({ text }: { text?: string | null }) {
  if (!text) return null;

  return (
    <p
      style={{
        whiteSpace: "pre-line",
        lineHeight: 1.75,
        margin: 0,
      }}
    >
      {text}
    </p>
  );
}

export default function ProductInformation({
  product,
}: {
  product: RichProduct;
}) {
  const [pin, setPin] = useState("");
  const [pinMessage, setPinMessage] = useState("");
  const [showMore, setShowMore] = useState(false);

  const specifications = Object.entries(
    product.specifications || {}
  ).filter(([, value]) => String(value || "").trim());

  /*
   * The normal product description also counts as product information.
   *
   * This means "View more product information" will appear when the
   * product already has its normal description, even if the optional
   * rich-information fields have not yet been filled in by Admin.
   */
  const hasMoreInformation =
    Boolean(product.description?.trim()) ||
    Boolean(product.product_details?.trim()) ||
    Boolean(product.size_and_fit?.trim()) ||
    Boolean(product.material_and_care?.trim()) ||
    specifications.length > 0;

  function checkPin() {
    const cleanPin = pin.replace(/\D/g, "");

    if (cleanPin.length !== 6) {
      setPinMessage("Enter a valid 6-digit PIN code.");
      return;
    }

    setPinMessage(
      "PIN saved for delivery reference. Final serviceability and delivery timing are confirmed during fulfilment."
    );
  }

  const sectionStyle: React.CSSProperties = {
    padding: "28px 0",
    borderTop: "1px solid var(--line)",
  };

  const headingStyle: React.CSSProperties = {
    margin: "0 0 14px",
    fontFamily: '"Cormorant Garamond", serif',
    fontSize: "28px",
    fontWeight: 500,
  };

  return (
    <section
      className="section"
      style={{
        paddingTop: 0,
      }}
    >
      <div
        style={{
          maxWidth: 1180,
          margin: "0 auto",
        }}
      >
        {/* DELIVERY + ASSURANCE */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(290px, 1fr))",
            columnGap: 60,
          }}
        >
          <div>
            {/* DELIVERY OPTIONS */}
            <div style={sectionStyle}>
              <p className="eyebrow">Delivery</p>

              <h2 style={headingStyle}>
                Delivery Options
              </h2>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "minmax(0, 1fr) auto",
                  gap: 8,
                  width: "100%",
                  maxWidth: 520,
                  alignItems: "stretch",
                }}
              >
                <input
                  inputMode="numeric"
                  maxLength={6}
                  value={pin}
                  onChange={(e) => {
                    setPin(
                      e.target.value
                        .replace(/\D/g, "")
                        .slice(0, 6)
                    );

                    setPinMessage("");
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      checkPin();
                    }
                  }}
                  placeholder="Enter PIN code"
                  aria-label="Enter delivery PIN code"
                  style={{
                    width: "100%",
                    minWidth: 0,
                    boxSizing: "border-box",
                    padding: "0 14px",
                    minHeight: 52,
                    border:
                      "1px solid var(--line)",
                    background: "var(--paper)",
                    color: "var(--ink)",
                    font: "inherit",
                    borderRadius: 0,
                  }}
                />

                <button
                  type="button"
                  onClick={checkPin}
                  className="button button-dark"
                  style={{
                    minHeight: 52,
                    height: "100%",
                    margin: 0,
                    whiteSpace: "nowrap",
                  }}
                >
                  Check
                </button>
              </div>

              {pinMessage && (
                <p
                  style={{
                    margin: "10px 0 0",
                    color: "var(--muted)",
                    fontSize: 13,
                    lineHeight: 1.6,
                  }}
                >
                  {pinMessage}
                </p>
              )}

              {product.delivery_note && (
                <div
                  style={{
                    marginTop: 18,
                  }}
                >
                  <TextBlock
                    text={product.delivery_note}
                  />
                </div>
              )}
            </div>

            {/* OUR ASSURANCE */}
            <div style={sectionStyle}>
              <p className="eyebrow">
                CIRCA LUCIA
              </p>

              <h2 style={headingStyle}>
                Our Assurance
              </h2>

              <div
                style={{
                  display: "grid",
                  gap: 12,
                  lineHeight: 1.6,
                }}
              >
                <div>
                  Authentic CIRCA LUCIA product
                </div>

                <div>
                  Secure online payment
                </div>

                <div>
                  {product.return_note ||
                    "Returns and replacements are subject to CIRCA LUCIA's applicable policy."}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* VIEW MORE BUTTON */}
        {hasMoreInformation && (
          <div
            style={{
              borderTop:
                "1px solid var(--line)",
              padding: "26px 0",
            }}
          >
            <button
              type="button"
              className="button button-dark"
              onClick={() =>
                setShowMore(
                  (current) => !current
                )
              }
              aria-expanded={showMore}
              style={{
                width: "100%",
                maxWidth: 320,
                minHeight: 52,
              }}
            >
              {showMore
                ? "Hide product information"
                : "View more product information"}
            </button>
          </div>
        )}

        {/* EXPANDED PRODUCT INFORMATION */}
        {showMore && hasMoreInformation && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(290px, 1fr))",
              columnGap: 60,
            }}
          >
            {/* LEFT COLUMN */}
            <div>
              {/* NORMAL PRODUCT DESCRIPTION */}
              {product.description?.trim() && (
                <div style={sectionStyle}>
                  <p className="eyebrow">
                    The Product
                  </p>

                  <h2 style={headingStyle}>
                    Product Description
                  </h2>

                  <TextBlock
                    text={product.description}
                  />
                </div>
              )}

              {/* PRODUCT DETAILS */}
              {product.product_details?.trim() && (
                <div style={sectionStyle}>
                  <p className="eyebrow">
                    The Design
                  </p>

                  <h2 style={headingStyle}>
                    Product Details
                  </h2>

                  <TextBlock
                    text={
                      product.product_details
                    }
                  />
                </div>
              )}

              {/* SIZE & FIT */}
              {product.size_and_fit?.trim() && (
                <div style={sectionStyle}>
                  <p className="eyebrow">
                    Fit
                  </p>

                  <h2 style={headingStyle}>
                    Size &amp; Fit
                  </h2>

                  <TextBlock
                    text={product.size_and_fit}
                  />
                </div>
              )}
            </div>

            {/* RIGHT COLUMN */}
            <div>
              {/* MATERIAL & CARE */}
              {product.material_and_care?.trim() && (
                <div style={sectionStyle}>
                  <p className="eyebrow">
                    Craft
                  </p>

                  <h2 style={headingStyle}>
                    Material &amp; Care
                  </h2>

                  <TextBlock
                    text={
                      product.material_and_care
                    }
                  />
                </div>
              )}

              {/* SPECIFICATIONS */}
              {specifications.length > 0 && (
                <div style={sectionStyle}>
                  <p className="eyebrow">
                    Details
                  </p>

                  <h2 style={headingStyle}>
                    Specifications
                  </h2>

                  <div>
                    {specifications.map(
                      ([key, value]) => (
                        <div
                          key={key}
                          style={{
                            display: "grid",
                            gridTemplateColumns:
                              "minmax(120px, 0.8fr) 1.2fr",
                            gap: 18,
                            padding:
                              "11px 0",
                            borderBottom:
                              "1px solid var(--line)",
                          }}
                        >
                          <span
                            style={{
                              color:
                                "var(--muted)",
                              textTransform:
                                "capitalize",
                            }}
                          >
                            {key.replaceAll(
                              "_",
                              " "
                            )}
                          </span>

                          <strong
                            style={{
                              fontWeight: 500,
                            }}
                          >
                            {value}
                          </strong>
                        </div>
                      )
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}