"use client";

import { useRef, useCallback, type CSSProperties } from "react";
import { useLottie } from "lottie-react";

export interface LottieIconInnerProps {
  animationData: object;
  size?: number;
  loop?: boolean;
  autoplay?: boolean;
  playOnHover?: boolean;
  className?: string;
  style?: CSSProperties;
  onComplete?: () => void;
}

/**
 * Client-only Lottie renderer using useLottie hook so the View always renders
 * without depending on the default Lottie component's interactivity layer.
 * Loaded via dynamic import with ssr: false from lottie-icon.tsx.
 */
export function LottieIconInner({
  animationData,
  size = 24,
  loop = false,
  autoplay = true,
  playOnHover = false,
  className = "",
  style,
  onComplete,
}: LottieIconInnerProps) {
  const lottieRef = useRef<any>(null);

  const { View } = useLottie(
    {
      animationData,
      loop,
      autoplay: playOnHover ? false : autoplay,
      lottieRef,
      onComplete: onComplete ?? undefined,
    },
    { width: size, height: size }
  );

  const handleMouseEnter = useCallback(() => {
    if (playOnHover && lottieRef.current) {
      lottieRef.current.goToAndPlay(0);
    }
  }, [playOnHover]);

  return (
    <div
      className={`lottie-icon-wrapper ${className}`.trim()}
      style={{
        width: size,
        height: size,
        minWidth: size,
        minHeight: size,
        display: "inline-block",
        ...style,
      }}
      onMouseEnter={handleMouseEnter}
    >
      {View}
    </div>
  );
}
