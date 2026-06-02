"use client";

import posthog from "posthog-js";
import { PostHogProvider as PHProvider } from "posthog-js/react";
import { useEffect } from "react";

export default function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return;
    posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
      api_host:           process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com",
      ui_host:            "https://us.posthog.com",
      capture_pageview:   false, // we call manually per route change
      capture_pageleave:  true,
      session_recording:  { maskAllInputs: false, maskInputOptions: { password: true } },
    });
  }, []);

  return <PHProvider client={posthog}>{children}</PHProvider>;
}
