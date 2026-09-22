"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Country,
  getCountries,
  getCountryCallingCode,
} from "react-phone-number-input";
import { supabase } from "@/lib/supabase";

type Address = {
  id: string;
  full_name: string | null;
  phone: string | null;
  address_line_1: string | null;
  address_line_2: string | null;
  city: string | null;
  district: string | null;
  state: string | null;
  postal_code: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
  location_accuracy: number | null;
  location_captured_at: string | null;
  is_default: boolean | null;
};

const emptyAddress = {
  full_name: "",
  phone: "",
  address_line_1: "",
  address_line_2: "",
  city: "",
  district: "",
  state: "",
  postal_code: "",
  country: "India",
  latitude: null as number | null,
  longitude: null as number | null,
  location_accuracy: null as number | null,
  location_captured_at: null as string | null,
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
    "Agra", "Aligarh", "Ambedkar Nagar", "Amethi", "Amroha", "Auraiya", "Ayodhya",
    "Azamgarh", "Baghpat", "Bahraich", "Ballia", "Balrampur", "Banda", "Barabanki",
    "Bareilly", "Basti", "Bhadohi", "Bijnor", "Budaun", "Bulandshahr", "Chandauli",
    "Chitrakoot", "Deoria", "Etah", "Etawah", "Farrukhabad", "Fatehpur", "Firozabad",
    "Gautam Buddha Nagar", "Ghaziabad", "Ghazipur", "Gonda", "Gorakhpur", "Hamirpur",
    "Hapur", "Hardoi", "Hathras", "Jalaun", "Jaunpur", "Jhansi", "Kannauj",
    "Kanpur Dehat", "Kanpur Nagar", "Kasganj", "Kaushambi", "Kheri", "Kushinagar",
    "Lalitpur", "Lucknow", "Maharajganj", "Mahoba", "Mainpuri", "Mathura", "Mau",
    "Meerut", "Mirzapur", "Moradabad", "Muzaffarnagar", "Pilibhit", "Pratapgarh",
    "Prayagraj", "Rae Bareli", "Rampur", "Saharanpur", "Sambhal", "Sant Kabir Nagar",
    "Shahjahanpur", "Shamli", "Shravasti", "Siddharthnagar", "Sitapur", "Sonbhadra",
    "Sultanpur", "Unnao", "Varanasi"
  ],
  "Delhi": ["Central Delhi", "East Delhi", "New Delhi", "North Delhi", "North East Delhi", "North West Delhi", "Shahdara", "South Delhi", "South East Delhi", "South West Delhi", "West Delhi"],
  "Bihar": ["Araria","Arwal","Aurangabad","Banka","Begusarai","Bhagalpur","Bhojpur","Buxar","Darbhanga","East Champaran","Gaya","Gopalganj","Jamui","Jehanabad","Kaimur","Katihar","Khagaria","Kishanganj","Lakhisarai","Madhepura","Madhubani","Munger","Muzaffarpur","Nalanda","Nawada","Patna","Purnia","Rohtas","Saharsa","Samastipur","Saran","Sheikhpura","Sheohar","Sitamarhi","Siwan","Supaul","Vaishali","West Champaran"],
  "Uttarakhand": ["Almora","Bageshwar","Chamoli","Champawat","Dehradun","Haridwar","Nainital","Pauri Garhwal","Pithoragarh","Rudraprayag","Tehri Garhwal","Udham Singh Nagar","Uttarkashi"],
  "Rajasthan": ["Ajmer","Alwar","Banswara","Baran","Barmer","Bharatpur","Bhilwara","Bikaner","Bundi","Chittorgarh","Churu","Dausa","Dholpur","Dungarpur","Hanumangarh","Jaipur","Jaisalmer","Jalore","Jhalawar","Jhunjhunu","Jodhpur","Karauli","Kota","Nagaur","Pali","Pratapgarh","Rajsamand","Sawai Madhopur","Sikar","Sirohi","Sri Ganganagar","Tonk","Udaipur"],
  "Madhya Pradesh": ["Bhopal","Indore","Jabalpur","Gwalior","Ujjain","Sagar","Rewa","Satna","Dewas","Dhar","Ratlam","Vidisha","Sehore","Raisen","Chhindwara","Narmadapuram","Khandwa","Khargone","Shivpuri","Morena"],
  "Maharashtra": ["Ahmednagar","Akola","Amravati","Aurangabad","Beed","Bhandara","Buldhana","Chandrapur","Dhule","Gadchiroli","Gondia","Hingoli","Jalgaon","Jalna","Kolhapur","Latur","Mumbai City","Mumbai Suburban","Nagpur","Nanded","Nandurbar","Nashik","Osmanabad","Palghar","Parbhani","Pune","Raigad","Ratnagiri","Sangli","Satara","Sindhudurg","Solapur","Thane","Wardha","Washim","Yavatmal"],
  "Gujarat": ["Ahmedabad","Amreli","Anand","Aravalli","Banaskantha","Bharuch","Bhavnagar","Botad","Chhota Udaipur","Dahod","Dang","Devbhoomi Dwarka","Gandhinagar","Gir Somnath","Jamnagar","Junagadh","Kheda","Kutch","Mahisagar","Mehsana","Morbi","Narmada","Navsari","Panchmahal","Patan","Porbandar","Rajkot","Sabarkantha","Surat","Surendranagar","Tapi","Vadodara","Valsad"],
  "Haryana": ["Ambala","Bhiwani","Charkhi Dadri","Faridabad","Fatehabad","Gurugram","Hisar","Jhajjar","Jind","Kaithal","Karnal","Kurukshetra","Mahendragarh","Nuh","Palwal","Panchkula","Panipat","Rewari","Rohtak","Sirsa","Sonipat","Yamunanagar"],
  "Punjab": ["Amritsar","Barnala","Bathinda","Faridkot","Fatehgarh Sahib","Fazilka","Ferozepur","Gurdaspur","Hoshiarpur","Jalandhar","Kapurthala","Ludhiana","Malerkotla","Mansa","Moga","Pathankot","Patiala","Rupnagar","Sahibzada Ajit Singh Nagar","Sangrur","Shaheed Bhagat Singh Nagar","Sri Muktsar Sahib","Tarn Taran"],
  "West Bengal": ["Alipurduar","Bankura","Birbhum","Cooch Behar","Dakshin Dinajpur","Darjeeling","Hooghly","Howrah","Jalpaiguri","Jhargram","Kalimpong","Kolkata","Malda","Murshidabad","Nadia","North 24 Parganas","Paschim Bardhaman","Paschim Medinipur","Purba Bardhaman","Purba Medinipur","Purulia","South 24 Parganas","Uttar Dinajpur"],
};

