import { Client } from "@gradio/client";

const CAPTION_VERIFIER_URL =
  import.meta.env.VITE_CAPTION_VERIFIER_URL ||
  "https://onjmm-smartech-caption-verifier.hf.space";

const PUBMAT_CHECKER_URL =
  import.meta.env.VITE_PUBMAT_CHECKER_URL ||
  "https://lfaithb-smartech-pubmat-checker.hf.space";

const toNumber = (value: unknown, fallback = 0) => {
  const numeric =
    typeof value === "number" ? value : Number.parseFloat(String(value));

  return Number.isFinite(numeric) ? numeric : fallback;
};

const normalizeStatus = (value: unknown, score: number) => {
  if (typeof value === "string") {
    const lowerValue = value.toLowerCase();

    if (lowerValue === "accepted" || lowerValue === "pass") {
      return "Accepted" as const;
    }

    if (lowerValue === "rejected" || lowerValue === "fail") {
      return "Rejected" as const;
    }
  }

  return score >= 75 ? ("Accepted" as const) : ("Rejected" as const);
};

export const verifyCaption = async (caption: string) => {
  const client = await Client.connect(CAPTION_VERIFIER_URL);
  const result = await client.predict("/predict", [caption]);
  const [remarks, grammarValue, inclusivityValue, toneValue] =
    result.data ?? [];

  const grammar = toNumber(grammarValue, 0);
  const inclusivity = toNumber(inclusivityValue, 0);
  const tone = toNumber(toneValue, 0);
  const captionScore = Math.round(
    grammar * 0.4 + inclusivity * 0.4 + tone * 0.2,
  );

  return {
    captionScore,
    grammar,
    inclusivity,
    tone,
    status: normalizeStatus(undefined, captionScore),
    remarks:
      typeof remarks === "string" && remarks.trim()
        ? remarks
        : "Caption analysis completed.",
  };
};

const flattenPubmatRemarks = (report: Record<string, any>) => {
  const remarks = Object.entries(report)
    .filter(([key, value]) => {
      return (
        key !== "post_type" &&
        key !== "overall" &&
        value &&
        typeof value === "object"
      );
    })
    .map(([key, value]) => {
      const label = key.replaceAll("_", " ");
      const status = value.pass === false ? "needs review" : "passed";
      const detail =
        value.remark ||
        value.remarks ||
        value.message ||
        value.label ||
        value.status ||
        "";

      return `${label}: ${status}${detail ? ` (${detail})` : ""}`;
    });

  return remarks.length > 0
    ? remarks.join("; ")
    : "Pubmat analysis completed.";
};

const calculatePubmatScore = (report: Record<string, any>) => {
  const checks = Object.entries(report).filter(([, value]) => {
    return value && typeof value === "object" && "pass" in value;
  });

  if (checks.length === 0) {
    return report.overall === "PASS" ? 100 : 70;
  }

  const passedChecks = checks.filter(([, value]) => {
    return value.pass || value.level !== "error";
  }).length;

  return Math.round((passedChecks / checks.length) * 100);
};

export const auditPubmat = async ({
  file,
  postType,
  collaborators,
}: {
  file: File;
  postType: string;
  collaborators: string[];
}) => {
  const backendPostType =
    postType.toLowerCase() === "hiring" ? "Opportunity" : postType;
  const formData = new FormData();
  formData.append("file", file);
  formData.append("post_type", backendPostType);
  collaborators.forEach((collaborator) => {
    formData.append("collaborators", collaborator);
  });

  const response = await fetch(`${PUBMAT_CHECKER_URL}/api/audit`, {
    method: "POST",
    body: formData,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.error || "Pubmat checker request failed");
  }

  const report = Array.isArray(data) ? data[0] : data;
  const pubmatScore = calculatePubmatScore(report);

  return {
    pubmatScore,
    status: normalizeStatus(report.overall, pubmatScore),
    remarks: flattenPubmatRemarks(report),
  };
};
