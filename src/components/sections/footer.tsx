import Image from "next/image";
import { FadeIn } from "@/components/ui/fade-in";

const footerLinks = [
  {
    title: "Product",
    links: [
      { label: "Scheduler", href: "/#features" },
      { label: "Mobile App", href: "/#features" },
      { label: "AI Agent", href: "/#features" },
      { label: "Invoicing", href: "/#workflow" },
      { label: "Pricing", href: "/#pricing" },
    ],
  },
  {
    title: "Features",
    links: [
      { label: "Smart Routing", href: "/#workflow" },
      { label: "Offline Mode", href: "/#features" },
      { label: "Tap to Pay", href: "/#workflow" },
      { label: "Client CRM", href: "/#features" },
      { label: "Multi-branch", href: "/#features" },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "Documentation", href: "mailto:support@iworkr.com" },
      { label: "API Reference", href: "mailto:support@iworkr.com" },
      { label: "Changelog", href: "/#features" },
      { label: "Blog", href: "/#testimonials" },
      { label: "Contact Us", href: "mailto:hello@iworkr.com" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", href: "/#workflow" },
      { label: "Careers", href: "mailto:careers@iworkr.com" },
      { label: "Partners", href: "mailto:partners@iworkr.com" },
      { label: "Contact Sales", href: "mailto:sales@iworkr.com" },
    ],
  },
  {
    title: "Account",
    links: [
      { label: "Sign in", href: "/auth" },
      { label: "Start free trial", href: "/auth" },
      { label: "Privacy Policy", href: "/privacy" },
      { label: "Terms of Service", href: "/terms" },
    ],
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
                    <li key={link.label}>
                      <a
                        href={link.href}
                        className="text-sm text-zinc-600 transition-colors duration-200 hover:text-zinc-300"
                      >
                        {link.label}
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
            <Image
              src="/logos/logo-mark.png"
              alt="iWorkr"
              width={24}
              height={24}
              className="h-6 w-6 object-contain"
            />
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
