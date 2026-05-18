import { stripe } from "@/lib/stripe";
import { createServerClient } from "@/lib/supabase/server";

const PRICE_ID = "price_1TYWWc090vGdQrrLvppkGoIv";

export async function POST(request: Request) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const origin = new URL(request.url).origin;

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: PRICE_ID, quantity: 1 }],
    customer_email: user.email,
    client_reference_id: user.id,
    success_url: `${origin}/dashboard?upgraded=true`,
    cancel_url:  `${origin}/dashboard`,
    subscription_data: {
      metadata: { user_id: user.id },
    },
  });

  return Response.json({ url: session.url });
}
