"use client";

import dynamic from "next/dynamic";
import type { CSSProperties } from "react";

const LottieIconInner = dynamic(
  () =>
    import("./lottie-icon-inner").then((mod) => ({ default: mod.LottieIconInner })),
  { ssr: false }
);

export interface LottieIconProps {
  animationData: object;
  size?: number;
  loop?: boolean;
  autoplay?: boolean;
  playOnHover?: boolean;
  className?: string;
  style?: CSSProperties;
}

export function LottieIcon({
  animationData,
  size = 24,
  loop = false,
  autoplay = true,
  playOnHover = false,
  className = "",
  style,
}: LottieIconProps) {
  return (
    <LottieIconInner
      animationData={animationData}
      size={size}
      loop={loop}
      autoplay={autoplay}
      playOnHover={playOnHover}
      className={className}
      style={style}
    />
  );
}