export default function AccountDetailsPage() {
  const countries = useMemo(() => getCountries(), []);
  const countryNames = useMemo(
    () => new Intl.DisplayNames(["en"], { type: "region" }),
    []
  );

  const [userId, setUserId] = useState("");
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [country, setCountry] = useState<Country>("IN");
  const [phone, setPhone] = useState("");
  const [originalPhone, setOriginalPhone] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [gender, setGender] = useState("");
  const [editingProfile, setEditingProfile] = useState(false);

  const [addresses, setAddresses] = useState<Address[]>([]);
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);
  const [addressDraft, setAddressDraft] = useState({ ...emptyAddress });
  const [addingAddress, setAddingAddress] = useState(false);

  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingAddress, setSavingAddress] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    void loadPage();
  }, []);

  async function loadPage() {
    setLoading(true);
    setError("");

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      window.location.href = "/account";
      return;
    }

    setUserId(user.id);
    setEmail(user.email || "");

    const [profileResult, addressResult] = await Promise.all([
      supabase
        .from("profiles")
        .select("full_name, phone, date_of_birth, gender")
        .eq("id", user.id)
        .maybeSingle(),
      supabase
        .from("addresses")
        .select(
          "id, full_name, phone, address_line_1, address_line_2, city, district, state, postal_code, country, latitude, longitude, location_accuracy, location_captured_at, is_default"
        )
        .eq("user_id", user.id)
        .order("is_default", { ascending: false }),
    ]);

    if (profileResult.error) {
      setError("Unable to load your profile.");
      console.error(profileResult.error);
    } else if (profileResult.data) {
      const profile = profileResult.data;
      setFullName(profile.full_name || "");
      setDateOfBirth(profile.date_of_birth || "");
      setGender(profile.gender || "");

      const savedPhone = profile.phone || "";
      setOriginalPhone(savedPhone);

      if (savedPhone.startsWith("+91") && savedPhone.length >= 13) {
        setCountry("IN");
        setPhone(savedPhone.slice(3).replace(/\D/g, "").slice(0, 10));
      } else {
        setPhone(savedPhone.replace(/\D/g, "").slice(-10));
      }
    }

    if (addressResult.error) {
      setError("Unable to load your saved addresses.");
      console.error(addressResult.error);
    } else {
      setAddresses((addressResult.data || []) as Address[]);
    }

    setLoading(false);
  }

  function handlePhoneChange(value: string) {
    setPhone(value.replace(/\D/g, "").slice(0, 10));
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (savingProfile) return;

    setSavingProfile(true);
    setError("");
    setMessage("");

    try {
      if (!fullName.trim()) {
        setError("Please enter your full name.");
        return;
      }

      if (!/^\d{10}$/.test(phone)) {
        setError("Mobile number must contain exactly 10 digits.");
        return;
      }

      const fullPhone = `+${getCountryCallingCode(country)}${phone}`;

      if (fullPhone !== originalPhone) {
        const { data: registered, error: phoneError } =
          await supabase.rpc("is_phone_registered", {
            p_phone: fullPhone,
          });

        if (phoneError) {
          console.error(phoneError);
          setError("Unable to verify this mobile number. Please try again.");
          return;
        }

        if (registered === true) {
          setError("This mobile number is already registered with another account.");
          return;
        }
      }

      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          full_name: fullName.trim(),
          phone: fullPhone,
          date_of_birth: dateOfBirth || null,
          gender: gender || null,
        })
        .eq("id", userId);

      if (updateError) {
        console.error(updateError);
        setError("Unable to save your details. Please try again.");
        return;
      }

      setOriginalPhone(fullPhone);
      setEditingProfile(false);
      setMessage("Your personal details have been updated.");
    } finally {
      setSavingProfile(false);
    }
  }

  function startAddAddress() {
    setEditingAddressId(null);
    setAddressDraft({
      ...emptyAddress,
      full_name: fullName,
      phone: originalPhone,
    });
    setAddingAddress(true);
    setError("");
    setMessage("");
  }

  function startEditAddress(address: Address) {
    setAddingAddress(false);
    setEditingAddressId(address.id);
    setAddressDraft({
      full_name: address.full_name || "",
      phone: address.phone || "",
      address_line_1: address.address_line_1 || "",
      address_line_2: address.address_line_2 || "",
      city: address.city || "",
      district: address.district || "",
      state: address.state || "",
      postal_code: address.postal_code || "",
      country: address.country || "India",
      latitude: address.latitude ?? null,
      longitude: address.longitude ?? null,
      location_accuracy: address.location_accuracy ?? null,
      location_captured_at: address.location_captured_at ?? null,
    });
    setError("");
    setMessage("");
  }

  function cancelAddressEdit() {
    setAddingAddress(false);
    setEditingAddressId(null);
    setAddressDraft({ ...emptyAddress });
  }

  async function useCurrentLocation() {
    if (!navigator.geolocation) {
      setError("Location services are not supported by this browser.");
      return;
    }

    setLocating(true);
    setError("");
    setMessage("");

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const latitude = position.coords.latitude;
        const longitude = position.coords.longitude;
        const accuracy = position.coords.accuracy;

        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}&addressdetails=1`,
            {
              headers: {
                "Accept-Language": "en",
              },
            }
          );

          if (!response.ok) {
            throw new Error("Unable to fetch address from map.");
          }

          const result = await response.json();
          const mapAddress = result?.address || {};

          const detectedState = mapAddress.state || "";
          const detectedDistrict =
            mapAddress.state_district ||
            mapAddress.county ||
            mapAddress.district ||
            "";
          const detectedCity =
            mapAddress.city ||
            mapAddress.town ||
            mapAddress.village ||
            mapAddress.suburb ||
            "";

          setAddressDraft((current) => ({
            ...current,
            address_line_1:
              current.address_line_1 ||
              mapAddress.road ||
              mapAddress.neighbourhood ||
              mapAddress.suburb ||
              "",
            address_line_2:
              current.address_line_2 ||
              mapAddress.neighbourhood ||
              mapAddress.suburb ||
              "",
            city: detectedCity || current.city,
            district: detectedDistrict || current.district,
            state: detectedState || current.state,
            postal_code: mapAddress.postcode || current.postal_code,
            country: mapAddress.country || current.country || "India",
            latitude,
            longitude,
            location_accuracy: accuracy,
            location_captured_at: new Date().toISOString(),
          }));

          setMessage(
            "Current location captured. Please check the address before saving."
          );
        } catch (locationError) {
          console.error(locationError);
          setAddressDraft((current) => ({
            ...current,
            latitude,
            longitude,
            location_accuracy: accuracy,
            location_captured_at: new Date().toISOString(),
          }));
          setMessage(
            "Location pin captured. Please enter or confirm the written address before saving."
          );
        } finally {
          setLocating(false);
        }
      },
      (locationError) => {
        console.error(locationError);
        setLocating(false);

        if (locationError.code === locationError.PERMISSION_DENIED) {
          setError(
            "Location permission was not allowed. You can still enter the address manually."
          );
        } else {
          setError(
            "Unable to get your current location. Please try again or enter the address manually."
          );
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      }
    );
  }

  async function saveAddress(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (savingAddress) return;

    setSavingAddress(true);
    setError("");
    setMessage("");

    try {
      const required = [
        addressDraft.full_name,
        addressDraft.phone,
        addressDraft.address_line_1,
        addressDraft.city,
        addressDraft.district,
        addressDraft.state,
        addressDraft.postal_code,
      ];

      if (required.some((value) => !value.trim())) {
        setError("Please complete all required address fields.");
        return;
      }

      const payload = {
        user_id: userId,
        full_name: addressDraft.full_name.trim(),
        phone: addressDraft.phone.trim(),
        address_line_1: addressDraft.address_line_1.trim(),
        address_line_2: addressDraft.address_line_2.trim() || null,
        city: addressDraft.city.trim(),
        district: addressDraft.district.trim(),
        state: addressDraft.state.trim(),
        postal_code: addressDraft.postal_code.trim(),
        country: addressDraft.country.trim() || "India",
        latitude: addressDraft.latitude,
        longitude: addressDraft.longitude,
        location_accuracy: addressDraft.location_accuracy,
        location_captured_at: addressDraft.location_captured_at,
      };

      if (editingAddressId) {
        const { error: updateError } = await supabase
          .from("addresses")
          .update(payload)
          .eq("id", editingAddressId)
          .eq("user_id", userId);

        if (updateError) throw updateError;
        setMessage("Address updated.");
      } else {
        const { error: insertError } = await supabase
          .from("addresses")
          .insert({
            ...payload,
            is_default: addresses.length === 0,
          });

        if (insertError) throw insertError;
        setMessage("Address added.");
      }

      cancelAddressEdit();
      await reloadAddresses();
    } catch (addressError) {
      console.error(addressError);
      setError("Unable to save this address. Please try again.");
    } finally {
      setSavingAddress(false);
    }
  }

  async function reloadAddresses() {
    const { data, error: addressError } = await supabase
      .from("addresses")
      .select(
        "id, full_name, phone, address_line_1, address_line_2, city, district, state, postal_code, country, latitude, longitude, location_accuracy, location_captured_at, is_default"
      )
      .eq("user_id", userId)
      .order("is_default", { ascending: false });

    if (addressError) {
      console.error(addressError);
      return;
    }

    setAddresses((data || []) as Address[]);
  }

  async function makeDefault(addressId: string) {
    setError("");
    setMessage("");

    const { error: clearError } = await supabase
      .from("addresses")
      .update({ is_default: false })
      .eq("user_id", userId);

    if (clearError) {
      setError("Unable to update your default address.");
      return;
    }

    const { error: defaultError } = await supabase
      .from("addresses")
      .update({ is_default: true })
      .eq("id", addressId)
      .eq("user_id", userId);

    if (defaultError) {
      setError("Unable to update your default address.");
      return;
    }

    setMessage("Default address updated.");
    await reloadAddresses();
  }

  async function deleteAddress(address: Address) {
    if (!window.confirm("Delete this saved address?")) return;

    setError("");
    setMessage("");

    const { error: deleteError } = await supabase
      .from("addresses")
      .delete()
      .eq("id", address.id)
      .eq("user_id", userId);

    if (deleteError) {
      setError("Unable to delete this address.");
      return;
    }

    const remaining = addresses.filter((item) => item.id !== address.id);

    if (address.is_default && remaining.length > 0) {
      await supabase
        .from("addresses")
        .update({ is_default: true })
        .eq("id", remaining[0].id)
        .eq("user_id", userId);
    }

    setMessage("Address deleted.");
    await reloadAddresses();
  }

  if (loading) {
    return (
      <section className="section account-page">
        <p className="eyebrow">MY CIRCA LUCIA</p>
        <h1>My details.</h1>
        <p>Loading your details...</p>
      </section>
    );
  }

  return (
    <section className="section account-page">
      <p className="eyebrow">MY CIRCA LUCIA</p>
      <h1>My details.</h1>
      <p>
        Manage your personal information and saved delivery addresses.
      </p>

      <p style={{ marginTop: "18px" }}>
        <Link href="/account" className="text-link">
          ← Back to account
        </Link>
      </p>

      {error && <div className="error-box">{error}</div>}
      {message && <div className="success-box">{message}</div>}

      <div className="account-grid" style={{ marginTop: "30px" }}>
        <div className="account-card" style={{ gridColumn: "1 / -1" }}>
          <span>00</span>
          <h2>Personal information</h2>

          {!editingProfile ? (
            <div style={{ marginTop: "24px" }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "repeat(auto-fit, minmax(220px, 1fr))",
                  gap: "24px 40px",
                }}
              >
                <div>
                  <p className="eyebrow">FULL NAME</p>
                  <p>{fullName || "Not added"}</p>
                </div>

                <div>
                  <p className="eyebrow">EMAIL ADDRESS</p>
                  <p>{email || "Not added"}</p>
                </div>

                <div>
                  <p className="eyebrow">MOBILE NUMBER</p>
                  <p>{originalPhone || "Not added"}</p>
                </div>

                <div>
                  <p className="eyebrow">DATE OF BIRTH</p>
                  <p>
                    {dateOfBirth
                      ? new Date(
                          `${dateOfBirth}T00:00:00`
                        ).toLocaleDateString("en-IN", {
                          day: "2-digit",
                          month: "long",
                          year: "numeric",
                        })
                      : "Not added"}
                  </p>
                </div>

                <div>
                  <p className="eyebrow">GENDER</p>
                  <p>
                    {gender === "female"
                      ? "Female"
                      : gender === "male"
                      ? "Male"
                      : gender === "non_binary"
                      ? "Non-binary"
                      : gender === "prefer_not_to_say"
                      ? "Prefer not to say"
                      : "Not added"}
                  </p>
                </div>
              </div>

              <button
                type="button"
                className="button button-dark"
                onClick={() => {
                  setError("");
                  setMessage("");
                  setEditingProfile(true);
                }}
                style={{
                  marginTop: "26px",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                <span aria-hidden="true">✎</span>
                Edit details
              </button>
            </div>
          ) : (
            <form onSubmit={saveProfile}>
              <input
                className="input"
                placeholder="Full name"
                value={fullName}
                onChange={(event) =>
                  setFullName(event.target.value)
                }
                required
              />

              <input
                className="input"
                type="email"
                value={email}
                readOnly
                aria-label="Email address"
              />

              <div className="phone-row">
                <select
                  className="input phone-country"
                  value={country}
                  onChange={(event) =>
                    setCountry(
                      event.target.value as Country
                    )
                  }
                >
                  {countries.map((countryCode) => (
                    <option
                      key={countryCode}
                      value={countryCode}
                    >
                      {countryNames.of(countryCode) ||
                        countryCode} (+
                      {getCountryCallingCode(
                        countryCode
                      )}
                      )
                    </option>
                  ))}
                </select>

                <input
                  className="input phone-number"
                  type="tel"
                  inputMode="numeric"
                  placeholder="10-digit mobile number"
                  value={phone}
                  onChange={(event) =>
                    handlePhoneChange(
                      event.target.value
                    )
                  }
                  maxLength={10}
                  pattern="[0-9]{10}"
                  required
                />
              </div>

              <p className="phone-help">
                Your email is linked to your sign-in and
                cannot be changed here.
              </p>

              <input
                className="input"
                type="date"
                value={dateOfBirth}
                onChange={(event) =>
                  setDateOfBirth(event.target.value)
                }
                max={
                  new Date()
                    .toISOString()
                    .split("T")[0]
                }
                aria-label="Date of birth"
              />

              <select
                className="input"
                value={gender}
                onChange={(event) =>
                  setGender(event.target.value)
                }
                aria-label="Gender"
              >
                <option value="">Select gender</option>
                <option value="female">Female</option>
                <option value="male">Male</option>
                <option value="non_binary">
                  Non-binary
                </option>
                <option value="prefer_not_to_say">
                  Prefer not to say
                </option>
              </select>

              <div
                style={{
                  display: "flex",
                  gap: "18px",
                  alignItems: "center",
                  flexWrap: "wrap",
                }}
              >
                <button
                  className="button button-dark"
                  type="submit"
                  disabled={savingProfile}
                >
                  {savingProfile
                    ? "Saving..."
                    : "Save changes"}
                </button>

                <button
                  type="button"
                  className="button button-dark"
                  onClick={() => {
                    setEditingProfile(false);
                    setError("");
                    setMessage("");
                    void loadPage();
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>

        <div className="account-card" style={{ gridColumn: "1 / -1" }}>
          <span>01</span>
          <h2>Saved addresses</h2>
          <p>
            Add, edit or remove addresses used for delivery.
          </p>

          {!addingAddress && !editingAddressId && (
            <button
              type="button"
              className="button button-dark"
              onClick={startAddAddress}
            >
              Add new address
            </button>
          )}

          {(addingAddress || editingAddressId) && (
            <form onSubmit={saveAddress} style={{ marginTop: "22px" }}>
              <button
                type="button"
                className="button button-dark"
                onClick={() => void useCurrentLocation()}
                disabled={locating}
                style={{ marginBottom: "18px" }}
              >
                {locating ? "Fetching location..." : "⌖ Use current location"}
              </button>

              {addressDraft.latitude !== null &&
                addressDraft.longitude !== null && (
                  <p className="phone-help" style={{ marginBottom: "18px" }}>
                    Delivery location pin captured. Please confirm the address
                    fields below before saving.
                  </p>
                )}

              <input
                className="input"
                placeholder="Recipient full name"
                value={addressDraft.full_name}
                onChange={(e) =>
                  setAddressDraft({ ...addressDraft, full_name: e.target.value })
                }
                required
              />
              <input
                className="input"
                placeholder="Phone number"
                value={addressDraft.phone}
                onChange={(e) =>
                  setAddressDraft({ ...addressDraft, phone: e.target.value })
                }
                required
              />
              <input
                className="input"
                placeholder="Address line 1"
                value={addressDraft.address_line_1}
                onChange={(e) =>
                  setAddressDraft({
                    ...addressDraft,
                    address_line_1: e.target.value,
                  })
                }
                required
              />
              <input
                className="input"
                placeholder="Address line 2 (optional)"
                value={addressDraft.address_line_2}
                onChange={(e) =>
                  setAddressDraft({
                    ...addressDraft,
                    address_line_2: e.target.value,
                  })
                }
              />
              <input
                className="input"
                placeholder="City / Locality"
                value={addressDraft.city}
                onChange={(e) =>
                  setAddressDraft({ ...addressDraft, city: e.target.value })
                }
                required
              />

              <select
                className="input"
                value={addressDraft.state}
                onChange={(e) =>
                  setAddressDraft({
                    ...addressDraft,
                    state: e.target.value,
                    district: "",
                  })
                }
                required
              >
                <option value="">Select state / UT</option>
                {INDIA_STATES.map((stateName) => (
                  <option key={stateName} value={stateName}>
                    {stateName}
                  </option>
                ))}
              </select>

              {DISTRICTS_BY_STATE[addressDraft.state] ? (
                <select
                  className="input"
                  value={addressDraft.district}
                  onChange={(e) =>
                    setAddressDraft({
                      ...addressDraft,
                      district: e.target.value,
                    })
                  }
                  required
                >
                  <option value="">Select district</option>
                  {DISTRICTS_BY_STATE[addressDraft.state].map(
                    (districtName) => (
                      <option key={districtName} value={districtName}>
                        {districtName}
                      </option>
                    )
                  )}
                </select>
              ) : (
                <input
                  className="input"
                  placeholder={
                    addressDraft.state
                      ? "District"
                      : "Select state first"
                  }
                  value={addressDraft.district}
                  onChange={(e) =>
                    setAddressDraft({
                      ...addressDraft,
                      district: e.target.value,
                    })
                  }
                  disabled={!addressDraft.state}
                  required
                />
              )}
              <input
                className="input"
                placeholder="PIN / Postal code"
                value={addressDraft.postal_code}
                onChange={(e) =>
                  setAddressDraft({
                    ...addressDraft,
                    postal_code: e.target.value,
                  })
                }
                required
              />
              <input
                className="input"
                placeholder="Country"
                value={addressDraft.country}
                onChange={(e) =>
                  setAddressDraft({ ...addressDraft, country: e.target.value })
                }
                required
              />

              <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
                <button
                  className="button button-dark"
                  type="submit"
                  disabled={savingAddress}
                >
                  {savingAddress ? "Saving..." : "Save address"}
                </button>
                <button
                  className="button button-dark"
                  type="button"
                  onClick={cancelAddressEdit}
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          <div style={{ marginTop: "26px" }}>
            {addresses.length === 0 ? (
              <p>No saved addresses yet.</p>
            ) : (
              addresses.map((address, index) => (
                <div
                  key={address.id}
                  style={{
                    padding: "20px 0",
                    borderTop: "1px solid var(--line)",
                  }}
                >
                  <p>
                    <strong>
                      Address {String(index + 1).padStart(2, "0")}
                      {address.is_default ? " · Default" : ""}
                    </strong>
                  </p>
                  <p>
                    {address.full_name}<br />
                    {address.phone}<br />
                    {address.address_line_1}
                    {address.address_line_2
                      ? `, ${address.address_line_2}`
                      : ""}
                    <br />
                    {address.city}{address.district ? `, ${address.district}` : ""}, {address.state} {address.postal_code}
                    <br />
                    {address.country}
                  </p>

                  <div
                    style={{
                      display: "flex",
                      gap: "18px",
                      flexWrap: "wrap",
                      marginTop: "10px",
                    }}
                  >
                    <button
                      type="button"
                      className="button button-dark"
                      onClick={() => startEditAddress(address)}
                    >
                      Edit
                    </button>

                    {!address.is_default && (
                      <button
                        type="button"
                        className="button button-dark"
                        onClick={() => void makeDefault(address.id)}
                      >
                        Make default
                      </button>
                    )}

                    <button
                      type="button"
                      className="button button-dark"
                      onClick={() => void deleteAddress(address)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>


    </section>
  );
}
