import type { NextConfig } from "next";

const contentSecurityPolicyReportOnly = `
  default-src 'self';
  base-uri 'self';
  object-src 'none';
  frame-ancestors 'none';
  form-action 'self';

  script-src
    'self'
    'unsafe-inline'
    'unsafe-eval'
    https://checkout.razorpay.com;

  style-src
    'self'
    'unsafe-inline'
    https://fonts.googleapis.com;

  font-src
    'self'
    data:
    https://fonts.gstatic.com;

  img-src
    'self'
    data:
    blob:
    https:;

  media-src
    'self'
    blob:
    https:;

  connect-src
    'self'
    https://rewrlnavcpodcqtzvlfg.supabase.co
    wss://rewrlnavcpodcqtzvlfg.supabase.co
    https://nominatim.openstreetmap.org
    https://checkout.razorpay.com
    https://api.razorpay.com;

  frame-src
    'self'
    https://api.razorpay.com
    https://checkout.razorpay.com;
`
  .replace(/\s{2,}/g, " ")
  .trim();

const securityHeaders = [
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Permissions-Policy",
    value:
      "camera=(), microphone=(), geolocation=(self), payment=(self)",
  },
  {
    key: "Cross-Origin-Opener-Policy",
    value: "same-origin-allow-popups",
  },
  {
    key: "Content-Security-Policy-Report-Only",
    value: contentSecurityPolicyReportOnly,
  },
];

const nextConfig: NextConfig = {
  images: {
    unoptimized: true,
  },

  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },

      {
        source: "/api/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "private, no-store, max-age=0",
          },
          {
            key: "Pragma",
            value: "no-cache",
          },
        ],
      },
    ];
  },
};

export default nextConfig;