"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatINR } from "@/lib/products";
import { supabase } from "@/lib/supabase";

type CartItem = {
  slug: string;
  name: string;
  price: number;
  shipping_charge?: number;
  tax_percent?: number;
  qty: number;
  variantId?: string;
  size?: string;
  stockQuantity?: number;
  image?: string;
};

type AppliedPromo = {
  promotionId: string;
  code: string;
  discountType: "percentage" | "fixed";
  discountValue: number;
  discountAmount: number;
  minimumOrderValue: number;
  maximumDiscount: number | null;
};

type SavedAddress = {
  id: string;
  full_name: string;
  phone: string;
  address_line_1: string;
  address_line_2: string | null;
  city: string;
  district: string | null;
  state: string;
  postal_code: string;
  country: string;
  latitude: number | null;
  longitude: number | null;
  location_accuracy: number | null;
  location_captured_at: string | null;
  is_default: boolean;
};

type OrderResult = {
  success: boolean;
  order_id: string;
  order_number: string;
  status: string;
  subtotal: number;
  discount_amount: number;
  promo_code?: string | null;
  shipping_amount: number;
  total_amount: number;
  currency: string;
};

const INDIA_STATES = [
  "Andaman and Nicobar Islands", "Andhra Pradesh", "Arunachal Pradesh", "Assam",
  "Bihar", "Chandigarh", "Chhattisgarh", "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi", "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jammu and Kashmir",
  "Jharkhand", "Karnataka", "Kerala", "Ladakh", "Lakshadweep", "Madhya Pradesh",
  "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha",
  "Puducherry", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana",
  "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal",
];

const DISTRICTS_BY_STATE: Record<string, string[]> = {
  "Uttar Pradesh": [
    "Agra","Aligarh","Ambedkar Nagar","Amethi","Amroha","Auraiya","Ayodhya","Azamgarh",
    "Baghpat","Bahraich","Ballia","Balrampur","Banda","Barabanki","Bareilly","Basti",
    "Bhadohi","Bijnor","Budaun","Bulandshahr","Chandauli","Chitrakoot","Deoria","Etah",
    "Etawah","Farrukhabad","Fatehpur","Firozabad","Gautam Buddha Nagar","Ghaziabad",
    "Ghazipur","Gonda","Gorakhpur","Hamirpur","Hapur","Hardoi","Hathras","Jalaun",
    "Jaunpur","Jhansi","Kannauj","Kanpur Dehat","Kanpur Nagar","Kasganj","Kaushambi",
    "Kheri","Kushinagar","Lalitpur","Lucknow","Maharajganj","Mahoba","Mainpuri","Mathura",
    "Mau","Meerut","Mirzapur","Moradabad","Muzaffarnagar","Pilibhit","Pratapgarh",
    "Prayagraj","Rae Bareli","Rampur","Saharanpur","Sambhal","Sant Kabir Nagar",
    "Shahjahanpur","Shamli","Shravasti","Siddharthnagar","Sitapur","Sonbhadra",
    "Sultanpur","Unnao","Varanasi"
  ],
  "Delhi": ["Central Delhi","East Delhi","New Delhi","North Delhi","North East Delhi","North West Delhi","Shahdara","South Delhi","South East Delhi","South West Delhi","West Delhi"],
  "Bihar": ["Araria","Arwal","Aurangabad","Banka","Begusarai","Bhagalpur","Bhojpur","Buxar","Darbhanga","East Champaran","Gaya","Gopalganj","Jamui","Jehanabad","Kaimur","Katihar","Khagaria","Kishanganj","Lakhisarai","Madhepura","Madhubani","Munger","Muzaffarpur","Nalanda","Nawada","Patna","Purnia","Rohtas","Saharsa","Samastipur","Saran","Sheikhpura","Sheohar","Sitamarhi","Siwan","Supaul","Vaishali","West Champaran"],
  "Uttarakhand": ["Almora","Bageshwar","Chamoli","Champawat","Dehradun","Haridwar","Nainital","Pauri Garhwal","Pithoragarh","Rudraprayag","Tehri Garhwal","Udham Singh Nagar","Uttarkashi"],
  "Rajasthan": ["Ajmer","Alwar","Banswara","Baran","Barmer","Bharatpur","Bhilwara","Bikaner","Bundi","Chittorgarh","Churu","Dausa","Dholpur","Dungarpur","Hanumangarh","Jaipur","Jaisalmer","Jalore","Jhalawar","Jhunjhunu","Jodhpur","Karauli","Kota","Nagaur","Pali","Pratapgarh","Rajsamand","Sawai Madhopur","Sikar","Sirohi","Sri Ganganagar","Tonk","Udaipur"],
  "Haryana": ["Ambala","Bhiwani","Charkhi Dadri","Faridabad","Fatehabad","Gurugram","Hisar","Jhajjar","Jind","Kaithal","Karnal","Kurukshetra","Mahendragarh","Nuh","Palwal","Panchkula","Panipat","Rewari","Rohtak","Sirsa","Sonipat","Yamunanagar"],
  "Punjab": ["Amritsar","Barnala","Bathinda","Faridkot","Fatehgarh Sahib","Fazilka","Ferozepur","Gurdaspur","Hoshiarpur","Jalandhar","Kapurthala","Ludhiana","Malerkotla","Mansa","Moga","Pathankot","Patiala","Rupnagar","Sahibzada Ajit Singh Nagar","Sangrur","Shaheed Bhagat Singh Nagar","Sri Muktsar Sahib","Tarn Taran"],
};

