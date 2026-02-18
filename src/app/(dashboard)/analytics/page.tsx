import { getCurrentUser } from "@/lib/auth";
import { getAnalytics } from "@/actions/analytics";
import { AnalyticsDashboard } from "@/components/analytics/analytics-dashboard";

export default async function AnalyticsPage() {
  const user = await getCurrentUser();
  const data = await getAnalytics(user.organizationId);
  return <AnalyticsDashboard data={data} />;
}
