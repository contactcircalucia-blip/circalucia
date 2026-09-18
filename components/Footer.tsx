import Link from "next/link";

export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer-top">
        <div>
          <div className="footer-brand">CIRCA LUCIA</div>
          <p>Crafted as you imagined.</p>
        </div>

        <div className="footer-links">
          <div>
            <span>Explore</span>
            <Link href="/collection">Collection</Link>
            <Link href="/bespoke">Bespoke</Link>
            <Link href="/#maison">Maison</Link>
          </div>

          <div>
            <span>Client</span>
            <Link href="/account">Account</Link>
            <Link href="/cart">Bag</Link>
            <Link href="/checkout">Checkout</Link>
          </div>

          <div>
            <span>Contact</span>

            <a href="mailto:contact.circalucia@gmail.com">
              Email us
            </a>

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
              href="https://share.google/Nrt5W3MEO0TcLcM0Q"
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