export default function Checkout() {
  const router = useRouter();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [placingOrder, setPlacingOrder] = useState(false);
  const [appliedPromo, setAppliedPromo] = useState<AppliedPromo | null>(null);

  const [userId, setUserId] = useState<string | null>(null);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [district, setDistrict] = useState("");
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [locationAccuracy, setLocationAccuracy] = useState<number | null>(null);
  const [locationCapturedAt, setLocationCapturedAt] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const [pinCode, setPinCode] = useState("");
  const [addressLine2, setAddressLine2] = useState("");
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [addingAddress, setAddingAddress] = useState(false);

  const [customerNotes, setCustomerNotes] = useState("");

  const [errorMessage, setErrorMessage] = useState("");

  const [order, setOrder] =
    useState<OrderResult | null>(null);

  useEffect(() => {
    async function loadCheckout() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          setErrorMessage(
            "Please log in before proceeding to checkout."
          );

          setLoading(false);
          return;
        }

        setUserId(user.id);

        setEmail(user.email || "");

        const savedCart = JSON.parse(
          localStorage.getItem("cl-cart") || "[]"
        );

        if (
          !Array.isArray(savedCart) ||
          savedCart.length === 0
        ) {
          setErrorMessage(
            "Your bag is empty. Please add a design before checking out."
          );

          setLoading(false);
          return;
        }

        /*
         * Refresh product-level checkout charges directly from Supabase.
         *
         * This makes the products table the source of truth for shipping
         * and tax, so older cart items also receive the current Admin values.
         */
        const cartSlugs = Array.from(
          new Set(
            savedCart
              .map((item: CartItem) => item.slug)
              .filter(Boolean)
          )
        );

        const { data: checkoutProducts, error: checkoutProductsError } =
          await supabase
            .from("products")
            .select("slug, shipping_charge, tax_percent")
            .in("slug", cartSlugs);

        if (checkoutProductsError) {
          console.error(
            "Unable to load current shipping/tax values:",
            checkoutProductsError
          );

          setErrorMessage(
            "We couldn't load the current shipping and tax amounts. Please refresh checkout and try again."
          );

          setLoading(false);
          return;
        }

        const checkoutProductMap = new Map(
          (checkoutProducts || []).map((product: any) => [
            product.slug,
            product,
          ])
        );

        const refreshedCart: CartItem[] = savedCart.map(
          (item: CartItem) => {
            const currentProduct = checkoutProductMap.get(
              item.slug
            ) as
              | {
                  slug: string;
                  shipping_charge: number | null;
                  tax_percent: number | null;
                }
              | undefined;

            return {
              ...item,
              shipping_charge: Number(
                currentProduct?.shipping_charge ?? 0
              ),
              tax_percent: Number(
                currentProduct?.tax_percent ?? 0
              ),
            };
          }
        );

        setCart(refreshedCart);

        const savedPromoRaw = localStorage.getItem("cl-promo");
        if (savedPromoRaw) {
          try {
            const savedPromo = JSON.parse(savedPromoRaw) as AppliedPromo;
            const promoSubtotal = refreshedCart.reduce(
              (sum, item) => sum + Number(item.price || 0) * Number(item.qty || 0),
              0
            );
            const { data: promoData, error: promoError } = await supabase.rpc(
              "validate_promotion_for_cart",
              { p_code: savedPromo.code, p_items: refreshedCart.map((item) => ({ slug: item.slug, qty: item.qty, price: item.price })) }
            );
            if (!promoError && promoData?.valid === true) {
              setAppliedPromo({
                promotionId: promoData.promotion_id,
                code: promoData.code,
                discountType: promoData.discount_type,
                discountValue: Number(promoData.discount_value),
                discountAmount: Number(promoData.discount_amount),
                minimumOrderValue: Number(promoData.minimum_order_value),
                maximumDiscount:
                  promoData.maximum_discount !== null
                    ? Number(promoData.maximum_discount)
                    : null,
              });
            } else {
              localStorage.removeItem("cl-promo");
            }
          } catch {
            localStorage.removeItem("cl-promo");
          }
        }

        // Keep local cart synchronized with the current Admin values.
        localStorage.setItem(
          "cl-cart",
          JSON.stringify(refreshedCart)
        );

        const { data: profile } =
          await supabase
            .from("profiles")
            .select("full_name, phone")
            .eq("id", user.id)
            .maybeSingle();

        if (profile) {
          setFullName(
            profile.full_name || ""
          );

          setPhone(
            profile.phone || ""
          );
        }

        const { data: addressRows, error: addressError } = await supabase
          .from("addresses")
          .select("id, full_name, phone, address_line_1, address_line_2, city, district, state, postal_code, country, latitude, longitude, location_accuracy, location_captured_at, is_default")
          .eq("user_id", user.id)
          .order("is_default", { ascending: false })
          .order("created_at", { ascending: false });

        if (addressError) {
          console.error("Unable to load saved addresses:", addressError);
        } else if (addressRows?.length) {
          const rows = addressRows as SavedAddress[];
          setSavedAddresses(rows);
          const preferred = rows.find((item) => item.is_default) || rows[0];
          setSelectedAddressId(preferred.id);
          setFullName(preferred.full_name || profile?.full_name || "");
          setPhone(preferred.phone || profile?.phone || "");
          setAddress(preferred.address_line_1 || "");
          setAddressLine2(preferred.address_line_2 || "");
          setCity(preferred.city || "");
          setDistrict(preferred.district || "");
          setState(preferred.state || "");
          setPinCode(preferred.postal_code || "");
          setLatitude(preferred.latitude ?? null);
          setLongitude(preferred.longitude ?? null);
          setLocationAccuracy(preferred.location_accuracy ?? null);
          setLocationCapturedAt(preferred.location_captured_at ?? null);
          setAddingAddress(false);
        } else {
          setAddingAddress(true);
        }
      } catch (error) {
        console.error(
          "Unable to load checkout:",
          error
        );

        setErrorMessage(
          "We couldn't load your checkout. Please try again."
        );
      } finally {
        setLoading(false);
      }
    }

    loadCheckout();
  }, []);

  const displayedSubtotal = cart.reduce(
    (sum, item) =>
      sum +
      Number(item.price || 0) *
        Number(item.qty || 0),
    0
  );

  const displayedShipping = cart.reduce(
    (sum, item) =>
      sum +
      Number(item.shipping_charge || 0) *
        Number(item.qty || 0),
    0
  );

  const displayedTax = cart.reduce(
    (sum, item) => {
      const lineSubtotal =
        Number(item.price || 0) *
        Number(item.qty || 0);

      const taxPercent =
        Number(item.tax_percent || 0);

      return (
        sum +
        (lineSubtotal * taxPercent) / 100
      );
    },
    0
  );

  const displayedDiscount = appliedPromo
    ? Math.min(Number(appliedPromo.discountAmount || 0), displayedSubtotal)
    : 0;

  const displayedTotal =
    Math.max(0, displayedSubtotal - displayedDiscount) +
    displayedShipping +
    displayedTax;

  const totalItems = cart.reduce(
    (sum, item) =>
      sum + Number(item.qty || 0),
    0
  );

  function chooseAddress(saved: SavedAddress) {
    setSelectedAddressId(saved.id);
    setAddingAddress(false);
    setFullName(saved.full_name || "");
    setPhone(saved.phone || "");
    setAddress(saved.address_line_1 || "");
    setAddressLine2(saved.address_line_2 || "");
    setCity(saved.city || "");
    setDistrict(saved.district || "");
    setState(saved.state || "");
    setPinCode(saved.postal_code || "");
    setLatitude(saved.latitude ?? null);
    setLongitude(saved.longitude ?? null);
    setLocationAccuracy(saved.location_accuracy ?? null);
    setLocationCapturedAt(saved.location_captured_at ?? null);
  }

  function startNewAddress() {
    setSelectedAddressId(null);
    setAddingAddress(true);
    setAddress("");
    setAddressLine2("");
    setCity("");
    setDistrict("");
    setState("");
    setPinCode("");
    setLatitude(null);
    setLongitude(null);
    setLocationAccuracy(null);
    setLocationCapturedAt(null);
  }

  async function useCurrentLocation() {
    if (!navigator.geolocation) {
      setErrorMessage("Location services are not supported by this browser.");
      return;
    }

    setLocating(true);
    setErrorMessage("");

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        const accuracy = position.coords.accuracy;

        setLatitude(lat);
        setLongitude(lng);
        setLocationAccuracy(accuracy);
        setLocationCapturedAt(new Date().toISOString());

        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&addressdetails=1`,
            { headers: { "Accept-Language": "en" } }
          );

          if (!response.ok) throw new Error("Reverse geocoding failed.");

          const result = await response.json();
          const a = result?.address || {};

          setAddress(
            a.road || a.neighbourhood || a.suburb || address
          );
          setAddressLine2(
            a.neighbourhood || a.suburb || addressLine2
          );
          setCity(
            a.city || a.town || a.village || a.suburb || city
          );
          setDistrict(
            a.state_district || a.county || a.district || district
          );
          setState(a.state || state);
          setPinCode(a.postcode || pinCode);
        } catch (locationError) {
          console.error("Unable to fetch written address:", locationError);
        } finally {
          setLocating(false);
        }
      },
      (locationError) => {
        console.error("Unable to get current location:", locationError);
        setLocating(false);
        setErrorMessage(
          locationError.code === locationError.PERMISSION_DENIED
            ? "Location permission was not allowed. You can still enter your delivery address manually."
            : "Unable to get your current location. Please try again or enter the address manually."
        );
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }

  async function placeOrder() {
    if (placingOrder) {
      return;
    }

    setErrorMessage("");

    if (!userId) {
      setErrorMessage(
        "Please log in before placing your order."
      );

      return;
    }

    if (cart.length === 0) {
      setErrorMessage(
        "Your bag is empty."
      );

      return;
    }

    if (!fullName.trim()) {
      setErrorMessage(
        "Please enter your full name."
      );

      return;
    }

    if (!email.trim()) {
      setErrorMessage(
        "Please enter your email address."
      );

      return;
    }

    if (!phone.trim()) {
      setErrorMessage(
        "Please enter your phone number."
      );

      return;
    }

    if (!address.trim()) {
      setErrorMessage(
        "Please enter your shipping address."
      );

      return;
    }

    if (!city.trim()) {
      setErrorMessage(
        "Please enter your city."
      );

      return;
    }

    if (!state.trim()) {
      setErrorMessage(
        "Please enter your state."
      );

      return;
    }

    if (!district.trim()) {
      setErrorMessage(
        "Please select or enter your district."
      );

      return;
    }

    if (!pinCode.trim()) {
      setErrorMessage(
        "Please enter your PIN code."
      );

      return;
    }

    setPlacingOrder(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setErrorMessage(
          "Your login session has expired. Please log in again."
        );

        return;
      }

      // Save a newly entered address to this customer's Supabase address book.
      if (addingAddress || !selectedAddressId) {
        const { data: existingAddresses, error: existingError } = await supabase
          .from("addresses")
          .select("id")
          .eq("user_id", user.id)
          .limit(1);

        if (existingError) {
          console.error("Could not check saved addresses:", existingError);
          setErrorMessage("We couldn't verify your saved addresses. Please try again.");
          return;
        }

        const { data: insertedAddress, error: insertAddressError } = await supabase
          .from("addresses")
          .insert({
            user_id: user.id,
            full_name: fullName.trim(),
            phone: phone.trim(),
            address_line_1: address.trim(),
            address_line_2: addressLine2.trim() || null,
            city: city.trim(),
            district: district.trim(),
            state: state.trim(),
            postal_code: pinCode.trim(),
            country: "India",
            latitude,
            longitude,
            location_accuracy: locationAccuracy,
            location_captured_at: locationCapturedAt,
            is_default: !existingAddresses?.length,
          })
          .select("id, full_name, phone, address_line_1, address_line_2, city, district, state, postal_code, country, latitude, longitude, location_accuracy, location_captured_at, is_default")
          .single();

        if (insertAddressError || !insertedAddress) {
          console.error("Address save error:", insertAddressError);
          setErrorMessage("Your address could not be saved. Please check your connection and try again.");
          return;
        }

        const newlySaved = insertedAddress as SavedAddress;
        setSavedAddresses((current) => [newlySaved, ...current]);
        setSelectedAddressId(newlySaved.id);
        setAddingAddress(false);
      }

      const shippingAddress = {
        full_name: fullName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        address: address.trim(),
        city: city.trim(),
        district: district.trim(),
        state: state.trim(),
        pin_code: pinCode.trim(),
        country: "India",
        latitude,
        longitude,
        location_accuracy: locationAccuracy,
        location_captured_at: locationCapturedAt,
      };

      const { data, error } =
        await supabase.rpc(
          "create_pending_order",
          {
            p_items: cart.map(
              (item) => ({
                slug: item.slug,
                name: item.name,
                price: item.price,
                shipping_charge:
                  Number(item.shipping_charge || 0),
                tax_percent:
                  Number(item.tax_percent || 0),
                qty: item.qty,
                variantId:
                  item.variantId,
                size: item.size,
              })
            ),

            p_shipping_address:
              shippingAddress,

            p_customer_notes:
              customerNotes.trim() ||
              null,

            p_promo_code:
              appliedPromo?.code || null,
          }
        );

      if (error) {
        console.error(
          "Order creation error:",
          error
        );

        const message =
          error.message || "";

        if (
          message.includes(
            "INSUFFICIENT_STOCK"
          )
        ) {
          setErrorMessage(
            "One or more items no longer have enough stock. Please return to your bag and update it."
          );
        } else if (
          message.includes(
            "VARIANT_NOT_FOUND"
          )
        ) {
          setErrorMessage(
            "One of the selected variants is no longer available. Please return to your bag and select it again."
          );
        } else if (
          message.includes(
            "VARIANT_INACTIVE"
          )
        ) {
          setErrorMessage(
            "One of the selected variants is no longer available. Please return to your bag and select it again."
          );
        } else if (message.includes("PROMO_")) {
          setErrorMessage(
            "This promotion is no longer valid for this order. Please return to your bag and apply it again."
          );
          localStorage.removeItem("cl-promo");
          setAppliedPromo(null);
        } else {
          setErrorMessage(
            "We couldn't create your order. Please try again."
          );
        }

        return;
      }

      if (!data || data.success !== true) {
        setErrorMessage(
          "We couldn't create your order. Please try again."
        );

        return;
      }

      /*
       * The pending order has been created successfully.
       *
       * Do not clear the cart and do not send the order-confirmation
       * email yet. The customer must complete Razorpay payment first.
       */
      const createdOrder =
        data as OrderResult;

      router.push(
        `/payment/${encodeURIComponent(
          createdOrder.order_id
        )}`
      );

      return;
    } catch (error) {
      console.error(
        "Unable to place order:",
        error
      );

      setErrorMessage(
        "Something went wrong while creating your order. Please try again."
      );
    } finally {
      setPlacingOrder(false);
    }
  }

  if (loading) {
    return (
      <section className="section">
        <p className="eyebrow">
          CHECKOUT
        </p>

        <h1>Loading...</h1>
      </section>
    );
  }

  if (order) {
    return (
      <section className="success-page section">
        <p className="eyebrow">
          ORDER RECEIVED
        </p>

        <h1>
          Thank you.
        </h1>

        <p>
          Your order has been created
          successfully.
        </p>

        <div
          style={{
            marginTop: "28px",
            padding: "22px",
            border:
              "1px solid #d9d0c4",
            background:
              "#faf8f4",
          }}
        >
          <p
            style={{
              margin:
                "0 0 8px",
              color:
                "#716b64",
              fontSize:
                "11px",
              letterSpacing:
                "0.08em",
              textTransform:
                "uppercase",
            }}
          >
            Order number
          </p>

          <strong
            style={{
              fontSize:
                "20px",
              letterSpacing:
                "0.04em",
            }}
          >
            {order.order_number}
          </strong>
        </div>

        <p
          className="small-note"
          style={{
            marginTop:
              "22px",
          }}
        >
          Your order is currently
          awaiting payment. Payment
          gateway integration will be
          connected before launch. Once
          payment is confirmed, the
          atelier will begin preparing
          your pair.
        </p>

        <div
          style={{
            display:
              "flex",
            gap: "12px",
            flexWrap:
              "wrap",
            marginTop:
              "28px",
          }}
        >
          <Link
            href="/account"
            className="button button-dark"
          >
            View my account
          </Link>

          <Link
            href="/collection"
            className="button"
          >
            Continue shopping
          </Link>
        </div>
      </section>
    );
  }

  if (
    errorMessage &&
    (!userId ||
      cart.length === 0)
  ) {
    return (
      <section className="section">
        <p className="eyebrow">
          CHECKOUT
        </p>

        <h1>
          Checkout unavailable.
        </h1>

        <p className="page-intro">
          {errorMessage}
        </p>

        <Link
          href={
            userId
              ? "/cart"
              : "/account"
          }
          className="button button-dark"
        >
          {userId
            ? "Return to bag"
            : "Log in"}
        </Link>
      </section>
    );
  }

  return (
    <section className="section checkout-page checkout-luxury">
      <div className="checkout-details">
        <p className="eyebrow">
          CHECKOUT
        </p>

        <h1>
          Your details.
        </h1>

        <p className="page-intro">
          Please enter the details
          required for your order.
        </p>

        <div
          style={{
            marginTop:
              "28px",
          }}
        >
          <input
            className="input"
            placeholder="Full name"
            value={fullName}
            onChange={(event) =>
              setFullName(
                event.target.value
              )
            }
          />

          <input
            className="input"
            placeholder="Email"
            type="email"
            value={email}
            onChange={(event) =>
              setEmail(
                event.target.value
              )
            }
          />

          <input
            className="input"
            placeholder="Phone"
            value={phone}
            onChange={(event) =>
              setPhone(
                event.target.value
              )
            }
          />

          {savedAddresses.length > 0 && (
            <div className="delivery-addresses" style={{ marginBottom: "22px" }}>
              <p className="eyebrow" style={{ marginBottom: "12px" }}>DELIVERY ADDRESS</p>
              <div style={{ display: "grid", gap: "10px" }}>
                {savedAddresses.map((saved) => {
                  const isSelected = selectedAddressId === saved.id && !addingAddress;
                  return (
                    <button
                      key={saved.id}
                      type="button"
                      onClick={() => chooseAddress(saved)}
                      aria-pressed={isSelected}
                      className="saved-address-card"
                      style={{
                        display: "block", width: "100%", textAlign: "left",
                        padding: "14px 16px", cursor: "pointer",
                        border: isSelected ? "2px solid #141210" : "1px solid #d9d0c4",
                        background: isSelected ? "#f3eee6" : "#faf8f4",
                      }}
                    >
                      <span style={{ display: "flex", justifyContent: "space-between", gap: "12px" }}>
                        <strong>{saved.full_name}</strong>
                        <span aria-hidden="true">{isSelected ? "●" : "○"}</span>
                      </span>
                      <span style={{ display: "block", marginTop: "5px", fontSize: "13px", lineHeight: 1.5 }}>
                        {saved.address_line_1}{saved.address_line_2 ? `, ${saved.address_line_2}` : ""}<br />
                        {saved.city}{saved.district ? `, ${saved.district}` : ""}, {saved.state} {saved.postal_code}<br />
                        {saved.phone}
                      </span>
                      {saved.is_default && <span style={{ display: "inline-block", marginTop: "6px", fontSize: "11px", letterSpacing: ".06em" }}>DEFAULT ADDRESS</span>}
                    </button>
                  );
                })}
                <button type="button" className="button" onClick={startNewAddress} style={{ width: "100%" }}>
                  + Add another address
                </button>
              </div>
            </div>
          )}

          {(addingAddress || savedAddresses.length === 0) && (
            <div style={{ marginBottom: "18px" }}>
              {savedAddresses.length > 0 && <p className="eyebrow">NEW DELIVERY ADDRESS</p>}
              <input
                className="input"
                placeholder="Address"
            value={address}
            onChange={(event) =>
              setAddress(
                event.target.value
              )
            }
          />

          <button
            type="button"
            className="button button-dark"
            onClick={() => void useCurrentLocation()}
            disabled={locating}
            style={{ width: "100%", marginBottom: "14px" }}
          >
            {locating ? "Fetching location..." : "⌖ Use current location"}
          </button>

          {latitude !== null && longitude !== null && (
            <p className="small-note" style={{ margin: "0 0 14px" }}>
              Delivery location pin captured. Please confirm the address below.
            </p>
          )}

          <input
            className="input"
            placeholder="City / Locality"
            value={city}
            onChange={(event) => setCity(event.target.value)}
          />

          <div className="two-inputs">
            <select
              className="input"
              value={state}
              onChange={(event) => {
                setState(event.target.value);
                setDistrict("");
              }}
            >
              <option value="">Select state / UT</option>
              {INDIA_STATES.map((stateName) => (
                <option key={stateName} value={stateName}>
                  {stateName}
                </option>
              ))}
            </select>

            {DISTRICTS_BY_STATE[state] ? (
              <select
                className="input"
                value={district}
                onChange={(event) => setDistrict(event.target.value)}
              >
                <option value="">Select district</option>
                {DISTRICTS_BY_STATE[state].map((districtName) => (
                  <option key={districtName} value={districtName}>
                    {districtName}
                  </option>
                ))}
              </select>
            ) : (
              <input
                className="input"
                placeholder={state ? "District" : "Select state first"}
                value={district}
                onChange={(event) => setDistrict(event.target.value)}
                disabled={!state}
              />
            )}
          </div>

          <input
            className="input"
            placeholder="PIN code"
            value={pinCode}
            onChange={(event) =>
              setPinCode(
                event.target.value
              )
            }
          />

          <input
            className="input"
            placeholder="Apartment, suite, landmark (optional)"
            value={addressLine2}
            onChange={(event) => setAddressLine2(event.target.value)}
          />
          </div>
          )}

          <textarea
            className="input"
            placeholder="Order notes (optional)"
            value={customerNotes}
            onChange={(event) =>
              setCustomerNotes(
                event.target.value
              )
            }
            rows={4}
            style={{
              resize:
                "vertical",
              minHeight:
                "110px",
            }}
          />
        </div>

        {errorMessage && (
          <div
            style={{
              marginTop:
                "18px",
              padding:
                "14px 16px",
              border:
                "1px solid #7a263a",
              background:
                "#faf8f4",
              color:
                "#7a263a",
              fontSize:
                "13px",
              lineHeight:
                1.5,
            }}
          >
            {errorMessage}
          </div>
        )}
      </div>

      <aside className="summary">
        <p className="eyebrow">
          ORDER SUMMARY
        </p>

        <h2>
          Your order
        </h2>

        <div
          style={{
            display:
              "flex",
            flexDirection:
              "column",
            gap:
              "16px",
          }}
        >
          {cart.map(
            (item, index) => (
              <div
                key={`${item.slug}-${item.variantId ?? "default"}-${index}`}
                className="summary-item"
                style={{
                  display:
                    "flex",
                  justifyContent:
                    "space-between",
                  gap:
                    "18px",
                  fontSize:
                    "13px",
                }}
              >
                <div>
                  <strong>
                    {item.name}
                  </strong>

                  {item.size && (
                    <p
                      style={{
                        margin:
                          "4px 0 0",
                        color:
                          "#716b64",
                        fontSize:
                          "11px",
                      }}
                    >
                      Size{" "}
                      {item.size}
                    </p>
                  )}

                  <p
                    style={{
                      margin:
                        "4px 0 0",
                      color:
                        "#716b64",
                      fontSize:
                        "11px",
                    }}
                  >
                    Quantity{" "}
                    {item.qty}
                  </p>
                </div>

                <strong>
                  {formatINR(
                    item.price *
                      item.qty
                  )}
                </strong>
              </div>
            )
          )}
        </div>

        <div
          style={{
            height:
              "1px",
            background:
              "#d9d0c4",
            margin:
              "22px 0",
          }}
        />

        <div className="billing-line">
          <span>
            Items ({totalItems})
          </span>

          <span>
            {formatINR(
              displayedSubtotal
            )}
          </span>
        </div>

        <div className="billing-line">
          <span>
            Subtotal
          </span>

          <span>
            {formatINR(
              displayedSubtotal
            )}
          </span>
        </div>

        {displayedDiscount > 0 && (
          <div className="billing-line" style={{ color: "#7a263a" }}>
            <span>Promo discount {appliedPromo?.code ? `(${appliedPromo.code})` : ""}</span>
            <span>− {formatINR(displayedDiscount)}</span>
          </div>
        )}

        <div className="billing-line muted">
          <span>
            Shipping
          </span>

          <span>
            {formatINR(
              displayedShipping
            )}
          </span>
        </div>

        <div className="billing-line muted">
          <span>
            Taxes
          </span>

          <span>
            {formatINR(
              displayedTax
            )}
          </span>
        </div>

        <div
          style={{
            height:
              "1px",
            background:
              "#d9d0c4",
            margin:
              "22px 0",
          }}
        />

        <div className="billing-total">
          <span>
            Total
          </span>

          <strong>
            {formatINR(
              displayedTotal
            )}
          </strong>
        </div>

        <p
          className="small-note"
          style={{
            marginTop:
              "14px",
          }}
        >
          Your promotion is revalidated securely when the order is created.
          You will pay the remaining balance through Razorpay.
        </p>

        <button
          type="button"
          className="button button-dark"
          onClick={placeOrder}
          disabled={
            placingOrder
          }
          style={{
            width:
              "100%",
            marginTop:
              "20px",
            opacity:
              placingOrder
                ? 0.6
                : 1,
            cursor:
              placingOrder
                ? "wait"
                : "pointer",
          }}
        >
          {placingOrder
            ? "Creating order..."
            : "Place order"}
        </button>

        <Link
          href="/cart"
          style={{
            display:
              "block",
            marginTop:
              "14px",
            textAlign:
              "center",
            color:
              "#716b64",
            fontSize:
              "12px",
            textDecoration:
              "underline",
            textUnderlineOffset:
              "3px",
          }}
        >
          Return to bag
        </Link>
      </aside>

      <style jsx>{`
        /* -------------------------------------------------------
           CHECKOUT — LUXURY RESPONSIVE UI
           Visual-only rules. Checkout/order logic is unchanged.
           ------------------------------------------------------- */

        .checkout-luxury {
          display: grid;
          grid-template-columns: minmax(0, 1.55fr) minmax(360px, 0.9fr);
          gap: clamp(56px, 8vw, 148px);
          align-items: start;
          max-width: 1640px;
          margin: 0 auto;
          padding-top: 24px;
          padding-bottom: 72px;
        }

        .checkout-details {
          min-width: 0;
        }

        .checkout-details :global(h1) {
          margin: 20px 0 26px;
          font-size: clamp(58px, 6.1vw, 104px);
          line-height: 0.94;
          font-weight: 400;
          letter-spacing: -0.035em;
        }

        .checkout-details :global(.page-intro) {
          margin: 0;
          max-width: 620px;
          color: #716b64;
          font-size: 17px;
          line-height: 1.65;
        }

        .checkout-details :global(.input) {
          width: 100%;
          min-height: 62px;
          box-sizing: border-box;
          margin-bottom: 14px;
          padding: 16px 18px;
          border: 1px solid #d9d0c4;
          border-radius: 0;
          background: transparent;
          color: #141210;
          font-family: inherit;
          font-size: 15px;
          outline: none;
          transition:
            border-color 180ms ease,
            background 180ms ease,
            box-shadow 180ms ease;
        }

        .checkout-details :global(.input:focus) {
          border-color: #141210;
          background: #fffdf9;
          box-shadow: 0 0 0 1px #141210;
        }

        .checkout-details :global(.two-inputs) {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 14px;
        }

        .delivery-addresses {
          margin-top: 8px;
          padding-top: 2px;
        }

        .saved-address-card {
          transition:
            background 180ms ease,
            border-color 180ms ease,
            transform 180ms ease;
        }

        .saved-address-card:hover {
          transform: translateY(-1px);
        }

        .summary {
          position: sticky;
          top: 32px;
          min-width: 0;
          padding-top: 27px;
          border-top: 1px solid #141210;
        }

        .summary :global(.eyebrow) {
          margin: 0 0 34px;
        }

        .summary :global(h2) {
          margin: 0 0 36px;
          font-size: clamp(38px, 3.2vw, 56px);
          line-height: 1;
          font-weight: 400;
          letter-spacing: -0.025em;
        }

        .summary-item {
          align-items: flex-start;
          padding: 0;
        }

        .summary-item > div {
          min-width: 0;
        }

        .summary-item > :global(strong) {
          flex: 0 0 auto;
          white-space: nowrap;
          font-size: 14px;
          font-weight: 500;
        }

        .summary-item div > :global(strong) {
          display: block;
          font-size: 14px;
          line-height: 1.35;
          font-weight: 500;
          letter-spacing: 0.01em;
        }

        .summary :global(.billing-line) {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          align-items: baseline;
          column-gap: 28px;
          width: 100%;
          margin: 0;
          padding: 5px 0;
          font-size: 14px;
          line-height: 1.45;
        }

        .summary :global(.billing-line > span:last-child) {
          text-align: right;
          white-space: nowrap;
        }

        .summary :global(.billing-line.muted) {
          color: #716b64;
        }

        .summary :global(.billing-total) {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          align-items: baseline;
          column-gap: 28px;
          width: 100%;
          font-size: 17px;
          line-height: 1.4;
        }

        .summary :global(.billing-total strong) {
          text-align: right;
          white-space: nowrap;
          font-size: 20px;
          font-weight: 500;
        }

        .summary :global(.small-note) {
          max-width: 470px;
          color: #8a7767;
          font-size: 11px;
          line-height: 1.55;
        }

        .summary :global(.button) {
          min-height: 56px;
          letter-spacing: 0.16em;
        }

        @media (max-width: 1020px) {
          .checkout-luxury {
            grid-template-columns: 1fr;
            gap: 56px;
            max-width: 860px;
          }

          .summary {
            position: static;
            top: auto;
          }

          .checkout-details :global(h1) {
            font-size: clamp(58px, 10vw, 90px);
          }
        }

        @media (max-width: 640px) {
          .checkout-luxury {
            gap: 42px;
            padding-top: 10px;
            padding-bottom: 48px;
          }

          .checkout-details :global(h1) {
            margin-top: 16px;
            margin-bottom: 20px;
            font-size: clamp(48px, 16vw, 70px);
          }

          .checkout-details :global(.page-intro) {
            font-size: 15px;
          }

          .checkout-details :global(.two-inputs) {
            grid-template-columns: 1fr;
            gap: 0;
          }

          .summary {
            padding-top: 22px;
          }

          .summary :global(.eyebrow) {
            margin-bottom: 26px;
          }

          .summary :global(h2) {
            margin-bottom: 30px;
            font-size: 40px;
          }

          .summary :global(.billing-line),
          .summary :global(.billing-total) {
            column-gap: 16px;
          }
        }
      `}</style>
    </section>
  );
}