import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { z } from "zod";
import { ArrowLeft, Loader2, Plus, ImageIcon } from "lucide-react";
import { EventService } from "@/integrations/mysql/services";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

const schema = z.object({
  event_name: z.string().trim().min(1, "Name required").max(120),
  event_date: z.string().min(1, "Start date required"),
  end_date: z.string().optional(),
  location: z.string().trim().min(1, "Location required").max(255),
  for_whom: z.string().trim().min(1, "Target audience required").max(255),
  price_per_head: z.number().nonnegative("Must be ≥ 0").max(1_000_000),
  max_students: z.number().int().nonnegative("Must be ≥ 0").max(10_000),
  notes: z.string().max(1000).optional(),
});

// Convert "YYYY-MM-DD HH:mm:ss" → "YYYY-MM-DDTHH:mm" for datetime-local inputs
const toInputValue = (dateStr?: string | null) => {
  if (!dateStr) return "";
  return dateStr.replace(" ", "T").slice(0, 16);
};

const toDbDate = (dateStr: string) =>
  new Date(dateStr).toISOString().slice(0, 19).replace("T", " ");

const EditEvent = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [event, setEvent] = useState<Record<string, string> | null>(null);

  // Image state
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [existingImageUrl, setExistingImageUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    EventService.getEventById(id).then((data) => {
      if (data) {
        setEvent(data as Record<string, string>);
        setExistingImageUrl(data.image_url || null);
        setPreview(data.image_url || null);
      }
      setFetching(false);
    });
  }, [id]);

  const validateImage = (file: File): Promise<boolean> => {
    return new Promise((resolve) => {
      if (file.size > 1024 * 1024) {
        toast.error("Image must be less than 1MB");
        return resolve(false);
      }
      if (!["image/jpeg", "image/png", "image/jpg"].includes(file.type)) {
        toast.error("Only JPEG or PNG images are allowed");
        return resolve(false);
      }
      const img = new Image();
      img.src = URL.createObjectURL(file);
      img.onload = () => {
        const ratio = img.width / img.height;
        const targetRatio = 3 / 4;
        if (Math.abs(ratio - targetRatio) > 0.05) {
          toast.error("Image must have a 3:4 aspect ratio");
          resolve(false);
        } else {
          resolve(true);
        }
      };
      img.onerror = () => { toast.error("Invalid image file"); resolve(false); };
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    const isValid = await validateImage(selected);
    if (isValid) {
      setFile(selected);
      setPreview(URL.createObjectURL(selected));
    } else {
      e.target.value = "";
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!id) return;

    const fd = new FormData(e.currentTarget);
    const parsed = schema.safeParse({
      event_name: String(fd.get("event_name") ?? ""),
      event_date: String(fd.get("event_date") ?? ""),
      end_date: String(fd.get("end_date") ?? ""),
      location: String(fd.get("location") ?? ""),
      for_whom: String(fd.get("for_whom") ?? ""),
      price_per_head: Number(fd.get("price_per_head") ?? 0),
      max_students: Number(fd.get("max_students") ?? 0),
      notes: String(fd.get("notes") ?? ""),
    });
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);

    setLoading(true);
    try {
      let imageUrl = existingImageUrl;

      // Upload new image if selected
      if (file) {
        const uploadFd = new FormData();
        uploadFd.append("file", file);
        const uploadRes = await fetch("/api/upload", { method: "POST", body: uploadFd });
        if (!uploadRes.ok) throw new Error("Upload failed");
        const { url } = await uploadRes.json();
        imageUrl = url;
      }

      await EventService.updateEvent(id, {
        event_name: parsed.data.event_name,
        event_date: toDbDate(parsed.data.event_date),
        end_date: parsed.data.end_date ? toDbDate(parsed.data.end_date) : undefined,
        location: parsed.data.location,
        for_whom: parsed.data.for_whom,
        image_url: imageUrl || undefined,
        price_per_head: parsed.data.price_per_head,
        max_students: parsed.data.max_students,
        notes: parsed.data.notes || undefined,
      });

      toast.success("Workshop updated successfully");
      navigate(`/events/${id}`);
    } catch (error) {
      console.error("Failed to update event:", error);
      toast.error("Failed to update workshop");
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <Skeleton className="h-10 w-32" />
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96 rounded-2xl" />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="text-center py-20">
        <p className="text-muted-foreground">Workshop not found.</p>
        <Button onClick={() => navigate("/dashboard")} className="mt-4">Back to dashboard</Button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8 pb-12">
      <Button variant="ghost" onClick={() => navigate(-1)} className="-ml-3 hover:bg-secondary">
        <ArrowLeft className="w-4 h-4 mr-1" /> Back
      </Button>

      <div>
        <h1 className="font-display text-4xl md:text-5xl font-bold tracking-tight">
          Edit <span className="text-gold-gradient">workshop</span>
        </h1>
        <p className="text-muted-foreground mt-2">Update the details for your workshop.</p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="surface-gradient rounded-2xl p-6 sm:p-8 hairline shadow-card space-y-6"
      >
        <div className="space-y-6">
          {/* Cover Image */}
          <div className="space-y-2">
            <Label>Workshop Cover Image (3:4 ratio, max 1MB)</Label>
            <div
              className={`relative h-64 w-48 mx-auto rounded-xl border-2 border-dashed transition-all flex flex-col items-center justify-center overflow-hidden bg-secondary/20 cursor-pointer ${preview ? "border-gold/50" : "border-border/50 hover:border-gold/30"}`}
              onClick={() => document.getElementById("file-upload-edit")?.click()}
            >
              {preview ? (
                <img src={preview} alt="Preview" className="w-full h-full object-cover" />
              ) : (
                <div className="text-center p-4">
                  <ImageIcon className="w-8 h-8 mx-auto text-gold mb-2" />
                  <p className="text-xs text-muted-foreground">Click to replace image</p>
                </div>
              )}
              <input
                id="file-upload-edit"
                type="file"
                className="hidden"
                accept="image/jpeg,image/png"
                onChange={handleFileChange}
              />
            </div>
            {preview && (
              <p className="text-center text-xs text-muted-foreground mt-1">
                Click image to replace
              </p>
            )}
          </div>

          {/* Workshop Name */}
          <div className="space-y-2">
            <Label htmlFor="event_name">Workshop Name</Label>
            <Input
              id="event_name" name="event_name"
              defaultValue={event.event_name}
              placeholder="e.g. Professional Portrait Lighting"
              required maxLength={120} className="bg-secondary/30"
            />
          </div>

          {/* Dates */}
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="event_date">Start Date & Time</Label>
              <Input
                id="event_date" name="event_date" type="datetime-local"
                defaultValue={toInputValue(event.event_date)}
                required className="bg-secondary/30"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end_date">End Date & Time</Label>
              <Input
                id="end_date" name="end_date" type="datetime-local"
                defaultValue={toInputValue(event.end_date)}
                className="bg-secondary/30"
              />
            </div>
          </div>

          {/* Location */}
          <div className="space-y-2">
            <Label htmlFor="location">Location</Label>
            <Input
              id="location" name="location"
              defaultValue={event.location}
              placeholder="e.g. Viharamahadevi Park, Colombo"
              required maxLength={255} className="bg-secondary/30"
            />
          </div>

          {/* For Whom / Price / Max Students in one row */}
          <div className="grid sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="for_whom">For Whom</Label>
              <Input
                id="for_whom" name="for_whom"
                defaultValue={event.for_whom}
                placeholder="e.g. Beginners"
                required maxLength={255} className="bg-secondary/30"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="price_per_head">Price per Student (Rs)</Label>
              <Input
                id="price_per_head" name="price_per_head" type="number"
                min="0" step="0.01"
                defaultValue={event.price_per_head}
                required className="bg-secondary/30"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="max_students">Max Students</Label>
              <Input
                id="max_students" name="max_students" type="number"
                min="0"
                defaultValue={event.max_students}
                required className="bg-secondary/30"
              />
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes & Agenda</Label>
            <Textarea
              id="notes" name="notes" rows={4}
              defaultValue={event.notes || ""}
              placeholder="Provide more details about the workshop..."
              maxLength={1000} className="bg-secondary/30"
            />
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-border/50">
          <Button type="submit" variant="hero" size="lg" disabled={loading} className="sm:flex-1">
            {loading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : "Save Changes"}
          </Button>
          <Button type="button" variant="outline" size="lg" onClick={() => navigate(-1)} className="sm:w-32">
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
};

export default EditEvent;
