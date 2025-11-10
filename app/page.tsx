"use client";

import dynamic from "next/dynamic";

const Animator = dynamic(() => import("@/components/Animator"), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-screen items-center justify-center">
      <p className="text-sm text-neutral-400">Loading animator...</p>
    </div>
  )
});

export default function Page() {
  return <Animator />;
}
