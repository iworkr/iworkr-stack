import { CustomerPortal } from "@polar-sh/nextjs";

export const GET = CustomerPortal({
  accessToken: process.env.POLAR_ACCESS_TOKEN!,
  server: "production",
  returnUrl: process.env.NEXT_PUBLIC_APP_URL
    ? `${process.env.NEXT_PUBLIC_APP_URL}/settings/billing`
    : "https://iworkr-stack.vercel.app/settings/billing",
  getCustomerId: async (req) => {
    const { searchParams } = new URL(req.url);
    const customerId = searchParams.get("customerId");
    if (!customerId) throw new Error("Missing customerId");
    return customerId;
  },
});
