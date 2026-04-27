import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import {
  Wallet,
  Users,
  TrendingUp,
  Calendar,
  Clock,
  BarChart3,
  PieChart as PieChartIcon,
  Trophy,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
} from "lucide-react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { useAuth } from "@/contexts/AuthContext";
import { ReportService } from "@/integrations/mysql/services";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";

type Period = "week" | "month" | "year";

const PIE_COLORS = [
  "hsl(43 74% 58%)",
  "hsl(200 80% 55%)",
  "hsl(340 75% 55%)",
  "hsl(142 65% 48%)",
  "hsl(270 60% 60%)",
  "hsl(25 90% 55%)",
  "hsl(180 60% 45%)",
];

const Reports = () => {
  const { user } = useAuth();
  const [period, setPeriod] = useState<Period>("month");
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<any>(null);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [typeBreakdown, setTypeBreakdown] = useState<any[]>([]);
  const [topWorkshops, setTopWorkshops] = useState<any[]>([]);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [sum, time, types, top] = await Promise.all([
        ReportService.getEarningsSummary(user.id, period),
        ReportService.getEarningsOverTime(user.id, period),
        ReportService.getWorkshopTypeBreakdown(user.id, period),
        ReportService.getTopWorkshops(user.id, period),
      ]);
      setSummary(sum);
      setTimeline(Array.isArray(time) ? time : []);
      setTypeBreakdown(Array.isArray(types) ? types : []);
      setTopWorkshops(Array.isArray(top) ? top : []);
    } catch (err) {
      console.error("Failed to load reports:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, period]);

  const periodLabel = period === "week" ? "This Week" : period === "month" ? "This Month" : "This Year";

  return (
    <div className="space-y-8 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground mb-1 uppercase tracking-widest font-medium opacity-70">
            Analytics
          </p>
          <h1 className="font-display text-4xl md:text-5xl font-bold tracking-tight">
            Your <span className="text-gold-gradient">Reports</span>
          </h1>
        </div>

        <Tabs value={period} onValueChange={(v) => setPeriod(v as Period)}>
          <TabsList className="bg-secondary/50 border border-border/50">
            <TabsTrigger value="week" className="data-[state=active]:bg-gold/20 data-[state=active]:text-gold text-xs px-4">
              Weekly
            </TabsTrigger>
            <TabsTrigger value="month" className="data-[state=active]:bg-gold/20 data-[state=active]:text-gold text-xs px-4">
              Monthly
            </TabsTrigger>
            <TabsTrigger value="year" className="data-[state=active]:bg-gold/20 data-[state=active]:text-gold text-xs px-4">
              Yearly
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {loading ? (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-32 rounded-2xl" />)}
          </div>
          <Skeleton className="h-80 rounded-2xl" />
          <div className="grid lg:grid-cols-2 gap-6">
            <Skeleton className="h-72 rounded-2xl" />
            <Skeleton className="h-72 rounded-2xl" />
          </div>
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <SummaryCard
              icon={Wallet}
              label="Total Earned"
              value={`${user?.profile?.currency || 'USD'} ${Number(summary?.total_earned || 0).toLocaleString()}`}
              accent
              subtitle={periodLabel}
            />
            <SummaryCard
              icon={Clock}
              label="Pending"
              value={`${user?.profile?.currency || 'USD'} ${Number(summary?.pending_amount || 0).toLocaleString()}`}
              subtitle={`${summary?.pending_payments || 0} unpaid`}
            />
            <SummaryCard
              icon={Users}
              label="Total Students"
              value={String(summary?.total_students || 0)}
              subtitle={`${summary?.paid_students || 0} paid`}
            />
            <SummaryCard
              icon={Calendar}
              label="Workshops"
              value={String(summary?.total_workshops || 0)}
              subtitle={periodLabel}
            />
          </div>

          {/* Earnings Chart */}
          <div className="surface-gradient rounded-2xl p-6 hairline shadow-card animate-fade-in">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gold-gradient grid place-items-center">
                  <BarChart3 className="w-5 h-5 text-primary-foreground" />
                </div>
                <div>
                  <h3 className="font-display text-lg font-bold">Earnings Overview</h3>
                  <p className="text-xs text-muted-foreground">{periodLabel} performance</p>
                </div>
              </div>
              <div className="flex items-center gap-4 text-xs">
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-sm" style={{ background: "hsl(43 74% 58%)" }} />
                  Earnings
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-sm" style={{ background: "hsl(200 80% 55%)" }} />
                  Students
                </span>
              </div>
            </div>

            {timeline.length === 0 ? (
              <EmptyChart message="No data for this period" />
            ) : (
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={timeline} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="goldGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(43 74% 58%)" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(43 74% 58%)" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="blueGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(200 80% 55%)" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(200 80% 55%)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(40 12% 16%)" />
                    <XAxis dataKey="label" stroke="hsl(40 8% 42%)" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis yAxisId="left" stroke="hsl(40 8% 42%)" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `${user?.profile?.currency || 'USD'} ${v >= 1000 ? `${(v/1000).toFixed(0)}k` : v}`} />
                    <YAxis yAxisId="right" orientation="right" stroke="hsl(40 8% 42%)" fontSize={11} tickLine={false} axisLine={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Area yAxisId="left" type="monotone" dataKey="earned" stroke="hsl(43 74% 58%)" fill="url(#goldGrad)" strokeWidth={2.5} dot={{ r: 4, fill: "hsl(43 74% 58%)" }} />
                    <Area yAxisId="right" type="monotone" dataKey="students" stroke="hsl(200 80% 55%)" fill="url(#blueGrad)" strokeWidth={2} dot={{ r: 3, fill: "hsl(200 80% 55%)" }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Bottom Grid */}
          <div className="grid lg:grid-cols-2 gap-6">
            {/* Workshop Type Breakdown */}
            <div className="surface-gradient rounded-2xl p-6 hairline shadow-card animate-fade-in">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-secondary grid place-items-center">
                  <PieChartIcon className="w-5 h-5 text-gold" />
                </div>
                <div>
                  <h3 className="font-display text-lg font-bold">Workshop Types</h3>
                  <p className="text-xs text-muted-foreground">Student distribution by category</p>
                </div>
              </div>

              {typeBreakdown.length === 0 ? (
                <EmptyChart message="No workshop data" />
              ) : (
                <div className="flex flex-col sm:flex-row items-center gap-6">
                  <div className="w-48 h-48 shrink-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={typeBreakdown}
                          dataKey="student_count"
                          nameKey="category"
                          cx="50%"
                          cy="50%"
                          innerRadius={45}
                          outerRadius={75}
                          paddingAngle={3}
                          strokeWidth={0}
                        >
                          {typeBreakdown.map((_, i) => (
                            <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip content={<PieTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex-1 space-y-2 w-full">
                    {typeBreakdown.map((item: any, i: number) => (
                      <div key={item.category} className="flex items-center justify-between p-2.5 rounded-xl bg-secondary/20 border border-border/30 hover:border-gold/20 transition-colors">
                        <div className="flex items-center gap-2.5">
                          <span className="w-3 h-3 rounded-full shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                          <span className="text-sm font-medium truncate">{item.category}</span>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-sm font-bold">{Number(item.student_count)} </span>
                          <span className="text-[10px] text-muted-foreground">students</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Top Workshops */}
            <div className="surface-gradient rounded-2xl p-6 hairline shadow-card animate-fade-in">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-secondary grid place-items-center">
                  <Trophy className="w-5 h-5 text-gold" />
                </div>
                <div>
                  <h3 className="font-display text-lg font-bold">Top Workshops</h3>
                  <p className="text-xs text-muted-foreground">Ranked by student count</p>
                </div>
              </div>

              {topWorkshops.length === 0 ? (
                <EmptyChart message="No workshops yet" />
              ) : (
                <div className="space-y-2">
                  {topWorkshops.map((ws: any, i: number) => (
                    <Link
                      key={ws.id}
                      to={`/events/${ws.id}`}
                      className="flex items-center gap-3 p-3 rounded-xl bg-secondary/20 border border-border/30 hover:border-gold/20 hover:bg-secondary/40 transition-all group"
                    >
                      <span className={`w-7 h-7 rounded-lg grid place-items-center text-xs font-bold shrink-0 ${
                        i === 0 ? "bg-gold-gradient text-primary-foreground" : "bg-secondary text-muted-foreground"
                      }`}>
                        {i + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate group-hover:text-gold transition-colors">
                          {ws.event_name}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {ws.for_whom || "General"} · {format(new Date(ws.event_date), "PP")}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-bold">{Number(ws.student_count)}</p>
                        <p className="text-[10px] text-muted-foreground">{user?.profile?.currency || 'USD'} {Number(ws.earned).toLocaleString()}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

/* ─── Sub-components ──────────────────────────────────────── */

const SummaryCard = ({
  icon: Icon,
  label,
  value,
  accent,
  subtitle,
}: {
  icon: any;
  label: string;
  value: string;
  accent?: boolean;
  subtitle?: string;
}) => (
  <div className={`surface-gradient rounded-2xl p-5 hairline ${accent ? "shadow-gold border-gold/20" : "shadow-card"} flex items-center gap-4 transition-all hover:border-gold/30 group`}>
    <div className={`w-11 h-11 rounded-xl shrink-0 grid place-items-center transition-transform group-hover:scale-110 ${accent ? "bg-gold-gradient" : "bg-secondary"}`}>
      <Icon className={`w-5 h-5 ${accent ? "text-primary-foreground" : "text-gold"}`} />
    </div>
    <div className="min-w-0">
      <span className="text-[11px] uppercase tracking-wider text-muted-foreground block mb-0.5 opacity-80">{label}</span>
      <p className="font-display text-xl font-bold truncate">{value}</p>
      {subtitle && <span className="text-[10px] text-muted-foreground">{subtitle}</span>}
    </div>
  </div>
);

const EmptyChart = ({ message }: { message: string }) => (
  <div className="h-48 flex flex-col items-center justify-center text-muted-foreground">
    <Sparkles className="w-8 h-8 mb-3 text-gold/40" />
    <p className="text-sm">{message}</p>
  </div>
);

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-border/50 bg-background/95 backdrop-blur-sm px-4 py-3 shadow-xl">
      <p className="text-xs font-medium text-muted-foreground mb-2">{label}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center gap-2 text-sm">
          <span className="w-2.5 h-2.5 rounded-sm" style={{ background: p.stroke }} />
          <span className="text-muted-foreground capitalize">{p.dataKey}:</span>
          <span className="font-bold">
            {p.dataKey === "earned" ? `${user?.profile?.currency || 'USD'} ${Number(p.value).toLocaleString()}` : p.value}
          </span>
        </div>
      ))}
    </div>
  );
};

const PieTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const d = payload[0];
  return (
    <div className="rounded-xl border border-border/50 bg-background/95 backdrop-blur-sm px-4 py-3 shadow-xl">
      <p className="text-xs font-bold mb-1">{d.name}</p>
      <p className="text-sm text-muted-foreground">
        {d.value} student{d.value !== 1 ? "s" : ""}
      </p>
    </div>
  );
};

export default Reports;
