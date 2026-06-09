"use client";

import { useAuth } from "@/lib/auth";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { CallAlertsBanner } from "@/components/CallAlertsBanner";
import { Button } from "@/components/ui/button";
import { Beaker, Calendar, ShieldCheck, Stethoscope, Pill, Truck, Settings, Globe, BarChart3, UserCog } from "lucide-react";
import Link from "next/link";

function StatCard({ label, value, icon: Icon }: { label: string; value: string | number; icon: any }) {
  return (
    <div className="rounded-2xl border bg-card p-5">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{label}</span>
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <div className="mt-2 text-2xl font-bold">{value}</div>
    </div>
  );
}

export default function Dashboard() {
  const { user, roles } = useAuth();
  const [stats, setStats] = useState({ bookings: 0, labs: 0, pending: 0, apptPending: 0 });
  const [myLab, setMyLab] = useState<any>(null);
  const [myDoctor, setMyDoctor] = useState<any>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [{ count: bookings }, { count: pending }, { data: labs }, { data: doctor }] = (await Promise.all([
        supabase.from("bookings" as any).select("*", { count: "exact", head: true }).eq("patient_id", user.id),
        supabase.from("bookings" as any).select("*", { count: "exact", head: true }).eq("patient_id", user.id).in("status", ["pending", "confirmed", "sample_collected", "processing"]),
        supabase.from("labs" as any).select("*").eq("owner_id", user.id),
        supabase.from("doctors" as any).select("id, slug, full_name, profile_views").eq("owner_id", user.id).maybeSingle(),
      ])) as any;
      let apptPending = 0;
      if (doctor?.id) {
        const { count } = (await supabase
          .from("doctor_appointments" as any)
          .select("*", { count: "exact", head: true })
          .eq("doctor_id", doctor.id)
          .eq("status", "pending")) as any;
        apptPending = count ?? 0;
      }
      setStats({ bookings: bookings ?? 0, labs: labs?.length ?? 0, pending: pending ?? 0, apptPending });
      setMyLab(labs?.[0] ?? null);
      setMyDoctor(doctor ?? null);
    })();
  }, [user]);

  const isLab = roles.includes("lab");
  const isAdmin = roles.includes("admin") || roles.includes("super_admin");
  const isDoctor = roles.includes("doctor");
  const isCourier = roles.includes("courier");

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      {(isLab || isAdmin) && (
        <CallAlertsBanner mode="partner" partnerType={isLab ? "lab" : "pharmacy"} />
      )}
      <h1 className="text-3xl font-bold font-sans tracking-tight">Dashboard</h1>
      <p className="mt-1 text-muted-foreground">Welcome back{user?.full_name ? `, ${user.full_name}` : ""}.</p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="My bookings" value={stats.bookings} icon={Calendar} />
        <StatCard label="In progress" value={stats.pending} icon={Beaker} />
        {isLab && <StatCard label="My labs" value={stats.labs} icon={ShieldCheck} />}
        {isDoctor && myDoctor && <StatCard label="Site views" value={myDoctor.profile_views ?? 0} icon={Globe} />}
        {isDoctor && <StatCard label="Pending appointments" value={stats.apptPending} icon={BarChart3} />}
        <StatCard label="Role" value={roles.join(", ") || "patient"} icon={Settings} />
      </div>

      <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        <ActionCard icon={Calendar} title="My Bookings" desc="View and track your test bookings & reports." to="/bookings" />
        <ActionCard icon={Pill} title="Medicine Orders" desc="Track medicine delivery live — Zomato-style." to="/orders" />
        <ActionCard icon={Beaker} title="Find Labs" desc="Search labs near you, compare prices." to="/labs" />

        {isLab && !myLab && <ActionCard icon={ShieldCheck} title="Register your Lab" desc="Add your lab so patients can find you." to="/lab-setup" />}
        {isLab && myLab && <ActionCard icon={Settings} title="Manage Lab" desc="Edit tests, prices and bookings." to="/lab" />}

        {isDoctor && !myDoctor && (
          <ActionCard icon={Stethoscope} title="Create Doctor Profile" desc="Launch your free mini website with appointments & WhatsApp." to="/doctor-setup" />
        )}
        {isDoctor && myDoctor && (
          <>
            <ActionCard icon={Globe} title="My Mini Website" desc="View your public page — share with patients." to={`/doctors/${myDoctor.slug}`} />
            <ActionCard icon={Settings} title="Doctor Dashboard" desc="Appointments, analytics, clinic photos." to="/doctor-manage" />
            <ActionCard icon={Stethoscope} title="Edit Profile" desc="Update qualification, fees, timings & services." to="/doctor-setup" />
          </>
        )}
        {isCourier && <ActionCard icon={Truck} title="Pickup Queue" desc="Manage sample pickups and deliveries." to="/dashboard" />}
        {isAdmin && (
          <>
            <ActionCard icon={Settings} title="Admin Panel" desc="Verify labs, doctors and pharmacies." to="/admin/verifications" />
            <ActionCard icon={UserCog} title="User Directory" desc="Approve, reject, or suspend user credentials." to="/admin/users" />
          </>
        )}
      </div>
    </div>
  );
}

function ActionCard({ icon: Icon, title, desc, to }: { icon: any; title: string; desc: string; to: string }) {
  return (
    <Link href={to} className="group rounded-2xl border bg-card p-6 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
      <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="mt-4 font-semibold">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
      <Button variant="link" className="mt-2 h-auto p-0">Open →</Button>
    </Link>
  );
}
