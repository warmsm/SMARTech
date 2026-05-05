import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Label } from "@/app/components/ui/label";
import { Input } from "@/app/components/ui/input";
import { useAccessRequests } from "@/contexts/AccessRequestsContext";
import { api } from "@/utils/supabase/client";

const OFFICE_ACCOUNTS: Record<string, { office: string }> = {
  "central.office@smartech.ph": { office: "Central NYC" },
  "youth.organization@smartech.ph": {
    office: "Youth Organization Registration Program (YORP)",
  },
  "sangguniang.kabataan@smartech.ph": {
    office: "NYC Sangguniang Kabataan",
  },
  "ncr.ivb@smartech.ph": { office: "NYC NCR and MIMAROPA" },
  "car.i@smartech.ph": { office: "NYC CAR and Region 1" },
  "ii.iii@smartech.ph": { office: "NYC Regions 2 and 3" },
  "iv-a@smartech.ph": { office: "NYC CALABARZON" },
  "v@smartech.ph": { office: "NYC Region 5" },
  "vi@smartech.ph": { office: "NYC Region 6" },
  "vii.viii@smartech.ph": { office: "NYC Regions 7 and 8" },
  "ix.xii@smartech.ph": { office: "NYC Regions 9 and 12" },
  "x.caraga@smartech.ph": {
    office: "NYC Region 10 and CARAGA",
  },
  "xi.barmm@smartech.ph": { office: "NYC Region 11 and BARMM" },
};
export default function HandoffRequestPage() {
  const navigate = useNavigate();
  const { addRequest } = useAccessRequests();

  const [email, setEmail] = useState("");
  const [step, setStep] = useState<"email" | "done">("email");

  const [form, setForm] = useState({
    newName: "",
    reason: "",
  });

  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleRequestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setError("");

    if (!email) {
      setError("Please enter the office account email.");
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();

    let profile: { email: string; office: string };

    try {
      const response = await api.get(
        `/profiles/by-email/${encodeURIComponent(normalizedEmail)}`,
      );
      profile = response.profile;
    } catch {
      setError(
        "Email not recognized. Please use an approved office email.",
      );
      return;
    }

    if (!form.newName) {
      setError("Please enter the new assigned person.");
      return;
    }

    if (!form.reason) {
      setError("Please enter the reason for handoff.");
      return;
    }

    setIsSubmitting(true);

    try {
      await addRequest({
        id: crypto.randomUUID(),
        type: "handoff",
        officeEmail: email,
        officeName: profile.office,
        status: "Pending",
        submittedAt: new Date().toLocaleString(),
        reason: form.reason,
        newAssignedPerson: form.newName,
      });

      setStep("done");
    } catch {
      setError("Failed to submit request. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#3391f7]/7 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Card className="bg-[#000033] border-[#000033] border-2">
          <CardContent className="py-12 px-8 space-y-6 text-center">
            <h1 className="text-2xl font-bold text-white">
              Handoff Request
            </h1>

            {step === "email" && (
              <>
                <p className="text-white/70 text-sm">
                  Submit a handoff request for account transfer.
                  Your request will be sent to NYC Central
                  Office for approval.
                </p>

                <form
                  onSubmit={handleRequestSubmit}
                  className="space-y-4 text-left"
                >
                  <div className="space-y-2">
                    <Label className="text-white">
                      Office Account Email
                    </Label>
                    <Input
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Enter office email"
                      className="bg-[#0099FF] border-[#0099FF] text-black placeholder:text-black/80"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-white">
                      New Assigned Person
                    </Label>
                    <Input
                      value={form.newName}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          newName: e.target.value,
                        })
                      }
                      placeholder="Enter name"
                      className="bg-[#0099FF] border-[#0099FF] text-black placeholder:text-black/80"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-white">Reason</Label>
                    <Input
                      value={form.reason}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          reason: e.target.value,
                        })
                      }
                      placeholder="Reason for handoff"
                      className="bg-[#0099FF] border-[#0099FF] text-black placeholder:text-black/80"
                    />
                  </div>

                  {error && (
                    <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-3">
                      {error}
                    </div>
                  )}

                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full bg-[#FFFF00] text-[#000033]"
                  >
                    {isSubmitting
                      ? "Request Submitting"
                      : "Submit Request"}
                  </Button>
                </form>

                <button
                  type="button"
                  onClick={() => navigate("/account-access")}
                  className="text-sm text-white/70 hover:text-white hover:underline"
                >
                  Back to Account Access
                </button>
              </>
            )}

            {step === "done" && (
              <>
                <p className="text-green-400 text-sm">
                  Your handoff request has been submitted
                  successfully!
                </p>

                <div className="bg-white/10 border border-white/20 rounded-lg p-4 text-left space-y-3">
                  <p className="text-sm text-white">
                    <span className="font-semibold">
                      Email:
                    </span>{" "}
                    {email}
                  </p>
                  <p className="text-sm text-white">
                    <span className="font-semibold">
                      New Assigned Person:
                    </span>{" "}
                    {form.newName}
                  </p>
                  <p className="text-sm text-white">
                    <span className="font-semibold">
                      Status:
                    </span>{" "}
                    Pending Approval
                  </p>
                </div>

                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
                  <p className="text-sm text-yellow-200">
                    <strong>Next Steps:</strong>
                    <br />
                    Once approved by NYC Central Office, you
                    will receive a verification code. Use that
                    code to reset your password and complete the
                    handoff process.
                  </p>
                </div>

                <Button
                  onClick={() => navigate("/login")}
                  className="w-full bg-[#FFFF00] hover:bg-[#FFFF00]/90 text-black font-semibold"
                >
                  Back to Login
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}