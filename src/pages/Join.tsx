import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { format } from "date-fns";
import { z } from "zod";
import {
  Calendar,
  GraduationCap,
  Loader2,
  Upload,
  CheckCircle2,
  ImageIcon,
  Lock,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import {
  EventService,
  JoinRequestService,
  AttendeeService,
} from "@/integrations/mysql/services";
import { Button } from "@/components/ui/button";
import { API_BASE_URL } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

interface Event {
  id: string;
  event_name: string;
  event_date: string;
  end_date: string | null;
  price_per_head: number;
  currency: string;
  notes: string | null;
  attendees_count: number;
  max_students: number;
  image_url?: string;
  photographer_name?: string;
  photographer_avatar?: string;
  photographer_phone?: string;
  photographer_email?: string;
}

const schema = z.object({
  student_name: z.string().trim().min(1, "Name required").max(120),
  email: z.string().trim().email("Invalid email").max(255),
  phone: z.string().trim().min(5, "Phone required").max(40),
  note: z.string().max(1000).optional(),
});

const Join = () => {
  const { id } = useParams<{ id: string }>();
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [slip, setSlip] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      if (!id) return;
      try {
        const eventData = await EventService.getEventById(id);
        setEvent(eventData as Event | null);
      } catch (error) {
        console.error("Failed to load event:", error);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      toast.error("Please upload an image");
      return;
    }
    if (f.size > 5 * 1024 * 1024) {
      toast.error("Image must be under 5MB");
      return;
    }
    setSlip(f);
    setPreview(URL.createObjectURL(f));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!event) return;
    if (!slip) return toast.error("Please upload your payment slip");

    const fd = new FormData(e.currentTarget);
    const parsed = schema.safeParse({
      student_name: String(fd.get("student_name") ?? ""),
      email: String(fd.get("email") ?? ""),
      phone: String(fd.get("phone") ?? ""),
      note: String(fd.get("note") ?? ""),
    });
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);

    setSubmitting(true);

    // Upload the file to the server
    const uploadData = new FormData();
    uploadData.append("file", slip);

    const uploadRes = await fetch(`${API_BASE_URL}/api/upload`, {
      method: "POST",
      body: uploadData,
    });

    if (!uploadRes.ok) {
      setSubmitting(false);
      return toast.error("Failed to upload payment slip");
    }

    const { url: paymentSlipUrl } = await uploadRes.json();

    await JoinRequestService.createJoinRequest({
      event_id: event.id,
      student_name: parsed.data.student_name,
      email: parsed.data.email,
      phone: parsed.data.phone,
      note: parsed.data.note || null,
      payment_slip_url: paymentSlipUrl,
      amount_paid: Number(event.price_per_head),
    });

    setDone(true);
    toast.success("Successfully joined workshop!");
  };

  if (loading) {
    return (
      <div className="container max-w-2xl py-16 space-y-4">
        <Skeleton className="h-32 rounded-2xl" />
        <Skeleton className="h-96 rounded-2xl" />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="container max-w-2xl py-32 text-center">
        <h1 className="font-display text-3xl font-bold">Workshop not found</h1>
        <p className="text-muted-foreground mt-2">
          This join link is invalid or the workshop was removed.
        </p>
        <Link to="/" className="mt-6 inline-block">
          <Button variant="outline">Go home</Button>
        </Link>
      </div>
    );
  }

  const isFull = event.attendees_count >= event.max_students;
  const isExpired = new Date(event.end_date || event.event_date) < new Date();

  if (done) {
    return (
      <div className="min-h-screen grid place-items-center p-4">
        <div className="max-w-md w-full surface-gradient rounded-2xl p-8 hairline text-center space-y-4">
          <div className="w-16 h-16 mx-auto rounded-full bg-gold/10 grid place-items-center">
            <CheckCircle2 className="w-8 h-8 text-gold" />
          </div>
          <h1 className="font-display text-3xl font-bold">
            Registration Received!
          </h1>
          <p className="text-muted-foreground leading-relaxed">
            Your registration for{" "}
            <span className="text-foreground font-medium">
              {event.event_name}
            </span>{" "}
            is pending review. We will contact you once approved.
          </p>
          <Link to="/" className="block">
            <Button className="w-full bg-gold hover:bg-gold/90 text-black font-semibold">
              Go to Home
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  if (isExpired || isFull) {
    return (
      <div className="min-h-screen grid place-items-center p-4">
        <div className="max-w-md w-full surface-gradient rounded-2xl p-8 hairline text-center space-y-4">
          <div className="w-16 h-16 mx-auto rounded-full bg-destructive/10 grid place-items-center">
            <Lock className="w-8 h-8 text-destructive" />
          </div>
          <h1 className="font-display text-3xl font-bold">
            {isFull ? "Workshop Full" : "Registration Closed"}
          </h1>
          <p className="text-muted-foreground leading-relaxed">
            {isFull
              ? `Sorry, all seats for ${event.event_name} have been taken.`
              : `The registration window for ${event.event_name} has ended.`}{" "}
            Please contact the organiser for more information.
          </p>
          <Link to="/" className="block mt-6">
            <Button variant="outline">Go home</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <header className="container px-4 sm:px-6 flex items-center justify-between h-16">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gold-gradient grid place-items-center shrink-0">
            <GraduationCap className="w-4 h-4 text-primary-foreground" />
          </div>
          <span className="font-display text-lg font-semibold truncate">
            Workshop <span className="text-gold">Manager</span>
          </span>
        </Link>
      </header>

      <main className="container px-4 sm:px-6 max-w-2xl py-6 sm:py-8 space-y-4 sm:space-y-6">
        <div className="surface-gradient rounded-2xl p-5 sm:p-8 hairline shadow-card">
          <div className="flex gap-6">
            {event.image_url && (
              <div className="w-32 sm:w-40 shrink-0 overflow-hidden rounded-xl border border-border/50 aspect-[3/4]">
                <img
                  src={event.image_url}
                  alt="Workshop banner"
                  className="w-full h-full object-cover"
                />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-[10px] sm:text-xs uppercase tracking-wider text-gold mb-2">
                You're joining
              </p>
              <h1 className="font-display text-2xl sm:text-3xl md:text-4xl font-bold leading-tight">
                {event.event_name}
              </h1>
              <div className="text-sm sm:text-base text-muted-foreground mt-4 space-y-2">
                <div className="flex items-start gap-2">
                  <Calendar className="w-4 h-4 shrink-0 mt-1 text-gold/70" />
                  <div>
                    {(() => {
                      const parseLocal = (d: string) => {
                        return new Date(d.replace(" ", "T"));
                      };
                      const start = parseLocal(event.event_date);
                      const end = event.end_date ? parseLocal(event.end_date) : null;
                      
                      return (
                        <>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-gold/80 uppercase tracking-widest w-10">Start</span>
                            <p className="text-foreground">{format(start, "PPPP 'at' p")}</p>
                          </div>
                          {end && (
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-[10px] font-bold text-gold/80 uppercase tracking-widest w-10">End</span>
                              <p className="text-foreground">{format(end, "PPPP 'at' p")}</p>
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>
                </div>
              </div>
              {event.notes && (
                <p className="text-sm text-muted-foreground mt-3">
                  {event.notes}
                </p>
              )}
              <div className="mt-4 flex flex-wrap gap-2">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 hairline">
                  <span className="text-sm text-muted-foreground">Fee:</span>
                  <span className="font-semibold text-gold">
                    {event.currency || "USD"}{" "}
                    {Number(event.price_per_head).toLocaleString()}
                  </span>
                </div>
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-secondary/50 hairline">
                  <span className="text-sm text-muted-foreground">Slots Available:</span>
                  <span className="font-semibold text-foreground">
                    {Math.max(0, event.max_students - event.attendees_count)}
                  </span>
                </div>
              </div>
              {event.photographer_name && (
                <div className="mt-4 p-4 bg-secondary/50 rounded-lg">
                  <h3 className="text-sm font-medium mb-3">
                    Photographer Details
                  </h3>
                  <div className="flex items-start gap-3">
                    {event.photographer_avatar ? (
                      <img
                        src={event.photographer_avatar}
                        alt={event.photographer_name}
                        className="w-12 h-12 rounded-full object-cover hairline"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-secondary grid place-items-center">
                        <GraduationCap className="w-6 h-6 text-gold" />
                      </div>
                    )}
                    <div className="flex-1 space-y-1">
                      <p className="text-sm font-medium">
                        {event.photographer_name}
                      </p>
                      {event.photographer_email && (
                        <p className="text-xs text-muted-foreground">
                          Email: {event.photographer_email}
                        </p>
                      )}
                      {event.photographer_phone && (
                        <p className="text-xs text-muted-foreground">
                          Phone: {event.photographer_phone}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="surface-gradient rounded-2xl p-5 sm:p-8 hairline shadow-card space-y-5"
        >
          <div>
            <h2 className="font-display text-lg sm:text-xl font-semibold">
              Your details
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Fill in your info and upload your payment slip image.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="student_name">
                Full name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="student_name"
                name="student_name"
                required
                maxLength={120}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">
                Email <span className="text-destructive">*</span>
              </Label>
              <Input
                id="email"
                name="email"
                type="email"
                required
                maxLength={255}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">
                Phone <span className="text-destructive">*</span>
              </Label>
              <Input
                id="phone"
                name="phone"
                type="tel"
                required
                maxLength={40}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="note">Note (optional)</Label>
              <Textarea
                id="note"
                name="note"
                rows={3}
                maxLength={1000}
                placeholder="Anything we should know?"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>
              Payment slip <span className="text-destructive">*</span>
            </Label>
            <label
              htmlFor="slip"
              className="block cursor-pointer rounded-xl border-2 border-dashed border-border hover:border-primary/50 transition-colors p-6 text-center"
            >
              {preview ? (
                <div className="space-y-3">
                  <img
                    src={preview}
                    alt="Payment slip preview"
                    className="max-h-64 mx-auto rounded-lg hairline"
                  />
                  <p className="text-xs text-muted-foreground">
                    {slip?.name} — click to change
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="w-12 h-12 mx-auto rounded-full bg-secondary grid place-items-center">
                    <ImageIcon className="w-5 h-5 text-gold" />
                  </div>
                  <p className="font-medium">Click to upload payment slip</p>
                  <p className="text-xs text-muted-foreground">
                    PNG, JPG up to 5MB
                  </p>
                </div>
              )}
              <input
                id="slip"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFile}
              />
            </label>
          </div>

          <Button
            type="submit"
            variant="hero"
            size="lg"
            className="w-full"
            disabled={submitting}
          >
            {submitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <Upload className="w-4 h-4" /> Submit request
              </>
            )}
          </Button>
        </form>

        <p className="text-center text-xs text-muted-foreground pb-8">
          Powered by <span className="font-display">Workshop Manager</span>
        </p>
      </main>
    </div>
  );
};

export default Join;
