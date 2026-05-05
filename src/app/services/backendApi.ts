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

const isOnlyKeysmash = (caption: string) => {
  const trimmed = caption.trim();
  const lettersOnly = trimmed.replace(/[^a-zA-Z]/g, "");
  const words = trimmed.split(/\s+/).filter(Boolean);

  if (words.length !== 1 || lettersOnly.length < 12) {
    return false;
  }

  const lower = lettersOnly.toLowerCase();
  const vowels = lower.match(/[aeiou]/g)?.length || 0;
  const vowelRatio = vowels / lower.length;
  const consonantRuns = lower.match(/[^aeiou]{5,}/g) || [];

  return vowelRatio < 0.32 || consonantRuns.length > 0;
};

export const verifyCaption = async (caption: string) => {
  if (isOnlyKeysmash(caption)) {
    return {
      captionScore: 0,
      grammar: 0,
      inclusivity: 0,
      tone: 0,
      status: "Rejected" as const,
      remarks:
        "Caption Rejected. Overall score: 0. Grammar: fail. Tone: fail. Inclusivity: fail. Suggestions: Caption appears to be a keysmash or random text.",
    };
  }

  const client = await Client.connect(CAPTION_VERIFIER_URL);
  const result = await client.predict("/predict", [caption]);
  const [remarks, grammarValue, inclusivityValue, toneValue] =
    result.data ?? [];

  const grammar = toNumber(grammarValue, 0);
  const inclusivity = toNumber(inclusivityValue, 0);
  const tone = toNumber(toneValue, 0);
  const captionScore = Math.round(
    (grammar + inclusivity + tone) / 3,
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

const toTitle = (value: string) => {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
};

const pubmatCriterionLabels: Record<string, string> = {
  logos: "Correct Logos Present",
  logo_order: "Correct Logo Order",
  pubmat_quality: "PubMat Image Quality",
  watermark: "Watermark Present",
  readability: "Readable Text",
  spelling: "Spelling Review",
  sgd: "SGD Signature",
  photo_quality: "Photo Quality",
};

const getPubmatCriteria = (report: Record<string, any>) => {
  return Object.entries(report)
    .filter(([key, value]) => {
      return (
        key !== "post_type" &&
        key !== "overall" &&
        value &&
        typeof value === "object" &&
        "pass" in value
      );
    })
    .map(([key, value]) => {
      const label =
        pubmatCriterionLabels[key] || value.label || toTitle(key);
      const passed = Boolean(value.pass);
      const detail =
        value.remark ||
        value.remarks ||
        value.message ||
        value.status ||
        "";

      return {
        label,
        status: passed ? ("Present" as const) : ("Not Present" as const),
        detail: typeof detail === "string" ? detail : "",
      };
    });
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
    postType.toLowerCase() === "opportunities"
      ? "Opportunity"
      : postType;
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

  const report = data.report || (Array.isArray(data) ? data[0] : data);
  const pubmatScore = calculatePubmatScore(report);
  const annotatedImage =
    data.annotated_image || data.annotatedImage || report.annotated_image;

  return {
    pubmatScore,
    status: normalizeStatus(report.overall, pubmatScore),
    remarks: flattenPubmatRemarks(report),
    criteria: getPubmatCriteria(report),
    annotatedImage:
      typeof annotatedImage === "string" ? annotatedImage : undefined,
  };
};
