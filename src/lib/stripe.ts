import Stripe from "stripe";

let _stripe: Stripe | null = null;

export function getStripe() {
  if (!_stripe) {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error("STRIPE_SECRET_KEY is not configured");
    }
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  }
  return _stripe;
}

export const PLANS = {
  FREE: {
    name: "Free",
    price: 0,
    priceId: null,
    features: {
      maxWebsites: 1,
      maxPostsPerMonth: 2,
      maxImagesPerMonth: 2,
      apiAccess: false,
      cmsPush: false,
      socialPublishing: false,
      topicClustersPerMonth: 0,
      teamMembers: 1,
      support: "community",
      whiteLabel: false,
    },
  },
  STARTER: {
    name: "Starter",
    price: 29,
    priceId: process.env.STRIPE_STARTER_PRICE_ID,
    features: {
      maxWebsites: 3,
      maxPostsPerMonth: 20,
      maxImagesPerMonth: 20,
      apiAccess: true,
      cmsPush: true, // WordPress only
      socialPublishing: true, // 1 platform
      topicClustersPerMonth: 2,
      teamMembers: 3,
      support: "email",
      whiteLabel: false,
    },
  },
  GROWTH: {
    name: "Growth",
    price: 79,
    priceId: process.env.STRIPE_GROWTH_PRICE_ID,
    features: {
      maxWebsites: 10,
      maxPostsPerMonth: 60,
      maxImagesPerMonth: 60,
      apiAccess: true,
      cmsPush: true, // All CMS
      socialPublishing: true, // All platforms
      topicClustersPerMonth: 10,
      teamMembers: 10,
      support: "priority",
      whiteLabel: false,
    },
  },
  AGENCY: {
    name: "Agency",
    price: 199,
    priceId: process.env.STRIPE_AGENCY_PRICE_ID,
    features: {
      maxWebsites: 50,
      maxPostsPerMonth: 200,
      maxImagesPerMonth: 200,
      apiAccess: true,
      cmsPush: true,
      socialPublishing: true,
      topicClustersPerMonth: -1, // Unlimited
      teamMembers: -1, // Unlimited
      support: "dedicated",
      whiteLabel: true,
    },
  },
} as const;

export type PlanKey = keyof typeof PLANS;
