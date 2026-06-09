"use client";

import { useEffect, useState } from "react";
import {
  getLatestVerification,
  startVerificationFlow,
  addVerificationDocument,
  submitVerificationFlow,
  analyzeVerificationDocument,
} from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  ShieldCheck,
  Upload,
  Loader2,
  FileCheck2,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";

const PARTNER_TYPES = [
  {
    value: "doctor",
    label: "Doctor",
    docs: [
      { type: "aadhaar", label: "Identity Proof (Aadhaar/PAN/Passport)" },
      { type: "medical_registration", label: "Medical Registration Certificate" },
    ],
  },
  {
    value: "laboratory",
    label: "Laboratory",
    docs: [
      { type: "aadhaar", label: "Owner Identity Proof" },
      { type: "lab_registration", label: "Lab Registration / NABL Certificate" },
    ],
  },
  {
    value: "pharmacy",
    label: "Pharmacy",
    docs: [
      { type: "aadhaar", label: "Owner Identity Proof" },
      { type: "drug_license", label: "Drug License" },
    ],
  },
  {
    value: "collection_center",
    label: "Collection Center",
    docs: [
      { type: "aadhaar", label: "Owner Identity Proof" },
      { type: "business_registration", label: "Business Registration" },
    ],
  },
  {
    value: "franchise",
    label: "Franchise Partner",
    docs: [
      { type: "aadhaar", label: "Identity Proof" },
      { type: "business_registration", label: "Business Registration" },
    ],
  },
] as const;

function statusVariant(s: string) {
  if (s === "approved") return "default";
  if (s === "rejected" || s === "suspended" || s === "expired") return "destructive";
  return "secondary";
}

