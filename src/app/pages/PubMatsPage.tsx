import { useEffect, useMemo, useRef, useState } from "react";
import {
  Upload,
  FileImage,
  CheckCircle,
  AlertCircle,
  Loader2,
  TrendingUp,
  ChevronDown,
  Info,
} from "lucide-react";
import { usePosts } from "@/contexts/PostsContext";
import { useAuth } from "@/contexts/AuthContext";
import { DatePicker } from "@/app/components/ui/date-picker";
import { auditPubmat } from "@/app/services/backendApi";

const formatDateSafe = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

type Platform = "Facebook" | "Instagram" | "X";
type Collaborator = "SK" | "YORP";

const pubmatRemarkLabels =
  "logo order|logos|pubmat quality|watermark|template|sgd signature|checker response|correct logos present|correct logo order";

const getRemarkLines = (remarks?: string) => {
  return (remarks || "")
    .replace(
      new RegExp(`\\s+(?=(${pubmatRemarkLabels}):)`, "gi"),
      "\n",
    )
    .split(/[;\n]+/)
    .map((item) => item.trim())
    .filter(Boolean);
};

const renderRemarks = (remarks?: string) => {
  const rows = getRemarkLines(remarks).map((line) => {
    const separatorIndex = line.indexOf(":");
    const hasLabel = separatorIndex > -1;
    const label = hasLabel ? line.slice(0, separatorIndex) : "Summary";
    const detail = hasLabel
      ? line.slice(separatorIndex + 1).trimStart()
      : line;

    return { label, detail };
  });

  if (rows.length === 0) return null;

  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead className="bg-muted/40">
          <tr>
            <th className="w-1/3 px-3 py-2 text-left font-semibold text-foreground">
              Criteria
            </th>
            <th className="px-3 py-2 text-left font-semibold text-foreground">
              Remark
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((row, index) => (
            <tr key={`${row.label}-${index}`}>
              <td className="px-3 py-2 align-top font-semibold text-foreground">
                {row.label}
              </td>
              <td className="px-3 py-2 align-top text-muted-foreground">
                {row.detail}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const renderCriteriaTable = (criteria: NonNullable<AnalysisResult["criteria"]>) => {
  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead className="bg-muted/40">
          <tr>
            <th className="w-1/3 px-3 py-2 text-left font-semibold text-foreground">
              Criteria
            </th>
            <th className="px-3 py-2 text-left font-semibold text-foreground">
              Remark
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {criteria.map((criterion) => (
            <tr key={criterion.label}>
              <td className="px-3 py-2 align-top font-semibold text-foreground">
                {criterion.label}
              </td>
              <td className="px-3 py-2 align-top text-muted-foreground">
                <span
                  className={
                    criterion.status === "Present"
                      ? "font-semibold text-green-700"
                      : "font-semibold text-red-700"
                  }
                >
                  {criterion.status}
                </span>
                {criterion.detail ? ` - ${criterion.detail}` : ""}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

interface AnalysisResult {
  fileName?: string;
  pubmatScore: number;
  remarks: string;
  status: "Accepted" | "Rejected";
  criteria?: Array<{
    label: string;
    status: "Present" | "Not Present";
    detail?: string;
  }>;
  annotatedImage?: string;
}

export function PubMatsPage() {
  const { addPost } = usePosts();
  const { currentOffice, isLoading } = useAuth();

  const [uploadedImages, setUploadedImages] = useState<
    Array<{ file: File; preview: string }>
  >([]);
  const [postType, setPostType] = useState("");
  const [selectedPlatforms, setSelectedPlatforms] = useState<
    Platform[]
  >([]);
  const [selectedCollaborators, setSelectedCollaborators] =
    useState<Collaborator[]>([]);
  const [postDate, setPostDate] = useState<Date | undefined>(
    undefined,
  );
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResults, setAnalysisResults] = useState<
    AnalysisResult[]
  >([]);
  const [showSuccessMessage, setShowSuccessMessage] =
    useState(false);
  const [isCollaboratorOpen, setIsCollaboratorOpen] =
    useState(false);
  const [showTypeHelp, setShowTypeHelp] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const collaboratorRef = useRef<HTMLDivElement | null>(null);
  const isAuditLocked = analysisResults.length > 0 || isAnalyzing;
  const uploadedImageCount = uploadedImages.length;

  const postTypes = [
    "News",
    "Quotes",
    "Advisory",
    "Resolution",
    "Opportunities",
    "Photo",
    "Holiday",
    "Other",
  ];

  const collaborators: Collaborator[] = ["SK", "YORP"];
  const platforms: Platform[] = ["Facebook", "Instagram", "X"];

  const getRequiredElements = () => {
    const selectedType = postType.toLowerCase();
    const logoList = ["NYC", "BP", ...selectedCollaborators];
    const requirements = [
      `Correct logos present (${logoList.join(", ")})`,
      "Correct logo order",
      "Pubmat image quality (resolution, blur, pixelation, contrast)",
    ];

    if (
      ["news", "opportunities", "holiday", "other"].includes(
        selectedType,
      )
    ) {
      requirements.push("Watermark present");
    }

    if (
      [
        "news",
        "quotes",
        "advisory",
        "resolution",
        "opportunities",
        "photo",
        "holiday",
      ].includes(selectedType)
    ) {
      requirements.push("Template correctly used");
    }

    if (["advisory", "resolution"].includes(selectedType)) {
      requirements.push("SGD signature required");
    }

    if (
      [
        "news",
        "quotes",
        "advisory",
        "resolution",
        "opportunities",
        "holiday",
        "other",
      ].includes(selectedType)
    ) {
      requirements.push("Readable text and spelling review");
    }

    return requirements;
  };

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        collaboratorRef.current &&
        !collaboratorRef.current.contains(event.target as Node)
      ) {
        setIsCollaboratorOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () =>
      document.removeEventListener(
        "mousedown",
        handleClickOutside,
      );
  }, []);

  const collaboratorLabel = useMemo(() => {
    if (selectedCollaborators.length === 0)
      return "Choose options";
    return selectedCollaborators.join(", ");
  }, [selectedCollaborators]);

  const appendImageFiles = (fileList: FileList | File[]) => {
    if (isAuditLocked) return;

    const files = Array.from(fileList).filter((file) =>
      file.type.startsWith("image/"),
    );

    if (files.length === 0) return;

    files.forEach((file) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setUploadedImages((prev) => [
          ...prev,
          { file, preview: reader.result as string },
        ]);
      };
      reader.readAsDataURL(file);
    });
  };

  const handleImageUpload = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    if (!event.target.files) return;

    appendImageFiles(event.target.files);
    event.target.value = "";
  };

  const handleRemoveImage = (index: number) => {
    if (isAuditLocked) return;

    setUploadedImages((prev) =>
      prev.filter((_, itemIndex) => itemIndex !== index),
    );
    setAnalysisResults([]);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isAuditLocked) return;
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isAuditLocked) return;
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isAuditLocked) return;
    setIsDragging(false);

    appendImageFiles(e.dataTransfer.files);
  };

  const toggleCollaborator = (value: Collaborator) => {
    if (isAuditLocked) return;

    setSelectedCollaborators((prev) =>
      prev.includes(value)
        ? prev.filter((item) => item !== value)
        : [...prev, value],
    );
  };

  const handleSelectAllCollaborators = () => {
    if (isAuditLocked) return;

    if (selectedCollaborators.length === collaborators.length) {
      setSelectedCollaborators([]);
    } else {
      setSelectedCollaborators(collaborators);
    }
  };

  const analyzeContent = async () => {
    if (isLoading || !currentOffice) {
      alert(
        "Office profile is still loading. Please wait a moment and try again.",
      );
      return;
    }

    if (uploadedImages.length === 0) {
      alert("Please upload at least one pubmat image first.");
      return;
    }

    setIsAnalyzing(true);
    const results: AnalysisResult[] = [];
    const today = new Date().toISOString().split("T")[0];
    const postingDateStr = postDate
      ? formatDateSafe(postDate)
      : today;

    try {
      for (const [index, image] of uploadedImages.entries()) {
        try {
          const result = await auditPubmat({
            file: image.file,
            postType,
            collaborators: selectedCollaborators,
          });
          const { pubmatScore, remarks, status, annotatedImage } = result;
          const resultWithFile = {
            ...result,
            fileName: image.file.name,
          };

          results.push(resultWithFile);

          await addPost({
            id: `POST-${Date.now().toString().slice(-6)}${index}`,
            platform:
              selectedPlatforms.length === 1
                ? selectedPlatforms[0]
                : selectedPlatforms,
            caption: "",
            thumbnail: annotatedImage || image.preview,
            score: pubmatScore,
            pubmatScore,
            status,
            recommendation: remarks,
            date: postingDateStr,
            office: currentOffice,
            submissionDate: today,
            lastUpdated: today,
            auditFocus: "pubmat",
            centralReviewStatus: "Pending Review",
            appealStatus: "Not Appealed",
            pubmatType: postType,
          });
        } catch (error) {
          console.warn(
            `Pubmat checker failed for ${image.file.name}:`,
            error,
          );

          const pubmatScore = 0;
          const status: "Accepted" | "Rejected" = "Rejected";
          const remarks =
            error instanceof Error
              ? `Pubmat checker failed for ${image.file.name}: ${error.message}. Please try again after the backend is fixed.`
              : `Pubmat checker failed for ${image.file.name}. Please try again after the backend is fixed.`;

          const failedResult = {
            fileName: image.file.name,
            pubmatScore,
            remarks,
            status,
            criteria: [
              {
                label: "Checker Response",
                status: "Not Present" as const,
                detail: remarks,
              },
            ],
          };

          await addPost({
            id: `POST-${Date.now().toString().slice(-6)}${index}`,
            platform:
              selectedPlatforms.length === 1
                ? selectedPlatforms[0]
                : selectedPlatforms,
            caption: "",
            thumbnail: image.preview,
            score: pubmatScore,
            pubmatScore,
            status,
            recommendation: remarks,
            date: postingDateStr,
            office: currentOffice,
            submissionDate: today,
            lastUpdated: today,
            auditFocus: "pubmat",
            centralReviewStatus: "Pending Review",
            appealStatus: "Not Appealed",
            pubmatType: postType,
          });

          results.push(failedResult);
        }
      }

      setAnalysisResults(results);

      setShowSuccessMessage(true);
      setTimeout(() => setShowSuccessMessage(false), 3000);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleStartNewAudit = () => {
    setUploadedImages([]);
    setPostType("");
    setSelectedPlatforms([]);
    setSelectedCollaborators([]);
    setPostDate(undefined);
    setAnalysisResults([]);
    setShowSuccessMessage(false);
  };

  return (
    <div className="max-w-5xl mx-auto">
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              Select Post Type
            </label>
            <select
              value={postType}
              onChange={(e) => setPostType(e.target.value)}
              disabled={isAuditLocked}
              className="w-full rounded-lg border border-border bg-card px-4 py-3 text-foreground outline-none transition focus:ring-2 focus:ring-primary disabled:cursor-not-allowed disabled:opacity-60"
            >
              <option value="">Choose post type</option>
              {postTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => setShowTypeHelp((prev) => !prev)}
              className="flex w-full items-center gap-2 rounded-lg border border-border bg-card px-4 py-3 text-left text-sm text-foreground hover:bg-muted/40"
            >
              <Info className="h-4 w-4 text-primary" />
              <span>What does this post type check?</span>
            </button>

            {showTypeHelp && (
              <div className="rounded-lg border border-border bg-card px-4 py-3 text-sm text-foreground">
                {postType ? (
                  <ul className="space-y-3">
                    {getRequiredElements().map((requirement) => (
                      <li
                        key={requirement}
                        className="flex items-start gap-3"
                      >
                        <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                        <span className="font-semibold">
                          {requirement}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-muted-foreground">
                    Select a post type to see the required
                    elements.
                  </p>
                )}
              </div>
            )}
          </div>

          <div
            className="space-y-2 relative"
            ref={collaboratorRef}
          >
            <label className="text-sm font-medium text-foreground">
              Collaborators
            </label>

            <button
              type="button"
              onClick={() =>
                !isAuditLocked &&
                setIsCollaboratorOpen((prev) => !prev)
              }
              disabled={isAuditLocked}
              className={`flex w-full items-center justify-between rounded-lg border bg-card px-4 py-3 text-left transition ${
                isCollaboratorOpen
                  ? "border-primary ring-2 ring-primary/20"
                  : "border-border"
              }`}
            >
              <span
                className={
                  selectedCollaborators.length === 0
                    ? "text-muted-foreground"
                    : "text-foreground"
                }
              >
                {collaboratorLabel}
              </span>
              <ChevronDown className="h-4 w-4 text-foreground" />
            </button>

            {isCollaboratorOpen && (
              <div className="absolute z-20 mt-1 w-full rounded-lg border border-border bg-card shadow-lg">
                <button
                type="button"
                onClick={handleSelectAllCollaborators}
                disabled={isAuditLocked}
                className="block w-full border-b border-border px-4 py-3 text-left text-sm hover:bg-muted/40"
                >
                  Select all
                </button>

                {collaborators.map((item) => (
                  <label
                    key={item}
                    className="flex cursor-pointer items-center gap-3 px-4 py-3 hover:bg-muted/40"
                  >
                    <input
                      type="checkbox"
                      checked={selectedCollaborators.includes(
                        item,
                      )}
                      disabled={isAuditLocked}
                      onChange={() => toggleCollaborator(item)}
                      className="h-4 w-4 appearance-none rounded border border-border bg-background
                                 checked:bg-primary checked:border-primary
                                 relative
                                 after:content-[''] after:absolute after:hidden
                                 after:left-1/2 after:top-1/2
                                 after:w-[4px] after:h-[8px]
                                 after:border-white after:border-r-[2.5px] after:border-b-[2.5px]
                                 after:rotate-45
                                 after:-translate-x-1/2 after:-translate-y-[60%]
                                 checked:after:block"
                    />

                    <span className="text-sm text-foreground">
                      {item}
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="bg-card rounded-lg border border-border p-6">
          <label className="block mb-4">
            <span className="text-lg font-semibold text-primary mb-2 block">
              PubMat Checker
            </span>
            <span className="text-sm text-muted-foreground block mb-4">
              Upload one or more publication materials (PNG, JPG, or
              JPEG)
            </span>
          </label>

          {uploadedImages.length === 0 ? (
            <div className="relative">
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handleImageUpload}
                disabled={isAuditLocked}
                className="hidden"
                id="pubmat-upload"
              />
              <label
                htmlFor={isAuditLocked ? undefined : "pubmat-upload"}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`flex h-44 w-full cursor-pointer items-center justify-between rounded-lg border-2 border-dashed px-6 transition-colors ${
                  isAuditLocked
                    ? "cursor-not-allowed border-border bg-muted/30 opacity-60"
                    : isDragging
                    ? "border-primary bg-primary/10"
                    : "border-border bg-background hover:bg-muted/40"
                }`}
              >
                <div className="flex items-center gap-4">
                  <Upload className="h-10 w-10 text-muted-foreground" />
                  <div>
                    <p className="text-base font-medium text-foreground">
                      Drag and drop files here
                    </p>
                    <p className="text-sm text-muted-foreground">
                      PNG, JPG or JPEG
                    </p>
                  </div>
                </div>
                <span className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground">
                  Browse files
                </span>
              </label>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-lg border border-border bg-background p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <FileImage className="h-5 w-5 text-primary" />
                    <span className="text-sm font-medium text-foreground">
                      {uploadedImageCount} file
                      {uploadedImageCount === 1 ? "" : "s"} selected
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                {uploadedImages.map((image, index) => (
                  <div
                    key={`${image.file.name}-${index}`}
                    className="overflow-hidden rounded-lg border border-border bg-muted/20"
                  >
                    <div className="flex items-center justify-between gap-3 border-b border-border bg-background px-3 py-2">
                      <span className="truncate text-xs font-medium text-foreground">
                        {image.file.name}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveImage(index)}
                        disabled={isAuditLocked}
                        className="shrink-0 text-xs font-medium text-red-600 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Remove
                      </button>
                    </div>
                    <img
                      src={image.preview}
                      alt={`Uploaded pubmat ${index + 1}`}
                      className="mx-auto h-64 w-full object-contain"
                    />
                  </div>
                ))}
              </div>

              <div className="relative">
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleImageUpload}
                  disabled={isAuditLocked}
                  className="hidden"
                  id="pubmat-upload-more"
                />
                <label
                  htmlFor={
                    isAuditLocked ? undefined : "pubmat-upload-more"
                  }
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={`flex min-h-24 w-full cursor-pointer items-center justify-between rounded-lg border-2 border-dashed px-5 py-4 transition-colors ${
                    isAuditLocked
                      ? "cursor-not-allowed border-border bg-muted/30 opacity-60"
                      : isDragging
                      ? "border-primary bg-primary/10"
                      : "border-border bg-background hover:bg-muted/40"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Upload className="h-7 w-7 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        Add more photos
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Drag more files here or browse
                      </p>
                    </div>
                  </div>
                  <span className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground">
                    Browse files
                  </span>
                </label>
              </div>
            </div>
          )}
        </div>

        <div className="bg-card rounded-lg border border-border p-6">
          <label className="block mb-4">
            <span className="text-lg font-semibold text-primary mb-2 block">
              Platform
            </span>
            <span className="text-sm text-muted-foreground block mb-4">
              Select all platforms for your post
            </span>
          </label>

          <div className="space-y-3">
            {platforms.map((p) => (
              <label
                key={p}
                className="flex items-center space-x-3 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={selectedPlatforms.includes(p)}
                  disabled={isAuditLocked}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedPlatforms([
                        ...selectedPlatforms,
                        p,
                      ]);
                    } else {
                      setSelectedPlatforms(
                        selectedPlatforms.filter(
                          (item) => item !== p,
                        ),
                      );
                    }
                  }}
                  className="h-4 w-4 appearance-none rounded border border-border bg-background
                             checked:bg-primary checked:border-primary
                             relative
                             after:content-[''] after:absolute after:hidden
                             after:left-1/2 after:top-1/2
                             after:w-[4px] after:h-[8px]
                             after:border-white after:border-r-[2.5px] after:border-b-[2.5px]
                             after:rotate-45
                             after:-translate-x-1/2 after:-translate-y-[60%]
                             checked:after:block"
                />
                <span className="text-foreground">{p}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="bg-card rounded-lg border border-border p-6">
          <label className="block mb-4">
            <span className="text-lg font-semibold text-primary mb-2 block">
              Date
            </span>
            <span className="text-sm text-muted-foreground block mb-4">
              Select posting date
            </span>
          </label>
          <DatePicker
            date={postDate}
            onDateChange={setPostDate}
            placeholder="Pick a date"
            minDate={new Date()}
            disabled={isAuditLocked}
          />
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="button"
            onClick={analyzeContent}
            disabled={
              uploadedImages.length === 0 ||
              !postType ||
              selectedPlatforms.length === 0 ||
              !postDate ||
              isAuditLocked
            }
            className="flex items-center space-x-2 rounded-lg bg-primary px-6 py-3 font-semibold text-primary-foreground transition-all hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isAnalyzing ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Analyzing...</span>
              </>
            ) : (
              <>
                <TrendingUp className="h-5 w-5" />
                <span>Analyze</span>
              </>
            )}
          </button>
        </div>

        {isAnalyzing && (
          <div className="rounded-lg border border-border bg-card p-6 animate-in fade-in slide-in-from-top-4 duration-300">
            <div className="flex items-center space-x-3">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <span className="text-sm text-muted-foreground">
                Analyzing your pubmat for quality and posting
                alignment...
              </span>
            </div>
          </div>
        )}

        {analysisResults.length > 0 && !isAnalyzing && (
          <div className="space-y-4">
            {analysisResults.map((analysisResult, index) => (
              <div
                key={`${analysisResult.fileName || "result"}-${index}`}
                className={`rounded-lg border-2 bg-card p-6 animate-in fade-in slide-in-from-top-4 duration-300 ${
                  analysisResult.status === "Accepted"
                    ? "border-green-500 bg-green-50/50"
                    : "border-red-500 bg-red-50/50"
                }`}
              >
            <div className="space-y-4">
              <div className="flex items-center space-x-3">
                {analysisResult.status === "Accepted" ? (
                  <CheckCircle className="h-6 w-6 text-green-600" />
                ) : (
                  <AlertCircle className="h-6 w-6 text-red-600" />
                )}
                <div>
                  <h3 className="text-lg font-bold text-secondary">
                    {analysisResult.status}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Content Analysis Complete
                    {analysisResult.fileName
                      ? ` for ${analysisResult.fileName}`
                      : ""}
                  </p>
                </div>
              </div>

              <div className="border-t border-border" />

              <div>
                <h4 className="mb-2 text-sm font-semibold text-primary">
                  Remarks:
                </h4>
                <div className="space-y-1 text-sm leading-relaxed text-foreground">
                  {renderRemarks(analysisResult.remarks)}
                </div>
              </div>

              {analysisResult.criteria &&
                analysisResult.criteria.length > 0 && (
                  <div>
                    <h4 className="mb-3 text-sm font-semibold text-primary">
                      Criteria:
                    </h4>
                    {renderCriteriaTable(analysisResult.criteria)}
                  </div>
                )}

              {analysisResult.annotatedImage && (
                <div>
                  <h4 className="mb-2 text-sm font-semibold text-primary">
                    Annotated Detection:
                  </h4>
                  <div className="overflow-hidden rounded-lg border border-border bg-background">
                    <img
                      src={analysisResult.annotatedImage}
                      alt="Annotated pubmat detection result"
                      className="mx-auto max-h-[520px] w-auto object-contain"
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 rounded-lg bg-muted/30 p-4 text-sm">
                <div>
                  <p className="mb-1 text-muted-foreground">
                    Post Type
                  </p>
                  <p className="font-medium text-foreground">
                    {postType}
                  </p>
                </div>
                <div>
                  <p className="mb-1 text-muted-foreground">
                    Collaborators
                  </p>
                  <p className="font-medium text-foreground">
                    {selectedCollaborators.length > 0
                      ? selectedCollaborators.join(", ")
                      : "None"}
                  </p>
                </div>
                <div>
                  <p className="mb-1 text-muted-foreground">
                    Platform
                  </p>
                  <p className="font-medium text-foreground">
                    {selectedPlatforms.join(", ")}
                  </p>
                </div>
                <div>
                  <p className="mb-1 text-muted-foreground">
                    Office
                  </p>
                  <p className="font-medium text-foreground">
                    {currentOffice || "N/A"}
                  </p>
                </div>
              </div>
            </div>
              </div>
            ))}
          </div>
        )}

        {showSuccessMessage && (
          <div className="animate-in fade-in slide-in-from-top-4 rounded-lg bg-green-500 p-4 text-center text-white duration-300">
            <p className="text-sm font-medium">
              Post submitted successfully!
            </p>
          </div>
        )}

        {analysisResults.length > 0 && !isAnalyzing && (
          <div className="flex justify-center pt-2">
            <button
              type="button"
              onClick={handleStartNewAudit}
              className="flex items-center space-x-2 rounded-lg bg-accent px-6 py-3 font-semibold text-accent-foreground transition-all hover:bg-accent/90"
            >
              <Upload className="h-5 w-5" />
              <span>Start New Audit</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default PubMatsPage;
