import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
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
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import {
  EventService,
  AttendeeService,
  JoinRequestService,
} from "@/integrations/mysql/services";
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
  price_per_head: number;
  max_students: number;
  notes: string | null;
}

interface Attendee {
  id: string;
  student_name: string;
  contact_number: string | null;
  payment_status: string;
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

  const handleAdd = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!event) return;
    const fd = new FormData(e.currentTarget);
    const parsed = attendeeSchema.safeParse({
      student_name: String(fd.get("student_name") ?? ""),
      contact_number: String(fd.get("contact_number") ?? ""),
    });
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);

    setAdding(true);
    try {
      await AttendeeService.createAttendee(event.id, {
        student_name: parsed.data.student_name,
        contact_number: parsed.data.contact_number || undefined,
        payment_status_id: 1, // pending
        amount_paid: 0,
      });
      toast.success("Student added");
      load(); // Reload data
      (e.target as HTMLFormElement).reset();
    } catch (error) {
      console.error("Failed to add attendee:", error);
      toast.error("Failed to add student");
    } finally {
      setAdding(false);
    }
  };

  const togglePaid = async (a: Attendee) => {
    if (!event) return;
    const nextStatus = a.payment_status === "paid" ? 1 : 2; // 1 = pending, 2 = paid
    const amount = nextStatus === 2 ? Number(event.price_per_head) : 0;

    // Optimistic update
    setAttendees((prev) =>
      prev.map((x) =>
        x.id === a.id
          ? {
              ...x,
              payment_status: nextStatus === 2 ? "paid" : "pending",
              amount_paid: amount,
            }
          : x,
      ),
    );

    try {
      await AttendeeService.updateAttendeeStatus(a.id, nextStatus, amount);
      toast.success(nextStatus === 2 ? "Marked paid" : "Marked pending");
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
        await fetch('/api/delete-file', {
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
        await fetch('/api/delete-file', {
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
    const paid = attendees.filter((a) => a.payment_status === "paid");
    const collected = paid.reduce((s, a) => s + Number(a.amount_paid), 0);
    const pendingAmt =
      (attendees.length - paid.length) * Number(event.price_per_head);

    doc.setFontSize(20);
    doc.text(event.event_name, 14, 20);
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Date: ${format(new Date(event.event_date), "PPP p")}`, 14, 28);
    doc.text(`Price per head: Rs ${event.price_per_head}`, 14, 34);
    doc.text(`Capacity: ${attendees.length}/${event.max_students}`, 14, 40);

    autoTable(doc, {
      startY: 50,
      head: [["#", "Student", "Contact", "Status", "Paid (Rs)"]],
      body: attendees.map((a, i) => [
        i + 1,
        a.student_name,
        a.contact_number || "-",
        a.payment_status.toUpperCase(),
        Number(a.amount_paid).toLocaleString(),
      ]),
      headStyles: { fillColor: [200, 160, 60] },
    });

    const finalY = (doc as any).lastAutoTable.finalY + 10;
    doc.setFontSize(12);
    doc.setTextColor(0);
    doc.text(`Total Collected: Rs ${collected.toLocaleString()}`, 14, finalY);
    doc.text(`Pending: Rs ${pendingAmt.toLocaleString()}`, 14, finalY + 7);

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

  const paidCount = attendees.filter((a) => a.payment_status === "paid").length;
  const collected = attendees
    .filter((a) => a.payment_status === "paid")
    .reduce((s, a) => s + Number(a.amount_paid), 0);
  const pendingAmt =
    (attendees.length - paidCount) * Number(event.price_per_head);

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
      <div className="surface-gradient rounded-2xl p-5 sm:p-6 hairline shadow-card">
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
          <div>
            <h1 className="font-display text-3xl md:text-4xl font-bold tracking-tight">
              {event.event_name}
            </h1>
            <p className="text-muted-foreground mt-2 flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              {format(new Date(event.event_date), "PPPP 'at' p")}
            </p>
            {event.notes && (
              <p className="text-sm text-muted-foreground mt-3 max-w-2xl">
                {event.notes}
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={downloadPDF}>
              <Download className="w-4 h-4" /> PDF Report
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  className="text-destructive hover:text-destructive"
                >
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
                  <AlertDialogAction onClick={deleteEvent}>
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        {/* Join link display */}
        <div className="mt-6 flex items-center gap-2 px-4 py-3 rounded-xl bg-secondary/40 hairline">
          <Link2 className="w-4 h-4 text-gold shrink-0" />
          <code className="text-xs sm:text-sm text-muted-foreground truncate flex-1">
            {joinUrl}
          </code>
          <Button variant="ghost" size="sm" onClick={copyJoinLink}>
            Copy
          </Button>
        </div>

        <div className="grid sm:grid-cols-4 gap-4 mt-8">
          <Stat
            icon={Users}
            label="Attendees"
            value={`${attendees.length}/${event.max_students}`}
          />
          <Stat icon={Check} label="Paid" value={String(paidCount)} />
          <Stat
            icon={Wallet}
            label="Collected"
            value={`Rs ${collected.toLocaleString()}`}
            accent
          />
          <Stat
            icon={Clock}
            label="Pending"
            value={`Rs ${pendingAmt.toLocaleString()}`}
          />
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

      {/* Add attendee */}
      <form
        onSubmit={handleAdd}
        className="surface-gradient rounded-2xl p-5 sm:p-6 hairline shadow-card"
      >
        <h2 className="font-display text-lg font-semibold mb-4">Add student</h2>
        <div className="grid sm:grid-cols-[1fr_1fr_auto] gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="student_name">Name</Label>
            <Input
              id="student_name"
              name="student_name"
              required
              maxLength={120}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="contact_number">Contact (optional)</Label>
            <Input id="contact_number" name="contact_number" maxLength={40} />
          </div>
          <div className="flex items-end">
            <Button
              type="submit"
              variant="hero"
              disabled={adding}
              className="w-full sm:w-auto"
            >
              {adding ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Plus className="w-4 h-4" /> Add
                </>
              )}
            </Button>
          </div>
        </div>
      </form>

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
                    Rs {Number(a.amount_paid).toLocaleString()}
                  </p>
                </div>

                <Button
                  variant={a.payment_status === "paid" ? "gold" : "outline"}
                  size="sm"
                  onClick={() => togglePaid(a)}
                  disabled={!!a.payment_slip_url}
                  className="min-w-[90px]"
                >
                  {a.payment_status === "paid" ? (
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
