import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import {
  User,
  Mail,
  Phone,
  MapPin,
  Camera,
  Save,
  Trash2,
  Shield,
  Pencil,
  X,
  AlertTriangle,
  Package,
  Crown,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { ProfileService } from "@/integrations/mysql/services";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { API_BASE_URL } from "@/lib/api";

const Profile = () => {
  const { user, signOut, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [profile, setProfile] = useState<any>(null);
  const [form, setForm] = useState({
    display_name: "",
    phone: "",
    address: "",
    avatar_url: "",
  });

  const load = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const data = await ProfileService.getFullProfile(user.id);
      setProfile(data);
      if (data) {
        setForm({
          display_name: data.display_name || "",
          phone: data.phone || "",
          address: data.address || "",
          avatar_url: data.avatar_url || "",
        });
      }
    } catch (err) {
      console.error("Failed to load profile:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [user]);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    try {
      const res = await fetch(`${API_BASE_URL}/api/upload`, { method: "POST", body: fd });
      const data = await res.json();
      if (data.url) {
        setForm((f) => ({ ...f, avatar_url: data.url }));
        toast.success("Photo uploaded");
      }
    } catch {
      toast.error("Upload failed");
    }
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      await ProfileService.updateProfile(user.id, form);
      toast.success("Profile updated!");
      setEditing(false);
      await load();
      await refreshProfile();
    } catch (err) {
      toast.error("Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!user || deleteConfirm !== "DELETE") return;
    setDeleting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/delete-account`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id }),
      });
      if (!res.ok) throw new Error("Failed");
      toast.success("Account deleted. A confirmation email has been sent.");
      await signOut();
      navigate("/auth");
    } catch {
      toast.error("Failed to delete account");
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 max-w-3xl mx-auto">
        <Skeleton className="h-12 w-48 rounded-2xl" />
        <Skeleton className="h-80 rounded-2xl" />
        <Skeleton className="h-48 rounded-2xl" />
      </div>
    );
  }

  const avatarSrc = editing ? form.avatar_url : profile?.avatar_url;

  return (
    <div className="space-y-8 max-w-3xl mx-auto">
      {/* Header */}
      <div>
        <p className="text-sm text-muted-foreground mb-1 uppercase tracking-widest font-medium opacity-70">
          Account
        </p>
        <h1 className="font-display text-4xl md:text-5xl font-bold tracking-tight">
          Your <span className="text-gold-gradient">Profile</span>
        </h1>
      </div>

      {/* Profile Card */}
      <div className="surface-gradient rounded-2xl hairline shadow-card animate-fade-in overflow-hidden">
        {/* Avatar + Name Banner */}
        <div className="relative px-6 pt-8 pb-6 flex flex-col sm:flex-row items-center gap-6">
          {/* Avatar */}
          <div className="relative group">
            <div className="w-28 h-28 rounded-2xl overflow-hidden border-2 border-gold/30 shadow-gold bg-secondary grid place-items-center">
              {avatarSrc ? (
                <img src={avatarSrc} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <User className="w-12 h-12 text-gold/40" />
              )}
            </div>
            {editing && (
              <button
                onClick={() => fileRef.current?.click()}
                className="absolute inset-0 rounded-2xl bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity grid place-items-center cursor-pointer"
              >
                <Camera className="w-6 h-6 text-white" />
              </button>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarUpload}
            />
          </div>

          {/* Name & Email */}
          <div className="flex-1 text-center sm:text-left">
            <h2 className="font-display text-2xl font-bold">
              {profile?.display_name || "No name set"}
            </h2>
            <p className="text-sm text-muted-foreground flex items-center justify-center sm:justify-start gap-1.5 mt-1">
              <Mail className="w-3.5 h-3.5 text-gold/70" />
              {profile?.email}
            </p>
            {profile?.member_since && (
              <p className="text-xs text-muted-foreground mt-1 opacity-60">
                Member since {format(new Date(profile.member_since), "MMMM yyyy")}
              </p>
            )}
          </div>

          {/* Edit Toggle */}
          {!editing ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditing(true)}
              className="border-gold/20 hover:bg-gold/10 hover:text-gold"
            >
              <Pencil className="w-4 h-4 mr-1.5" /> Edit
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setEditing(false); load(); }}
            >
              <X className="w-4 h-4 mr-1" /> Cancel
            </Button>
          )}
        </div>

        {/* Fields */}
        <div className="px-6 pb-8 space-y-5">
          <div className="grid sm:grid-cols-2 gap-5">
            <FieldRow
              icon={User}
              label="Full Name"
              value={profile?.display_name || "—"}
              editing={editing}
              inputValue={form.display_name}
              onChange={(v) => setForm((f) => ({ ...f, display_name: v }))}
              placeholder="Your name"
            />
            <FieldRow
              icon={Phone}
              label="Phone"
              value={profile?.phone || "—"}
              editing={editing}
              inputValue={form.phone}
              onChange={(v) => setForm((f) => ({ ...f, phone: v }))}
              placeholder="+94 7X XXX XXXX"
            />
            <FieldRow
              icon={Mail}
              label="Email"
              value={profile?.email || "—"}
              editing={false}
              inputValue=""
              onChange={() => {}}
              placeholder=""
            />
            <FieldRow
              icon={MapPin}
              label="Address"
              value={profile?.address || "—"}
              editing={editing}
              inputValue={form.address}
              onChange={(v) => setForm((f) => ({ ...f, address: v }))}
              placeholder="Your address"
            />
          </div>

          {editing && (
            <div className="flex justify-end pt-2">
              <Button
                variant="hero"
                onClick={handleSave}
                disabled={saving}
                className="shadow-gold-lg"
              >
                <Save className="w-4 h-4 mr-1.5" />
                {saving ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Package Details */}
      <div className="surface-gradient rounded-2xl p-6 hairline shadow-card animate-fade-in">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-gold-gradient grid place-items-center">
            <Crown className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h3 className="font-display text-lg font-bold">Active Package</h3>
            <p className="text-xs text-muted-foreground">Your current subscription plan</p>
          </div>
          <span className="ml-auto px-3 py-1 rounded-full bg-gold/10 text-gold text-[10px] uppercase tracking-widest font-bold border border-gold/20 shadow-glow-sm">
            {profile?.package_name || "Free"}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <PkgStat label="Max Workshops" value={profile?.max_workshops ?? "—"} />
          <PkgStat label="Max Students" value={profile?.max_students_per_workshop ?? "—"} />
          <PkgStat label="Max Slip Size" value={profile?.max_slip_size_mb ? `${profile.max_slip_size_mb}MB` : "—"} />
          <PkgStat label="Price" value={profile?.package_price ? `Rs ${Number(profile.package_price).toLocaleString()}` : "Free"} />
        </div>
      </div>

      {/* Danger Zone */}
      <div className="surface-gradient rounded-2xl p-6 hairline border-destructive/20 shadow-card animate-fade-in">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-destructive/20 grid place-items-center">
            <Shield className="w-5 h-5 text-destructive" />
          </div>
          <div>
            <h3 className="font-display text-lg font-bold text-destructive">Danger Zone</h3>
            <p className="text-xs text-muted-foreground">Irreversible actions</p>
          </div>
        </div>

        {!showDelete ? (
          <Button
            variant="outline"
            className="border-destructive/30 text-destructive hover:bg-destructive/10"
            onClick={() => setShowDelete(true)}
          >
            <Trash2 className="w-4 h-4 mr-1.5" /> Delete Account
          </Button>
        ) : (
          <div className="p-5 rounded-xl bg-destructive/5 border border-destructive/20 space-y-4 animate-fade-in">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-destructive">
                  This action is permanent and cannot be undone.
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  All your workshops, student records, uploaded images, and payment data will be permanently deleted. A confirmation email will be sent to your email address.
                </p>
              </div>
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">
                Type <strong className="text-foreground">DELETE</strong> to confirm
              </label>
              <Input
                value={deleteConfirm}
                onChange={(e) => setDeleteConfirm(e.target.value)}
                placeholder="DELETE"
                className="max-w-xs bg-secondary/30 border-destructive/30 focus:border-destructive"
              />
            </div>

            <div className="flex gap-3">
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={deleteConfirm !== "DELETE" || deleting}
              >
                <Trash2 className="w-4 h-4 mr-1.5" />
                {deleting ? "Deleting..." : "Permanently Delete"}
              </Button>
              <Button
                variant="ghost"
                onClick={() => { setShowDelete(false); setDeleteConfirm(""); }}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

/* ─── Sub-components ──────────────────────────────────── */

const FieldRow = ({
  icon: Icon,
  label,
  value,
  editing,
  inputValue,
  onChange,
  placeholder,
}: {
  icon: any;
  label: string;
  value: string;
  editing: boolean;
  inputValue: string;
  onChange: (v: string) => void;
  placeholder: string;
}) => (
  <div className="p-4 rounded-xl bg-secondary/20 border border-border/30 hover:border-gold/20 transition-colors">
    <div className="flex items-center gap-2 mb-2">
      <Icon className="w-3.5 h-3.5 text-gold/70" />
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
        {label}
      </span>
    </div>
    {editing ? (
      <Input
        value={inputValue}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-9 bg-secondary/40 border-border/50 text-sm"
      />
    ) : (
      <p className="text-sm font-medium truncate">{value}</p>
    )}
  </div>
);

const PkgStat = ({ label, value }: { label: string; value: string | number }) => (
  <div className="p-3 rounded-xl bg-secondary/30 border border-border/50 transition-colors hover:bg-secondary/50">
    <span className="text-[10px] uppercase tracking-wider text-muted-foreground block mb-1">
      {label}
    </span>
    <span className="text-sm font-bold">{value}</span>
  </div>
);

export default Profile;
