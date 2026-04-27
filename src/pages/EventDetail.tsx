import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { format } from "date-fns";
import { z } from "zod";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  ArrowLeft,
  Calendar,
  Users,
  Wallet,
  Plus,
  Trash2,
  Download,
  Check,
  Clock,
  Loader2,
  Link2,
  Inbox,
  ExternalLink,
  X,
  Pencil,
  CheckCircle2,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import {
  EventService,
  AttendeeService,
  JoinRequestService,
} from "@/integrations/mysql/services";
import { API_BASE_URL } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

interface Event {
  id: string;
  event_name: string;
  event_date: string;
  end_date: string | null;
  location: string | null;
  image_url: string | null;
  for_whom: string | null;
  price_per_head: number;
  max_students: number;
  notes: string | null;
}

interface Attendee {
  id: string;
  student_name: string;
  contact_number: string | null;
  status: string;
  amount_paid: number;
  payment_slip_url: string | null;
}

interface JoinRequest {
  id: string;
  student_name: string;
  email: string;
  phone: string;
  note: string | null;
  payment_slip_url: string;
  status: string;
  created_at: string;
}

const attendeeSchema = z.object({
  student_name: z.string().trim().min(1, "Name required").max(120),
  contact_number: z.string().trim().max(40).optional(),
});

const EventDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [event, setEvent] = useState<Event | null>(null);
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [requests, setRequests] = useState<JoinRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);

  const load = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [eventData, attendeesData, requestsData] = await Promise.all([
        EventService.getEventById(id),
        AttendeeService.getAttendeesByEvent(id),
        JoinRequestService.getJoinRequestsByEvent(id),
      ]);

      setEvent(eventData as Event | null);
      setAttendees(attendeesData as Attendee[]);
      setRequests(
        requestsData.filter(
          (r: any) => r.status === "pending",
        ) as JoinRequest[],
      );
    } catch (error) {
      console.error("Failed to load event data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const togglePaid = async (a: Attendee) => {
    if (!event) return;
    const nextStatus = a.status === "approved" ? "unpaid" : "approved";
    const amount = nextStatus === "approved" ? Number(event.price_per_head) : 0;
    
    // Optimistic update
    setAttendees((prev) =>
      prev.map((x) =>
        x.id === a.id
          ? {
              ...x,
              status: nextStatus,
              amount_paid: amount
            }
          : x,
      ),
    );

    try {
      await AttendeeService.updateAttendeeStatus(a.id, nextStatus, amount);
      toast.success(nextStatus === "approved" ? "Marked paid" : "Marked unpaid");
    } catch (error) {
      console.error("Failed to update payment status:", error);
      toast.error("Couldn't update");
      load();
    }
  };

  const removeAttendee = async (a: Attendee) => {
    setAttendees((prev) => prev.filter((x) => x.id !== a.id));
    try {
      await AttendeeService.deleteAttendee(a.id);
      
      // Delete the payment slip file from the server if it exists
      if (a.payment_slip_url) {
        await fetch(`${API_BASE_URL}/api/delete-file`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: a.payment_slip_url }),
        }).catch(err => console.error("Failed to delete slip file", err));
      }

      toast.success("Student removed");
    } catch (error) {
      console.error("Failed to delete attendee:", error);
      toast.error("Couldn't delete");
      load();
    }
  };

  const deleteEvent = async () => {
    if (!event) return;
    try {
      // Collect all file URLs to delete (attendee slips + pending request slips + cover image)
      const fileUrls: string[] = [];

      attendees.forEach((a) => {
        if (a.payment_slip_url) fileUrls.push(a.payment_slip_url);
      });
      requests.forEach((r) => {
        if (r.payment_slip_url) fileUrls.push(r.payment_slip_url);
      });
      if (event.image_url) fileUrls.push(event.image_url);

      // Delete all files in parallel
      await Promise.allSettled(
        fileUrls.map((url) =>
          fetch(`${API_BASE_URL}/api/delete-file`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url }),
          })
        )
      );

      await EventService.deleteEvent(event.id);
      toast.success("Workshop deleted");
      navigate("/dashboard");
    } catch (error) {
      console.error("Failed to delete event:", error);
      toast.error("Failed to delete workshop");
    }
  };

  const joinUrl = event ? `${window.location.origin}/join/${event.id}` : "";

  const copyJoinLink = async () => {
    if (!joinUrl) return;
    try {
      await navigator.clipboard.writeText(joinUrl);
      toast.success("Join link copied");
    } catch {
      toast.error("Couldn't copy");
    }
  };

  const approveRequest = async (r: JoinRequest) => {
    if (!event) return;
    try {
      await JoinRequestService.approveJoinRequest(r.id);
      toast.success(`${r.student_name} approved`);
      load(); // Reload to get updated attendees and requests
    } catch (error) {
      console.error("Failed to approve request:", error);
      toast.error("Failed to approve request");
    }
  };

  const rejectRequest = async (r: JoinRequest) => {
    try {
      await JoinRequestService.rejectJoinRequest(r.id);
      
      if (r.payment_slip_url) {
        await fetch(`${API_BASE_URL}/api/delete-file`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: r.payment_slip_url }),
        }).catch(err => console.error("Failed to delete slip file", err));
      }

      toast.success("Request rejected");
      load(); // Reload to update requests and attendees list
    } catch (error) {
      console.error("Failed to reject request:", error);
      toast.error("Failed to reject request");
    }
  };

  const downloadPDF = () => {
    if (!event) return;
    const doc = new jsPDF();
    const paid = attendees.filter((a) => a.status === "approved" || a.payment_slip_url);
    const collected = paid.length * Number(event.price_per_head);
    const pendingAmt =
      (attendees.length - paid.length) * Number(event.price_per_head);

    doc.setFontSize(20);
    doc.text(event.event_name, 14, 20);
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Date: ${format(new Date(event.event_date), "PPP p")}`, 14, 28);
    doc.text(`Price per head: ${user?.profile?.currency || 'USD'} ${event.price_per_head}`, 14, 34);
    doc.text(`Capacity: ${attendees.length}/${event.max_students}`, 14, 40);

    autoTable(doc, {
      startY: 50,
      head: [["#", "Student", "Contact", "Status", `Paid (${user?.profile?.currency || 'USD'})`]],
      body: attendees.map((a, i) => {
        const isPaid = a.status === "approved" || a.payment_slip_url;
        return [
          i + 1,
          a.student_name,
          a.contact_number || "-",
          isPaid ? "PAID" : "PENDING",
          isPaid ? Number(event.price_per_head).toLocaleString() : "0",
        ];
      }),
      headStyles: { fillColor: [200, 160, 60] },
    });

    const finalY = (doc as any).lastAutoTable.finalY + 10;
    doc.setFontSize(12);
    doc.setTextColor(0);
    doc.text(`Total Collected: ${user?.profile?.currency || 'USD'} ${collected.toLocaleString()}`, 14, finalY);
    doc.text(`Pending: ${user?.profile?.currency || 'USD'} ${pendingAmt.toLocaleString()}`, 14, finalY + 7);

    doc.save(`${event.event_name.replace(/\s+/g, "-")}-report.pdf`);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-32" />
        <Skeleton className="h-32 rounded-2xl" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="text-center py-20">
        <p className="text-muted-foreground">Workshop not found.</p>
        <Button onClick={() => navigate("/dashboard")} className="mt-4">
          Back to dashboard
        </Button>
      </div>
    );
  }

  const paidCount = attendees.filter((a) => a.status === "approved").length;
  const collected = paidCount * Number(event.price_per_head);
  const pendingCount = requests.length;
  const pendingAmt = pendingCount * Number(event.price_per_head);

  return (
    <div className="space-y-6">
      <Button
        variant="ghost"
        onClick={() => navigate("/dashboard")}
        className="-ml-3"
      >
        <ArrowLeft className="w-4 h-4" /> Back to dashboard
      </Button>

      {/* Hero */}
      <div className="surface-gradient rounded-2xl overflow-hidden hairline shadow-card flex flex-col md:flex-row min-h-[400px]">
        {event.image_url && (
          <div className="w-full md:w-72 lg:w-80 shrink-0 bg-secondary/20 border-b md:border-b-0 md:border-r border-border/50">
            <img
              src={event.image_url}
              alt={event.event_name}
              className="w-full h-full object-cover"
            />
          </div>
        )}
        <div className="p-5 sm:p-8 flex-1 flex flex-col gap-6">
          {/* Top: title + actions */}
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
            <div className="space-y-3">
              <Badge variant="gold" className="px-2.5 py-0.5 rounded-full bg-gold/10 text-gold text-[10px] uppercase tracking-widest font-bold border border-gold/20">
                Workshop Details
              </Badge>
              <h1 className="font-display text-4xl md:text-5xl font-bold tracking-tight">
                {event.event_name}
              </h1>
            </div>
            <div className="flex flex-wrap gap-2 shrink-0">
              <Link to={`/events/${event.id}/edit`}>
                <Button variant="outline">
                  <Pencil className="w-4 h-4" /> Edit
                </Button>
              </Link>
              <Button variant="outline" onClick={downloadPDF}>
                <Download className="w-4 h-4" /> PDF Report
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" className="text-destructive hover:text-destructive">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete workshop?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This permanently removes the workshop and all attendees.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={deleteEvent}>Delete</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>

          {/* Info: timeline → location → audience stacked */}
          <div className="space-y-3">
            <div className="flex items-center gap-3 text-muted-foreground">
              <div className="w-8 h-8 rounded-lg bg-secondary/50 grid place-items-center shrink-0">
                <Calendar className="w-4 h-4 text-gold" />
              </div>
              <div className="text-sm">
                <p className="font-medium text-foreground">Timeline</p>
                <p>{format(new Date(event.event_date), "PPP p")} — {event.end_date ? format(new Date(event.end_date), "PPP p") : "TBD"}</p>
              </div>
            </div>

            {event.location && (
              <div className="flex items-center gap-3 text-muted-foreground">
                <div className="w-8 h-8 rounded-lg bg-secondary/50 grid place-items-center shrink-0">
                  <Inbox className="w-4 h-4 text-gold" />
                </div>
                <div className="text-sm">
                  <p className="font-medium text-foreground">Location</p>
                  <p>{event.location}</p>
                </div>
              </div>
            )}

            {event.for_whom && (
              <div className="flex items-center gap-3 text-muted-foreground">
                <div className="w-8 h-8 rounded-lg bg-secondary/50 grid place-items-center shrink-0">
                  <Users className="w-4 h-4 text-gold" />
                </div>
                <div className="text-sm">
                  <p className="font-medium text-foreground">Audience</p>
                  <p>{event.for_whom}</p>
                </div>
              </div>
            )}
          </div>

          {event.notes && (
            <div className="pt-4 border-t border-border/50">
              <p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap">
                {event.notes}
              </p>
            </div>
          )}

          {/* Join link */}
          <div className="mt-auto space-y-4">
            <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-secondary/40 hairline">
              <Link2 className="w-4 h-4 text-gold shrink-0" />
              <code className="text-xs sm:text-sm text-muted-foreground truncate flex-1">
                {joinUrl}
              </code>
              <Button variant="ghost" size="sm" onClick={copyJoinLink}>
                Copy
              </Button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Stat icon={Users} label="Attendees" value={`${event.attendees_count}/${event.max_students}`} />
              <Stat icon={Check} label="Paid" value={String(paidCount)} />
              <Stat icon={Wallet} label="Collected" value={`${user?.profile?.currency || 'USD'} ${collected.toLocaleString()}`} accent />
              <Stat icon={Clock} label="Pending" value={`${user?.profile?.currency || 'USD'} ${pendingAmt.toLocaleString()}`} />
            </div>
          </div>
        </div>
      </div>

      {/* Join Requests */}
      {requests.length > 0 && (
        <div className="surface-gradient rounded-2xl hairline shadow-card overflow-hidden">
          <div className="p-6 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gold-gradient grid place-items-center shadow-gold">
                <Inbox className="w-5 h-5 text-primary-foreground" />
              </div>
              <div>
                <h2 className="font-display text-lg font-semibold">
                  Join Requests
                </h2>
                <p className="text-xs text-muted-foreground">
                  Review payment slips and approve students
                </p>
              </div>
            </div>
            <Badge variant="outline" className="border-primary/30 text-gold">
              {requests.length} new
            </Badge>
          </div>

          <ul className="divide-y divide-border">
            {requests.map((r) => (
              <li
                key={r.id}
                className="p-4 sm:p-5 grid sm:grid-cols-[120px_1fr_auto] gap-4 items-start"
              >
                <a
                  href={r.payment_slip_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block group"
                >
                  <img
                    src={r.payment_slip_url}
                    alt={`Slip from ${r.student_name}`}
                    className="w-full h-24 object-cover rounded-lg hairline group-hover:opacity-80 transition-opacity"
                  />
                  <span className="text-[10px] text-muted-foreground flex items-center gap-1 mt-1">
                    <ExternalLink className="w-3 h-3" /> View full
                  </span>
                </a>
                <div className="min-w-0">
                  <p className="font-medium">{r.student_name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                    {r.email} · {r.phone}
                  </p>
                  {r.note && (
                    <p className="text-sm text-muted-foreground mt-2 italic">
                      "{r.note}"
                    </p>
                  )}
                  <p className="text-[11px] text-muted-foreground mt-2">
                    {format(new Date(r.created_at), "PPp")}
                  </p>
                </div>
                <div className="flex sm:flex-col gap-2">
                  <Button
                    variant="gold"
                    size="sm"
                    onClick={() => approveRequest(r)}
                  >
                    <Check className="w-3.5 h-3.5" /> Approve
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => rejectRequest(r)}
                  >
                    <X className="w-3.5 h-3.5" /> Reject
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Attendees list */}
      <div className="surface-gradient rounded-2xl hairline shadow-card overflow-hidden">
        <div className="p-6 border-b border-border flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">Students</h2>
          <Badge variant="outline" className="border-primary/30 text-gold">
            {paidCount}/{attendees.length} paid
          </Badge>
        </div>

        {attendees.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">
            No students yet. Add the first one above.
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {attendees.map((a) => (
              <li
                key={a.id}
                className="p-4 sm:p-5 flex items-center gap-4 hover:bg-secondary/40 transition-colors"
              >
                <div className="flex-1 min-w-0 flex items-center gap-3">
                  <p className="font-medium truncate">{a.student_name}</p>
                  {a.contact_number && (
                    <p className="text-xs sm:text-sm text-muted-foreground shrink-0">
                      {a.contact_number}
                    </p>
                  )}
                  {a.payment_slip_url && (
                    <a href={a.payment_slip_url} target="_blank" rel="noopener noreferrer" className="text-[11px] sm:text-xs text-gold hover:underline shrink-0 inline-flex items-center gap-1 bg-gold/10 px-2 py-0.5 rounded-full">
                      <ExternalLink className="w-3 h-3" /> Slip
                    </a>
                  )}
                </div>

                <div className="hidden sm:block text-right">
                  <p className="text-sm font-semibold">
                    {user?.profile?.currency || 'USD'} {Number(a.amount_paid).toLocaleString()}
                  </p>
                </div>

                <Button
                  variant={a.status === "approved" ? "gold" : "outline"}
                  size="sm"
                  onClick={() => a.status !== "approved" && togglePaid(a)}
                  disabled={a.status === "approved"}
                  className="min-w-[90px]"
                >
                  {a.status === "approved" ? (
                    <>
                      <Check className="w-3.5 h-3.5" /> Paid
                    </>
                  ) : (
                    <>
                      <Clock className="w-3.5 h-3.5" /> Pending
                    </>
                  )}
                </Button>

                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeAttendee(a)}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

const Stat = ({
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
    className={`rounded-xl p-4 hairline ${accent ? "bg-primary/10" : "bg-secondary/40"}`}
  >
    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1.5">
      <Icon className={`w-3.5 h-3.5 ${accent ? "text-gold" : ""}`} />
      {label}
    </div>
    <p className="font-display text-2xl font-bold">{value}</p>
  </div>
);

export default EventDetail;
