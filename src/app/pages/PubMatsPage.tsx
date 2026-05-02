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
import { Client } from "@gradio/client";
import { usePosts } from "@/contexts/PostsContext";
import { useAuth } from "@/contexts/AuthContext";
import { DatePicker } from "@/app/components/ui/date-picker";

/**
 * Utility to format dates for the SMARTech database/context
 */
const formatDateSafe = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

type Platform = "Facebook" | "Instagram" | "X";
type Collaborator = "SK" | "YORP";

interface AnalysisResult {
  pubmatScore: number;
  remarks: string;
  status: "Accepted" | "Rejected";
}

export default function PubMatsPage() {
  const { addPost } = usePosts();
  const { currentOffice, isLoading } = useAuth();

  // Form State
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [postType, setPostType] = useState("");
  const [fileName, setFileName] = useState("");
  const [selectedPlatforms, setSelectedPlatforms] = useState<Platform[]>([]);
  const [selectedCollaborators, setSelectedCollaborators] = useState<Collaborator[]>([]);
  const [postDate, setPostDate] = useState<Date | undefined>(undefined);
  
  // UI & Analysis State
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [isCollaboratorOpen, setIsCollaboratorOpen] = useState(false);
  const [showTypeHelp, setShowTypeHelp] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const collaboratorRef = useRef<HTMLDivElement | null>(null);

  const postTypes = [
    "News",
    "Quotes",
    "Advisory",
    "Resolution",
    "Opportunity",
    "Photo",
    "Holiday",
    "Other",
  ];

  const collaborators: Collaborator[] = ["SK", "YORP"];
  const platforms: Platform[] = ["Facebook", "Instagram", "X"];

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (collaboratorRef.current && !collaboratorRef.current.contains(event.target as Node)) {
        setIsCollaboratorOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const collaboratorLabel = useMemo(() => {
    if (selectedCollaborators.length === 0) return "Choose options";
    return selectedCollaborators.join(", ");
  }, [selectedCollaborators]);

  // Image Handlers
  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onloadend = () => setUploadedImage(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleRemoveImage = () => {
    setUploadedImage(null);
    setFileName("");
    setAnalysisResult(null);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith("image/")) {
      setFileName(file.name);
      const reader = new FileReader();
      reader.onloadend = () => setUploadedImage(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const toggleCollaborator = (value: Collaborator) => {
    setSelectedCollaborators((prev) =>
      prev.includes(value) ? prev.filter((item) => item !== value) : [...prev, value]
    );
  };

  const handleSelectAllCollaborators = () => {
    setSelectedCollaborators(selectedCollaborators.length === collaborators.length ? [] : collaborators);
  };

  /**
   * Primary Analysis logic using @gradio/client
   */
  const analyzeContent = async () => {
    if (!uploadedImage) return;
    
    setIsAnalyzing(true);
    setAnalysisResult(null);

    try {
      const client = await Client.connect("LFaithB/smartech-pubmat-checker");
      const imageBlob = await fetch(uploadedImage).then((r) => r.blob());

      const result = await client.predict("/predict", {
        image: imageBlob,
        post_type: postType,
        collaborators_text: JSON.stringify(selectedCollaborators),
      });

      // result.data[0] is the annotated image, result.data[1] is the JSON report
      const annotatedImage = result.data[0] as string;
      const apiData = result.data[1] as any;
      
      // Update preview to show the version with detection boxes/highlights
      setUploadedImage(annotatedImage);
      
      // DEEP PARSING: Extract specific remarks from nested report keys
      const specificRemark = 
        apiData?.logos?.remark || 
        apiData?.watermark?.remark || 
        (apiData?.overall === "PASS" ? "Branding compliance verified." : "Compliance issues detected.");

      const status = apiData?.overall === "PASS" ? "Accepted" : "Rejected";
      const pubmatScore = apiData?.overall === "PASS" ? 100 : 70;

      setAnalysisResult({ pubmatScore, remarks: specificRemark, status });

      if (!isLoading && currentOffice) {
        const today = new Date().toISOString().split("T")[0];
        const auditDateStr = postDate ? formatDateSafe(postDate) : today;

        await addPost({
          id: `POST-${Date.now().toString().slice(-6)}`,
          platform: selectedPlatforms.length === 1 ? selectedPlatforms[0] : selectedPlatforms,
          caption: "",
          thumbnail: annotatedImage, // CRITICAL: This fixes the empty image in the table
          score: pubmatScore,
          pubmatScore,
          status,
          recommendation: specificRemark, // This fixes the generic remarks in the table
          date: today,
          office: currentOffice,
          submissionDate: auditDateStr,
          lastUpdated: auditDateStr,
          auditFocus: "pubmat",
          centralReviewStatus: "Pending Review",
          appealStatus: "Not Appealed",
          pubmatType: postType,
        });

        setShowSuccessMessage(true);
        setTimeout(() => setShowSuccessMessage(false), 3000);
      }
    } catch (error) {
      console.error("Audit Error:", error);
      alert(`Analysis failed: ${error instanceof Error ? error.message : "Connection error"}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleStartNewAudit = () => {
    setUploadedImage(null);
    setFileName("");
    setPostType("");
    setSelectedPlatforms([]);
    setSelectedCollaborators([]);
    setPostDate(undefined);
    setAnalysisResult(null);
    setShowSuccessMessage(false);
  };

  return (
    <div className="max-w-5xl mx-auto">
      <div className="space-y-6">
        {/* Post Type & Collaborators Rows */}
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Select Post Type</label>
            <select
              value={postType}
              onChange={(e) => setPostType(e.target.value)}
              className="w-full rounded-lg border border-border bg-card px-4 py-3 text-foreground outline-none transition focus:ring-2 focus:ring-primary"
            >
              <option value="">Choose post type</option>
              {postTypes.map((type) => (
                <option key={type} value={type}>{type}</option>
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
              <div className="rounded-lg border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
                Evaluates logo placement, hierarchy, and watermark requirements specific to {postType || 'the selected'} format.
              </div>
            )}
          </div>

          <div className="space-y-2 relative" ref={collaboratorRef}>
            <label className="text-sm font-medium text-foreground">Collaborators</label>
            <button
              type="button"
              onClick={() => setIsCollaboratorOpen((prev) => !prev)}
              className={`flex w-full items-center justify-between rounded-lg border bg-card px-4 py-3 text-left transition ${
                isCollaboratorOpen ? "border-primary ring-2 ring-primary/20" : "border-border"
              }`}
            >
              <span className={selectedCollaborators.length === 0 ? "text-muted-foreground" : "text-foreground"}>
                {collaboratorLabel}
              </span>
              <ChevronDown className="h-4 w-4 text-foreground" />
            </button>

            {isCollaboratorOpen && (
              <div className="absolute z-20 mt-1 w-full rounded-lg border border-border bg-card shadow-lg">
                <button
                  type="button"
                  onClick={handleSelectAllCollaborators}
                  className="block w-full border-b border-border px-4 py-3 text-left text-sm hover:bg-muted/40"
                >
                  Select all
                </button>
                {collaborators.map((item) => (
                  <label key={item} className="flex cursor-pointer items-center gap-3 px-4 py-3 hover:bg-muted/40">
                    <input
                      type="checkbox"
                      checked={selectedCollaborators.includes(item)}
                      onChange={() => toggleCollaborator(item)}
                      className="h-4 w-4 appearance-none rounded border border-border bg-background checked:bg-primary checked:border-primary relative after:content-[''] after:absolute after:hidden after:left-1/2 after:top-1/2 after:w-[4px] after:h-[8px] after:border-white after:border-r-[2.5px] after:border-b-[2.5px] after:rotate-45 after:-translate-x-1/2 after:-translate-y-[60%] checked:after:block"
                    />
                    <span className="text-sm text-foreground">{item}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Upload Area */}
        <div className="bg-card rounded-lg border border-border p-6">
          <label className="block mb-2 text-lg font-semibold text-primary">PubMat Checker</label>
          <p className="text-sm text-muted-foreground mb-4">Upload publication material (PNG, JPG, or JPEG)</p>
          {!uploadedImage ? (
            <div className="relative">
              <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" id="pubmat-upload" />
              <label
                htmlFor="pubmat-upload"
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`flex h-44 w-full cursor-pointer items-center justify-between rounded-lg border-2 border-dashed px-6 transition-colors ${
                  isDragging ? "border-primary bg-primary/10" : "border-border bg-background hover:bg-muted/40"
                }`}
              >
                <div className="flex items-center gap-4">
                  <Upload className="h-10 w-10 text-muted-foreground" />
                  <div>
                    <p className="text-base font-medium text-foreground">Drag and drop files here</p>
                    <p className="text-sm text-muted-foreground">PNG, JPG or JPEG</p>
                  </div>
                </div>
                <span className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium">Browse files</span>
              </label>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-lg border border-border bg-background p-4 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <FileImage className="h-5 w-5 text-primary" />
                  <span className="text-sm font-medium">{fileName}</span>
                </div>
                <button onClick={handleRemoveImage} className="text-sm font-medium text-red-600 hover:text-red-700">Remove</button>
              </div>
              <div className="rounded-lg border border-border overflow-hidden bg-muted/20">
                <img src={uploadedImage} alt="Preview" className="mx-auto max-h-[500px] w-auto object-contain" />
              </div>
            </div>
          )}
        </div>

        {/* Platform & Date Selection */}
        <div className="grid gap-6 md:grid-cols-2">
          <div className="bg-card rounded-lg border border-border p-6">
            <label className="block mb-4 font-semibold text-primary">Platform</label>
            <div className="space-y-3">
              {platforms.map((p) => (
                <label key={p} className="flex items-center space-x-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedPlatforms.includes(p)}
                    onChange={(e) =>
                      setSelectedPlatforms(e.target.checked ? [...selectedPlatforms, p] : selectedPlatforms.filter((i) => i !== p))
                    }
                    className="h-4 w-4 appearance-none rounded border border-border bg-background checked:bg-primary checked:border-primary relative after:content-[''] after:absolute after:hidden after:left-1/2 after:top-1/2 after:w-[4px] after:h-[8px] after:border-white after:border-r-[2.5px] after:border-b-[2.5px] after:rotate-45 after:-translate-x-1/2 after:-translate-y-[60%] checked:after:block"
                  />
                  <span className="text-foreground">{p}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="bg-card rounded-lg border border-border p-6">
            <label className="block mb-4 font-semibold text-primary">Posting Date</label>
            <DatePicker date={postDate} onDateChange={setPostDate} placeholder="Pick a date" minDate={new Date()} />
          </div>
        </div>

        {/* Action Button */}
        <div className="flex justify-end pt-2">
          <button
            type="button"
            onClick={analyzeContent}
            disabled={!uploadedImage || !postType || selectedPlatforms.length === 0 || !postDate || isAnalyzing}
            className="flex items-center space-x-2 rounded-lg bg-primary px-6 py-3 font-semibold text-primary-foreground transition-all hover:bg-primary/90 disabled:opacity-50"
          >
            {isAnalyzing ? (
              <><Loader2 className="h-5 w-5 animate-spin" /><span>Analyzing...</span></>
            ) : (
              <><TrendingUp className="h-5 w-5" /><span>Analyze PubMat</span></>
            )}
          </button>
        </div>

        {/* Result UI */}
        {analysisResult && (
          <div className={`rounded-lg border-2 p-6 animate-in fade-in slide-in-from-top-4 duration-300 ${
            analysisResult.status === "Accepted" ? "border-green-500 bg-green-50/10" : "border-red-500 bg-red-50/10"
          }`}>
            <div className="flex items-center space-x-3 mb-4">
              {analysisResult.status === "Accepted" ? <CheckCircle className="h-6 w-6 text-green-600" /> : <AlertCircle className="h-6 w-6 text-red-600" />}
              <h3 className="text-lg font-bold">{analysisResult.status} (Score: {analysisResult.pubmatScore}%)</h3>
            </div>
            <p className="text-sm text-foreground mb-4 whitespace-pre-wrap">{analysisResult.remarks}</p>
            <button onClick={handleStartNewAudit} className="bg-accent px-4 py-2 rounded-lg text-sm font-medium">Start New Audit</button>
          </div>
        )}

        {showSuccessMessage && (
          <div className="rounded-lg bg-green-500 p-4 text-center text-white text-sm font-medium">
            Audit recorded successfully in post history!
          </div>
        )}
      </div>
    </div>
  );
}