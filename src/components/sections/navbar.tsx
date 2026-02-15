"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import { Menu, X } from "lucide-react";
import { useState } from "react";
import { SpotlightButton } from "@/components/ui/spotlight-button";

const navLinks = [
  { label: "Features", href: "#features" },
  { label: "Workflow", href: "#workflow" },
  { label: "Pricing", href: "#pricing" },
  { label: "Testimonials", href: "#testimonials" },
];

export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { scrollY } = useScroll();
  const bgOpacity = useTransform(scrollY, [0, 100], [0, 0.8]);
  const borderOpacity = useTransform(scrollY, [0, 100], [0, 0.08]);

  return (
    <>
      <motion.header
        className="fixed top-0 right-0 left-0 z-50"
        style={{
          backgroundColor: `rgba(0, 0, 0, ${bgOpacity.get()})`,
        }}
      >
        <motion.div
          className="absolute inset-0 backdrop-blur-xl"
          style={{ opacity: bgOpacity }}
        />
        <motion.div
          className="absolute inset-x-0 bottom-0 h-px bg-white"
          style={{ opacity: borderOpacity }}
        />

        <nav className="relative mx-auto flex max-w-[1200px] items-center justify-between px-6 py-4 md:px-12">
          {/* Logo */}
          <a href="/" className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-white">
              <span className="text-sm font-semibold text-black">iW</span>
            </div>
            <span className="text-sm font-medium tracking-tight text-zinc-100">
              iWorkr
            </span>
            <span className="hidden rounded border border-[rgba(255,255,255,0.08)] px-1.5 py-0.5 font-mono text-[10px] text-zinc-500 sm:inline-block">
              v2.0
            </span>
          </a>

          {/* Desktop Links */}
          <div className="hidden items-center gap-8 md:flex">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-sm text-zinc-400 transition-colors duration-200 hover:text-zinc-100"
              >
                {link.label}
              </a>
            ))}
          </div>

          {/* Desktop CTA */}
          <div className="hidden items-center gap-3 md:flex">
            <a
              href="#pricing"
              className="text-sm text-zinc-400 transition-colors hover:text-zinc-100"
            >
              Sign in
            </a>
            <SpotlightButton size="sm" href="#pricing">
              Start free
            </SpotlightButton>
          </div>

          {/* Mobile Toggle */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="text-zinc-400 transition-colors hover:text-zinc-100 md:hidden"
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
          className="fixed inset-x-0 top-[57px] z-40 border-b border-[rgba(255,255,255,0.08)] bg-black/95 backdrop-blur-xl md:hidden"
        >
          <div className="flex flex-col gap-1 px-6 py-4">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className="rounded-lg px-3 py-2.5 text-sm text-zinc-400 transition-colors hover:bg-[rgba(255,255,255,0.05)] hover:text-zinc-100"
              >
                {link.label}
              </a>
            ))}
            <div className="mt-3 border-t border-[rgba(255,255,255,0.08)] pt-3">
              <SpotlightButton size="md" className="w-full" href="#pricing">
                Start free trial
              </SpotlightButton>
            </div>
          </div>
        </motion.div>
      )}
    </>
  );
}
