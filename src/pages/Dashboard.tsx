import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import {
  Calendar,
  Users,
  Wallet,
  Plus,
  Search,
  TrendingUp,
  Clock,
  Inbox,
  Link2,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { EventService } from "@/integrations/mysql/services";
import { Database } from "@/integrations/mysql/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

interface EventRow {
  id: string;
  event_name: string;
  event_date: string;
  end_date: string | null;
  location: string | null;
  image_url: string | null;
  for_whom: string | null;
  price_per_head: number;
  max_students: number;
  attendees_count: number;
  paid_count: number;
  total_collected: number;
  total_pending: number;
}

const Dashboard = () => {
  const { user } = useAuth();
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [userPackage, setUserPackage] = useState<any>(null);
  const [query, setQuery] = useState("");

  const load = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [eventsData, pkgData] = await Promise.all([
        EventService.getEventsByUser(user.id),
        Database.getUserPackage(user.id)
      ]);
      
      const rows: EventRow[] = (eventsData as any[]).map((e: any) => ({
        id: e.id,
        event_name: e.event_name,
        event_date: e.event_date,
        end_date: e.end_date,
        location: e.location,
        image_url: e.image_url,
        for_whom: e.for_whom,
        price_per_head: Number(e.price_per_head),
        max_students: e.max_students,
        attendees_count: Number(e.attendees_count),
        paid_count: Number(e.paid_count),
        total_collected: Number(e.total_collected),
        total_pending: Number(e.total_pending),
      }));
      setEvents(rows);
      setUserPackage(pkgData);
    } catch (error) {
      console.error("Failed to load events:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return events;
    return events.filter(
      (e) =>
        e.event_name.toLowerCase().includes(q) ||
        format(new Date(e.event_date), "PP").toLowerCase().includes(q),
    );
  }, [events, query]);

  const totals = useMemo(() => {
    const earned = events.reduce((s, e) => s + e.total_collected, 0);
    const pending = events.reduce((s, e) => s + e.total_pending, 0);
    const students = events.reduce((s, e) => s + e.attendees_count, 0);
    return { earned, pending, students };
  }, [events]);

  return (
    <div className="space-y-8 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground mb-1 uppercase tracking-widest font-medium opacity-70">Control Center</p>
          <h1 className="font-display text-4xl md:text-5xl font-bold tracking-tight">
            Your <span className="text-gold-gradient">workshops</span>
          </h1>
        </div>
        <Link to="/events/new">
          <Button variant="hero" size="lg" className="shadow-gold-lg">
            <Plus className="w-5 h-5 mr-1" /> New Workshop
          </Button>
        </Link>
      </div>

      <div className="grid lg:grid-cols-[1fr_340px] gap-8">
        <div className="space-y-8">
          {/* Stats - More Compact */}
          <div className="grid sm:grid-cols-3 gap-4">
            <StatCard
              icon={Wallet}
              label="Total earnings"
              value={`Rs ${totals.earned.toLocaleString()}`}
              accent
            />
            <StatCard
              icon={Clock}
              label="Pending"
              value={`Rs ${totals.pending.toLocaleString()}`}
            />
            <StatCard
              icon={Users}
              label="Total Students"
              value={String(totals.students)}
            />
          </div>

          {/* Search */}
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search workshops..."
              className="pl-10 h-11 bg-secondary/30 border-border/50"
            />
          </div>

          {/* Events */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-xl font-bold tracking-tight">Active Workshops</h2>
              <span className="text-sm text-muted-foreground">{filtered.length} found</span>
            </div>
            
            {loading ? (
              <div className="grid sm:grid-cols-2 gap-5">
                {[...Array(4)].map((_, i) => (
                  <Skeleton key={i} className="h-44 rounded-2xl" />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <EmptyState hasEvents={events.length > 0} />
            ) : (
              <div className="grid sm:grid-cols-2 gap-5">
                {filtered.map((e, i) => (
                  <EventCard key={e.id} event={e} index={i} />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar - Package Details */}
        <aside className="space-y-6">
          <PackageDetails userPackage={userPackage} eventsCount={events.length} />
          
          <div className="surface-gradient rounded-2xl p-6 hairline shadow-card bg-gold/5 border-gold/10">
            <h3 className="font-display font-bold mb-2 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-gold" /> Quick Tip
            </h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Share your workshop link with students to automate registration and payment tracking.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
};

const StatCard = ({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: any;
  label: string;
  value: string;
  accent?: boolean;
}) => (
  <div
    className={`surface-gradient rounded-2xl p-5 hairline ${accent ? "shadow-gold border-gold/20" : "shadow-card"} flex items-center gap-4 transition-all hover:border-gold/30 group`}
  >
    <div
      className={`w-11 h-11 rounded-xl shrink-0 grid place-items-center transition-transform group-hover:scale-110 ${
        accent ? "bg-gold-gradient" : "bg-secondary"
      }`}
    >
      <Icon
        className={`w-5 h-5 ${accent ? "text-primary-foreground" : "text-gold"}`}
      />
    </div>
    <div className="min-w-0">
      <span className="text-[11px] uppercase tracking-wider text-muted-foreground block mb-0.5 opacity-80">{label}</span>
      <p className="font-display text-xl font-bold truncate">{value}</p>
    </div>
  </div>
);

const PackageDetails = ({ userPackage, eventsCount }: { userPackage: any, eventsCount: number }) => {
  if (!userPackage) return <Skeleton className="h-64 rounded-2xl" />;

  const workshopUsage = (eventsCount / userPackage.max_workshops) * 100;

  return (
    <div className="surface-gradient rounded-2xl p-6 hairline shadow-card animate-fade-in sticky top-24">
      <div className="flex items-center justify-between mb-6">
        <h3 className="font-display text-lg font-bold">Your Plan</h3>
        <span className="px-3 py-1 rounded-full bg-gold/10 text-gold text-[10px] uppercase tracking-widest font-bold border border-gold/20 shadow-glow-sm">
          {userPackage.name}
        </span>
      </div>

      <div className="space-y-6">
        <div>
          <div className="flex justify-between text-xs mb-2">
            <span className="text-muted-foreground uppercase tracking-wider">Workshop Capacity</span>
            <span className="font-bold">{eventsCount} / {userPackage.max_workshops}</span>
          </div>
          <div className="h-2 rounded-full bg-secondary/50 overflow-hidden border border-border/50">
            <div 
              className="h-full bg-gold-gradient transition-all shadow-glow-gold" 
              style={{ width: `${Math.min(workshopUsage, 100)}%` }}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-xl bg-secondary/30 border border-border/50 transition-colors hover:bg-secondary/50">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground block mb-1">Max Students</span>
            <span className="text-sm font-bold">{userPackage.max_students_per_workshop}</span>
          </div>
          <div className="p-3 rounded-xl bg-secondary/30 border border-border/50 transition-colors hover:bg-secondary/50">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground block mb-1">Slip Limit</span>
            <span className="text-sm font-bold">{userPackage.max_slip_size_mb}MB</span>
          </div>
        </div>


      </div>
    </div>
  );
};

const EventCard = ({ event, index }: { event: EventRow; index: number }) => {
  const filledPct =
    event.max_students > 0
      ? (event.attendees_count / event.max_students) * 100
      : 0;

  const isPast = new Date(event.event_date) < new Date();
  const joinUrl = `${window.location.origin}/join/${event.id}`;

  const copyJoinLink = (e: React.MouseEvent) => {
    e.preventDefault();
    navigator.clipboard.writeText(joinUrl).then(() => {
      toast.success("Join link copied!");
    }).catch(() => {
      toast.error("Couldn't copy link");
    });
  };

  return (
    <Link
      to={`/events/${event.id}`}
      className="group surface-gradient rounded-2xl overflow-hidden hairline shadow-card hover:shadow-gold transition-all hover:-translate-y-1 animate-fade-in block"
      style={{ animationDelay: `${index * 60}ms` }}
    >
      <div className="flex h-full">
        {event.image_url && (
          <div className="w-24 sm:w-32 shrink-0 overflow-hidden border-r border-border/50">
            <img 
              src={event.image_url} 
              alt={event.event_name} 
              className="w-full h-full object-cover transition-transform group-hover:scale-105"
            />
          </div>
        )}
        <div className="p-5 flex-1 min-w-0 flex flex-col justify-between">
          <div>
            <div className="flex items-start justify-between gap-3 mb-2">
              <h3 className="font-display text-lg font-semibold truncate group-hover:text-gold transition-colors">
                {event.event_name}
              </h3>
              {isPast && (
                <span className="shrink-0 text-[10px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground border border-border/50 font-medium">
                  Ended
                </span>
              )}
            </div>
            
            <div className="space-y-1">
              <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                <Calendar className="w-3 h-3 text-gold/70" />
                {format(new Date(event.event_date), "PPP")}
              </p>
              {event.location && (
                <p className="text-[11px] text-muted-foreground flex items-center gap-1.5 truncate">
                  <Inbox className="w-3 h-3 text-gold/70" />
                  {event.location}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-muted-foreground">Capacity</span>
                <span className="font-medium">
                  {event.attendees_count}/{event.max_students || "∞"}
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                <div
                  className="h-full bg-gold-gradient transition-all"
                  style={{ width: `${Math.min(filledPct, 100)}%` }}
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-border">
              <div className="flex items-center gap-1.5 text-sm">
                <TrendingUp className="w-3.5 h-3.5 text-gold" />
                <span className="font-semibold">
                  Rs {event.total_collected.toLocaleString()}
                </span>
              </div>
              {!isPast ? (
                <button
                  onClick={copyJoinLink}
                  className="flex items-center gap-1 text-[11px] text-gold hover:text-gold/80 transition-colors px-2 py-1 rounded-lg bg-gold/10 hover:bg-gold/20"
                >
                  <Link2 className="w-3 h-3" />
                  Copy link
                </button>
              ) : (
                <span className="text-xs text-muted-foreground">
                  {event.paid_count}/{event.attendees_count} paid
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
};

const EmptyState = ({ hasEvents }: { hasEvents: boolean }) => (
  <div className="text-center py-10 surface-gradient rounded-2xl hairline">
    <div className="w-14 h-14 mx-auto rounded-full bg-secondary grid place-items-center mb-4">
      <Calendar className="w-6 h-6 text-gold" />
    </div>
    <h3 className="font-display text-xl font-semibold">
      {hasEvents ? "No matches" : "No workshops yet"}
    </h3>
    <p className="text-muted-foreground mt-2 mb-6">
      {hasEvents
        ? "Try a different search."
        : "Create your first workshop to get started."}
    </p>
    {!hasEvents && (
      <Link to="/events/new">
        <Button variant="hero">
          <Plus className="w-4 h-4" /> Create workshop
        </Button>
      </Link>
    )}
  </div>
);

export default Dashboard;
