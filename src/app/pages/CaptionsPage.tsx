import { useState } from "react";
import { CheckCircle, AlertCircle, Loader2, TrendingUp, Upload } from "lucide-react";
import { usePosts } from "@/contexts/PostsContext";
import { useAuth } from "@/contexts/AuthContext";
import { DatePicker } from "@/app/components/ui/date-picker";
import { Client } from "@gradio/client";

const formatDateSafe = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const callCaptionVerifier = async (caption: string) => {
  try {
    const app = await Client.connect("onjmm/smartech-caption-verifier");
    const result = await app.predict("/predict", [caption]);
    return result.data || null; // Returns the full [remarks, g, i, t] list
  } catch (error) {
    console.error("Gradio Connection Error:", error);
    return null; 
  }
};

type Platform = "Facebook" | "Instagram" | "X" | "TikTok";

interface AnalysisResult {
  captionScore: number;
  remarks: string;
  status: "Accepted" | "Rejected";
  grammar: number;
  inclusivity: number;
  tone: number;
}

export function CaptionsPage() {
  const { addPost } = usePosts();
  const { currentOffice, isLoading } = useAuth();

  const [caption, setCaption] = useState("");
  const [selectedPlatforms, setSelectedPlatforms] = useState<Platform[]>([]);
  const [postDate, setPostDate] = useState<Date | undefined>();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);

  const platforms: Platform[] = ["Facebook", "Instagram", "X", "TikTok"];

  const analyzeContent = async () => {
    if (isLoading || !currentOffice) {
      alert("Office profile is still loading...");
      return;
    }

    setIsAnalyzing(true);

    try {
      const apiResponse = await callCaptionVerifier(caption);
      
      if (apiResponse && Array.isArray(apiResponse)) {
        // Destructure indices from the Python list [remarks, g, i, t]
        const remarks = String(apiResponse[0]);
        const grammar = Math.round(Number(apiResponse[1]));
        const inclusivity = Math.round(Number(apiResponse[2]));
        const tone = Math.round(Number(apiResponse[3]));

        // Calculate Weighted Global Score[cite: 1]
        const captionScore = Math.floor((grammar * 0.4) + (inclusivity * 0.4) + (tone * 0.2));
        
        // Threshold check (75 is "Accepted" based on deployment metadata)[cite: 1]
        const status = captionScore >= 75 ? "Accepted" : "Rejected";

        const result: AnalysisResult = {
          captionScore,
          remarks,
          status,
          grammar,
          inclusivity,
          tone,
        };

        setAnalysisResult(result);
        await submitPost(result);
      }
    } catch (error) {
      console.error("Analysis failed:", error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const submitPost = async (result: AnalysisResult) => {
    const today = new Date().toISOString().split("T")[0];
    const auditDateStr = postDate ? formatDateSafe(postDate) : today;

    await addPost({
      id: `POST-${Date.now().toString().slice(-6)}`,
      platform: selectedPlatforms.length === 1 ? selectedPlatforms[0] : selectedPlatforms,
      caption,
      score: result.captionScore,
      captionScore: result.captionScore,
      grammar: result.grammar,
      inclusivity: result.inclusivity,
      tone: result.tone,
      status: result.status,
      recommendation: result.remarks,
      date: today,
      office: currentOffice,
      submissionDate: auditDateStr,
      lastUpdated: auditDateStr,
      auditFocus: "caption",
      centralReviewStatus: "Pending Review",
      appealStatus: "Not Appealed",
    });

    setShowSuccessMessage(true);
    setTimeout(() => setShowSuccessMessage(false), 3000);
  };

  const handleStartNew = () => {
    setCaption("");
    setSelectedPlatforms([]);
    setPostDate(undefined);
    setAnalysisResult(null);
    setShowSuccessMessage(false);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="bg-card rounded-lg border border-border p-6">
        <label className="block mb-4">
          <span className="text-lg font-semibold text-primary block">Caption Verifier</span>
          <span className="text-sm text-muted-foreground block mb-4">Write or paste your caption</span>
        </label>
        <textarea
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          placeholder="Enter your caption here..."
          rows={6}
          className="w-full px-4 py-3 border border-border rounded-lg bg-background focus:ring-2 focus:ring-primary resize-none"
        />
        <div className="text-xs text-right text-muted-foreground mt-2">{caption.length} characters</div>
      </div>

      <div className="bg-card rounded-lg border border-border p-6">
        <label className="block mb-4">
          <span className="text-lg font-semibold text-primary mb-2 block">Platform</span>
          <span className="text-sm text-muted-foreground block mb-4">Select all platforms for your post</span>
        </label>
        <div className="space-y-3">
          {platforms.map((p) => (
            <label key={p} className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={selectedPlatforms.includes(p)}
                onChange={(e) => {
                  if (e.target.checked) setSelectedPlatforms([...selectedPlatforms, p]);
                  else setSelectedPlatforms(selectedPlatforms.filter((i) => i !== p));
                }}
                className="h-4 w-4 appearance-none rounded border border-border bg-background checked:bg-primary checked:border-primary relative after:content-[''] after:absolute after:hidden after:left-1/2 after:top-1/2 after:w-[4px] after:h-[8px] after:border-white after:border-r-[2.5px] after:border-b-[2.5px] after:rotate-45 after:-translate-x-1/2 after:-translate-y-[60%] checked:after:block"
              />
              <span>{p}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="bg-card rounded-lg border border-border p-6">
        <label className="block mb-4">
          <span className="text-lg font-semibold text-primary mb-2 block">Date</span>
          <span className="text-sm text-muted-foreground block mb-4">Select posting date</span>
        </label>
        <DatePicker date={postDate} onDateChange={setPostDate} placeholder="Pick a date" minDate={new Date()} />
      </div>

      <div className="flex justify-end">
        <button
          onClick={analyzeContent}
          disabled={!caption || selectedPlatforms.length === 0 || !postDate || isAnalyzing}
          className="flex items-center gap-2 bg-primary text-white px-6 py-3 rounded-lg disabled:opacity-50"
        >
          {isAnalyzing ? <><Loader2 className="animate-spin h-4 w-4" /> Analyzing...</> : <><TrendingUp className="h-4 w-4" /> Analyze</>}
        </button>
      </div>

      {analysisResult && !isAnalyzing && (
        <div className={`rounded-lg border-2 bg-card p-6 animate-in fade-in slide-in-from-top-4 duration-300 ${analysisResult.status === "Accepted" ? "border-green-500 bg-green-50/50" : "border-red-500 bg-red-50/50"}`}>
          <div className="space-y-4">
            <div className="flex items-center space-x-3">
              {analysisResult.status === "Accepted" ? <CheckCircle className="h-6 w-6 text-green-600" /> : <AlertCircle className="h-6 w-6 text-red-600" />}
              <div>
                <h3 className="text-lg font-bold text-secondary">{analysisResult.status}</h3>
                <p className="text-xs text-muted-foreground">Caption Analysis Complete</p>
              </div>
            </div>

            <div className={`rounded-lg p-4 text-center ${analysisResult.captionScore >= 75 ? "border-2 border-green-500 bg-green-100" : "border-2 border-red-500 bg-red-100"}`}>
              <p className={`text-4xl font-bold ${analysisResult.captionScore >= 75 ? "text-green-700" : "text-red-700"}`}>{analysisResult.captionScore}</p>
              <p className="mt-1 text-xs font-semibold text-secondary">Overall Caption Score</p>
            </div>

            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="rounded-lg bg-muted/30 p-4">
                <p className="text-2xl font-bold text-foreground">{analysisResult.grammar}</p>
                <p className="mt-1 text-xs font-semibold text-muted-foreground">Grammar</p>
              </div>
              <div className="rounded-lg bg-muted/30 p-4">
                <p className="text-2xl font-bold text-foreground">{analysisResult.inclusivity}</p>
                <p className="mt-1 text-xs font-semibold text-muted-foreground">Inclusivity</p>
              </div>
              <div className="rounded-lg bg-muted/30 p-4">
                <p className="text-2xl font-bold text-foreground">{analysisResult.tone}</p>
                <p className="mt-1 text-xs font-semibold text-muted-foreground">Tone</p>
              </div>
            </div>

            <div className="border-t border-border" />

            <div>
              <h4 className="mb-2 text-sm font-semibold text-primary">Remarks:</h4>
              <p className="text-sm leading-relaxed text-foreground">{analysisResult.remarks}</p>
            </div>
          </div>
        </div>
      )}

      {analysisResult && !isAnalyzing && (
        <div className="flex justify-center pt-2">
          <button type="button" onClick={handleStartNew} className="flex items-center space-x-2 rounded-lg bg-accent px-6 py-3 font-semibold text-accent-foreground transition-all hover:bg-accent/90">
            <Upload className="h-5 w-5" />
            <span>Start New Audit</span>
          </button>
        </div>
      )}

      {showSuccessMessage && (
        <div className="bg-green-500 text-white text-center p-3 rounded">Submitted successfully!</div>
      )}
    </div>
  );
}