import { NextRequest, NextResponse } from "next/server";
import { getStripe, PLANS, PlanKey } from "@/lib/stripe";
import prisma from "@/lib/prisma";
import Stripe from "stripe";

export const dynamic = "force-dynamic";

function getPlanByPriceId(priceId: string): { key: PlanKey; plan: (typeof PLANS)[PlanKey] } | null {
  for (const [key, plan] of Object.entries(PLANS)) {
    if (plan.priceId && plan.priceId === priceId) {
      return { key: key as PlanKey, plan };
    }
  }
  return null;
}

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("[STRIPE_WEBHOOK] STRIPE_WEBHOOK_SECRET is not configured");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }

  let event: Stripe.Event;

  try {
    const stripe = getStripe();
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[STRIPE_WEBHOOK] Signature verification failed:", message);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;

        const userId = session.metadata?.userId;
        const organizationId = session.metadata?.organizationId;
        const planKey = session.metadata?.planKey as PlanKey | undefined;

        if (!userId || !organizationId || !planKey) {
          console.error("[STRIPE_WEBHOOK] Missing metadata on checkout session");
          break;
        }

        const stripeSubscriptionId =
          typeof session.subscription === "string"
            ? session.subscription
            : session.subscription?.id;

        const stripeCustomerId =
          typeof session.customer === "string"
            ? session.customer
            : session.customer?.id;

        if (!stripeSubscriptionId || !stripeCustomerId) {
          console.error("[STRIPE_WEBHOOK] Missing subscription or customer ID");
          break;
        }

        const matchedPlan = PLANS[planKey];
        if (!matchedPlan) {
          console.error("[STRIPE_WEBHOOK] Unknown plan key:", planKey);
          break;
        }

        await prisma.subscription.upsert({
          where: { userId },
          update: {
            stripeCustomerId,
            stripeSubscriptionId,
            plan: planKey,
            status: "ACTIVE",
            maxWebsites: matchedPlan.features.maxWebsites,
            maxPostsPerMonth: matchedPlan.features.maxPostsPerMonth,
            maxImagesPerMonth: matchedPlan.features.maxImagesPerMonth,
          },
          create: {
            stripeCustomerId,
            stripeSubscriptionId,
            plan: planKey,
            status: "ACTIVE",
            maxWebsites: matchedPlan.features.maxWebsites,
            maxPostsPerMonth: matchedPlan.features.maxPostsPerMonth,
            maxImagesPerMonth: matchedPlan.features.maxImagesPerMonth,
            organizationId,
            userId,
          },
        });

        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;

        const existing = await prisma.subscription.findUnique({
          where: { stripeSubscriptionId: subscription.id },
        });

        if (!existing) {
          console.error("[STRIPE_WEBHOOK] No subscription found for:", subscription.id);
          break;
        }

        const priceId = subscription.items.data[0]?.price?.id;
        const matched = priceId ? getPlanByPriceId(priceId) : null;

        const statusMap: Record<string, string> = {
          active: "ACTIVE",
          past_due: "PAST_DUE",
          canceled: "CANCELLED",
          trialing: "TRIALING",
          paused: "PAUSED",
        };

        const mappedStatus = statusMap[subscription.status] || "ACTIVE";
        const subObj = subscription as unknown as Record<string, unknown>;
        const periodEnd = typeof subObj.current_period_end === "number"
          ? new Date(subObj.current_period_end * 1000)
          : undefined;

        await prisma.subscription.update({
          where: { stripeSubscriptionId: subscription.id },
          data: {
            status: mappedStatus as "ACTIVE" | "PAST_DUE" | "CANCELLED" | "TRIALING" | "PAUSED",
            cancelAtPeriodEnd: subscription.cancel_at_period_end,
            ...(periodEnd && { currentPeriodEnd: periodEnd }),
            ...(matched && {
              plan: matched.key,
              maxWebsites: matched.plan.features.maxWebsites,
              maxPostsPerMonth: matched.plan.features.maxPostsPerMonth,
              maxImagesPerMonth: matched.plan.features.maxImagesPerMonth,
            }),
          },
        });

        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;

        await prisma.subscription.updateMany({
          where: { stripeSubscriptionId: subscription.id },
          data: {
            status: "CANCELLED",
            cancelAtPeriodEnd: false,
          },
        });

        break;
      }

      case "invoice.payment_failed": {
        const invoiceObj = event.data.object as unknown as Record<string, unknown>;
        const rawSub = invoiceObj.subscription;
        const subId = typeof rawSub === "string"
          ? rawSub
          : (rawSub as { id?: string } | null)?.id;

        if (subId) {
          await prisma.subscription.updateMany({
            where: { stripeSubscriptionId: subId },
            data: { status: "PAST_DUE" },
          });
        }

        break;
      }

      default:
        break;
    }
  } catch (error) {
    console.error("[STRIPE_WEBHOOK] Error processing event:", error);
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
