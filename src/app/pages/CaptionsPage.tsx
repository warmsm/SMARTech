import { useState } from "react";
import { 
  CheckCircle, 
  AlertCircle, 
  Loader2, 
  TrendingUp, 
  Search, 
  Calendar, 
  Share2 
} from "lucide-react";
import { usePosts } from "@/contexts/PostsContext";
import { useAuth } from "@/contexts/AuthContext";
import { Client } from "@gradio/client";

export default function CaptionsPage() {
  const { addPost } = usePosts();
  const { currentOffice } = useAuth();
  
  // Form State
  const [caption, setCaption] = useState("");
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  
  // Analysis State
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<{
    captionScore: number;
    remarks: string;
    status: "Accepted" | "Rejected";
    grammar: number;
    inclusivity: number;
    tone: number;
  } | null>(null);

  const analyzeContent = async () => {
    if (!caption.trim()) return;
    
    setIsAnalyzing(true);
    setAnalysisResult(null);

    try {
      // Connect to your Hugging Face Space
      const app = await Client.connect("onjmm/smartech-caption-verifier");
      
      // Send the caption to the /predict endpoint
      const result = await app.predict("/predict", [caption]);
      
      if (result.data) {
        // Mapping the 4 outputs from Python: [remarks, grammar, inclusivity, tone]
        const [remarks, gScore, iScore, tScore] = result.data;
        
        // Calculate the weighted average matching your backend logic
        const finalWeightedScore = Math.floor(
          (Number(gScore) * 0.4) + 
          (Number(iScore) * 0.4) + 
          (Number(tScore) * 0.2)
        );
        
        const status = finalWeightedScore >= 75 ? "Accepted" : "Rejected";

        const data = {
          captionScore: finalWeightedScore,
          remarks: String(remarks),
          status: status as "Accepted" | "Rejected",
          grammar: Math.round(Number(gScore)),
          inclusivity: Math.round(Number(iScore)),
          tone: Math.round(Number(tScore))
        };

        setAnalysisResult(data);
        
        // Save to your Posts history
        await addPost({
          id: `POST-${Date.now()}`,
          platform: selectedPlatforms.length > 0 ? selectedPlatforms : ["Other"],
          caption: caption,
          score: finalWeightedScore,
          status: status,
          recommendation: data.remarks,
          office: currentOffice || "General",
          date: new Date().toISOString().split('T')[0]
        });
      }
    } catch (error) {
      console.error("Analysis failed:", error);
      alert("Failed to connect to the analysis engine. Check Hugging Face logs.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Caption Verifier</h1>
        <p className="text-muted-foreground">
          Analyze your social media captions for NYC professional standards.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        {/* Left Column: Input */}
        <div className="lg:col-span-3 space-y-6">
          <div className="bg-card border rounded-xl p-6 shadow-sm space-y-4">
            <label className="text-sm font-semibold uppercase tracking-wider opacity-70">
              Content Entry
            </label>
            <textarea 
              className="w-full min-h-[200px] p-4 rounded-lg border bg-background focus:ring-2 focus:ring-primary outline-none transition-all"
              placeholder="Paste your caption here for AI analysis..."
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
            />
            
            <div className="flex flex-wrap gap-2">
              {['Facebook', 'Instagram', 'Twitter', 'LinkedIn'].map(plt => (
                <button
                  key={plt}
                  onClick={() => setSelectedPlatforms(prev => 
                    prev.includes(plt) ? prev.filter(p => p !== plt) : [...prev, plt]
                  )}
                  className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                    selectedPlatforms.includes(plt) 
                    ? 'bg-primary text-white border-primary' 
                    : 'hover:bg-accent'
                  }`}
                >
                  {plt}
                </button>
              ))}
            </div>

            <button 
              onClick={analyzeContent}
              disabled={isAnalyzing || !caption.trim()}
              className="w-full py-4 bg-primary text-primary-foreground font-bold rounded-lg flex items-center justify-center gap-3 hover:opacity-90 disabled:opacity-50 transition-all"
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="animate-spin h-5 w-5" />
                  AI is Analyzing...
                </>
              ) : (
                <>
                  <TrendingUp className="h-5 w-5" />
                  Run Audit
                </>
              )}
            </button>
          </div>
        </div>

        {/* Right Column: Results */}
        <div className="lg:col-span-2">
          {analysisResult ? (
            <div className={`rounded-xl border-2 p-6 shadow-lg transition-all ${
              analysisResult.status === 'Accepted' 
              ? 'border-green-500 bg-green-50/50' 
              : 'border-red-500 bg-red-50/50'
            }`}>
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  {analysisResult.status === 'Accepted' ? (
                    <CheckCircle className="text-green-600 h-6 w-6" />
                  ) : (
                    <AlertCircle className="text-red-600 h-6 w-6" />
                  )}
                  <span className={`font-bold text-xl ${
                    analysisResult.status === 'Accepted' ? 'text-green-700' : 'text-red-700'
                  }`}>
                    {analysisResult.status}
                  </span>
                </div>
                <span className="text-xs font-mono opacity-50">v3.1.0-AI</span>
              </div>

              <div className="text-center py-6">
                <div className={`text-7xl font-black mb-2 ${
                  analysisResult.status === 'Accepted' ? 'text-green-800' : 'text-red-800'
                }`}>
                  {analysisResult.captionScore}
                </div>
                <div className="text-xs uppercase font-bold tracking-widest opacity-60">
                  Overall Compliance Score
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 border-y border-black/10 py-6 my-6">
                <div className="text-center">
                  <div className="text-xl font-bold">{analysisResult.grammar}</div>
                  <div className="text-[10px] uppercase opacity-60">Grammar</div>
                </div>
                <div className="text-center border-x border-black/10">
                  <div className="text-xl font-bold">{analysisResult.inclusivity}</div>
                  <div className="text-[10px] uppercase opacity-60">Inclusivity</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-bold">{analysisResult.tone}</div>
                  <div className="text-[10px] uppercase opacity-60">Tone</div>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase opacity-60">AI Remarks:</h4>
                <p className="text-sm leading-relaxed text-foreground/80 italic">
                  "{analysisResult.remarks}"
                </p>
              </div>

              <button 
                onClick={() => {setAnalysisResult(null); setCaption("");}}
                className="w-full mt-8 py-2 text-sm font-semibold border border-black/10 rounded-lg hover:bg-black/5 transition-colors"
              >
                Start New Audit
              </button>
            </div>
          ) : (
            <div className="h-full min-h-[300px] border-2 border-dashed rounded-xl flex flex-col items-center justify-center p-8 text-center opacity-40">
              <Search className="h-12 w-12 mb-4" />
              <p className="text-sm font-medium">Audit Results will appear here after analysis.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}