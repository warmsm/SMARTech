import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Label } from "@/app/components/ui/label";
import { Input } from "@/app/components/ui/input";
import { useAccessRequests } from "@/contexts/AccessRequestsContext";

const isValidEmail = (value: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

export default function CreateAccountRequestPage() {
  const navigate = useNavigate();
  const { addRequest } = useAccessRequests();

  const [form, setForm] = useState({
    officeName: "",
    email: "",
    assignedPerson: "",
  });

  const [step, setStep] = useState<"form" | "done">("form");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setError("");

    if (!form.officeName) {
      setError("Please enter the office name.");
      return;
    }

    if (!form.email) {
      setError("Please enter an email address.");
      return;
    }

    const normalizedEmail = form.email.trim().toLowerCase();

    if (!isValidEmail(normalizedEmail)) {
      setError("Please enter a valid email address.");
      return;
    }

    if (!form.assignedPerson) {
      setError("Please enter the assigned person's name.");
      return;
    }

    setIsSubmitting(true);

    try {
      await addRequest({
        id: crypto.randomUUID(),
        type: "create-account",
        officeEmail: normalizedEmail,
        officeName: form.officeName,
        status: "Pending",
        submittedAt: new Date().toLocaleString(),
        newAssignedPerson: form.assignedPerson,
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
              Create New Account Request
            </h1>

            {step === "form" && (
              <>
                <p className="text-white/70 text-sm">
                  Submit a request to create a new account for a
                  new office. Central NYC will review and
                  approve.
                </p>

                <form
                  onSubmit={handleSubmit}
                  className="space-y-4 text-left"
                >
                  <div className="space-y-2">
                    <Label className="text-white">
                      Office Name
                    </Label>
                    <Input
                      value={form.officeName}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          officeName: e.target.value,
                        })
                      }
                      placeholder="Enter office name"
                      className="bg-[#0099FF] border-[#0099FF] text-black placeholder:text-black/80"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-white">
                      Requested Email Address
                    </Label>
                    <Input
                      type="email"
                      value={form.email}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          email: e.target.value,
                        })
                      }
                      placeholder="office.email@smartech.ph"
                      className="bg-[#0099FF] border-[#0099FF] text-black placeholder:text-black/80"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-white">
                      Assigned Person
                    </Label>
                    <Input
                      value={form.assignedPerson}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          assignedPerson: e.target.value,
                        })
                      }
                      placeholder="Enter full name"
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
                    className="w-full bg-[#FFFF00] hover:bg-[#FFFF00]/90 text-black font-semibold"
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
                  Your account creation request has been
                  submitted successfully!
                </p>

                <div className="bg-white/10 border border-white/20 rounded-lg p-4 text-left space-y-3">
                  <p className="text-sm text-white">
                    <span className="font-semibold">
                      Office Name:
                    </span>{" "}
                    {form.officeName}
                  </p>
                  <p className="text-sm text-white">
                    <span className="font-semibold">
                      Email:
                    </span>{" "}
                    {form.email}
                  </p>
                  <p className="text-sm text-white">
                    <span className="font-semibold">
                      Assigned Person:
                    </span>{" "}
                    {form.assignedPerson}
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
                    Your request will be reviewed by Central
                    NYC. Once approved, you will receive your
                    login credentials.
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
