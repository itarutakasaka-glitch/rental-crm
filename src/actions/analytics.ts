"use server";
import { prisma } from "@/lib/db/prisma";

export type AnalyticsData = {
  totalCustomers: number; needActionCount: number; lineLinkedCount: number;
  monthInquiries: number; monthVisits: number; avgResponseHours: number | null;
  statusBreakdown: { name: string; color: string; count: number }[];
  portalBreakdown: { portal: string; count: number }[];
  monthlyTrend: { month: string; count: number }[];
  channelBreakdown: { channel: string; outbound: number; inbound: number }[];
  assigneeBreakdown: { name: string; total: number; needAction: number }[];
  workflowStats: { total: number; running: number; completed: number; stopped: number };
  weekSchedules: number;
};

export async function getAnalytics(organizationId: string): Promise<AnalyticsData> {
  const now = new Date(); const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
  const weekStart = new Date(now); weekStart.setDate(now.getDate() - ((now.getDay() + 6) % 7)); weekStart.setHours(0,0,0,0);
  const weekEnd = new Date(weekStart); weekEnd.setDate(weekStart.getDate() + 7);

  const [totalCustomers, needActionCount, lineLinkedCount, monthInquiries, statuses, customers, messages, monthlyCustomers, workflowRuns, weekSchedules] = await Promise.all([
    prisma.customer.count({ where: { organizationId } }),
    prisma.customer.count({ where: { organizationId, isNeedAction: true } }),
    prisma.customer.count({ where: { organizationId, lineUserId: { not: null } } }),
    prisma.customer.count({ where: { organizationId, createdAt: { gte: monthStart } } }),
    prisma.status.findMany({ where: { organizationId }, orderBy: { order: "asc" }, include: { _count: { select: { customers: true } } } }),
    prisma.customer.findMany({ where: { organizationId }, select: { sourcePortal: true, isNeedAction: true, assignee: { select: { name: true } } } }),
    prisma.message.findMany({ where: { customer: { organizationId } }, select: { channel: true, direction: true } }),
    prisma.customer.findMany({ where: { organizationId, createdAt: { gte: sixMonthsAgo } }, select: { createdAt: true } }),
    prisma.workflowRun.findMany({ where: { workflow: { organizationId } }, select: { status: true } }),
    prisma.schedule.count({ where: { organizationId, startAt: { gte: weekStart, lt: weekEnd } } }),
  ]);

  const monthVisits = await prisma.schedule.count({ where: { organizationId, type: { in: ["VISIT","VIEWING"] }, startAt: { gte: monthStart } } });

  const statusBreakdown = statuses.map((s: any) => ({ name: s.name, color: s.color, count: s._count.customers }));
  const portalMap: Record<string,number> = {}; customers.forEach((c: any) => { const p = c.sourcePortal||"不明"; portalMap[p]=(portalMap[p]||0)+1; });
  const portalBreakdown = Object.entries(portalMap).map(([portal,count]) => ({portal,count})).sort((a,b) => b.count-a.count);

  const monthMap: Record<string,number> = {};
  for (let i=5;i>=0;i--) { const d=new Date(now.getFullYear(),now.getMonth()-i,1); monthMap[`${d.getFullYear()}/${d.getMonth()+1}`]=0; }
  monthlyCustomers.forEach((c: any) => { const d=new Date(c.createdAt); const k=`${d.getFullYear()}/${d.getMonth()+1}`; if(monthMap[k]!==undefined)monthMap[k]++; });
  const monthlyTrend = Object.entries(monthMap).map(([month,count]) => ({month,count}));

  const chMap: Record<string,{outbound:number;inbound:number}> = {};
  messages.forEach((m: any) => { if(!chMap[m.channel])chMap[m.channel]={outbound:0,inbound:0}; if(m.direction==="OUTBOUND")chMap[m.channel].outbound++;else chMap[m.channel].inbound++; });
  const channelBreakdown = Object.entries(chMap).map(([channel,d]) => ({channel,...d}));

  const assigneeMap: Record<string,{name:string;total:number;needAction:number}> = {};
  customers.forEach((c: any) => { const n=c.assignee?.name||"未割当"; if(!assigneeMap[n])assigneeMap[n]={name:n,total:0,needAction:0}; assigneeMap[n].total++; if(c.isNeedAction)assigneeMap[n].needAction++; });
  const assigneeBreakdown = Object.values(assigneeMap).sort((a,b) => b.total-a.total);

  const wfStats = {total:workflowRuns.length, running:0, completed:0, stopped:0};
  workflowRuns.forEach((r: any) => { if(r.status==="RUNNING")wfStats.running++; else if(r.status==="COMPLETED")wfStats.completed++; else wfStats.stopped++; });

  return { totalCustomers, needActionCount, lineLinkedCount, monthInquiries, monthVisits, avgResponseHours:null, statusBreakdown, portalBreakdown, monthlyTrend, channelBreakdown, assigneeBreakdown, workflowStats:wfStats, weekSchedules };
}
