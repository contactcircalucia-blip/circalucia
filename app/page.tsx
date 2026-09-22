import Link from "next/link";
import Image from "next/image";
import {
  getProducts,
  formatINR,
  getProductImage,
} from "@/lib/products";

export default async function Home() {
  const allProducts = await getProducts();

  // Only products selected in Admin for homepage display.
  // Maximum 3 products can appear here.
  const products = allProducts
    .filter((product) => product.featured_home === true)
    .slice(0, 3);

  return (
    <>
      {/* =====================================================
          HERO
      ===================================================== */}
      <section className="hero">
        <div className="hero-overlay">
          <p className="eyebrow">THE HOUSE OF CIRCA LUCIA</p>

          <h1>
            Crafted
            <br />
            <em>as you imagined.</em>
          </h1>

          <p className="hero-copy">
            Designed in-house. Crafted to order. Made for the woman who refuses
            ordinary.
          </p>

          <div className="hero-actions">
            <Link className="button button-light" href="/collection">
              Discover the collection
            </Link>

            <Link className="text-link light" href="/bespoke">
              Enter bespoke
            </Link>
          </div>
        </div>
      </section>

      {/* =====================================================
          PHILOSOPHY
      ===================================================== */}
      <section className="intro section">
        <p className="eyebrow">THE CIRCA LUCIA PHILOSOPHY</p>

        <h2>
          Not simply footwear.
          <br />
          <em>A piece of your imagination.</em>
        </h2>

        <p className="wide-copy">
          Every Circa Lucia design begins as an idea. We refine the silhouette,
          the proportions and the details, then craft each pair to order with
          an obsessive attention to finish.
        </p>
      </section>

      {/* =====================================================
          COLLECTION
      ===================================================== */}
      <section className="collection-preview section" id="collection">
        <div className="section-heading">
          <div>
            <p className="eyebrow">THE COLLECTION</p>

            <h2>Designed to be remembered.</h2>
          </div>

          <Link href="/collection" className="text-link">
            View all designs →
          </Link>
        </div>

        <div className="product-grid">
          {products.map((p) => {
            const productImage = getProductImage(p);

            return (
              <Link
                className="product-card"
                href={`/product/${p.slug}`}
                key={p.slug}
              >
                <div className="product-placeholder">
                  {productImage ? (
                    <Image
                      src={productImage}
                      alt={p.name}
                      fill
                      sizes="(max-width: 900px) 100vw, 33vw"
                      className="product-image"
                    />
                  ) : (
                    <span>{p.name}</span>
                  )}
                </div>

                <div className="product-meta">
                  <div>
                    <h3>{p.name}</h3>
                    <p>{p.collection}</p>
                  </div>

                  <strong>{formatINR(p.price)}</strong>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* =====================================================
          MAISON / ART OF THE PAIR
      ===================================================== */}
      <section className="split-feature" id="maison">
        <div
          className="feature-image dark-panel"
          style={{
            backgroundImage: "url('/art-of-the-pair.jpg')",
            backgroundSize: "cover",
            backgroundPosition: "center center",
            backgroundRepeat: "no-repeat",
          }}
        >
          <span>THE ART OF THE PAIR</span>
        </div>

        <div className="feature-copy">
          <p className="eyebrow">THE MAISON</p>

          <h2>
            Where design becomes <em>craft.</em>
          </h2>

          <p>
            We believe luxury lives in the details no one asks you to notice:
            the curve of a heel, the balance of a silhouette, the final
            hand-finished edge.
          </p>

          <Link href="/bespoke" className="text-link">
            Discover our approach →
          </Link>
        </div>
      </section>

      {/* =====================================================
          BESPOKE
      ===================================================== */}
      <section className="bespoke-banner" id="bespoke">
        <p className="eyebrow">YOUR VISION, OUR CRAFT</p>

        <h2>
          Made for a moment
          <br />
          <em>only you can create.</em>
        </h2>

        <Link href="/bespoke" className="button button-light">
          Begin your bespoke journey
        </Link>
      </section>

      {/* =====================================================
          JOURNAL
      ===================================================== */}
      <section className="journal section" id="journal">
        <p className="eyebrow">THE JOURNAL</p>

        <h2>Inside the world of Circa Lucia.</h2>

        <div className="journal-grid">
          {/* CRAFT */}
          <article>
            <div
              className="journal-image"
              style={{
                position: "relative",
                overflow: "hidden",
              }}
            >
              <Image
                src="/craft.jpg"
                alt="Circa Lucia craftsmanship"
                fill
                sizes="(max-width: 900px) 100vw, 33vw"
                style={{
                  objectFit: "cover",
                  objectPosition: "center center",
                }}
              />
            </div>

            <p>CRAFT</p>

            <h3>The anatomy of a signature heel.</h3>
          </article>

          {/* STYLE */}
          <article>
            <div
              className="journal-image"
              style={{
                position: "relative",
                overflow: "hidden",
              }}
            >
              <Image
                src="/style.jpg"
                alt="Circa Lucia signature style"
                fill
                sizes="(max-width: 900px) 100vw, 33vw"
                style={{
                  objectFit: "cover",
                  objectPosition: "center center",
                }}
              />
            </div>

            <p>STYLE</p>

            <h3>Why the right silhouette changes everything.</h3>
          </article>

          {/* MAISON */}
          <article>
            <div
              className="journal-image"
              style={{
                position: "relative",
                overflow: "hidden",
              }}
            >
              <Image
                src="/maison.jpg"
                alt="The Maison of Circa Lucia"
                fill
                sizes="(max-width: 900px) 100vw, 33vw"
                style={{
                  objectFit: "cover",
                  objectPosition: "center center",
                }}
              />
            </div>

            <p>MAISON</p>

            <h3>From sketch to the final pair.</h3>
          </article>
        </div>
      </section>

      {/* =====================================================
          ABOUT
      ===================================================== */}
      <section className="about-section section" id="about">
        <div className="about-inner">
          <div className="about-heading">
            <p className="eyebrow">ABOUT CIRCA LUCIA</p>

            <h2>
              More than footwear.
              <br />
              <em>A signature of you.</em>
            </h2>
          </div>

          <div className="about-content">
            <p>
              Circa Lucia was created around a simple belief: luxury should
              feel personal.
            </p>

            <p>
              We design footwear for women who see a pair of heels as more
              than an accessory. Every silhouette, proportion and detail is
              considered to create something that feels distinctive,
              intentional and beautifully yours.
            </p>

            <p>
              From our house designs to our bespoke creations, we bring
              together thoughtful design and meticulous craftsmanship to
              create footwear made to be remembered.
            </p>

            <Link href="/about" className="text-link">
              Read more →
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}