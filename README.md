# Circa Lucia — Luxury Footwear Website

This is Version 1: a polished Next.js/TypeScript frontend and demo commerce flow.
Payment, production database, real authentication, shipping APIs and admin persistence are intentionally left for Version 2.

## Requirements
- Node.js 20+ (LTS recommended)
- VS Code
- A browser

## Run locally
1. Extract this folder.
2. Open the folder in VS Code.
3. Open Terminal -> New Terminal.
4. Run:
   npm install
   npm run dev
5. Open http://localhost:3000

## Important
- Your supplied Circa Lucia logo has been included as `public/hero.jpg` only as a temporary hero asset.
- Replace it with proper hero/product photography before launch.
- The admin page is a frontend demo, not secure production administration.
- The checkout page is a demo. Do NOT accept real payments until Razorpay/Stripe/etc. is integrated server-side.

## Next production phases
1. Supabase PostgreSQL database
2. Supabase Auth
3. Product/admin CRUD
4. Real order creation
5. Razorpay payment + webhook
6. Shipping/tracking integration
7. Email/WhatsApp notifications
8. Cloudinary product media
9. Secure admin roles
10. Vercel deployment + domain
