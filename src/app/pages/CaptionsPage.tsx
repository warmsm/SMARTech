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

// CHANGED: Removed 'default' to fix the Vercel build error
export function CaptionsPage() {
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
        const [remarks, gScore, iScore, tScore] = result.data as [string, number, number, number];
        
        // Calculate weighted average
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
        <h1 className="text-3xl font-bold tracking-tight text-primary">Caption Verifier</h1>
        <p className="text-muted-foreground text-sm lg:text-base">
          Analyze your social media captions for professional standards using DeBERTa models.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        {/* Input Column */}
        <div className="lg:col-span-3 space-y-6">
          <div className="bg-card border border-border rounded-xl p-6 shadow-sm space-y-4">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Content Entry
            </label>
            <textarea 
              className="w-full min-h-[220px] p-4 rounded-lg border border-border bg-background focus:ring-2 focus:ring-primary outline-none transition-all resize-none text-sm"
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
                  className={`px-4 py-1.5 rounded-full text-xs font-medium border transition-all ${
                    selectedPlatforms.includes(plt) 
                    ? 'bg-primary text-primary-foreground border-primary' 
                    : 'bg-card text-foreground border-border hover:bg-muted'
                  }`}
                >
                  {plt}
                </button>
              ))}
            </div>

            <button 
              onClick={analyzeContent}
              disabled={isAnalyzing || !caption.trim()}
              className="w-full py-4 bg-primary text-primary-foreground font-bold rounded-lg flex items-center justify-center gap-3 hover:opacity-90 disabled:opacity-50 transition-all shadow-md"
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="animate-spin h-5 w-5" />
                  Processing through Hugging Face...
                </>
              ) : (
                <>
                  <TrendingUp className="h-5 w-5" />
                  Run Caption Audit
                </>
              )}
            </button>
          </div>
        </div>

        {/* Results Column */}
        <div className="lg:col-span-2">
          {analysisResult ? (
            <div className={`rounded-xl border-2 p-6 shadow-lg transition-all animate-in fade-in slide-in-from-right-4 ${
              analysisResult.status === 'Accepted' 
              ? 'border-green-500 bg-green-50/10' 
              : 'border-red-500 bg-red-50/10'
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
                <span className="text-[10px] font-mono opacity-40 uppercase tracking-tighter">SMARTech Engine</span>
              </div>

              <div className="text-center py-6">
                <div className={`text-7xl font-black mb-2 tracking-tighter ${
                  analysisResult.status === 'Accepted' ? 'text-green-800' : 'text-red-800'
                }`}>
                  {analysisResult.captionScore}
                </div>
                <div className="text-[10px] uppercase font-bold tracking-widest opacity-60">
                  Overall Compliance Score
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 border-y border-border py-6 my-6">
                <div className="text-center">
                  <div className="text-xl font-bold">{analysisResult.grammar}</div>
                  <div className="text-[10px] uppercase opacity-60">Grammar</div>
                </div>
                <div className="text-center border-x border-border">
                  <div className="text-xl font-bold">{analysisResult.inclusivity}</div>
                  <div className="text-[10px] uppercase opacity-60">Inclusivity</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-bold">{analysisResult.tone}</div>
                  <div className="text-[10px] uppercase opacity-60">Tone</div>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="text-[10px] font-bold uppercase opacity-60 flex items-center gap-1">
                  <Calendar className="h-3 w-3" /> AI Insights & Remarks:
                </h4>
                <p className="text-sm leading-relaxed text-foreground/80 italic bg-background/50 p-3 rounded-lg border border-border">
                  "{analysisResult.remarks}"
                </p>
              </div>

              <button 
                onClick={() => {setAnalysisResult(null); setCaption("");}}
                className="w-full mt-8 py-2 text-xs font-semibold border border-border rounded-lg bg-background hover:bg-muted transition-colors flex items-center justify-center gap-2"
              >
                <Share2 className="h-3 w-3" /> Start New Audit
              </button>
            </div>
          ) : (
            <div className="h-full min-h-[400px] border-2 border-dashed border-border rounded-xl flex flex-col items-center justify-center p-8 text-center opacity-40 bg-muted/5">
              <div className="bg-muted p-4 rounded-full mb-4">
                <Search className="h-10 w-10 text-muted-foreground" />
              </div>
              <h3 className="font-semibold text-foreground">Awaiting Input</h3>
              <p className="text-xs max-w-[200px] mx-auto mt-2">Results will generate here once you run the audit.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}