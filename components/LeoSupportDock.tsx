"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

const PublicLeoConsultant = dynamic(() => import("@/components/PublicLeoConsultant"), {
  ssr: false,
});

export default function LeoSupportDock() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const win = window as typeof window & {
      requestIdleCallback?: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number;
      cancelIdleCallback?: (id: number) => void;
    };

    let idleId: number | undefined;
    let timeoutId: number | undefined;

    if (win.requestIdleCallback) {
      idleId = win.requestIdleCallback(() => setReady(true), { timeout: 1800 });
    } else {
      timeoutId = window.setTimeout(() => setReady(true), 900);
    }

    return () => {
      if (idleId !== undefined && win.cancelIdleCallback) win.cancelIdleCallback(idleId);
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
    };
  }, []);

  return ready ? <PublicLeoConsultant /> : null;
}
