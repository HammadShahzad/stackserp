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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Search, Edit } from "lucide-react";

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

export default function AdminClient() {
  const [users, setUsers] = useState<UserWithSubscription[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState<UserWithSubscription | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  // Form states
  const [role, setRole] = useState("USER");
  const [plan, setPlan] = useState("FREE");
  const [maxWebsites, setMaxWebsites] = useState(1);
  const [maxPosts, setMaxPosts] = useState(5);
  const [maxImages, setMaxImages] = useState(5);
  const [websitesUsed, setWebsitesUsed] = useState(0);
  const [postsUsed, setPostsUsed] = useState(0);
  const [imagesUsed, setImagesUsed] = useState(0);

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/admin/users?search=${encodeURIComponent(search)}`);
      if (!res.ok) throw new Error("Failed to fetch users");
      const data = await res.json();
      setUsers(data);
    } catch (error) {
      toast.error("Error loading users");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Debounce search
    const delayDebounceFn = setTimeout(() => {
      fetchUsers();
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [search]);

  const handleEditClick = (user: UserWithSubscription) => {
    setSelectedUser(user);
    setRole(user.role);
    if (user.subscription) {
      setPlan(user.subscription.plan);
      setMaxWebsites(user.subscription.maxWebsites);
      setMaxPosts(user.subscription.maxPostsPerMonth);
      setMaxImages(user.subscription.maxImagesPerMonth);
      setWebsitesUsed(user.subscription.websitesUsed);
      setPostsUsed(user.subscription.postsGeneratedThisMonth);
      setImagesUsed(user.subscription.imagesGeneratedThisMonth);
    }
    setIsDialogOpen(true);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;

    setIsUpdating(true);
    try {
      const payload: any = { role };
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
    } catch (error) {
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
                    ) : (
                      "-"
                    )}
                  </TableCell>
                  <TableCell>
                    {user.subscription ? (
                      <span className="text-sm">
                        {user.subscription.imagesGeneratedThisMonth} / {user.subscription.maxImagesPerMonth}
                      </span>
                    ) : (
                      "-"
                    )}
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
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
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
                      <Select value={plan} onValueChange={setPlan}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
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
                        <Input
                          type="number"
                          value={websitesUsed}
                          onChange={(e) => setWebsitesUsed(Number(e.target.value))}
                        />
                        <span>/</span>
                        <Input
                          type="number"
                          value={maxWebsites}
                          onChange={(e) => setMaxWebsites(Number(e.target.value))}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Posts (Used / Max)</Label>
                      <div className="flex items-center space-x-2">
                        <Input
                          type="number"
                          value={postsUsed}
                          onChange={(e) => setPostsUsed(Number(e.target.value))}
                        />
                        <span>/</span>
                        <Input
                          type="number"
                          value={maxPosts}
                          onChange={(e) => setMaxPosts(Number(e.target.value))}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Images (Used / Max)</Label>
                      <div className="flex items-center space-x-2">
                        <Input
                          type="number"
                          value={imagesUsed}
                          onChange={(e) => setImagesUsed(Number(e.target.value))}
                        />
                        <span>/</span>
                        <Input
                          type="number"
                          value={maxImages}
                          onChange={(e) => setMaxImages(Number(e.target.value))}
                        />
                      </div>
                    </div>
                  </div>
                </>
              )}

              <div className="flex justify-end space-x-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
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