export default function VerifyPage() {
  const [loading, setLoading] = useState(true);
  const [verification, setVerification] = useState<any>(null);
  const [documents, setDocuments] = useState<any[]>([]);
  const [partnerType, setPartnerType] = useState<string>("doctor");
  const [uploading, setUploading] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await getLatestVerification();
      setVerification(res.verification);
      setDocuments(res.documents);
      if (res.verification) {
        setPartnerType(res.verification.partner_type);
      }
    } catch (err: any) {
      toast.error("Failed to load verification status");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleStartVerification = async () => {
    try {
      const res = await startVerificationFlow(partnerType);
      if (res.success) {
        setVerification(res.verification);
        setDocuments([]);
        toast.success("Verification started. Upload your documents.");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to start verification");
    }
  };

  const fileToBase64 = (f: File) =>
    new Promise<string>((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(String(r.result).split(",")[1] || "");
      r.onerror = () => rej(r.error);
      r.readAsDataURL(f);
    });

  const uploadDoc = async (docType: string, file: File) => {
    if (!verification) return;
    if (!file.type.match(/^image\/(png|jpe?g|webp)$/)) {
      return toast.error("Upload PNG, JPG or WEBP image");
    }
    if (file.size > 8 * 1024 * 1024) return toast.error("Max 8MB file size allowed");
    setUploading(docType);

    try {
      // 1. Upload to storage bucket via standard file upload endpoint
      const formData = new FormData();
      formData.append("file", file);
      formData.append("folder", `verification-docs/${docType}`);

      const uploadRes = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!uploadRes.ok) {
        const errText = await uploadRes.text();
        throw new Error(errText || "Storage upload failed");
      }

      const uploadData = await uploadRes.json();
      const signedUrl = uploadData.url;

      // 2. Add document record via secure server action
      const docRes = await addVerificationDocument({
        verificationId: verification.id,
        documentType: docType,
        fileUrl: signedUrl,
      });

      if (!docRes.success) throw new Error("Failed to register document");

      toast.message("Analyzing document with AI...");

      // 3. Process document via AI analysis action
      const base64 = await fileToBase64(file);
      await analyzeVerificationDocument({
        verificationId: verification.id,
        documentId: docRes.document.id,
        documentType: docType,
        partnerType: verification.partner_type,
        imageBase64: base64,
        mimeType: file.type,
      });

      toast.success("Document analyzed successfully!");
      await load();
    } catch (e: any) {
      toast.error(e?.message || "Upload and analysis failed");
    } finally {
      setUploading(null);
    }
  };

  const handleSubmit = async () => {
    if (!verification) return;
    try {
      const res = await submitVerificationFlow(verification.id);
      if (res.success) {
        toast.success("Submitted for review");
        load();
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to submit verification");
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const meta = PARTNER_TYPES.find((p) => p.value === (verification?.partner_type ?? partnerType));
  const canEdit = !verification || ["draft", "rejected"].includes(verification.status);

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-10 sm:px-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold font-sans sm:text-3xl bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            <ShieldCheck className="h-7 w-7 text-primary" /> Partner Verification
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            AI-assisted identity and license verification for healthcare partners.
          </p>
        </div>
        {verification && (
          <Badge variant={statusVariant(verification.status) as any} className="text-xs capitalize">
            {verification.status.replace(/_/g, " ")}
          </Badge>
        )}
      </header>

      {!verification && (
        <div className="glass-card space-y-4 rounded-2xl p-6">
          <Label className="text-sm font-semibold uppercase tracking-wider text-primary">Choose Partner Type</Label>
          <Select value={partnerType} onValueChange={setPartnerType}>
            <SelectTrigger className="min-h-11 glass bg-card/50">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PARTNER_TYPES.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={handleStartVerification} className="w-full min-h-11 font-semibold">
            Start Verification
          </Button>
        </div>
      )}

      {verification && (
        <>
          <div className="glass-card rounded-2xl p-6 relative overflow-hidden bg-gradient-to-br from-card/90 to-card/40">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-primary">AI Verification Score</div>
                <div className="text-4xl font-extrabold mt-1">
                  {Number(verification.verification_score ?? 0).toFixed(0)}
                  <span className="text-sm font-normal text-muted-foreground">/100</span>
                </div>
              </div>
              <div className="text-right text-xs text-muted-foreground space-y-1">
                {verification.registration_number && (
                  <div>
                    Reg: <span className="font-mono font-medium text-foreground">{verification.registration_number}</span>
                  </div>
                )}
                {verification.authority_name && <div>Auth: {verification.authority_name}</div>}
                {verification.expiry_date && <div>Expires: {verification.expiry_date}</div>}
              </div>
            </div>
            {verification.ai_summary && (
              <div className="mt-4 rounded-xl bg-card/40 border p-3.5 text-xs text-muted-foreground leading-relaxed">
                <span className="font-semibold text-primary block mb-1">AI Document Summary:</span>
                {verification.ai_summary}
              </div>
            )}
            {verification.reviewer_remarks && (
              <div className="mt-3 rounded-xl border border-destructive/20 bg-destructive/5 p-3.5 text-xs">
                <strong className="text-destructive font-semibold">Reviewer Remarks:</strong> {verification.reviewer_remarks}
              </div>
            )}
          </div>

          <div className="space-y-4">
            <h2 className="text-lg font-bold font-sans">Required Documents</h2>
            {meta?.docs.map((d) => {
              const uploaded = documents.find((x) => x.document_type === d.type);
              return (
                <div key={d.type} className="glass-card flex flex-wrap items-center justify-between gap-4 rounded-xl p-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2.5 font-semibold text-sm">
                      {uploaded ? (
                        <FileCheck2 className="h-5 w-5 text-primary" />
                      ) : (
                        <Upload className="h-5 w-5 text-muted-foreground" />
                      )}
                      {d.label}
                    </div>
                    {uploaded && (
                      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground border-t pt-2 border-border/30">
                        <span>
                          AI Legibility Score: <strong className="text-foreground">{Number(uploaded.ai_score).toFixed(0)}</strong>
                        </span>
                        {uploaded.classified_as && (
                          <span>
                            Classified: <strong className="text-foreground capitalize">{uploaded.classified_as.toLowerCase()}</strong>
                          </span>
                        )}
                        {Array.isArray(uploaded.flags) && uploaded.flags.length > 0 && (
                          <span className="flex items-center gap-1 text-amber-500 font-semibold bg-amber-500/10 px-1.5 py-0.5 rounded">
                            <AlertTriangle className="h-3 w-3" /> {uploaded.flags.length} flag{uploaded.flags.length > 1 ? "s" : ""}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  {canEdit && (
                    <label className="cursor-pointer">
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        className="hidden"
                        disabled={uploading === d.type}
                        onChange={(e) => e.target.files?.[0] && uploadDoc(d.type, e.target.files[0])}
                      />
                      <span className="inline-flex items-center gap-2 rounded-xl border bg-card px-4 py-2 text-xs font-semibold hover:bg-accent transition-all hover:scale-[1.02] active:scale-[0.98] shadow-sm">
                        {uploading === d.type ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Upload className="h-3.5 w-3.5 text-primary" />
                        )}
                        {uploaded ? "Replace File" : "Upload Image"}
                      </span>
                    </label>
                  )}
                </div>
              );
            })}
          </div>

          {canEdit && (
            <Button
              onClick={handleSubmit}
              disabled={documents.length < (meta?.docs.length ?? 99)}
              className="w-full min-h-12 font-semibold text-base shadow-lg transition-transform hover:scale-[1.01]"
              size="lg"
            >
              <CheckCircle2 className="mr-2 h-5 w-5" /> Submit for Review
            </Button>
          )}

          {verification.status === "approved" && (
            <div className="rounded-2xl border border-success/30 bg-success/5 p-5 text-sm text-success-foreground font-medium flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-success shrink-0" />
              <span>Congratulations! Your partner account is approved and verified. You are now active in public searches.</span>
            </div>
          )}
        </>
      )}
    </div>
  );
}
