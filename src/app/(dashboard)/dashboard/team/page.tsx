"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Users,
  UserPlus,
  Trash2,
  Loader2,
  Crown,
  Shield,
  User,
  Mail,
  ArrowRight,
  Info,
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

interface Member {
  id: string;
  role: string;
  createdAt: string;
  user: {
    id: string;
    name: string | null;
    email: string | null;
    createdAt: string;
  };
}

const ROLE_ICONS: Record<string, React.ReactNode> = {
  OWNER: <Crown className="h-3.5 w-3.5 text-yellow-500" />,
  ADMIN: <Shield className="h-3.5 w-3.5 text-blue-500" />,
  MEMBER: <User className="h-3.5 w-3.5 text-muted-foreground" />,
};

const ROLE_COLORS: Record<string, string> = {
  OWNER: "bg-yellow-50 text-yellow-700 border-yellow-200",
  ADMIN: "bg-blue-50 text-blue-700 border-blue-200",
  MEMBER: "bg-muted text-muted-foreground",
};

const PLAN_LIMITS: Record<string, number> = {
  FREE: 1,
  STARTER: 3,
  GROWTH: 10,
  AGENCY: -1,
};

export default function TeamPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [currentUserId, setCurrentUserId] = useState("");
  const [myRole, setMyRole] = useState("MEMBER");
  const [plan, setPlan] = useState("FREE");
  const [isSysAdmin, setIsSysAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isInviting, setIsInviting] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [showInviteForm, setShowInviteForm] = useState(false);

  const fetchTeam = useCallback(async () => {
    try {
      const res = await fetch("/api/team");
      if (res.ok) {
        const data = await res.json();
        setMembers(data.members);
        setCurrentUserId(data.currentUserId);
        setMyRole(data.role);
        setPlan(data.plan);
        setIsSysAdmin(data.isSystemAdmin || false);
      }
    } catch {
      toast.error("Failed to load team");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTeam();
  }, [fetchTeam]);

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return;
    setIsInviting(true);
    try {
      const res = await fetch("/api/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail.trim() }),
      });

      const data = await res.json();

      if (res.ok) {
        toast.success(`${inviteEmail} added to your team`);
        setInviteEmail("");
        setShowInviteForm(false);
        fetchTeam();
      } else {
        toast.error(data.error || "Failed to add member");
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setIsInviting(false);
    }
  };

  const handleRemove = async (memberId: string, memberName: string | null) => {
    setRemovingId(memberId);
    try {
      const res = await fetch(`/api/team/${memberId}`, { method: "DELETE" });
      const data = await res.json();

      if (res.ok) {
        toast.success(`${memberName || "Member"} removed from team`);
        fetchTeam();
      } else {
        toast.error(data.error || "Failed to remove member");
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setRemovingId(null);
    }
  };

  const maxMembers = PLAN_LIMITS[plan] ?? 1;
  const isOwnerOrAdmin = myRole === "OWNER" || myRole === "ADMIN";
  const canInvite =
    isOwnerOrAdmin &&
    (isSysAdmin || maxMembers === -1 || members.length < maxMembers);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Team</h2>
          <p className="text-muted-foreground mt-1">
            Manage team members who have access to your workspace
          </p>
        </div>
        {isOwnerOrAdmin && (
          <Button
            onClick={() => setShowInviteForm((v) => !v)}
            disabled={!canInvite}
          >
            <UserPlus className="mr-2 h-4 w-4" />
            Add Member
          </Button>
        )}
      </div>

      {/* Plan limit warning — hidden for system admins who bypass limits */}
      {!isSysAdmin && maxMembers !== -1 && members.length >= maxMembers && isOwnerOrAdmin && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <Info className="h-5 w-5 text-amber-600 shrink-0" />
              <div>
                <p className="font-medium text-amber-800 text-sm">
                  Team limit reached ({members.length}/{maxMembers} members)
                </p>
                <p className="text-xs text-amber-700">
                  Upgrade your plan to add more team members
                </p>
              </div>
            </div>
            <Button asChild size="sm" variant="outline" className="border-amber-300 text-amber-800">
              <Link href="/dashboard/billing">
                Upgrade
                <ArrowRight className="ml-1 h-3 w-3" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Invite Form */}
      {showInviteForm && canInvite && (
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Mail className="h-4 w-4" />
              Add Team Member
            </CardTitle>
            <CardDescription>
              They must already have an account on this platform
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-3">
              <div className="flex-1 space-y-1">
                <Label htmlFor="inviteEmail" className="sr-only">
                  Email address
                </Label>
                <Input
                  id="inviteEmail"
                  type="email"
                  placeholder="colleague@example.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleInvite()}
                />
              </div>
              <Button onClick={handleInvite} disabled={isInviting || !inviteEmail.trim()}>
                {isInviting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Add"
                )}
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setShowInviteForm(false);
                  setInviteEmail("");
                }}
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Members List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Members
            <Badge variant="secondary" className="ml-1">
              {members.length}
              {maxMembers !== -1 ? `/${maxMembers}` : ""}
            </Badge>
          </CardTitle>
          <CardDescription>
            Everyone with access to your workspace
          </CardDescription>
        </CardHeader>
        <CardContent>
          {members.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <Users className="h-10 w-10 text-muted-foreground/40 mb-3" />
              <p className="text-muted-foreground text-sm">No team members yet</p>
            </div>
          ) : (
            <div className="space-y-1">
              {members.map((member, i) => (
                <div key={member.id}>
                  {i > 0 && <Separator />}
                  <div className="flex items-center justify-between py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-semibold">
                        {member.user.name
                          ? member.user.name
                              .split(" ")
                              .map((n) => n[0])
                              .join("")
                              .toUpperCase()
                              .slice(0, 2)
                          : member.user.email?.[0]?.toUpperCase() || "?"}
                      </div>
                      <div>
                        <p className="text-sm font-medium">
                          {member.user.name || "No name"}
                          {member.user.id === currentUserId && (
                            <span className="ml-2 text-xs text-muted-foreground">
                              (you)
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {member.user.email}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className={`text-xs gap-1 ${ROLE_COLORS[member.role] || ""}`}
                      >
                        {ROLE_ICONS[member.role]}
                        {member.role.charAt(0) + member.role.slice(1).toLowerCase()}
                      </Badge>

                      {isOwnerOrAdmin &&
                        member.user.id !== currentUserId &&
                        member.role !== "OWNER" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-destructive"
                            onClick={() =>
                              handleRemove(member.id, member.user.name)
                            }
                            disabled={removingId === member.id}
                          >
                            {removingId === member.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="h-3.5 w-3.5" />
                            )}
                          </Button>
                        )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Role explanation */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Roles & Permissions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[
            {
              role: "OWNER",
              icon: <Crown className="h-4 w-4 text-yellow-500" />,
              desc: "Full access including billing, team management, and all website controls",
            },
            {
              role: "ADMIN",
              icon: <Shield className="h-4 w-4 text-blue-500" />,
              desc: "Can manage websites, generate content, and invite members",
            },
            {
              role: "MEMBER",
              icon: <User className="h-4 w-4 text-muted-foreground" />,
              desc: "Can view and edit content but cannot manage team or billing",
            },
          ].map(({ role, icon, desc }) => (
            <div key={role} className="flex items-start gap-3">
              <div className="mt-0.5">{icon}</div>
              <div>
                <p className="text-sm font-medium">{role.charAt(0) + role.slice(1).toLowerCase()}</p>
                <p className="text-xs text-muted-foreground">{desc}</p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
