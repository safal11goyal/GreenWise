import { useState, useRef, useCallback } from 'react';
import { Upload, AlertCircle } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface MaterialScannerProps {
  productId: string;
  onScanComplete: (productId?: string) => void;
}

interface DetectedMaterial {
  material: string;
  confidence: number;
}

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const VALID_FILE_TYPES = ['image/jpeg', 'image/png', 'image/jpg'];

const MaterialScanner = ({ productId, onScanComplete }: MaterialScannerProps) => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [detectedMaterials, setDetectedMaterials] = useState<DetectedMaterial[]>([]);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const validateFile = (file: File): boolean => {
    if (file.size > MAX_FILE_SIZE) {
      toast({
        title: "File Too Large",
        description: "Please upload an image smaller than 5MB",
        variant: "destructive",
      });
      return false;
    }

    if (!VALID_FILE_TYPES.includes(file.type)) {
      toast({
        title: "Invalid File Type",
        description: "Please upload a JPEG or PNG image",
        variant: "destructive",
      });
      return false;
    }

    return true;
  };

  const analyzeImage = async (base64Image: string) => {
    try {
      setIsAnalyzing(true);
      setError(null);
      
      if (!import.meta.env.VITE_GOOGLE_CLOUD_API_KEY) {
        throw new Error('Google Cloud API key is not configured');
      }

      const imageContent = base64Image.replace(/^data:image\/(png|jpeg|jpg);base64,/, '');

      const response = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${import.meta.env.VITE_GOOGLE_CLOUD_API_KEY}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requests: [{
            image: { content: imageContent },
            features: [
              { type: 'OBJECT_LOCALIZATION', maxResults: 15 },
              { type: 'LABEL_DETECTION', maxResults: 15 }
            ]
          }]
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || 'Analysis failed');
      }

      if (!data.responses?.[0]?.labelAnnotations?.length) {
        throw new Error('No materials detected in the image');
      }

      const materials = data.responses[0].labelAnnotations.map((label: any) => ({
        material: label.description,
        confidence: label.score * 100
      }));

      setDetectedMaterials(materials);

      const { error: dbError } = await supabase
        .from('material_scans')
        .insert({
          product_id: productId,
          scan_data: JSON.stringify(data.responses[0]),
          user_id: (await supabase.auth.getUser()).data.user?.id,
          detected_materials: materials.map(m => m.material)
        });

    

      toast({
        title: "Analysis Complete",
        description: "Materials have been successfully analyzed.",
      });

      onScanComplete(productId);

    } catch (error: any) {
      setError(error.message);
      toast({
        title: "Analysis Failed",
        description: error.message || "Unable to analyze the image. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!validateFile(file)) {
      event.target.value = '';
      return;
    }

    const reader = new FileReader();
    
    reader.onerror = () => {
      toast({
        title: "Upload Failed",
        description: "Failed to read the image file. Please try again.",
        variant: "destructive",
      });
    };

    reader.onloadend = () => {
      const base64Image = reader.result as string;
      setCapturedImage(base64Image);
      analyzeImage(base64Image);
    };

    reader.readAsDataURL(file);
  }, [toast]);

  const handleRetry = () => {
    setCapturedImage(null);
    setDetectedMaterials([]);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <Card className="p-4 shadow-md">
      <div className="space-y-4">
        <div className="text-center py-4">
          <h3 className="text-lg font-medium">Material Scanner</h3>
          <p className="text-sm text-gray-500 mt-1">
            Upload an image to analyze materials
          </p>
        </div>

        <div className="flex justify-center gap-2">
          <Button
            onClick={() => fileInputRef.current?.click()}
            className="bg-eco-primary hover:bg-eco-accent"
            disabled={isAnalyzing}
          >
            <Upload className="w-4 h-4 mr-2" />
            Upload Image
          </Button>
          {capturedImage && (
            <Button
              onClick={handleRetry}
              variant="outline"
              disabled={isAnalyzing}
            >
              Try Another Image
            </Button>
          )}
          <input
            type="file"
            ref={fileInputRef}
            accept="image/png,image/jpeg,image/jpg"
            onChange={handleFileUpload}
            className="hidden"
          />
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-lg flex items-center">
            <AlertCircle className="w-4 h-4 mr-2" />
            {error}
          </div>
        )}

        {capturedImage && (
          <div className="relative rounded-lg overflow-hidden">
            <img
              src={capturedImage}
              alt="Uploaded material"
              className="w-full max-h-[300px] object-contain"
            />
            {isAnalyzing && (
              <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
              </div>
            )}
          </div>
        )}

        {detectedMaterials.length > 0 && (
          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="font-medium text-gray-800 mb-2">Detected Materials</h4>
            <ul className="space-y-1">
              {detectedMaterials.map((item, index) => (
                <li key={index} className="text-sm text-gray-700 flex justify-between">
                  <span>{item.material}</span>
                  <span className="text-gray-500">{item.confidence.toFixed(1)}% confidence</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {isAnalyzing && (
          <p className="text-center text-sm text-gray-600">
            Analyzing materials... Please wait
          </p>
        )}
      </div>
    </Card>
  );
};

export default MaterialScanner;