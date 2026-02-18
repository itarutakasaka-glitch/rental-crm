import { getCurrentUser } from "@/lib/auth";
import { SidebarNav } from "@/components/layout/sidebar-nav";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  return (
    <div className="flex h-screen">
      <SidebarNav user={user} />
      <main className="flex-1 overflow-auto bg-gray-50">{children}</main>
    </div>
  );
}
