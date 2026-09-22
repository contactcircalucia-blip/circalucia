"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function AdminAccessGuard({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const [checking, setChecking] = useState(true);
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    let active = true;

    async function checkAccess() {
      setChecking(true);
      setAllowed(false);

      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (!active) return;

        const isAdminRoute =
          pathname === "/admin" ||
          pathname.startsWith("/admin/");

        // ----------------------------------
        // NOT LOGGED IN
        // ----------------------------------

        if (userError || !user) {
          if (isAdminRoute) {
            router.replace("/account");
            return;
          }

          setAllowed(true);
          setChecking(false);
          return;
        }

        // ----------------------------------
        // GET PROFILE / ADMIN STATUS
        // ----------------------------------

        const {
          data: profile,
          error: profileError,
        } = await supabase
          .from("profiles")
          .select("is_admin")
          .eq("id", user.id)
          .single();

        if (!active) return;

        if (profileError) {
          console.error(
            "Unable to verify admin access:",
            profileError
          );

          if (isAdminRoute) {
            router.replace("/account");
            return;
          }

          setAllowed(true);
          setChecking(false);
          return;
        }

        const isAdmin = profile?.is_admin === true;

        // ----------------------------------
        // ADMIN ACCOUNT
        // ----------------------------------

        if (isAdmin) {
          if (!isAdminRoute) {
            router.replace("/admin");
            return;
          }

          setAllowed(true);
          setChecking(false);
          return;
        }

        // ----------------------------------
        // NORMAL CUSTOMER
        // ----------------------------------

        if (isAdminRoute) {
          router.replace("/account");
          return;
        }

        setAllowed(true);
        setChecking(false);
      } catch (error) {
        console.error(
          "Admin access verification failed:",
          error
        );

        const isAdminRoute =
          pathname === "/admin" ||
          pathname.startsWith("/admin/");

        if (isAdminRoute) {
          router.replace("/account");
          return;
        }

        if (active) {
          setAllowed(true);
          setChecking(false);
        }
      }
    }

    void checkAccess();

    return () => {
      active = false;
    };
  }, [pathname, router]);

  // ----------------------------------
  // CIRCA LUCIA LOADING SCREEN
  // ----------------------------------

  if (checking || !allowed) {
    return (
      <div
        style={{
          position: "fixed",
          inset: 0,
          width: "100%",
          height: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#f7f0e5",
          zIndex: 99999,
        }}
      >
        <img
          src="/circa-lucia-loader.gif"
          alt="CIRCA LUCIA loading"
          style={{
            width: "min(360px, 78vw)",
            height: "auto",
            display: "block",
            objectFit: "contain",
          }}
        />
      </div>
    );
  }

  return <>{children}</>;
}