import { supabase } from "@/lib/supabase";

export type Product = {
  id: string;
  slug: string;
  name: string;
  collection: string | null;
  description: string | null;
  price: number;
  material: string | null;
  heel_height: string | null;
  image_url: string | null;
  is_active: boolean;
  is_bespoke: boolean;
  created_at: string;
  updated_at: string;
};

export async function getProducts() {
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("is_active", true)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Error fetching products:", error);
    return [];
  }

  return data as Product[];
}

export async function getProduct(slug: string) {
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("slug", slug)
    .eq("is_active", true)
    .single();

  if (error) {
    console.error("Error fetching product:", error);
    return null;
  }

  return data as Product;
}

export async function getProductVariants(productId: string) {
  const { data, error } = await supabase
    .from("product_variants")
    .select("*")
    .eq("product_id", productId)
    .eq("is_active", true)
    .order("size", { ascending: true });

  if (error) {
    console.error("Error fetching product variants:", error);
    return [];
  }

  return data;
}

export function formatINR(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}