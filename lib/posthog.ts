// Server-side PostHog client — used in API routes and MCP handlers
// to track tool calls and key events without blocking responses.
// Uses fire-and-forget: never await, never throw.

import { PostHog } from "posthog-node";

let _client: PostHog | null = null;

function getClient(): PostHog | null {
  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return null;
  if (!_client) {
    _client = new PostHog(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
      host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com",
      flushAt: 1,       // send immediately in serverless context
      flushInterval: 0,
    });
  }
  return _client;
}

// Capture a server-side event. Fire-and-forget — never blocks.
export function track(
  userId: string,
  event: string,
  properties?: Record<string, unknown>,
): void {
  try {
    const ph = getClient();
    if (!ph) return;
    ph.capture({ distinctId: userId, event, properties });
  } catch {
    // observability must never break the product
  }
}
