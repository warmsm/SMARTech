const FB_LEAD_TEXTS = [
  "CALL FOR APPLICATIONS |",
  "LATEST |",
  "IN PHOTOS |",
  "READ |",
  "ICYMI |",
  "NOW |",
  "WATCH |",
];

const YOUTH_HASHTAGS = [
  "#youth",
  "#youthph",
  "#nycpilipinas",
  "#forthefilipinoyouth",
  "#parasakabataangpilipino",
];

const TIKTOK_HASHTAGS = [
  "#fyp",
  "#fypage",
  "#youth",
  "#nationalyouthcommission",
  "#nycpilipinas",
];

export interface CaptionRemarkRow {
  label: string;
  detail: string;
  emphasizeLabel?: boolean;
}

const normalizePlatforms = (platform?: string | string[]) => {
  if (Array.isArray(platform)) return platform;
  return platform ? [platform] : [];
};

const isVisualOnlyRemark = (text: string) => {
  const lower = text.toLowerCase();

  return (
    lower.includes("facebook caption should") ||
    lower.includes("facebook post should") ||
    lower.includes("accepted lead text") ||
    lower.includes("call for applications |") ||
    lower.includes("latest |") ||
    lower.includes("in photos |") ||
    lower.includes("read |") ||
    lower.includes("icymi |") ||
    lower.includes("now |") ||
    lower.includes("or watch") ||
    lower.includes("watch |") ||
    lower.includes("exceeds 2200 characters") ||
    lower.includes("exceeds 280 characters") ||
    lower.includes("should not exceed 2200 characters") ||
    lower.includes("should not exceed 280 characters") ||
    lower.includes("needs #forthefilipinoyouth") ||
    lower.includes("must include the hashtags") ||
    lower.includes("missing #fyp") ||
    lower.includes("instagram needs at least one") ||
    lower.includes("instagram caption should include")
  );
};

const cleanRemarkParts = (text: string) => {
  return text
    .split(/\s+\|\s+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .filter((part) => !isVisualOnlyRemark(part));
};

const buildBaseRemarkRows = (remarks?: string): CaptionRemarkRow[] => {
  return (remarks || "")
    .replace(
      /\s+(?=(Overall score|Grammar|Tone|Inclusivity|Spelling|Suggestions):)/g,
      "\n",
    )
    .split(/[;\n]+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .flatMap((line) => {
      const separatorIndex = line.indexOf(":");
      const hasLabel = separatorIndex > -1;
      const label = hasLabel ? line.slice(0, separatorIndex) : "Summary";
      const detail = hasLabel
        ? line.slice(separatorIndex + 1).trimStart()
        : line;
      const cleanedParts = cleanRemarkParts(detail);

      if (cleanedParts.length === 0) return [];

      return [
        {
          label,
          detail: cleanedParts.join(" | "),
          emphasizeLabel: true,
        },
      ];
    });
};

const buildVisualRows = (
  caption = "",
  platform?: string | string[],
): CaptionRemarkRow[] => {
  const platforms = normalizePlatforms(platform);
  const captionText = caption || "";
  const captionLower = captionText.toLowerCase();
  const textLimitIssues: string[] = [];
  const hashtagIssues: string[] = [];

  const facebookLeadDetail = platforms.includes("Facebook")
    ? FB_LEAD_TEXTS.some((lead) => captionText.startsWith(lead))
      ? "uses recognized lead text"
      : `missing recognized lead text when applicable. Accepted lead texts: ${FB_LEAD_TEXTS.join(
          ", ",
        )}`
    : "not applicable";

  if (platforms.includes("Instagram") && captionText.length > 2200) {
    textLimitIssues.push("Instagram exceeds 2200 characters");
  }

  if (platforms.includes("X") && captionText.length > 280) {
    textLimitIssues.push("X exceeds 280 characters");
  }

  if (platforms.includes("TikTok") && captionText.length > 2200) {
    textLimitIssues.push("TikTok exceeds 2200 characters");
  }

  if (platforms.includes("X")) {
    const hasRequiredXTags =
      captionText.includes("#ForTheFilipinoYouth") &&
      captionText.includes("#ParaSaKabataangPilipino");

    if (!hasRequiredXTags) {
      hashtagIssues.push(
        "X needs #ForTheFilipinoYouth and #ParaSaKabataangPilipino",
      );
    }
  }

  if (platforms.includes("TikTok")) {
    const missing = TIKTOK_HASHTAGS.filter(
      (tag) => !captionLower.includes(tag),
    );

    if (missing.length > 0) {
      hashtagIssues.push(`TikTok missing ${missing.join(", ")}`);
    }
  }

  if (platforms.includes("Instagram")) {
    const hasYouthHashtag = YOUTH_HASHTAGS.some((tag) =>
      captionLower.includes(tag),
    );

    if (!hasYouthHashtag) {
      hashtagIssues.push(
        "Instagram needs at least one youth-related required hashtag",
      );
    }
  }

  return [
    {
      label: "Facebook Lead Text",
      detail: facebookLeadDetail,
      emphasizeLabel: false,
    },
    {
      label: "Text Limit",
      detail:
        textLimitIssues.length > 0
          ? textLimitIssues.join("\n")
          : "within required platform limits",
      emphasizeLabel: false,
    },
    {
      label: "Hashtags",
      detail:
        hashtagIssues.length > 0
          ? hashtagIssues.join("\n")
          : "required hashtags present",
      emphasizeLabel: false,
    },
  ];
};

export const getCaptionRemarkRows = ({
  remarks,
  caption,
  platform,
}: {
  remarks?: string;
  caption?: string;
  platform?: string | string[];
}) => {
  return [
    ...buildBaseRemarkRows(remarks),
    ...buildVisualRows(caption, platform),
  ];
};
