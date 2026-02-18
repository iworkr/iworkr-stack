"use client";

import { motion } from "framer-motion";
import { useState } from "react";
import { Check, ExternalLink } from "lucide-react";

interface Integration {
  id: string;
  name: string;
  description: string;
  category: string;
  connected: boolean;
}

const integrations: Integration[] = [
  { id: "stripe", name: "Stripe", description: "Process payments and sync invoices automatically.", category: "Payments", connected: true },
  { id: "xero", name: "Xero", description: "Two-way sync for invoices, expenses, and contacts.", category: "Accounting", connected: true },
  { id: "quickbooks", name: "QuickBooks", description: "Sync financial data with QuickBooks Online.", category: "Accounting", connected: false },
  { id: "gcal", name: "Google Calendar", description: "Two-way sync for schedules and job appointments.", category: "Scheduling", connected: false },
  { id: "outlook", name: "Outlook Calendar", description: "Sync schedules with Microsoft Outlook.", category: "Scheduling", connected: false },
  { id: "slack", name: "Slack", description: "Get job updates and notifications in Slack channels.", category: "Communication", connected: false },
  { id: "twilio", name: "Twilio", description: "SMS notifications for clients and team members.", category: "Communication", connected: false },
  { id: "zapier", name: "Zapier", description: "Connect your workspace to 5,000+ apps via automated workflows.", category: "Automation", connected: false },
];

export default function IntegrationsPage() {
  const [items, setItems] = useState(integrations);

  function toggleConnect(id: string) {
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, connected: !i.connected } : i))
    );
  }

  const categories = [...new Set(items.map((i) => i.category))];

  return (
    <>
      <div className="mb-8">
        <h1 className="text-2xl font-medium tracking-tight text-zinc-100">Integrations</h1>
        <p className="mt-1 text-[13px] text-zinc-600">
          Connect your workspace with your existing tools and services.
        </p>
      </div>

      {categories.map((category) => (
        <div key={category} className="mb-8">
          <h3 className="mb-3 text-[11px] font-medium tracking-wider text-zinc-600 uppercase">
            {category}
          </h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {items
              .filter((i) => i.category === category)
              .map((item, idx) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.04 }}
                  className="flex flex-col justify-between rounded-lg border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.02)] p-4 transition-colors hover:border-[rgba(255,255,255,0.12)]"
                >
                  <div className="mb-3">
                    <div className="mb-1 text-[14px] font-medium text-zinc-200">
                      {item.name}
                    </div>
                    <p className="text-[12px] leading-relaxed text-zinc-600">
                      {item.description}
                    </p>
                  </div>
                  <div className="flex items-center justify-between">
                    {item.connected ? (
                      <span className="flex items-center gap-1.5 text-[12px] text-emerald-400">
                        <Check size={12} />
                        Connected
                      </span>
                    ) : (
                      <span className="text-[12px] text-zinc-600">Not connected</span>
                    )}
                    <button
                      onClick={() => toggleConnect(item.id)}
                      className={`flex items-center gap-1.5 rounded-md border px-3 py-1 text-[12px] font-medium transition-colors ${
                        item.connected
                          ? "border-[rgba(255,255,255,0.08)] text-zinc-500 hover:border-red-500/30 hover:text-red-400"
                          : "border-[rgba(255,255,255,0.15)] text-zinc-300 hover:bg-[rgba(255,255,255,0.04)]"
                      }`}
                    >
                      {item.connected ? "Disconnect" : "Connect"}
                      {!item.connected && <ExternalLink size={10} />}
                    </button>
                  </div>
                </motion.div>
              ))}
          </div>
        </div>
      ))}
    </>
  );
}
