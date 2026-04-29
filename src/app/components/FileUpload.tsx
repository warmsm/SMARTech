import { useCallback, useState } from 'react'; // Added useState
import { useDropzone } from 'react-dropzone';
import { Card, CardContent } from '@/app/components/ui/card';
import { Upload, Loader2 } from 'lucide-react'; // Added Loader2 for loading state
import { toast } from "sonner"; // Assuming you use sonner from your UI folder

export function FileUpload() {
  const [isUploading, setIsUploading] = useState(false);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;

    const file = acceptedFiles[0];
    setIsUploading(true);

    // Create the FormData to match what the FastAPI backend expects
    const formData = new FormData();
    formData.append('file', file);
    formData.append('post_type', 'news'); // Hardcoded for now, or pass from props
    formData.append('collaborators', JSON.stringify([])); // Empty array for now

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/audit`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) throw new Error('Backend failed to process audit');

      const result = await response.json();
      console.log('Audit Results:', result);
      
      toast.success("Audit Complete!");
      
      // Handle the result (e.g., pass it to a parent component to show the table)
      // onUploadSuccess(result); 

    } catch (error) {
      console.error('Upload error:', error);
      toast.error("Failed to connect to SMARTech AI.");
    } finally {
      setIsUploading(false);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    disabled: isUploading, // Prevent multiple uploads at once
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.svg'],
    },
  });

  return (
    <Card>
      <CardContent className="p-6">
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
            isDragActive
              ? 'border-primary bg-primary/5'
              : 'border-border hover:border-primary/50'
          } ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <input {...getInputProps()} />
          
          {isUploading ? (
            <Loader2 className="mx-auto h-12 w-12 text-primary animate-spin mb-4" />
          ) : (
            <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          )}

          {isUploading ? (
            <p className="text-lg">SMARTech AI is auditing your file...</p>
          ) : isDragActive ? (
            <p className="text-lg">Drop the files here...</p>
          ) : (
            <div>
              <p className="text-lg mb-2">
                Drag and drop files here, or click to browse
              </p>
              <p className="text-sm text-muted-foreground">
                Supports: PNG, JPG, JPEG, GIF, SVG
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}