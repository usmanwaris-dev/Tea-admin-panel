import { redirect } from "next/navigation";
import { getCurrentAdmin } from "@/lib/auth";
import { getKpis } from "@/lib/data/repo";
import { IS_MOCK } from "@/lib/supabase/config";
import { Sidebar } from "@/components/shell/sidebar";
import { Topbar } from "@/components/shell/topbar";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/login");

  const kpis = await getKpis();

  return (
    <div className="flex min-h-screen">
      <Sidebar pendingReports={kpis.pending_reports} adminEmail={admin.email} isMock={IS_MOCK} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar adminEmail={admin.email} pendingReports={kpis.pending_reports} />
        <main className="flex-1 px-4 py-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
