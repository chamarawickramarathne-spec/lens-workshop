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
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { EventService } from "@/integrations/mysql/services";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

interface EventRow {
  id: string;
  event_name: string;
  event_date: string;
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
  const [query, setQuery] = useState("");

  const load = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const eventsData = await EventService.getEventsByUser(user.id);
      const rows: EventRow[] = (eventsData as any[]).map((e: any) => ({
        id: e.id,
        event_name: e.event_name,
        event_date: e.event_date,
        price_per_head: Number(e.price_per_head),
        max_students: e.max_students,
        attendees_count: Number(e.attendees_count),
        paid_count: Number(e.paid_count),
        total_collected: Number(e.total_collected),
        total_pending: Number(e.total_pending),
      }));
      setEvents(rows);
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground mb-1">Welcome back</p>
          <h1 className="font-display text-3xl md:text-4xl font-bold tracking-tight">
            Your <span className="text-gold-gradient">workshops</span>
          </h1>
        </div>
        <Link to="/events/new">
          <Button variant="hero" size="lg">
            <Plus className="w-4 h-4" /> New Workshop
          </Button>
        </Link>
      </div>

      {/* Stats */}
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
          label="Students"
          value={String(totals.students)}
        />
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search workshops by name or date..."
          className="pl-10"
        />
      </div>

      {/* Events */}
      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-52 rounded-2xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState hasEvents={events.length > 0} />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((e, i) => (
            <EventCard key={e.id} event={e} index={i} />
          ))}
        </div>
      )}
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
    className={`surface-gradient rounded-2xl p-6 hairline ${accent ? "shadow-gold" : "shadow-card"}`}
  >
    <div className="flex items-center justify-between mb-3">
      <span className="text-sm text-muted-foreground">{label}</span>
      <div
        className={`w-9 h-9 rounded-lg grid place-items-center ${
          accent ? "bg-gold-gradient" : "bg-secondary"
        }`}
      >
        <Icon
          className={`w-4 h-4 ${accent ? "text-primary-foreground" : "text-gold"}`}
        />
      </div>
    </div>
    <p className="font-display text-2xl font-bold">{value}</p>
  </div>
);

const EventCard = ({ event, index }: { event: EventRow; index: number }) => {
  const filledPct =
    event.max_students > 0
      ? (event.attendees_count / event.max_students) * 100
      : 0;
  return (
    <Link
      to={`/events/${event.id}`}
      className="group surface-gradient rounded-2xl p-6 hairline shadow-card hover:shadow-gold transition-all hover:-translate-y-1 animate-fade-in block"
      style={{ animationDelay: `${index * 60}ms` }}
    >
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex-1 min-w-0">
          <h3 className="font-display text-xl font-semibold truncate group-hover:text-gold transition-colors">
            {event.event_name}
          </h3>
          <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5" />
            {format(new Date(event.event_date), "PPP")}
          </p>
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

        <div className="flex items-center justify-between pt-3 border-t border-border">
          <div className="flex items-center gap-1.5 text-sm">
            <TrendingUp className="w-3.5 h-3.5 text-gold" />
            <span className="font-semibold">
              Rs {event.total_collected.toLocaleString()}
            </span>
          </div>
          <span className="text-xs text-muted-foreground">
            {event.paid_count}/{event.attendees_count} paid
          </span>
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
