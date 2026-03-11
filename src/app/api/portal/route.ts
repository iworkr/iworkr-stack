import { CustomerPortal } from "@polar-sh/nextjs";
import { getAppUrl } from "@/lib/app-url";

export const GET = CustomerPortal({
  accessToken: process.env.POLAR_ACCESS_TOKEN!,
  server: "production",
  returnUrl: `${getAppUrl()}/settings/billing`,
  getCustomerId: async (req) => {
    const { searchParams } = new URL(req.url);
    const customerId = searchParams.get("customerId");
    if (!customerId) throw new Error("Missing customerId");
    return customerId;
  },
});
