import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Label } from "@/app/components/ui/label";
import { Input } from "@/app/components/ui/input";
import { useAccessRequests } from "@/contexts/AccessRequestsContext";
import { api } from "@/utils/supabase/client";

export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const { addRequest } = useAccessRequests();

  const [email, setEmail] = useState("");
  const [submittedEmail, setSubmittedEmail] = useState("");
  const [step, setStep] = useState<"email" | "done">("email");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setError("");

    if (!email) {
      setError("Please enter your office email address.");
      return;
    }

    // confirm email belong in the nyc assigned email
    const normalizedEmail = email.trim().toLowerCase();

    let profile: { email: string; office: string };

    try {
      const response = await api.get(
        `/profiles/by-email/${encodeURIComponent(normalizedEmail)}`,
      );
      profile = response.profile;
    } catch {
      setError(
        "This email is not registered to any approved office account.",
      );
      return;
    }

    setIsSubmitting(true);

    try {
      await addRequest({
        id: crypto.randomUUID(),
        type: "forgot-password",
        officeEmail: normalizedEmail,
        officeName: profile.office,
        status: "Pending",
        submittedAt: new Date().toLocaleString(),
      });

      setSubmittedEmail(normalizedEmail);

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
              Change/Forgot Password Request
            </h1>

            {step === "email" && (
              <>
                <p className="text-white/70 text-sm">
                  Enter your assigned office email address. Your
                  request will be sent to NYC Central Office for
                  approval.
                </p>

                <form
                  onSubmit={handleEmailSubmit}
                  className="space-y-4 text-left"
                >
                  <div className="space-y-2">
                    <Label className="text-white">
                      Office Email Address
                    </Label>
                    <Input
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Enter your email"
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
                  Your password reset request has been submitted
                  successfully!
                </p>

                <div className="bg-white/10 border border-white/20 rounded-lg p-4 text-left space-y-3">
                  <p className="text-sm text-white">
                    <span className="font-semibold">
                      Email:
                    </span>{" "}
                    {submittedEmail}
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
                    code to reset your password via the login
                    page.
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