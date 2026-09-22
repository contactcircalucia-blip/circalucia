import Link from "next/link";

export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer-top">
        {/* LEFT — BRAND DETAILS */}
        <div>
          <div className="footer-brand">CIRCA LUCIA</div>

          <p>Crafted as you imagined.</p>

          {/* CONTACT */}
          <div
            style={{
              marginTop: "30px",
            }}
          >
            <span
              style={{
                display: "block",
                marginBottom: "10px",
                fontSize: "10px",
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                opacity: 0.6,
              }}
            >
              Contact
            </span>

            <a
              href="mailto:contact.circalucia@gmail.com"
              style={{
                display: "block",
                width: "fit-content",
                marginBottom: "7px",
                color: "inherit",
                textDecoration: "none",
              }}
            >
              contact.circalucia@gmail.com
            </a>

            <a
              href="tel:+917398930068"
              style={{
                display: "block",
                width: "fit-content",
                color: "inherit",
                textDecoration: "none",
              }}
            >
              +91 73989 30068
            </a>
          </div>

          {/* ADDRESS */}
          <div
            style={{
              marginTop: "30px",
            }}
          >
            <span
              style={{
                display: "block",
                marginBottom: "10px",
                fontSize: "10px",
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                opacity: 0.6,
              }}
            >
              Address
            </span>

            <a
              href="https://share.google/GJUdq7uj42z5AuHua"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "block",
                width: "fit-content",
                color: "inherit",
                textDecoration: "none",
                lineHeight: "1.6",
              }}
            >
              Circa Lucia
              <br />
              K-2, Sangam Vihar
              <br />
              New Delhi, Delhi
              <br />
              India 110080
            </a>
          </div>
        </div>

        {/* RIGHT — NAVIGATION */}
        <div className="footer-links">
          <div>
            <span>Explore</span>

            <Link href="/collection">
              Collection
            </Link>

            <Link href="/bespoke">
              Bespoke
            </Link>

            <Link href="/#maison">
              Maison
            </Link>
          </div>

          <div>
            <span>Client</span>

            <Link href="/account">
              Account
            </Link>

            <Link href="/account/orders">
              Orders
            </Link>

            <Link href="/returns">
              Returns &amp; Replacements
            </Link>

            <Link href="/cart">
              Bag
            </Link>

            <Link href="/checkout">
              Checkout
            </Link>
          </div>

          <div>
            <span>Connect</span>

            <a
              href="https://www.instagram.com/circalucia"
              target="_blank"
              rel="noopener noreferrer"
            >
              Instagram
            </a>

            <a
              href="https://wa.me/917398930068"
              target="_blank"
              rel="noopener noreferrer"
            >
              WhatsApp
            </a>

            <a
              href="https://share.google/GJUdq7uj42z5AuHua"
              target="_blank"
              rel="noopener noreferrer"
            >
              Locate us
            </a>
          </div>
        </div>
      </div>

      <div className="footer-bottom">
        <span>© 2026 Circa Lucia</span>
        <span>Made for the moments that matter.</span>
      </div>
    </footer>
  );
}