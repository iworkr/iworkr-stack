import { FadeIn } from "@/components/ui/fade-in";

const footerLinks = [
  {
    title: "Product",
    links: ["Scheduler", "Mobile App", "AI Agent", "Invoicing", "Reports"],
  },
  {
    title: "Features",
    links: ["Smart Routing", "Offline Mode", "Tap to Pay", "Client CRM", "Multi-branch"],
  },
  {
    title: "Resources",
    links: ["Documentation", "API Reference", "Changelog", "Blog", "Webinars"],
  },
  {
    title: "Company",
    links: ["About", "Careers", "Press", "Partners", "Contact"],
  },
  {
    title: "Legal",
    links: ["Privacy Policy", "Terms of Service", "Cookie Policy", "DPA", "SLA"],
  },
];

export function Footer() {
  return (
    <footer className="border-t border-[rgba(255,255,255,0.06)]">
      <div className="mx-auto max-w-[1200px] px-6 py-16 md:px-12">
        <FadeIn>
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 md:grid-cols-5">
            {footerLinks.map((group) => (
              <div key={group.title}>
                <h4 className="mb-4 text-xs font-medium tracking-wider text-zinc-400 uppercase">
                  {group.title}
                </h4>
                <ul className="space-y-2.5">
                  {group.links.map((link) => (
                    <li key={link}>
                      <a
                        href="#"
                        className="text-sm text-zinc-600 transition-colors duration-200 hover:text-zinc-300"
                      >
                        {link}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </FadeIn>

        {/* Bottom bar */}
        <div className="mt-16 flex flex-col items-center justify-between gap-4 border-t border-[rgba(255,255,255,0.06)] pt-8 sm:flex-row">
          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-white">
              <span className="text-[10px] font-semibold text-black">iW</span>
            </div>
            <span className="text-sm text-zinc-500">
              &copy; {new Date().getFullYear()} iWorkr. All rights reserved.
            </span>
          </div>

          {/* Status */}
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-pulse-dot absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            <span className="text-xs text-zinc-600">System Operational</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
