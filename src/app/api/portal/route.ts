import { CustomerPortal } from "@polar-sh/nextjs";

const appUrl = process.env.NEXT_PUBLIC_APP_URL;
if (!appUrl) console.warn("[portal] NEXT_PUBLIC_APP_URL is not set, falling back to localhost");

export const GET = CustomerPortal({
  accessToken: process.env.POLAR_ACCESS_TOKEN!,
  server: "production",
  returnUrl: `${appUrl || "http://localhost:3000"}/settings/billing`,
  getCustomerId: async (req) => {
    const { searchParams } = new URL(req.url);
    const customerId = searchParams.get("customerId");
    if (!customerId) throw new Error("Missing customerId");
    return customerId;
  },
});
