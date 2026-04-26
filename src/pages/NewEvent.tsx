import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { EventService } from "@/integrations/mysql/services";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

const schema = z.object({
  event_name: z.string().trim().min(1, "Name required").max(120),
  event_date: z.string().min(1, "Date required"),
  price_per_head: z.number().nonnegative("Must be ≥ 0").max(1_000_000),
  max_students: z.number().int().nonnegative("Must be ≥ 0").max(10_000),
  notes: z.string().max(1000).optional(),
});

const NewEvent = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) return;
    const fd = new FormData(e.currentTarget);
    const parsed = schema.safeParse({
      event_name: String(fd.get("event_name") ?? ""),
      event_date: String(fd.get("event_date") ?? ""),
      price_per_head: Number(fd.get("price_per_head") ?? 0),
      max_students: Number(fd.get("max_students") ?? 0),
      notes: String(fd.get("notes") ?? ""),
    });
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);

    setLoading(true);
    try {
      const result = await EventService.createEvent(user.id, {
        event_name: parsed.data.event_name,
        event_date: new Date(parsed.data.event_date)
          .toISOString()
          .slice(0, 19)
          .replace("T", " "),
        price_per_head: parsed.data.price_per_head,
        max_students: parsed.data.max_students,
        notes: parsed.data.notes || undefined,
      });
      toast.success("Event created");
      navigate("/dashboard");
    } catch (error) {
      console.error("Failed to create event:", error);
      toast.error("Failed to create event");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <Button variant="ghost" onClick={() => navigate(-1)} className="-ml-3">
        <ArrowLeft className="w-4 h-4" /> Back
      </Button>

      <div>
        <h1 className="font-display text-4xl md:text-5xl font-bold tracking-tight">
          Create <span className="text-gold-gradient">workshop</span>
        </h1>
        <p className="text-muted-foreground mt-2">
          Set up your workshop details.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="surface-gradient rounded-2xl p-6 sm:p-8 hairline shadow-card space-y-5"
      >
        <div className="space-y-2">
          <Label htmlFor="event_name">Workshop name</Label>
          <Input
            id="event_name"
            name="event_name"
            placeholder="Lightroom Mastery Workshop"
            required
            maxLength={120}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="event_date">Date & time</Label>
          <Input
            id="event_date"
            name="event_date"
            type="datetime-local"
            required
          />
        </div>

        <div className="grid sm:grid-cols-2 gap-5">
          <div className="space-y-2">
            <Label htmlFor="price_per_head">Price per student (Rs)</Label>
            <Input
              id="price_per_head"
              name="price_per_head"
              type="number"
              min="0"
              step="0.01"
              defaultValue="0"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="max_students">Max students</Label>
            <Input
              id="max_students"
              name="max_students"
              type="number"
              min="0"
              defaultValue="10"
              required
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="notes">Notes (optional)</Label>
          <Textarea
            id="notes"
            name="notes"
            rows={3}
            placeholder="Location, gear, agenda..."
            maxLength={1000}
          />
        </div>

        <div className="flex gap-3 pt-2">
          <Button type="submit" variant="hero" size="lg" disabled={loading}>
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              "Create workshop"
            )}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={() => navigate(-1)}
          >
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
};

export default NewEvent;
