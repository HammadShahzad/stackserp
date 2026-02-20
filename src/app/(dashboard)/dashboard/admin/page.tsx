import { redirect } from "next/navigation";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import AdminClient from "./admin-client";

export const metadata = {
  title: "Admin Panel | StackSerp",
};

export default async function AdminPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user || session.user.systemRole !== "ADMIN") {
    redirect("/dashboard");
  }

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Admin Dashboard</h2>
      </div>
      <AdminClient />
    </div>
  );
}
