import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/app/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/app/components/ui/card";
import { Label } from "@/app/components/ui/label";
import { Input } from "@/app/components/ui/input";
import { LogIn } from "lucide-react";
import { HelpButton } from "@/app/components/HelpButton";
import { SmarTechLogo } from "@/app/components/SmarTechLogo";
import nycLogo from "figma:asset/32e65005e1211eef2a5c6c89d5f1fa935cae4da4.png";

const LOCKOUT_STORAGE_KEY = "smartech-login-lockouts";
const LOCKOUT_DURATIONS_MS = [
  30 * 60 * 1000,
  60 * 60 * 1000,
  3 * 60 * 60 * 1000,
  12 * 60 * 60 * 1000,
  24 * 60 * 60 * 1000,
];
const MAX_FAILED_ATTEMPTS = 5;

interface LoginLockoutRecord {
  failedAttempts: number;
  lockLevel: number;
  lockedUntil: number;
}

const getLockoutRecords = (): Record<string, LoginLockoutRecord> => {
  try {
    return JSON.parse(
      window.localStorage.getItem(LOCKOUT_STORAGE_KEY) || "{}",
    );
  } catch {
    return {};
  }
};

const saveLockoutRecords = (
  records: Record<string, LoginLockoutRecord>,
) => {
  window.localStorage.setItem(
    LOCKOUT_STORAGE_KEY,
    JSON.stringify(records),
  );
};

const formatLockoutTime = (lockedUntil: number) => {
  const remainingMs = Math.max(0, lockedUntil - Date.now());
  const remainingMinutes = Math.ceil(remainingMs / 60000);

  if (remainingMinutes >= 1440) return "1 day";
  if (remainingMinutes >= 60) {
    const hours = Math.ceil(remainingMinutes / 60);
    return `${hours} hour${hours === 1 ? "" : "s"}`;
  }

  return `${remainingMinutes} minute${
    remainingMinutes === 1 ? "" : "s"
  }`;
};

const getActiveLockoutMessage = (email: string) => {
  const record = getLockoutRecords()[email];

  if (!record || record.lockedUntil <= Date.now()) return "";

  return `Too many failed login attempts. Please try again in ${formatLockoutTime(
    record.lockedUntil,
  )}.`;
};

const clearLoginLockout = (email: string) => {
  const records = getLockoutRecords();
  delete records[email];
  saveLockoutRecords(records);
};

const recordFailedLogin = (email: string) => {
  const records = getLockoutRecords();
  const current = records[email] || {
    failedAttempts: 0,
    lockLevel: 0,
    lockedUntil: 0,
  };

  const nextFailedAttempts = current.failedAttempts + 1;

  if (nextFailedAttempts < MAX_FAILED_ATTEMPTS) {
    records[email] = {
      ...current,
      failedAttempts: nextFailedAttempts,
      lockedUntil: 0,
    };
    saveLockoutRecords(records);
    return "";
  }

  const duration =
    LOCKOUT_DURATIONS_MS[
      Math.min(current.lockLevel, LOCKOUT_DURATIONS_MS.length - 1)
    ];
  const lockedUntil = Date.now() + duration;

  records[email] = {
    failedAttempts: 0,
    lockLevel: current.lockLevel + 1,
    lockedUntil,
  };
  saveLockoutRecords(records);

  return `Too many failed login attempts. Please try again in ${formatLockoutTime(
    lockedUntil,
  )}.`;
};

export function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoggingIn) return;
    setError("");

    if (!email) {
      setError("Please enter your email");
      return;
    }

    if (!password) {
      setError("Please enter a password");
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();
    const lockoutMessage = getActiveLockoutMessage(normalizedEmail);

    if (lockoutMessage) {
      setError(lockoutMessage);
      return;
    }

    setIsLoggingIn(true);

    try {
      const success = await login(normalizedEmail, password);
      if (success) {
        clearLoginLockout(normalizedEmail);
        navigate("/");
      } else {
        setError(
          recordFailedLogin(normalizedEmail) ||
            "Invalid credentials. Please try again.",
        );
        setPassword("");
      }
    } catch (error) {
      setError("An error occurred during login. Please try again.");
      setPassword("");
    } finally {
      setIsLoggingIn(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#3391f7]/7 flex items-center justify-center p-4">
      <HelpButton loginPageOnly={true} />
      <SmarTechLogo />
      <div className="w-full max-w-md">
        {/* Login Card */}
        <Card className="bg-[#000033] border-[#000033] border-2">
          {/* Logo and Title */}
          <div className="text-center space-y-2 pt-6 px-6">
            <div className="flex justify-center mb-4">
              <img
                src={nycLogo}
                alt="NYC Logo"
                className="w-24 h-24 object-contain"
              />
            </div>
            <h1 className="text-3xl font-bold text-white">
              National Youth Commission
            </h1>
            <p className="text-white/80">
              Social Media Auditing and Reporting Technology
            </p>
          </div>

          <CardContent className="pb-10">
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Email Input */}
              <div className="space-y-2">
                <Label htmlFor="email" className="text-white">
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoggingIn}
                  placeholder="Enter your email"
                  className="bg-[#0099FF] border-[#0099FF] text-black placeholder:text-black/80"
                />
              </div>

              {/* Password Input */}
              <div className="space-y-2">
                <Label
                  htmlFor="password"
                  className="text-white"
                >
                  Password
                </Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoggingIn}
                  placeholder="Enter your password"
                  className="bg-[#0099FF] border-[#0099FF] text-black placeholder:text-black/80"
                />
              </div>

              {/* Error Message */}
              {error && (
                <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-3">
                  {error}
                </div>
              )}

              {/* Submit Button */}
              <Button
                type="submit"
                disabled={isLoggingIn}
                className="w-full bg-[#FFFF00] hover:bg-[#FFFF00]/90 text-[#000033] font-bold"
                size="lg"
              >
                {isLoggingIn ? "LOGGING IN" : "LOGIN"}
              </Button>

              {/* Account Access and Reset Password */}
              <div className="text-center pt-2 space-y-2">
                <div>
                  <button
                    type="button"
                    onClick={() => navigate("/reset-password")}
                    className="text-sm text-white/80 hover:underline"
                  >
                    Have a verification code? Reset password
                  </button>
                </div>
                <div>
                  <button
                    type="button"
                    onClick={() => navigate("/account-access")}
                    className="text-sm text-white/80 hover:underline"
                  >
                    Need help with account access?
                  </button>
                </div>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
