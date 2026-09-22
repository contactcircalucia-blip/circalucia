import Link from "next/link";

export default function ReturnsPage() {
  return (
    <main>
      {/* HERO */}
      <section
        className="section"
        style={{
          paddingTop: 90,
          paddingBottom: 70,
          borderBottom: "1px solid var(--line)",
        }}
      >
        <div
          style={{
            maxWidth: 1180,
            margin: "0 auto",
          }}
        >
          <p className="eyebrow">CIRCA LUCIA CLIENT CARE</p>

          <h1
            style={{
              margin: "18px 0 24px",
              fontFamily: '"Cormorant Garamond", serif',
              fontSize: "clamp(48px, 7vw, 88px)",
              lineHeight: 0.95,
              fontWeight: 400,
            }}
          >
            Returns &amp;
            <br />
            <em>Replacements.</em>
          </h1>

          <p
            style={{
              maxWidth: 700,
              margin: 0,
              color: "var(--muted)",
              fontSize: 16,
              lineHeight: 1.8,
            }}
          >
            We want every CIRCA LUCIA pair to arrive as it was intended.
            If there is an issue with your order, you can submit a return
            or replacement request directly from your account.
          </p>
        </div>
      </section>

      {/* POLICY */}
      <section className="section">
        <div
          style={{
            maxWidth: 1180,
            margin: "0 auto",
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 60,
          }}
        >
          <div>
            <p className="eyebrow">01 · REQUEST</p>

            <h2
              style={{
                margin: "12px 0 18px",
                fontFamily: '"Cormorant Garamond", serif',
                fontSize: 34,
                fontWeight: 500,
              }}
            >
              Begin from your order.
            </h2>

            <p
              style={{
                margin: 0,
                color: "var(--muted)",
                lineHeight: 1.8,
              }}
            >
              Sign in to your CIRCA LUCIA account, open My Orders and
              select the relevant order. Where eligible, you can submit
              your return or replacement request from the order details.
            </p>
          </div>

          <div>
            <p className="eyebrow">02 · REVIEW</p>

            <h2
              style={{
                margin: "12px 0 18px",
                fontFamily: '"Cormorant Garamond", serif',
                fontSize: 34,
                fontWeight: 500,
              }}
            >
              Your request is reviewed.
            </h2>

            <p
              style={{
                margin: 0,
                color: "var(--muted)",
                lineHeight: 1.8,
              }}
            >
              Once submitted, your request is reviewed by CIRCA LUCIA.
              You can follow the status of the request from your order
              details as it moves through the after-sales process.
            </p>
          </div>

          <div>
            <p className="eyebrow">03 · RESOLUTION</p>

            <h2
              style={{
                margin: "12px 0 18px",
                fontFamily: '"Cormorant Garamond", serif',
                fontSize: 34,
                fontWeight: 500,
              }}
            >
              Return or replacement.
            </h2>

            <p
              style={{
                margin: 0,
                color: "var(--muted)",
                lineHeight: 1.8,
              }}
            >
              Approved requests are handled according to the selected
              resolution. Refund amounts, where applicable, are confirmed
              as part of the review process.
            </p>
          </div>
        </div>
      </section>

      {/* IMPORTANT INFORMATION */}
      <section
        className="section"
        style={{
          borderTop: "1px solid var(--line)",
        }}
      >
        <div
          style={{
            maxWidth: 1180,
            margin: "0 auto",
            display: "grid",
            gridTemplateColumns:
              "minmax(260px, 0.8fr) minmax(0, 1.2fr)",
            gap: 80,
          }}
        >
          <div>
            <p className="eyebrow">CLIENT CARE</p>

            <h2
              style={{
                margin: "14px 0 0",
                fontFamily: '"Cormorant Garamond", serif',
                fontSize: "clamp(38px, 5vw, 58px)",
                lineHeight: 1,
                fontWeight: 400,
              }}
            >
              Before you
              <br />
              <em>submit a request.</em>
            </h2>
          </div>

          <div>
            <div
              style={{
                padding: "24px 0",
                borderTop: "1px solid var(--line)",
              }}
            >
              <strong
                style={{
                  display: "block",
                  marginBottom: 8,
                  fontWeight: 500,
                }}
              >
                Keep the pair in its original condition
              </strong>

              <p
                style={{
                  margin: 0,
                  color: "var(--muted)",
                  lineHeight: 1.75,
                }}
              >
                Please keep the footwear, packaging and supplied
                accessories together while your request is being reviewed.
              </p>
            </div>

            <div
              style={{
                padding: "24px 0",
                borderTop: "1px solid var(--line)",
              }}
            >
              <strong
                style={{
                  display: "block",
                  marginBottom: 8,
                  fontWeight: 500,
                }}
              >
                Bespoke and personalised orders
              </strong>

              <p
                style={{
                  margin: 0,
                  color: "var(--muted)",
                  lineHeight: 1.75,
                }}
              >
                Bespoke or personalised pieces may have different
                eligibility conditions because they are created specifically
                for the client. Any available resolution will be shown or
                confirmed during review.
              </p>
            </div>

            <div
              style={{
                padding: "24px 0",
                borderTop: "1px solid var(--line)",
                borderBottom: "1px solid var(--line)",
              }}
            >
              <strong
                style={{
                  display: "block",
                  marginBottom: 8,
                  fontWeight: 500,
                }}
              >
                Refunds
              </strong>

              <p
                style={{
                  margin: 0,
                  color: "var(--muted)",
                  lineHeight: 1.75,
                }}
              >
                Where a refund is approved, the applicable refund amount is
                confirmed during processing. Refund progress can be followed
                through the corresponding order and return request.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section
        className="section"
        style={{
          borderTop: "1px solid var(--line)",
          textAlign: "center",
          paddingTop: 80,
          paddingBottom: 90,
        }}
      >
        <p className="eyebrow">YOUR ORDERS</p>

        <h2
          style={{
            margin: "14px auto 18px",
            fontFamily: '"Cormorant Garamond", serif',
            fontSize: "clamp(38px, 5vw, 58px)",
            fontWeight: 400,
          }}
        >
          Need help with a pair?
        </h2>

        <p
          style={{
            maxWidth: 560,
            margin: "0 auto 30px",
            color: "var(--muted)",
            lineHeight: 1.8,
          }}
        >
          Open your order to view its current status and any available
          return or replacement options.
        </p>

        <Link
          href="/account/orders"
          className="button button-dark"
        >
          View my orders
        </Link>
      </section>
    </main>
  );
}