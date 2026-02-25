"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function SignupPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/auth?mode=signup");
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-black">
      <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/20 border-t-white/80" />
    </div>
  );
}
