"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  getDoctorProfile,
  updateAppointmentStatus,
  addDoctorGalleryPhoto,
  deleteDoctorGalleryPhoto,
  updateDoctorAvailability,
} from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  BarChart3,
  Calendar,
  Eye,
  Globe,
  MessageCircle,
  Settings,
  Trash2,
  ImagePlus,
  Loader2,
} from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { AppointmentStatus, DoctorAppointment, DoctorGalleryItem, DoctorProfile } from "@/lib/doctor";
import { doctorPublicUrl } from "@/lib/doctor";

export default function DoctorManagePage() {
  const { roles, loading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && !roles.includes("doctor")) {
      router.replace("/unauthorized");
    }
  }, [authLoading, roles, router]);

  const [loading, setLoading] = useState(true);
  const [doctor, setDoctor] = useState<DoctorProfile | null>(null);
  const [appointments, setAppointments] = useState<DoctorAppointment[]>([]);
  const [gallery, setGallery] = useState<DoctorGalleryItem[]>([]);
  const [referredBookings, setReferredBookings] = useState<any[]>([]);
  const [newImage, setNewImage] = useState({ image_url: "", caption: "" });
  const [submittingImage, setSubmittingImage] = useState(false);

  const load = async () => {
    try {
      const res = await getDoctorProfile();
      if (!res) {
        setDoctor(null);
        return;
      }
      setDoctor(res.doctor as DoctorProfile);
      setAppointments(res.appointments as DoctorAppointment[]);
      setGallery(res.gallery as DoctorGalleryItem[]);
      setReferredBookings(res.referredBookings || []);
    } catch (err: any) {
      toast.error("Failed to load doctor profile");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleUpdateStatus = async (id: string, status: AppointmentStatus) => {
    try {
      const res = await updateAppointmentStatus(id, status);
      if (res.success) {
        toast.success("Status updated successfully");
        load();
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to update status");
    }
  };

  const handleAddGallery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!doctor || !newImage.image_url) return;
    setSubmittingImage(true);
    try {
      const res = await addDoctorGalleryPhoto(newImage.image_url, newImage.caption);
      if (res.success) {
        setNewImage({ image_url: "", caption: "" });
        toast.success("Photo added to gallery");
        load();
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to add photo");
    } finally {
      setSubmittingImage(false);
    }
  };

  const handleRemoveGallery = async (id: string) => {
    try {
      const res = await deleteDoctorGalleryPhoto(id);
      if (res.success) {
        toast.success("Photo removed");
        load();
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to remove photo");
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!doctor) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center glass-card mt-10">
        <h1 className="text-2xl font-bold font-sans">Doctor Dashboard</h1>
        <p className="mt-2 text-muted-foreground max-w-md mx-auto">
          Create your professional profile to get your auto-generated mini website and start receiving bookings.
        </p>
        <div className="mt-6">
          <Button asChild className="min-h-11 px-6">
            <Link href="/doctor-setup">Set up Professional Profile</Link>
          </Button>
        </div>
      </div>
    );
  }

  const pendingCount = appointments.filter((a) => a.status === "pending").length;
  const siteUrl = doctorPublicUrl(doctor.slug);

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 space-y-8">
      {/* Header Panel */}
      <div className="flex flex-wrap items-start justify-between gap-4 border-b pb-6">
        <div>
          <h1 className="text-3xl font-extrabold font-sans bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Doctor Dashboard
          </h1>
          <p className="mt-1.5 text-muted-foreground text-sm">
            Manage consultations, appointment requests, clinic gallery, and track your metrics.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2">
            <div className="flex items-center gap-2">
              <Globe className="h-4 w-4 text-primary shrink-0" />
              <a
                href={siteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-semibold text-primary hover:underline truncate max-w-xs sm:max-w-md"
              >
                {siteUrl}
              </a>
            </div>
            
            <div className="flex items-center gap-2 rounded-lg border bg-card/50 px-3 py-1">
              <span className={`h-2 w-2 rounded-full ${doctor.is_available !== false ? "bg-emerald-500 animate-pulse" : "bg-destructive"}`} />
              <span className="text-xs font-medium">{doctor.is_available !== false ? "Available" : "On Leave"}</span>
              <Switch
                className="ml-2"
                checked={doctor.is_available !== false}
                onCheckedChange={async (checked) => {
                  try {
                    const res = await updateDoctorAvailability(checked);
                    if (res.success) {
                      setDoctor((prev: any) => ({ ...prev, is_available: checked }));
                      toast.success(checked ? "Status: Available" : "Status: On Leave");
                    }
                  } catch (err: any) {
                    toast.error(err.message || "Failed to update status");
                  }
                }}
              />
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm" className="glass">
            <a href={`/doctors/${doctor.slug}`} target="_blank" rel="noopener noreferrer">
              <Eye className="mr-1.5 h-4 w-4 text-primary" /> View Mini Site
            </a>
          </Button>
          <Button asChild size="sm">
            <Link href="/doctor-setup">
              <Settings className="mr-1.5 h-4 w-4" /> Edit Profile
            </Link>
          </Button>
        </div>
      </div>

      {/* Analytics Stats Grid */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Stat icon={Eye} label="Profile Views" value={doctor.profile_views} />
        <Stat icon={Calendar} label="Appointments" value={appointments.length} />
        <Stat icon={MessageCircle} label="WhatsApp Clicks" value={doctor.whatsapp_clicks} />
        <Stat icon={BarChart3} label="Rating" value={doctor.rating > 0 ? `${doctor.rating} ★` : "New"} />
      </div>

      {pendingCount > 0 && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3.5 text-sm text-amber-500 font-semibold flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
          </span>
          You have {pendingCount} pending appointment request{pendingCount > 1 ? "s" : ""} requiring action.
        </div>
      )}

      {/* Appointment Requests Section */}
      <section className="glass-card p-6 rounded-2xl shadow-sm">
        <h2 className="text-xl font-bold font-sans border-b pb-3 mb-4">Patient Appointment Requests</h2>
        <div className="space-y-3">
          {appointments.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No requests yet. Share your mini-website link to get bookings.
            </div>
          ) : (
            appointments.map((a) => (
              <div
                key={a.id}
                className="flex flex-wrap items-center justify-between gap-4 rounded-xl border bg-card/40 p-4 hover:bg-card/70 transition-all"
              >
                <div>
                  <p className="font-bold text-foreground text-base">{a.patient_name}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Phone: {a.patient_phone} · Preferred Date: <strong className="text-foreground">{a.preferred_date}</strong>
                  </p>
                  {a.symptoms && (
                    <div className="mt-2 text-xs bg-muted/50 p-2 rounded-lg text-muted-foreground border">
                      <strong className="text-foreground">Symptoms:</strong> {a.symptoms}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant={a.status === "pending" ? "secondary" : "outline"} className="capitalize">
                    {a.status}
                  </Badge>
                  <Select value={a.status} onValueChange={(v) => handleUpdateStatus(a.id, v as AppointmentStatus)}>
                    <SelectTrigger className="w-[120px] min-h-9 glass bg-card">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(["pending", "confirmed", "completed", "cancelled"] as const).map((s) => (
                        <SelectItem key={s} value={s} className="capitalize">
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {/* Clinic Gallery Section */}
      <section className="glass-card p-6 rounded-2xl shadow-sm space-y-4">
        <div>
          <h2 className="text-xl font-bold font-sans">Clinic Gallery Photos</h2>
          <p className="text-xs text-muted-foreground mt-1">
            Showcase your facility. These images will be displayed on your public profile.
          </p>
        </div>

        <form onSubmit={handleAddGallery} className="flex flex-wrap gap-4 rounded-xl border bg-card/20 p-4 items-end">
          <div className="min-w-0 w-full flex-1 space-y-1.5 sm:min-w-[15rem]">
            <Label className="text-xs font-semibold uppercase tracking-wider text-primary">Image URL</Label>
            <Input
              required
              value={newImage.image_url}
              onChange={(e) => setNewImage({ ...newImage, image_url: e.target.value })}
              placeholder="e.g. https://images.unsplash.com/photo-..."
              className="glass"
            />
          </div>
          <div className="min-w-0 w-full flex-1 space-y-1.5 sm:min-w-[10rem]">
            <Label className="text-xs font-semibold uppercase tracking-wider text-primary">Caption (Optional)</Label>
            <Input
              value={newImage.caption}
              onChange={(e) => setNewImage({ ...newImage, caption: e.target.value })}
              placeholder="e.g. Waiting Lounge"
              className="glass"
            />
          </div>
          <Button type="submit" className="min-h-11 px-5" disabled={submittingImage}>
            {submittingImage ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ImagePlus className="mr-1.5 h-4 w-4" />}
            Add Photo
          </Button>
        </form>

        <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 mt-4">
          {gallery.map((g) => (
            <div key={g.id} className="relative overflow-hidden rounded-xl border group shadow-sm bg-card/50 aspect-video">
              <img src={g.image_url} alt={g.caption || ""} className="w-full h-full object-cover transition-transform group-hover:scale-105" />
              {g.caption && (
                <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[10px] px-2 py-1 truncate">
                  {g.caption}
                </div>
              )}
              <Button
                type="button"
                size="icon"
                variant="destructive"
                className="absolute right-2 top-2 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => handleRemoveGallery(g.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      </section>

      {/* Referred Pathology Bookings & Commissions */}
      <section className="glass-card p-6 rounded-2xl shadow-sm space-y-6">
        <div>
          <h2 className="text-xl font-bold font-sans">Pathology Referrals & Commission Earnings</h2>
          <p className="text-xs text-muted-foreground mt-1">
            Track patients you referred for lab tests, view status updates, and monitor your referral commissions.
          </p>
        </div>

        {/* Commission stats */}
        <div className="grid gap-4 grid-cols-3">
          <div className="rounded-xl border bg-muted/20 p-4">
            <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Total Referred</span>
            <div className="text-xl font-extrabold mt-1">{referredBookings.length} cases</div>
          </div>
          <div className="rounded-xl border bg-muted/20 p-4">
            <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Earned Commission</span>
            <div className="text-xl font-extrabold mt-1 text-emerald-600 dark:text-emerald-400">
              ₹{referredBookings
                .filter(b => b.status === "completed" || b.status === "fnf")
                .reduce((acc, curr) => acc + Number(curr.commission_amount || 0), 0)
                .toFixed(0)}
            </div>
          </div>
          <div className="rounded-xl border bg-muted/20 p-4">
            <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Pending Commission</span>
            <div className="text-xl font-extrabold mt-1 text-amber-600 dark:text-amber-400">
              ₹{referredBookings
                .filter(b => b.status !== "completed" && b.status !== "fnf" && b.status !== "cancelled")
                .reduce((acc, curr) => acc + Number(curr.commission_amount || 0), 0)
                .toFixed(0)}
            </div>
          </div>
        </div>

        <div className="space-y-3">
          {referredBookings.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              No referred pathology bookings recorded yet.
            </div>
          ) : (
            <div className="border rounded-xl overflow-hidden bg-card/40">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow>
                    <TableHead>Patient Name</TableHead>
                    <TableHead>Test Details</TableHead>
                    <TableHead>Test Price</TableHead>
                    <TableHead>Commission</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {referredBookings.map((b) => (
                    <TableRow key={b.id}>
                      <TableCell className="font-semibold">{b.profiles?.full_name || "Patient"}</TableCell>
                      <TableCell>
                        <div>{b.tests?.name || "Blood Test"}</div>
                        <div className="text-[10px] text-muted-foreground">
                          {new Date(b.scheduled_at).toLocaleDateString()}
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">₹{Number(b.price).toFixed(0)}</TableCell>
                      <TableCell className="font-bold text-primary">₹{Number(b.commission_amount || 0).toFixed(0)}</TableCell>
                      <TableCell>
                        <Badge
                          className={
                            b.status === "completed"
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300 border-none capitalize text-xs"
                              : b.status === "fnf"
                              ? "bg-indigo-100 text-indigo-800 dark:bg-indigo-950/30 dark:text-indigo-300 border-none capitalize text-xs"
                              : b.status === "cancelled"
                              ? "bg-rose-100 text-rose-800 dark:bg-rose-950/30 dark:text-rose-300 border-none capitalize text-xs"
                              : "bg-amber-100 text-amber-800 dark:bg-amber-950/30 dark:text-amber-300 border-none capitalize text-xs"
                          }
                        >
                          {b.status.replace("_", " ")}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: any; label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border bg-card/30 glass p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{label}</span>
        <Icon className="h-4 w-4 text-primary shrink-0" />
      </div>
      <div className="mt-2 text-2xl font-extrabold tracking-tight text-foreground">{value}</div>
    </div>
  );
}
