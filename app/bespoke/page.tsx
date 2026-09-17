"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  getCountries,
  getCountryCallingCode,
  Country,
} from "react-phone-number-input";
import { supabase } from "@/lib/supabase";

export default function Bespoke() {
  const countries = useMemo(() => getCountries(), []);

  const countryNames = useMemo(() => {
    return new Intl.DisplayNames(["en"], {
      type: "region",
    });
  }, []);

  const [logged, setLogged] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const [userId, setUserId] = useState("");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  const [country, setCountry] = useState<Country>("IN");
  const [phone, setPhone] = useState("");

  const [design, setDesign] = useState("");
  const [size, setSize] = useState("");

  const [vision, setVision] = useState("");

  const [timing, setTiming] = useState(
    "Within 2–4 weeks"
  );

  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const [requestNumber, setRequestNumber] =
    useState("");

  const [error, setError] = useState("");

  useEffect(() => {
    async function loadSession() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session?.user) {
        setLogged(true);
        setUserId(session.user.id);
        setUserEmail(session.user.email || "");
        setEmail(session.user.email || "");

        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name, phone")
          .eq("id", session.user.id)
          .single();

        if (profile) {
          setName(profile.full_name || "");

          if (profile.phone) {
            const digitsOnly = profile.phone.replace(
              /\D/g,
              ""
            );

            const countryCode =
              getCountryCallingCode(country);

            if (
              digitsOnly.startsWith(countryCode)
            ) {
              setPhone(
                digitsOnly.slice(
                  countryCode.length
                )
              );
            } else {
              setPhone(digitsOnly.slice(-10));
            }
          }
        }
      }
    }

    loadSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (session?.user) {
          setLogged(true);
          setUserId(session.user.id);
          setUserEmail(
            session.user.email || ""
          );
          setEmail(session.user.email || "");
        } else {
          setLogged(false);
          setUserId("");
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  function handlePhoneChange(value: string) {
    const digitsOnly = value.replace(/\D/g, "");

    setPhone(digitsOnly.slice(0, 10));
  }

  async function handleSubmit(
    e: FormEvent<HTMLFormElement>
  ) {
    e.preventDefault();

    setError("");
    setRequestNumber("");

    if (!logged || !userId) {
      setError(
        "Please sign in to submit a bespoke request."
      );
      return;
    }

    if (!/^\d{10}$/.test(phone)) {
      setError(
        "Phone number must contain exactly 10 digits."
      );
      return;
    }

    if (!name.trim()) {
      setError("Please enter your name.");
      return;
    }

    if (!email.trim()) {
      setError("Please enter your email address.");
      return;
    }

    if (!design) {
      setError(
        "Please choose a starting design."
      );
      return;
    }

    if (!vision.trim()) {
      setError(
        "Please tell us about your vision."
      );
      return;
    }

    setLoading(true);

    const fullPhone = `+${getCountryCallingCode(
      country
    )}${phone}`;

    const designDescription = [
      `Starting design: ${design}`,
      size
        ? `Preferred size: ${size}`
        : "",
      `Vision: ${vision.trim()}`,
    ]
      .filter(Boolean)
      .join("\n\n");

    const { data, error: insertError } =
      await supabase
        .from("bespoke_requests")
        .insert({
          user_id: userId,
          name: name.trim(),
          email: email.trim(),
          phone: fullPhone,
          design_description:
            designDescription,
          timing,
          status: "SUBMITTED",
        })
        .select(
          "request_number"
        )
        .single();

    if (insertError) {
      console.error(
        "Unable to submit bespoke request:",
        insertError
      );

      setError(
        "We could not submit your request right now. Please try again."
      );

      setLoading(false);
      return;
    }

    setRequestNumber(
      data?.request_number || ""
    );

    setSent(true);
    setLoading(false);
  }

  return (
    <section className="section bespoke-page">
      <div className="bespoke-intro">
        <p className="eyebrow">
          THE BESPOKE ATELIER
        </p>

        <h1>
          Bring us
          <br />
          <em>your vision.</em>
        </h1>

        <p>
          Choose one of our house designs as your
          starting point, then tell us how you want
          your pair to feel, look and live.
        </p>

        {!logged && (
          <div className="login-note">
            <p>
              Please sign in to your Circa Lucia
              account before submitting a bespoke
              request.
            </p>

            <a href="/account">
              Sign in to your account →
            </a>
          </div>
        )}
      </div>

      <form
        className="bespoke-form"
        onSubmit={handleSubmit}
      >
        <div className="form-step">
          <span>01</span>

          <div>
            <h2>About you</h2>

            <input
              placeholder="Your name"
              value={name}
              onChange={(e) =>
                setName(e.target.value)
              }
              required
            />

            <input
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) =>
                setEmail(e.target.value)
              }
              required
            />

            <div className="phone-row">
              <select
                className="phone-country"
                value={country}
                onChange={(e) =>
                  setCountry(
                    e.target.value as Country
                  )
                }
              >
                {countries.map(
                  (countryCode) => {
                    const countryName =
                      countryNames.of(
                        countryCode
                      ) || countryCode;

                    const callingCode =
                      getCountryCallingCode(
                        countryCode
                      );

                    return (
                      <option
                        key={countryCode}
                        value={countryCode}
                      >
                        {countryName} (+
                        {callingCode})
                      </option>
                    );
                  }
                )}
              </select>

              <input
                className="phone-number"
                type="tel"
                inputMode="numeric"
                placeholder="10-digit mobile number"
                value={phone}
                onChange={(e) =>
                  handlePhoneChange(
                    e.target.value
                  )
                }
                maxLength={10}
                pattern="[0-9]{10}"
                required
              />
            </div>

            <p className="phone-help">
              Enter exactly 10 digits. Country code is
              selected separately.
            </p>
          </div>
        </div>

        <div className="form-step">
          <span>02</span>

          <div>
            <h2>Your design</h2>

            <select
              value={design}
              onChange={(e) =>
                setDesign(e.target.value)
              }
              required
            >
              <option value="">
                Choose a starting design
              </option>

              <option>
                The Luciana
              </option>

              <option>
                The Celeste
              </option>

              <option>
                The Aurora
              </option>

              <option>
                I have another idea
              </option>
            </select>

            <input
              placeholder="Preferred size"
              value={size}
              onChange={(e) =>
                setSize(e.target.value)
              }
            />
          </div>
        </div>

        <div className="form-step">
          <span>03</span>

          <div>
            <h2>Your vision</h2>

            <textarea
              rows={6}
              placeholder="Tell us about the colour, material, occasion, embellishment or anything else you imagine."
              value={vision}
              onChange={(e) =>
                setVision(e.target.value)
              }
              required
            />
          </div>
        </div>

        <div className="form-step">
          <span>04</span>

          <div>
            <h2>Timing</h2>

            <select
              value={timing}
              onChange={(e) =>
                setTiming(e.target.value)
              }
            >
              <option>
                Within 2–4 weeks
              </option>

              <option>
                Within 4–8 weeks
              </option>

              <option>
                I have a specific date
              </option>
            </select>
          </div>
        </div>

        {error && (
          <div className="error-box">
            {error}
          </div>
        )}

        {sent ? (
          <div className="success-box">
            <strong>
              Your request has been received.
            </strong>

            {requestNumber && (
              <p>
                Request number:{" "}
                <strong>
                  {requestNumber}
                </strong>
              </p>
            )}

            <p>
              Our concierge will contact you with
              the next step.
            </p>
          </div>
        ) : (
          <button
            className="button button-dark"
            type="submit"
            disabled={loading || !logged}
          >
            {loading
              ? "Sending request..."
              : "Send bespoke request"}
          </button>
        )}
      </form>

      <style jsx>{`
        .bespoke-intro {
          max-width: 720px;
          margin-bottom: 64px;
        }

        .bespoke-intro h1 {
          margin-bottom: 24px;
        }

        .bespoke-intro > p:last-child {
          max-width: 560px;
          color: #716b64;
          line-height: 1.8;
        }

        .bespoke-form {
          max-width: 900px;
        }

        .form-step {
          display: grid;
          grid-template-columns: 60px 1fr;
          gap: 30px;
          padding: 40px 0;
          border-top: 1px solid #d9d0c4;
        }

        .form-step > span {
          color: #716b64;
          font-size: 12px;
          letter-spacing: 0.12em;
        }

        .form-step h2 {
          margin: 0 0 24px;
          font-size: 28px;
          font-weight: 400;
        }

        .form-step input,
        .form-step select,
        .form-step textarea {
          width: 100%;
          box-sizing: border-box;
          margin-bottom: 14px;
          padding: 15px 0;
          border: 0;
          border-bottom: 1px solid #d9d0c4;
          background: transparent;
          color: #141210;
          font: inherit;
          outline: none;
        }

        .form-step input:focus,
        .form-step select:focus,
        .form-step textarea:focus {
          border-bottom-color: #141210;
        }

        .phone-row {
          display: grid;
          grid-template-columns: minmax(220px, 0.8fr) 1fr;
          gap: 14px;
        }

        .phone-country {
          width: 100% !important;
        }

        .phone-help {
          margin: -4px 0 10px;
          color: #716b64;
          font-size: 12px;
          line-height: 1.5;
        }

        .login-note {
          margin-top: 28px;
          padding: 18px 20px;
          border: 1px solid #d9d0c4;
          background: #faf8f4;
        }

        .login-note p {
          margin: 0 0 8px;
          color: #716b64;
          font-size: 13px;
          line-height: 1.6;
        }

        .login-note a {
          color: #141210;
          font-size: 13px;
          text-decoration: underline;
          text-underline-offset: 3px;
        }

        .error-box {
          margin: 20px 0;
        }

        .success-box {
          margin-top: 20px;
          padding: 20px;
          border: 1px solid #d9d0c4;
          background: #faf8f4;
          color: #141210;
          line-height: 1.6;
        }

        .success-box p {
          margin: 8px 0 0;
          color: #716b64;
          font-size: 13px;
        }

        @media (max-width: 700px) {
          .form-step {
            grid-template-columns: 1fr;
            gap: 12px;
            padding: 30px 0;
          }

          .phone-row {
            grid-template-columns: 1fr;
            gap: 0;
          }

          .bespoke-intro {
            margin-bottom: 40px;
          }
        }
      `}</style>
    </section>
  );
}