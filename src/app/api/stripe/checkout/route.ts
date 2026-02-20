import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getStripe, PLANS, PlanKey } from "@/lib/stripe";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { planKey } = (await req.json()) as { planKey: string };

    if (!planKey || !PLANS[planKey as PlanKey]) {
      return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
    }

    const plan = PLANS[planKey as PlanKey];
    if (!plan.priceId) {
      return NextResponse.json(
        { error: "Cannot checkout for the free plan" },
        { status: 400 },
      );
    }

    const subscription = await prisma.subscription.findUnique({
      where: { userId: session.user.id },
    });

    if (!subscription) {
      return NextResponse.json(
        { error: "No subscription record found" },
        { status: 404 },
      );
    }

    const stripe = getStripe();

    let stripeCustomerId = subscription.stripeCustomerId;

    if (stripeCustomerId.startsWith("temp_")) {
      const customer = await stripe.customers.create({
        email: session.user.email!,
        name: session.user.name ?? undefined,
        metadata: {
          userId: session.user.id,
          organizationId: subscription.organizationId,
        },
      });

      await prisma.subscription.update({
        where: { id: subscription.id },
        data: { stripeCustomerId: customer.id },
      });

      stripeCustomerId = customer.id;
    }

    const origin = req.headers.get("origin") || process.env.NEXTAUTH_URL || "";

    const checkoutSession = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      mode: "subscription",
      line_items: [{ price: plan.priceId, quantity: 1 }],
      success_url: `${origin}/dashboard/billing?success=true`,
      cancel_url: `${origin}/dashboard/billing?canceled=true`,
      metadata: {
        userId: session.user.id,
        organizationId: subscription.organizationId,
        planKey,
      },
    });

    return NextResponse.json({ url: checkoutSession.url });
  } catch (error) {
    console.error("[STRIPE_CHECKOUT]", error);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 },
    );
  }
}
