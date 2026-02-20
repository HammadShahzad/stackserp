import { getCurrentOrganization } from "@/lib/get-session";
import { PLANS } from "@/lib/stripe";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Check,
  X,
  Globe,
  FileText,
  Image,
  Users,
  Zap,
  Crown,
} from "lucide-react";
import { UpgradeButton, ManageButton } from "./billing-client";

export default async function BillingPage() {
  const { organization } = await getCurrentOrganization();
  const subscription = organization.subscription;
  const currentPlan = subscription?.plan || "FREE";

  const planOrder = ["FREE", "STARTER", "GROWTH", "AGENCY"] as const;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Billing</h2>
        <p className="text-muted-foreground mt-1">
          Manage your subscription and billing
        </p>
      </div>

      {/* Current Plan Summary */}
      {subscription && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Current Plan</CardTitle>
                <CardDescription>
                  Your active subscription details
                </CardDescription>
              </div>
              <Badge className="text-sm px-3 py-1">
                {PLANS[currentPlan as keyof typeof PLANS]?.name || currentPlan}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 md:grid-cols-4">
              <div className="text-center p-4 rounded-lg bg-muted/50">
                <Globe className="h-5 w-5 mx-auto mb-2 text-muted-foreground" />
                <p className="text-2xl font-bold">
                  {subscription.websitesUsed}/{subscription.maxWebsites}
                </p>
                <p className="text-sm text-muted-foreground">Websites</p>
              </div>
              <div className="text-center p-4 rounded-lg bg-muted/50">
                <FileText className="h-5 w-5 mx-auto mb-2 text-muted-foreground" />
                <p className="text-2xl font-bold">
                  {subscription.postsGeneratedThisMonth}/{subscription.maxPostsPerMonth}
                </p>
                <p className="text-sm text-muted-foreground">Posts this month</p>
              </div>
              <div className="text-center p-4 rounded-lg bg-muted/50">
                <Image className="h-5 w-5 mx-auto mb-2 text-muted-foreground" />
                <p className="text-2xl font-bold">
                  {subscription.imagesGeneratedThisMonth}/{subscription.maxImagesPerMonth}
                </p>
                <p className="text-sm text-muted-foreground">Images this month</p>
              </div>
              <div className="text-center p-4 rounded-lg bg-muted/50">
                <Zap className="h-5 w-5 mx-auto mb-2 text-muted-foreground" />
                <p className="text-2xl font-bold capitalize">
                  {subscription.status.toLowerCase()}
                </p>
                <p className="text-sm text-muted-foreground">Status</p>
              </div>
            </div>
          </CardContent>
          <CardFooter>
            <ManageButton />
          </CardFooter>
        </Card>
      )}

      {/* Pricing Plans */}
      <div>
        <h3 className="text-xl font-semibold mb-4">Available Plans</h3>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {planOrder.map((planKey) => {
            const plan = PLANS[planKey];
            const isCurrent = currentPlan === planKey;
            const isPopular = planKey === "GROWTH";

            return (
              <Card
                key={planKey}
                className={`relative ${
                  isPopular ? "border-primary shadow-lg" : ""
                } ${isCurrent ? "ring-2 ring-primary" : ""}`}
              >
                {isPopular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-primary">Most Popular</Badge>
                  </div>
                )}
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    {planKey === "AGENCY" && <Crown className="h-5 w-5 text-yellow-500" />}
                    {plan.name}
                  </CardTitle>
                  <div className="mt-2">
                    <span className="text-3xl font-bold">
                      ${plan.price}
                    </span>
                    {plan.price > 0 && (
                      <span className="text-muted-foreground">/mo</span>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <PlanFeature
                    icon={<Globe className="h-4 w-4" />}
                    text={`${plan.features.maxWebsites} website${plan.features.maxWebsites !== 1 ? "s" : ""}`}
                  />
                  <PlanFeature
                    icon={<FileText className="h-4 w-4" />}
                    text={`${plan.features.maxPostsPerMonth} posts/month`}
                  />
                  <PlanFeature
                    icon={<Image className="h-4 w-4" />}
                    text={`${plan.features.maxImagesPerMonth} AI images/month`}
                  />
                  <PlanFeature
                    icon={plan.features.apiAccess ? <Check className="h-4 w-4 text-green-600" /> : <X className="h-4 w-4 text-muted-foreground" />}
                    text="API Access"
                    enabled={plan.features.apiAccess}
                  />
                  <PlanFeature
                    icon={plan.features.cmsPush ? <Check className="h-4 w-4 text-green-600" /> : <X className="h-4 w-4 text-muted-foreground" />}
                    text="CMS Push"
                    enabled={plan.features.cmsPush}
                  />
                  <PlanFeature
                    icon={plan.features.socialPublishing ? <Check className="h-4 w-4 text-green-600" /> : <X className="h-4 w-4 text-muted-foreground" />}
                    text="Social Publishing"
                    enabled={plan.features.socialPublishing}
                  />
                  <PlanFeature
                    icon={<Users className="h-4 w-4" />}
                    text={`${plan.features.teamMembers === -1 ? "Unlimited" : plan.features.teamMembers} team member${plan.features.teamMembers !== 1 ? "s" : ""}`}
                  />
                </CardContent>
                <CardFooter>
                  {isCurrent ? (
                    <Button className="w-full" variant="outline" disabled>
                      Current Plan
                    </Button>
                  ) : planKey === "FREE" ? (
                    <ManageButton />
                  ) : (
                    <UpgradeButton
                      planKey={planKey}
                      isUpgrade={
                        planOrder.indexOf(planKey) >
                        planOrder.indexOf(currentPlan as typeof planOrder[number])
                      }
                    />
                  )}
                </CardFooter>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function PlanFeature({
  icon,
  text,
  enabled = true,
}: {
  icon: React.ReactNode;
  text: string;
  enabled?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-2 text-sm ${
        enabled ? "" : "text-muted-foreground"
      }`}
    >
      {icon}
      <span>{text}</span>
    </div>
  );
}
