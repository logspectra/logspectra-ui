"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

/** Legacy `/` entry — canonical dashboard lives at `/dashboard`. */
export default function RootRedirectPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const query = searchParams.toString();
    router.replace(query ? `/dashboard?${query}` : "/dashboard");
  }, [router, searchParams]);

  return null;
}
