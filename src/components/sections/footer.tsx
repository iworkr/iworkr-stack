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
      { label: "Contact Us", href: "/contact" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", href: "/#workflow" },
      { label: "Careers", href: "mailto:careers@iworkr.com" },
      { label: "Partners", href: "mailto:partners@iworkr.com" },
      { label: "Contact Sales", href: "/contact" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Terms of Service", href: "/terms" },
      { label: "Privacy Policy", href: "/privacy" },
      { label: "Cookie Policy", href: "/cookies" },
    ],
  },
  {
    title: "Account",
    links: [
      { label: "Sign in", href: "/auth" },
      { label: "Start free trial", href: "/auth" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="border-t border-[var(--card-border)]">
      <div className="mx-auto max-w-[1200px] px-6 py-16 md:px-12">
        <FadeIn>
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 md:grid-cols-6">
            {footerLinks.map((group) => (
              <div key={group.title}>
                <h4 className="mb-4 text-xs font-medium tracking-wider text-[var(--text-muted)] uppercase">
                  {group.title}
                </h4>
                <ul className="space-y-2.5">
                  {group.links.map((link) => (
                    <li key={link.label}>
                      <a
                        href={link.href}
                        className="text-sm text-[var(--text-dim)] transition-colors duration-200 hover:text-[var(--text-primary)]"
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
        <div className="mt-16 flex flex-col items-center justify-between gap-4 border-t border-[var(--card-border)] pt-8 sm:flex-row">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <Image
              src="/logos/logo-dark-full.png"
              alt="iWorkr"
              width={102}
              height={32}
              className="h-6 w-auto object-contain"
            />
            <span className="text-sm text-[var(--text-muted)]">
              &copy; {new Date().getFullYear()} All rights reserved.
            </span>
          </div>

          {/* Status */}
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-pulse-dot absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            <span className="text-xs text-[var(--text-dim)]">System Operational</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
