"use client";

import { useState, useEffect } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Loader2, Search, Edit, Users, FileText, Plus,
  Trash2, Eye, Save, Send, ArrowLeft, ExternalLink,
  Crown, Shield, User as UserIcon,
} from "lucide-react";
import { MarkdownEditor } from "@/components/editor/markdown-editor";
import { SEOScore } from "@/components/editor/seo-score";

// ────────────────── TYPES ──────────────────

type UserWithSubscription = {
  id: string;
  email: string;
  name: string | null;
  role: string;
  createdAt: string;
  subscription: {
    id: string;
    plan: string;
    maxWebsites: number;
    maxPostsPerMonth: number;
    maxImagesPerMonth: number;
    websitesUsed: number;
    postsGeneratedThisMonth: number;
    imagesGeneratedThisMonth: number;
  } | null;
};

type OrgMember = {
  id: string;
  role: string;
  createdAt: string;
  user: { id: string; name: string | null; email: string | null; createdAt: string };
};

type BlogPost = {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  status: string;
  category: string | null;
  featuredImage: string | null;
  wordCount: number | null;
  views: number;
  publishedAt: string | null;
  createdAt: string;
};

type PostFormData = {
  title: string;
  slug: string;
  content: string;
  excerpt: string;
  metaTitle: string;
  metaDescription: string;
  focusKeyword: string;
  secondaryKeywords: string[];
  featuredImage: string;
  featuredImageAlt: string;
  tags: string[];
  category: string;
  status: string;
};

// ────────────────── MAIN COMPONENT ──────────────────

export default function AdminClient() {
  return (
    <Tabs defaultValue="users" className="space-y-4">
      <TabsList>
        <TabsTrigger value="users" className="gap-2">
          <Users className="h-4 w-4" />
          Users
        </TabsTrigger>
        <TabsTrigger value="blog" className="gap-2">
          <FileText className="h-4 w-4" />
          StackSerp Blog
        </TabsTrigger>
      </TabsList>

      <TabsContent value="users">
        <UsersTab />
      </TabsContent>

      <TabsContent value="blog">
        <BlogTab />
      </TabsContent>
    </Tabs>
  );
}

// ────────────────── USERS TAB ──────────────────

