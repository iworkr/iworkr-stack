"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import { Menu, X } from "lucide-react";
import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { SpotlightButton } from "@/components/ui/spotlight-button";
import { useTheme } from "@/components/providers/theme-provider";

const navLinks = [
  { label: "Features", href: "#features" },
  { label: "Workflow", href: "#workflow" },
  { label: "Download", href: "#download" },
  { label: "Pricing", href: "#pricing" },
];

export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { scrollY } = useScroll();
  const { theme } = useTheme();
  const bgOpacity = useTransform(scrollY, [0, 100], [0, 0.8]);
  const borderOpacity = useTransform(scrollY, [0, 100], [0, 0.08]);

  return (
    <>
      <motion.header
        className="fixed top-0 right-0 left-0 z-50"
      >
        <motion.div
          className="absolute inset-0 backdrop-blur-xl"
          style={{
            opacity: bgOpacity,
            backgroundColor: "var(--background)",
          }}
        />
        <motion.div
          className="absolute inset-x-0 bottom-0 h-px"
          style={{
            opacity: borderOpacity,
            backgroundColor: "var(--text-primary)",
          }}
        />

        <nav className="relative mx-auto flex max-w-[1200px] items-center justify-between px-6 py-4 md:px-12">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5">
            <Image
              src={theme === "light" ? "/logos/logo-light-full.png" : "/logos/logo-dark-full.png"}
              alt="iWorkr"
              width={120}
              height={32}
              className="h-7 w-auto object-contain"
              priority
            />
            <span className="hidden rounded border border-[var(--card-border)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--text-muted)] sm:inline-block">
              v2.0
            </span>
          </Link>

          {/* Desktop Links */}
          <div className="hidden items-center gap-8 md:flex">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-sm text-[var(--text-muted)] transition-colors duration-200 hover:text-[var(--text-primary)]"
              >
                {link.label}
              </a>
            ))}
          </div>

          {/* Desktop CTA */}
          <div className="hidden items-center gap-3 md:flex">
            <Link
              href="/auth"
              className="text-sm text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)]"
            >
              Sign in
            </Link>
            <SpotlightButton size="sm" href="/auth">
              Start free
            </SpotlightButton>
          </div>

          {/* Mobile Toggle */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)] md:hidden"
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </nav>
      </motion.header>

      {/* Mobile Menu */}
      {mobileOpen && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="fixed inset-x-0 top-[57px] z-40 border-b border-[var(--overlay-border)] bg-[var(--overlay-bg)] backdrop-blur-xl md:hidden"
        >
          <div className="flex flex-col gap-1 px-6 py-4">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className="rounded-lg px-3 py-2.5 text-sm text-[var(--text-muted)] transition-colors hover:bg-[var(--subtle-bg)] hover:text-[var(--text-primary)]"
              >
                {link.label}
              </a>
            ))}
            <div className="mt-3 border-t border-[var(--overlay-border)] pt-3">
              <SpotlightButton size="md" className="w-full" href="/auth">
                Start free trial
              </SpotlightButton>
            </div>
          </div>
        </motion.div>
      )}
    </>
  );
}
