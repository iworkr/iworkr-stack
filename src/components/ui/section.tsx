import { type ReactNode } from "react";

interface SectionProps {
  children: ReactNode;
  className?: string;
  id?: string;
}

export function Section({ children, className = "", id }: SectionProps) {
  return (
    <section id={id} className={`relative py-24 md:py-32 ${className}`}>
      <div className="mx-auto max-w-[1200px] px-6 md:px-12">{children}</div>
    </section>
  );
}

export function SectionHeader({
  label,
  title,
  description,
  className = "",
}: {
  label?: string;
  title: string;
  description?: string;
  className?: string;
}) {
  return (
    <div className={`mb-16 max-w-2xl ${className}`}>
      {label && (
        <span className="mb-4 inline-block font-mono text-xs tracking-widest text-zinc-500 uppercase">
          {label}
        </span>
      )}
      <h2 className="text-3xl font-medium tracking-tight text-text-primary md:text-4xl lg:text-5xl">
        {title}
      </h2>
      {description && (
        <p className="mt-4 text-lg leading-relaxed text-text-secondary">
          {description}
        </p>
      )}
    </div>
  );
}
