import { stripe } from "@/lib/stripe";
import { createClient } from "@supabase/supabase-js";
import type Stripe from "stripe";

// Service-role client — bypasses RLS so the webhook can write regardless of
// who the "current user" is. Never exposed to the browser.
function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export async function POST(request: Request) {
  const body = await request.text();
  const sig  = request.headers.get("stripe-signature") ?? "";

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!,
    );
  } catch {
    return Response.json({ error: "Invalid signature" }, { status: 400 });
  }

  const supabase = adminClient();

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.mode !== "subscription") break;

      const userId = session.client_reference_id;
      const subId  = session.subscription as string;
      if (!userId || !subId) break;

      const sub  = await stripe.subscriptions.retrieve(subId);
      const item = sub.items.data[0];
      const periodEnd = (item as any).current_period_end ?? (sub as any).current_period_end;
      if (!periodEnd) break;

      await supabase.from("subscriptions").upsert({
        user_id:                userId,
        stripe_customer_id:     session.customer as string,
        stripe_subscription_id: subId,
        status:                 sub.status,
        price_id:               item.price.id,
        current_period_end:     new Date(periodEnd * 1000).toISOString(),
      }, { onConflict: "user_id" });
      break;
    }

    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const sub    = event.data.object as Stripe.Subscription;
      const userId = sub.metadata?.user_id;
      if (!userId) break;

      const item      = sub.items.data[0];
      const periodEnd = (item as any).current_period_end ?? (sub as any).current_period_end;
      if (!periodEnd) break;

      await supabase.from("subscriptions").upsert({
        user_id:                userId,
        stripe_customer_id:     sub.customer as string,
        stripe_subscription_id: sub.id,
        status:                 sub.status,
        price_id:               item.price.id,
        current_period_end:     new Date(periodEnd * 1000).toISOString(),
      }, { onConflict: "user_id" });
      break;
    }
  }

  return Response.json({ received: true });
}
