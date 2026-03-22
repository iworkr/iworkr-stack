/**
 * @module MockClients
 * @status COMPLETE
 * @description Test-environment mock clients for OpenAI, Twilio, and Supabase
 * @lastAudit 2026-03-22
 */
export const isTestEnv = Deno.env.get("IS_TEST_ENV") === "true";

export const MockOpenAI = {
  chat: {
    completions: {
      create: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                supplier_name: "Bunnings Warehouse",
                invoice_number: "INV-TEST-001",
                po_number: "PO-TEST-001",
                total_incl_tax: 150,
                tax_amount: 13.64,
                subtotal: 136.36,
                date: "2026-03-21",
                line_items: [
                  {
                    description: "PVC Pipe 100mm",
                    quantity: 2,
                    unit_cost: 68.18,
                    line_total: 136.36,
                  },
                ],
                confidence: 0.95,
              }),
            },
          },
        ],
      }),
    },
  },
};

export const MockResend = {
  emails: {
    send: async (payload: Record<string, unknown>) => {
      console.log("[TEST MODE] Mock email sent", payload.to);
      return { data: { id: "test_email_123" }, error: null };
    },
  },
  send: async (_payload: Record<string, unknown>) => {
    return { id: "test_email_123" };
  },
};

export const MockStripe = {
  paymentIntents: {
    create: async (params: Record<string, unknown>) => ({
      id: "pi_test_123",
      client_secret: "test_sec",
      amount: Number(params.amount || 0),
      status: "requires_payment_method",
    }),
  },
  webhooks: {
    constructEvent: (_body: string, _sig: string, _secret: string) => {
      return {};
    },
  },
};

