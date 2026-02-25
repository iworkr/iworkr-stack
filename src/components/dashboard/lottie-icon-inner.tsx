"use client";

import { useRef, useEffect, useCallback, memo, type CSSProperties } from "react";
import lottie, { type AnimationItem } from "lottie-web";

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

export const LottieIconInner = memo(function LottieIconInner({
  animationData,
  size = 24,
  loop = false,
  autoplay = true,
  playOnHover = false,
  className = "",
  style,
  onComplete,
}: LottieIconInnerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<AnimationItem | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    animRef.current = lottie.loadAnimation({
      container: containerRef.current,
      animationData,
      renderer: "svg",
      loop,
      autoplay: playOnHover ? false : autoplay,
    });
    if (onComplete) {
      animRef.current.addEventListener("complete", onComplete);
    }
    return () => {
      animRef.current?.destroy();
      animRef.current = null;
    };
    // animationData is a module-level constant; other deps are primitive
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animationData, loop, autoplay, playOnHover]);

  const handleMouseEnter = useCallback(() => {
    if (playOnHover && animRef.current) {
      animRef.current.goToAndPlay(0, true);
    }
  }, [playOnHover]);

  return (
    <div
      ref={containerRef}
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
    />
  );
});
