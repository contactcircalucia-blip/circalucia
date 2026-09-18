"use client";

import Link from "next/link";

export default function AboutPage() {
  return (
    <main className="about-page">
      <section className="about-hero">
        <div className="about-hero-inner">
          <p className="eyebrow">THE HOUSE OF CIRCA LUCIA</p>

          <h1>
            Designed with intention.
            <br />
            <em>Crafted with feeling.</em>
          </h1>

          <p className="about-hero-copy">
            Circa Lucia is a luxury footwear house built around one simple
            belief: what you wear should feel unmistakably yours.
          </p>
        </div>
      </section>

      <section className="about-story section">
        <div className="about-story-inner">
          <div className="about-label">
            <p className="eyebrow">OUR STORY</p>
          </div>

          <div className="about-story-copy">
            <h2>
              More than a pair.
              <br />
              <em>A personal expression.</em>
            </h2>

            <p>
              Circa Lucia was created for women who see footwear as more than
              something to complete an outfit. For us, a pair of heels can
              carry a mood, a memory, an occasion and a sense of identity.
            </p>

            <p>
              Every design begins with an idea. We shape the silhouette,
              refine the proportions and obsess over the details before
              bringing it to life through considered craftsmanship.
            </p>

            <p>
              Our approach is deliberately personal. Rather than following
              the idea of mass production, Circa Lucia creates footwear with
              intention, allowing each design to feel considered from the
              first sketch to the final pair.
            </p>
          </div>
        </div>
      </section>

      <section className="about-philosophy">
        <div className="about-philosophy-inner">
          <p className="eyebrow">THE CIRCA LUCIA PHILOSOPHY</p>

          <h2>
            Luxury is not
            <br />
            <em>what everyone notices.</em>
          </h2>

          <p>
            It is the curve of a heel. The balance of a silhouette. The
            precision of a finish. The feeling you have when everything about
            a piece feels exactly right.
          </p>
        </div>
      </section>

      <section className="about-values section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">WHAT DEFINES US</p>
            <h2>Our way of creating.</h2>
          </div>
        </div>

        <div className="about-values-grid">
          <article>
            <span>01</span>

            <h3>Intentional Design</h3>

            <p>
              Every silhouette begins with purpose. From proportion to
              finishing details, nothing is added without reason.
            </p>
          </article>

          <article>
            <span>02</span>

            <h3>Considered Craft</h3>

            <p>
              We believe the beauty of luxury lies in the details that reveal
              themselves slowly — through touch, movement and wear.
            </p>
          </article>

          <article>
            <span>03</span>

            <h3>Made With You</h3>

            <p>
              Our bespoke philosophy allows your ideas to become part of the
              design, creating footwear that feels personal rather than
              interchangeable.
            </p>
          </article>
        </div>
      </section>

      <section className="about-bespoke">
        <div className="about-bespoke-inner">
          <p className="eyebrow">YOUR VISION, OUR CRAFT</p>

          <h2>
            Imagine it.
            <br />
            <em>We'll craft it.</em>
          </h2>

          <p>
            Begin your bespoke journey and tell us what you imagine.
          </p>

          <Link href="/bespoke" className="button button-light">
            Begin your bespoke journey
          </Link>
        </div>
      </section>

      <style jsx>{`
        .about-page {
          background: #faf8f4;
          color: #141210;
        }

        .about-hero {
          min-height: 72vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 120px 24px 100px;
          background: #f3eee6;
          text-align: center;
        }

        .about-hero-inner {
          max-width: 900px;
          margin: 0 auto;
        }

        .about-hero h1 {
          margin: 22px 0 28px;
          font-family: "Cormorant Garamond", Georgia, serif;
          font-size: clamp(48px, 7vw, 92px);
          line-height: 0.95;
          font-weight: 400;
          letter-spacing: -0.03em;
        }

        .about-hero h1 em {
          font-weight: 400;
        }

        .about-hero-copy {
          max-width: 620px;
          margin: 0 auto;
          color: #716b64;
          font-family: Inter, Arial, sans-serif;
          font-size: 16px;
          line-height: 1.8;
        }

        .about-story {
          padding-top: 120px;
          padding-bottom: 120px;
        }

        .about-story-inner {
          max-width: 1180px;
          margin: 0 auto;
          padding: 0 24px;
          display: grid;
          grid-template-columns: 0.7fr 1.5fr;
          gap: 100px;
        }

        .about-story-copy {
          max-width: 720px;
        }

        .about-story-copy h2 {
          margin: 0 0 42px;
          font-family: "Cormorant Garamond", Georgia, serif;
          font-size: clamp(40px, 5vw, 64px);
          line-height: 1;
          font-weight: 400;
          letter-spacing: -0.02em;
        }

        .about-story-copy p {
          margin: 0 0 24px;
          color: #716b64;
          font-family: Inter, Arial, sans-serif;
          font-size: 15px;
          line-height: 1.9;
        }

        .about-philosophy {
          padding: 140px 24px;
          background: #141210;
          color: #f3eee6;
          text-align: center;
        }

        .about-philosophy-inner {
          max-width: 820px;
          margin: 0 auto;
        }

        .about-philosophy h2 {
          margin: 24px 0 30px;
          font-family: "Cormorant Garamond", Georgia, serif;
          font-size: clamp(48px, 6vw, 78px);
          line-height: 0.98;
          font-weight: 400;
          letter-spacing: -0.025em;
        }

        .about-philosophy p:last-child {
          max-width: 620px;
          margin: 0 auto;
          color: #c9c0b6;
          font-family: Inter, Arial, sans-serif;
          font-size: 15px;
          line-height: 1.9;
        }

        .about-values {
          padding-top: 120px;
          padding-bottom: 120px;
        }

        .about-values .section-heading {
          max-width: 1180px;
          margin: 0 auto 60px;
          padding: 0 24px;
        }

        .about-values-grid {
          max-width: 1180px;
          margin: 0 auto;
          padding: 0 24px;
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 1px;
          background: #d9d0c4;
        }

        .about-values-grid article {
          min-height: 300px;
          padding: 42px 34px;
          background: #faf8f4;
        }

        .about-values-grid span {
          display: block;
          margin-bottom: 40px;
          color: #716b64;
          font-family: Inter, Arial, sans-serif;
          font-size: 11px;
          letter-spacing: 0.12em;
        }

        .about-values-grid h3 {
          margin: 0 0 18px;
          font-family: "Cormorant Garamond", Georgia, serif;
          font-size: 32px;
          font-weight: 400;
        }

        .about-values-grid p {
          margin: 0;
          color: #716b64;
          font-family: Inter, Arial, sans-serif;
          font-size: 14px;
          line-height: 1.8;
        }

        .about-bespoke {
          padding: 130px 24px;
          background: #f3eee6;
          text-align: center;
        }

        .about-bespoke-inner {
          max-width: 760px;
          margin: 0 auto;
        }

        .about-bespoke h2 {
          margin: 22px 0 22px;
          font-family: "Cormorant Garamond", Georgia, serif;
          font-size: clamp(48px, 6vw, 78px);
          line-height: 0.95;
          font-weight: 400;
          letter-spacing: -0.025em;
        }

        .about-bespoke p:not(.eyebrow) {
          margin: 0 auto 32px;
          color: #716b64;
          font-family: Inter, Arial, sans-serif;
          font-size: 15px;
        }

        @media (max-width: 800px) {
          .about-story-inner {
            grid-template-columns: 1fr;
            gap: 40px;
          }

          .about-values-grid {
            grid-template-columns: 1fr;
          }

          .about-values-grid article {
            min-height: auto;
          }
        }

        @media (max-width: 600px) {
          .about-hero {
            min-height: 65vh;
            padding: 100px 20px 80px;
          }

          .about-story {
            padding-top: 80px;
            padding-bottom: 80px;
          }

          .about-story-inner {
            padding: 0 20px;
          }

          .about-philosophy {
            padding: 100px 20px;
          }

          .about-values {
            padding-top: 80px;
            padding-bottom: 80px;
          }

          .about-values .section-heading,
          .about-values-grid {
            padding-left: 20px;
            padding-right: 20px;
          }

          .about-values-grid {
            padding-left: 0;
            padding-right: 0;
          }

          .about-bespoke {
            padding: 100px 20px;
          }
        }
      `}</style>
    </main>
  );
}