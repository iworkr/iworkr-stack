"use client";

import { useRef, useState, useCallback, type CSSProperties } from "react";
import dynamic from "next/dynamic";

const Lottie = dynamic(() => import("lottie-react"), { ssr: false });

interface LottieIconProps {
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
  const lottieRef = useRef<any>(null);
  const [hasPlayed, setHasPlayed] = useState(false);

  const handleMouseEnter = useCallback(() => {
    if (playOnHover && lottieRef.current) {
      lottieRef.current.goToAndPlay(0);
    }
  }, [playOnHover]);

  const handleComplete = useCallback(() => {
    setHasPlayed(true);
  }, []);

  return (
    <div
      className={className}
      style={{ width: size, height: size, ...style }}
      onMouseEnter={handleMouseEnter}
    >
      <Lottie
        lottieRef={lottieRef}
        animationData={animationData}
        loop={loop}
        autoplay={playOnHover ? false : autoplay}
        onComplete={handleComplete}
        style={{ width: size, height: size }}
      />
    </div>
  );
}
