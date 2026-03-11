"use client";

import React, { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface MeteorsProps {
  number?: number;
  minDelay?: number;
  maxDelay?: number;
  minDuration?: number;
  maxDuration?: number;
  angle?: number;
  className?: string;
}

export const Meteors = ({
  number = 20,
  minDelay = 0.2,
  maxDelay = 1.2,
  minDuration = 2,
  maxDuration = 10,
  angle = 0,
  className,
}: MeteorsProps) => {
  const [meteorStyles, setMeteorStyles] = useState<Array<React.CSSProperties>>(
    [],
  );

  useEffect(() => {
    const styles = [...new Array(number)].map(() => ({
      "--meteor-angle": `${angle}deg`,
      top: "-5%",
      left: `${Math.random() * 100}%`,
      animationDelay:
        Math.random() * (maxDelay - minDelay) + minDelay + "s",
      animationDuration:
        Math.floor(Math.random() * (maxDuration - minDuration) + minDuration) +
        "s",
    })) as Array<React.CSSProperties>;
    setMeteorStyles(styles);
  }, [number, minDelay, maxDelay, minDuration, maxDuration, angle]);

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {[...meteorStyles].map((style, idx) => (
        <span
          key={idx}
          className={cn(
            "pointer-events-none absolute size-0.5 animate-meteor rounded-full bg-zinc-400 shadow-[0_0_0_1px_#ffffff10]",
            className,
          )}
          style={style}
        >
          {/* Trail — points opposite to travel direction (upward for angle 0) */}
          <div
            className="pointer-events-none absolute left-1/2 bottom-full -z-10 w-px -translate-x-1/2 bg-gradient-to-t from-zinc-400 to-transparent"
            style={{ height: 50 }}
          />
        </span>
      ))}
    </div>
  );
};