function UsersTab() {
  const [users, setUsers] = useState<UserWithSubscription[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState<UserWithSubscription | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  const PLAN_LIMITS: Record<string, { maxWebsites: number; maxPosts: number; maxImages: number }> = {
    FREE:       { maxWebsites: 1,   maxPosts: 2,    maxImages: 2 },
    STARTER:    { maxWebsites: 3,   maxPosts: 25,   maxImages: 25 },
    GROWTH:     { maxWebsites: 10,  maxPosts: 100,  maxImages: 100 },
    AGENCY:     { maxWebsites: 50,  maxPosts: 500,  maxImages: 500 },
    ENTERPRISE: { maxWebsites: 999, maxPosts: 9999, maxImages: 9999 },
  };

  const [role, setRole] = useState("USER");
  const [plan, setPlan] = useState("FREE");
  const [maxWebsites, setMaxWebsites] = useState(1);
  const [maxPosts, setMaxPosts] = useState(5);
  const [maxImages, setMaxImages] = useState(5);
  const [websitesUsed, setWebsitesUsed] = useState(0);
  const [postsUsed, setPostsUsed] = useState(0);
  const [imagesUsed, setImagesUsed] = useState(0);
  const [orgMembers, setOrgMembers] = useState<OrgMember[]>([]);
  const [isMembersLoading, setIsMembersLoading] = useState(false);
  const [addMemberEmail, setAddMemberEmail] = useState("");
  const [addMemberRole, setAddMemberRole] = useState("MEMBER");
  const [isAddingMember, setIsAddingMember] = useState(false);
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);

  const handlePlanChange = (newPlan: string) => {
    setPlan(newPlan);
    const limits = PLAN_LIMITS[newPlan];
    if (limits) {
      setMaxWebsites(limits.maxWebsites);
      setMaxPosts(limits.maxPosts);
      setMaxImages(limits.maxImages);
    }
  };

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/admin/users?search=${encodeURIComponent(search)}`);
      if (!res.ok) throw new Error("Failed to fetch users");
      const data = await res.json();
      setUsers(data);
    } catch {
      toast.error("Error loading users");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => { fetchUsers(); }, 500);
    return () => clearTimeout(delayDebounceFn);
  }, [search]);

  const fetchOrgMembers = async (userId: string) => {
    setIsMembersLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${userId}/team`);
      if (res.ok) {
        const data = await res.json();
        setOrgMembers(data.members || []);
      }
    } catch {
      /* silent */
    } finally {
      setIsMembersLoading(false);
    }
  };

  const handleAddMember = async () => {
    if (!addMemberEmail.trim() || !selectedUser) return;
    setIsAddingMember(true);
    try {
      const res = await fetch(`/api/admin/users/${selectedUser.id}/team`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: addMemberEmail.trim(), role: addMemberRole }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`${addMemberEmail} added to team`);
        setAddMemberEmail("");
        fetchOrgMembers(selectedUser.id);
      } else {
        toast.error(data.error || "Failed to add member");
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setIsAddingMember(false);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!selectedUser) return;
    setRemovingMemberId(memberId);
    try {
      const res = await fetch(
        `/api/admin/users/${selectedUser.id}/team?memberId=${memberId}`,
        { method: "DELETE" }
      );
      if (res.ok) {
        toast.success("Member removed");
        fetchOrgMembers(selectedUser.id);
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to remove");
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setRemovingMemberId(null);
    }
  };

  const handleEditClick = (user: UserWithSubscription) => {
    setSelectedUser(user);
    setRole(user.role);
    setAddMemberEmail("");
    setAddMemberRole("MEMBER");
    if (user.subscription) {
      setPlan(user.subscription.plan);
      setMaxWebsites(user.subscription.maxWebsites);
      setMaxPosts(user.subscription.maxPostsPerMonth);
      setMaxImages(user.subscription.maxImagesPerMonth);
      setWebsitesUsed(user.subscription.websitesUsed);
      setPostsUsed(user.subscription.postsGeneratedThisMonth);
      setImagesUsed(user.subscription.imagesGeneratedThisMonth);
    }
    fetchOrgMembers(user.id);
    setIsDialogOpen(true);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;

    setIsUpdating(true);
    try {
      const payload: Record<string, unknown> = { role };
      if (selectedUser.subscription) {
        payload.plan = plan;
        payload.maxWebsites = maxWebsites;
        payload.maxPostsPerMonth = maxPosts;
        payload.maxImagesPerMonth = maxImages;
        payload.websitesUsed = websitesUsed;
        payload.postsGeneratedThisMonth = postsUsed;
        payload.imagesGeneratedThisMonth = imagesUsed;
      }

      const res = await fetch(`/api/admin/users/${selectedUser.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error("Failed to update user");

      toast.success("User updated successfully");
      setIsDialogOpen(false);
      fetchUsers();
    } catch {
      toast.error("Error updating user");
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center space-x-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or email..."
            className="pl-8"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead>Posts Usage</TableHead>
              <TableHead>Images Usage</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center">
                  <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center">
                  No users found.
                </TableCell>
              </TableRow>
            ) : (
              users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>
                    <div className="font-medium">{user.name || "Unknown"}</div>
                    <div className="text-sm text-muted-foreground">{user.email}</div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={user.role === "ADMIN" ? "default" : "secondary"}>
                      {user.role}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {user.subscription ? (
                      <Badge variant="outline">{user.subscription.plan}</Badge>
                    ) : (
                      <span className="text-muted-foreground text-sm">No sub</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {user.subscription ? (
                      <span className="text-sm">
                        {user.subscription.postsGeneratedThisMonth} / {user.subscription.maxPostsPerMonth}
                      </span>
                    ) : "-"}
                  </TableCell>
                  <TableCell>
                    {user.subscription ? (
                      <span className="text-sm">
                        {user.subscription.imagesGeneratedThisMonth} / {user.subscription.maxImagesPerMonth}
                      </span>
                    ) : "-"}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => handleEditClick(user)}>
                      <Edit className="h-4 w-4 mr-2" />
                      Edit
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit User: {selectedUser?.email}</DialogTitle>
          </DialogHeader>
          {selectedUser && (
            <form onSubmit={handleUpdate} className="space-y-4">
              <div className="space-y-2">
                <Label>System Role</Label>
                <Select value={role} onValueChange={setRole}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USER">USER</SelectItem>
                    <SelectItem value="ADMIN">ADMIN</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {selectedUser.subscription && (
                <>
                  <div className="grid grid-cols-2 gap-4 border-t pt-4">
                    <div className="space-y-2">
                      <Label>Subscription Plan</Label>
                      <Select value={plan} onValueChange={handlePlanChange}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="FREE">FREE</SelectItem>
                          <SelectItem value="STARTER">STARTER</SelectItem>
                          <SelectItem value="GROWTH">GROWTH</SelectItem>
                          <SelectItem value="AGENCY">AGENCY</SelectItem>
                          <SelectItem value="ENTERPRISE">ENTERPRISE</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 border-t pt-4">
                    <div className="space-y-2">
                      <Label>Websites (Used / Max)</Label>
                      <div className="flex items-center space-x-2">
                        <Input type="number" value={websitesUsed} onChange={(e) => setWebsitesUsed(Number(e.target.value))} />
                        <span>/</span>
                        <Input type="number" value={maxWebsites} onChange={(e) => setMaxWebsites(Number(e.target.value))} />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Posts (Used / Max)</Label>
                      <div className="flex items-center space-x-2">
                        <Input type="number" value={postsUsed} onChange={(e) => setPostsUsed(Number(e.target.value))} />
                        <span>/</span>
                        <Input type="number" value={maxPosts} onChange={(e) => setMaxPosts(Number(e.target.value))} />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Images (Used / Max)</Label>
                      <div className="flex items-center space-x-2">
                        <Input type="number" value={imagesUsed} onChange={(e) => setImagesUsed(Number(e.target.value))} />
                        <span>/</span>
                        <Input type="number" value={maxImages} onChange={(e) => setMaxImages(Number(e.target.value))} />
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* Team Members */}
              <div className="border-t pt-4 space-y-3">
                <p className="text-sm font-medium flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Team Members
                </p>

                {isMembersLoading ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Loading members…
                  </div>
                ) : orgMembers.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No team members yet.</p>
                ) : (
                  <div className="space-y-1 max-h-36 overflow-y-auto">
                    {orgMembers.map((m) => {
                      const RoleIcon =
                        m.role === "OWNER" ? Crown :
                        m.role === "ADMIN" ? Shield : UserIcon;
                      return (
                        <div key={m.id} className="flex items-center justify-between rounded-md px-2 py-1.5 hover:bg-muted/50 text-sm">
                          <div className="flex items-center gap-2">
                            <RoleIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            <span className="font-medium truncate max-w-[140px]">
                              {m.user.name || m.user.email}
                            </span>
                            <span className="text-xs text-muted-foreground truncate max-w-[120px]">
                              {m.user.name ? m.user.email : ""}
                            </span>
                          </div>
                          {m.role !== "OWNER" && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-muted-foreground hover:text-destructive shrink-0"
                              onClick={() => handleRemoveMember(m.id)}
                              disabled={removingMemberId === m.id}
                            >
                              {removingMemberId === m.id
                                ? <Loader2 className="h-3 w-3 animate-spin" />
                                : <Trash2 className="h-3 w-3" />}
                            </Button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Add member inline */}
                <div className="flex gap-2">
                  <Input
                    type="email"
                    placeholder="Add by email…"
                    value={addMemberEmail}
                    onChange={(e) => setAddMemberEmail(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddMember())}
                    className="flex-1 h-8 text-sm"
                  />
                  <Select value={addMemberRole} onValueChange={setAddMemberRole}>
                    <SelectTrigger className="w-24 h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MEMBER">Member</SelectItem>
                      <SelectItem value="ADMIN">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    size="sm"
                    className="h-8"
                    disabled={isAddingMember || !addMemberEmail.trim()}
                    onClick={handleAddMember}
                  >
                    {isAddingMember ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={isUpdating}>
                  {isUpdating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Save Changes
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ────────────────── BLOG TAB ──────────────────

function BlogTab() {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [websiteId, setWebsiteId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [editingPost, setEditingPost] = useState<string | null>(null); // postId or "new"

  const fetchPosts = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/admin/blog");
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setPosts(data.posts);
      setWebsiteId(data.websiteId);
    } catch {
      toast.error("Failed to load blog posts");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchPosts(); }, []);

  const handleDelete = async (postId: string) => {
    if (!confirm("Delete this post? This cannot be undone.")) return;
    try {
      const res = await fetch(`/api/admin/blog/${postId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed");
      toast.success("Post deleted");
      fetchPosts();
    } catch {
      toast.error("Failed to delete post");
    }
  };

  if (editingPost) {
    return (
      <BlogEditor
        postId={editingPost}
        onBack={() => { setEditingPost(null); fetchPosts(); }}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            Manage blog posts for stackserp.com
            {websiteId && (
              <a
                href={`${window.location.origin}/blogs`}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-2 text-primary hover:underline inline-flex items-center gap-1"
              >
                View Blog <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </p>
        </div>
        <Button onClick={() => setEditingPost("new")}>
          <Plus className="h-4 w-4 mr-2" />
          New Post
        </Button>
      </div>

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Words</TableHead>
              <TableHead>Views</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center">
                  <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : posts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center">
                  <p className="text-muted-foreground">No blog posts yet.</p>
                  <Button variant="link" onClick={() => setEditingPost("new")} className="mt-1">
                    Create your first post
                  </Button>
                </TableCell>
              </TableRow>
            ) : (
              posts.map((post) => (
                <TableRow key={post.id}>
                  <TableCell>
                    <div className="font-medium max-w-[300px] truncate">{post.title}</div>
                    <div className="text-xs text-muted-foreground">/{post.slug}</div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={
                      post.status === "PUBLISHED" ? "default" :
                      post.status === "DRAFT" ? "secondary" : "outline"
                    }>
                      {post.status.toLowerCase()}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-muted-foreground">{post.category || "-"}</span>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm">{post.wordCount || "-"}</span>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm">{post.views}</span>
                  </TableCell>
                  <TableCell>
                    <span className="text-xs text-muted-foreground">
                      {post.publishedAt
                        ? new Date(post.publishedAt).toLocaleDateString()
                        : new Date(post.createdAt).toLocaleDateString()
                      }
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => setEditingPost(post.id)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => window.open(`/blogs/${post.slug}`, "_blank")}
                        disabled={post.status !== "PUBLISHED"}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(post.id)} className="text-destructive hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// ────────────────── BLOG EDITOR ──────────────────

function BlogEditor({ postId, onBack }: { postId: string; onBack: () => void }) {
  const isNew = postId === "new";
  const [isLoading, setIsLoading] = useState(!isNew);
  const [isSaving, setIsSaving] = useState(false);
  const [autoSlug, setAutoSlug] = useState(isNew);
  const [tagInput, setTagInput] = useState("");
  const [currentId, setCurrentId] = useState(isNew ? null : postId);

  const [form, setForm] = useState<PostFormData>({
    title: "",
    slug: "",
    content: "",
    excerpt: "",
    metaTitle: "",
    metaDescription: "",
    focusKeyword: "",
    secondaryKeywords: [],
    featuredImage: "",
    featuredImageAlt: "",
    tags: [],
    category: "",
    status: "DRAFT",
  });

  useEffect(() => {
    if (!isNew) {
      fetch(`/api/admin/blog/${postId}`)
        .then(r => r.json())
        .then(data => {
          setForm({
            title: data.title || "",
            slug: data.slug || "",
            content: data.content || "",
            excerpt: data.excerpt || "",
            metaTitle: data.metaTitle || "",
            metaDescription: data.metaDescription || "",
            focusKeyword: data.focusKeyword || "",
            secondaryKeywords: data.secondaryKeywords || [],
            featuredImage: data.featuredImage || "",
            featuredImageAlt: data.featuredImageAlt || "",
            tags: data.tags || [],
            category: data.category || "",
            status: data.status || "DRAFT",
          });
          setAutoSlug(false);
        })
        .catch(() => toast.error("Failed to load post"))
        .finally(() => setIsLoading(false));
    }
  }, [postId, isNew]);

  const updateField = (field: keyof PostFormData, value: unknown) => {
    setForm(prev => {
      const next = { ...prev, [field]: value };
      if (field === "title" && autoSlug) {
        next.slug = (value as string)
          .toLowerCase()
          .replace(/[^\w\s-]/g, "")
          .replace(/[\s_]+/g, "-")
          .replace(/^-+|-+$/g, "")
          .slice(0, 80);
      }
      return next;
    });
  };

  const wordCount = form.content ? form.content.split(/\s+/).filter(Boolean).length : 0;

  const handleSave = async (statusOverride?: string) => {
    if (!form.title || !form.content) {
      toast.error("Title and content are required");
      return;
    }
    setIsSaving(true);
    try {
      const payload = { ...form, wordCount };
      if (statusOverride) payload.status = statusOverride;

      const isCreating = isNew && !currentId;
      const url = isCreating ? "/api/admin/blog" : `/api/admin/blog/${currentId}`;
      const method = isCreating ? "POST" : "PATCH";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const saved = await res.json();
        if (isCreating) setCurrentId(saved.id);
        setForm(prev => ({ ...prev, status: saved.status }));
        toast.success(statusOverride === "PUBLISHED" ? "Post published!" : "Post saved");
      } else {
        const err = await res.json();
        toast.error(err.error || "Failed to save");
      }
    } catch {
      toast.error("Failed to save post");
    } finally {
      setIsSaving(false);
    }
  };

  const addTag = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && tagInput.trim()) {
      e.preventDefault();
      updateField("tags", [...form.tags, tagInput.trim()]);
      setTagInput("");
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Top Bar */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h2 className="text-xl font-bold">
              {isNew && !currentId ? "New Blog Post" : "Edit Blog Post"}
            </h2>
            <div className="flex items-center gap-2 mt-0.5">
              <Badge variant={
                form.status === "PUBLISHED" ? "default" :
                form.status === "REVIEW" ? "outline" : "secondary"
              }>
                {form.status.toLowerCase()}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {wordCount} words
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => handleSave()} disabled={isSaving}>
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save Draft
          </Button>
          <Button size="sm" onClick={() => handleSave("PUBLISHED")} disabled={isSaving}>
            <Send className="mr-2 h-4 w-4" />
            Publish
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* Main Editor */}
        <div className="space-y-4">
          <Input
            placeholder="Post title..."
            value={form.title}
            onChange={(e) => updateField("title", e.target.value)}
            className="text-2xl font-bold h-14 border-0 border-b rounded-none px-0 focus-visible:ring-0 focus-visible:ring-offset-0"
          />

          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="shrink-0">URL slug:</span>
            <Input
              value={form.slug}
              onChange={(e) => { setAutoSlug(false); updateField("slug", e.target.value); }}
              className="h-7 text-sm"
            />
          </div>

          <MarkdownEditor
            value={form.content}
            onChange={(v) => updateField("content", v)}
            height={500}
          />
        </div>

        {/* Right Sidebar */}
        <div className="space-y-4">
          <Tabs defaultValue="seo">
            <TabsList className="w-full">
              <TabsTrigger value="seo" className="flex-1 text-xs">SEO</TabsTrigger>
              <TabsTrigger value="meta" className="flex-1 text-xs">Meta</TabsTrigger>
              <TabsTrigger value="details" className="flex-1 text-xs">Details</TabsTrigger>
            </TabsList>

            <TabsContent value="seo" className="space-y-4 mt-4">
              <Card>
                <CardContent className="pt-4">
                  <SEOScore
                    title={form.title}
                    content={form.content}
                    metaTitle={form.metaTitle}
                    metaDescription={form.metaDescription}
                    focusKeyword={form.focusKeyword}
                    wordCount={wordCount}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Focus Keyword</CardTitle>
                </CardHeader>
                <CardContent>
                  <Input
                    placeholder="e.g., AI blog generator"
                    value={form.focusKeyword}
                    onChange={(e) => updateField("focusKeyword", e.target.value)}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Publish Settings</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Status</Label>
                    <Select value={form.status} onValueChange={(v) => updateField("status", v)}>
                      <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="DRAFT">Draft</SelectItem>
                        <SelectItem value="REVIEW">Review</SelectItem>
                        <SelectItem value="PUBLISHED">Published</SelectItem>
                        <SelectItem value="ARCHIVED">Archived</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Category</Label>
                    <Input
                      placeholder="e.g., SEO Tips"
                      value={form.category}
                      onChange={(e) => updateField("category", e.target.value)}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Tags (press Enter)</Label>
                    <Input
                      placeholder="Add tag..."
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={addTag}
                      className="h-8 text-sm"
                    />
                    {form.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {form.tags.map((tag) => (
                          <Badge
                            key={tag}
                            variant="secondary"
                            className="text-xs cursor-pointer"
                            onClick={() => updateField("tags", form.tags.filter(t => t !== tag))}
                          >
                            {tag} ×
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="meta" className="space-y-4 mt-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Meta Title</CardTitle>
                </CardHeader>
                <CardContent>
                  <Textarea
                    placeholder="SEO title (under 60 chars)"
                    value={form.metaTitle}
                    onChange={(e) => updateField("metaTitle", e.target.value)}
                    rows={2}
                    className="text-sm resize-none"
                  />
                  <p className="text-xs text-muted-foreground mt-1">{form.metaTitle.length}/60</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Meta Description</CardTitle>
                </CardHeader>
                <CardContent>
                  <Textarea
                    placeholder="Meta description (under 155 chars)"
                    value={form.metaDescription}
                    onChange={(e) => updateField("metaDescription", e.target.value)}
                    rows={3}
                    className="text-sm resize-none"
                  />
                  <p className="text-xs text-muted-foreground mt-1">{form.metaDescription.length}/155</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Excerpt</CardTitle>
                </CardHeader>
                <CardContent>
                  <Textarea
                    placeholder="Short post summary..."
                    value={form.excerpt}
                    onChange={(e) => updateField("excerpt", e.target.value)}
                    rows={3}
                    className="text-sm resize-none"
                  />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="details" className="space-y-4 mt-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Featured Image</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {form.featuredImage && (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={form.featuredImage}
                      alt={form.featuredImageAlt || "Featured image"}
                      className="w-full rounded-lg aspect-video object-cover"
                    />
                  )}
                  <Input
                    placeholder="Image URL"
                    value={form.featuredImage}
                    onChange={(e) => updateField("featuredImage", e.target.value)}
                    className="text-xs h-8"
                  />
                  <Input
                    placeholder="Alt text"
                    value={form.featuredImageAlt}
                    onChange={(e) => updateField("featuredImageAlt", e.target.value)}
                    className="text-xs h-8"
                  />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
