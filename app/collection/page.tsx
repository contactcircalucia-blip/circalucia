"use client";

import Image from "next/image";
import Link from "next/link";

const products = [
  {
    name: "The Luciana",
    category: "SIGNATURE",
    price: "₹28,900",
    image: "/products/luciana.jpg",
    slug: "luciana",
  },
  {
    name: "The Celeste",
    category: "EVENING",
    price: "₹32,500",
    image: "/products/celeste.jpg",
    slug: "celeste",
  },
  {
    name: "The Aurora",
    category: "BRIDAL",
    price: "₹34,900",
    image: "/products/aurora.jpg",
    slug: "aurora",
  },
];

export default function CollectionPage() {
  return (
    <main className="min-h-screen bg-[#f8f6f2] text-[#111111]">
      {/* Category Navigation */}
      <section className="mx-auto max-w-[1480px] px-6 pt-8 md:px-10">
        <div className="border-y border-[#d8d2c8]">
          <div className="flex gap-8 overflow-x-auto py-5 text-[12px] tracking-[0.18em]">
            <button className="whitespace-nowrap">ALL</button>
            <button className="whitespace-nowrap">SIGNATURE</button>
            <button className="whitespace-nowrap">EVENING</button>
            <button className="whitespace-nowrap">BRIDAL</button>
            <button className="whitespace-nowrap">STATEMENT</button>
          </div>
        </div>
      </section>

      {/* Products */}
      <section className="mx-auto max-w-[1480px] px-6 py-12 md:px-10">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {products.map((product) => (
            <Link
              key={product.name}
              href={`/collection/${product.slug}`}
              className="group block"
            >
              {/* Product Image */}
              <div className="relative aspect-[4/5] overflow-hidden bg-[#e8e2d8]">
                <Image
                  src={product.image}
                  alt={product.name}
                  fill
                  priority
                  sizes="(max-width: 768px) 100vw, 33vw"
                  className="object-cover transition-transform duration-700 group-hover:scale-[1.03]"
                />
              </div>

              {/* Product Information */}
              <div className="flex items-start justify-between gap-4 pt-5">
                <div>
                  <h2 className="font-serif text-[27px] leading-none">
                    {product.name}
                  </h2>

                  <p className="mt-3 text-[10px] tracking-[0.2em] text-[#77716a]">
                    {product.category}
                  </p>
                </div>

                <p className="pt-1 text-[13px] whitespace-nowrap">
                  {product.price}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}