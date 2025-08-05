import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import * as faceapi from 'face-api.js';
import { Loader2, AlertCircle } from 'lucide-react';
import { Card } from '@/components/ui/card';

// Model URLs from face-api.js CDN
const MODEL_URLS = {
  tinyFaceDetector: 'https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights/tiny_face_detector_model-',
  faceLandmark68: 'https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights/face_landmark_68_model-',
  faceExpression: 'https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights/face_expression_model-'
};

interface FaceDetectionState {
  faceDetected: boolean;
  multipleFaces: boolean;
  lookingAway: boolean;
  confidence: number;
  gazeDirection: 'left' | 'center' | 'right' | null;
}

interface ProctorCameraProps {
  onViolation: (type: string, description: string) => void;
  isActive: boolean;
}

const ProctorCamera: React.FC<ProctorCameraProps> = ({ onViolation, isActive }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectionIntervalRef = useRef<number>();
  
  const [isInitializing, setIsInitializing] = useState(true);
  const [detectionState, setDetectionState] = useState<FaceDetectionState>({
    faceDetected: false,
    multipleFaces: false,
    lookingAway: false,
    confidence: 0,
    gazeDirection: null
  });
  const [modelLoaded, setModelLoaded] = useState(false);

  // Load face detection models with force download
  useEffect(() => {
    const downloadAndSaveModel = async (baseUrl: string, modelName: string) => {
      const files = ['shard1', 'weights_manifest.json'];
      for (const file of files) {
        const response = await fetch(`${baseUrl}${file}`);
        if (!response.ok) throw new Error(`Failed to download ${modelName} ${file}`);
        const blob = await response.blob();
        
        // Convert blob to base64 and store in localStorage as temporary cache
        const reader = new FileReader();
        const base64 = await new Promise<string>((resolve) => {
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(blob);
        });
        localStorage.setItem(`face-api-${modelName}-${file}`, base64);
      }
    };

    const loadModels = async (retryCount = 0) => {
      try {
        setIsInitializing(true);
        
        // Force clear any cached models
        faceapi.nets.tinyFaceDetector.isLoaded = false;
        faceapi.nets.faceLandmark68Net.isLoaded = false;
        faceapi.nets.faceExpressionNet.isLoaded = false;
        
        // Force download fresh models
        await Promise.all([
          downloadAndSaveModel(MODEL_URLS.tinyFaceDetector, 'tiny-face'),
          downloadAndSaveModel(MODEL_URLS.faceLandmark68, 'landmark-68'),
          downloadAndSaveModel(MODEL_URLS.faceExpression, 'expression')
        ]);

        // Attempt to load models with retries
        const maxRetries = 3;
        const loadWithRetry = async (loader: any) => {
          try {
            await loader.loadFromUri('/weights');
          } catch (e) {
            if (retryCount < maxRetries) {
              console.log(`Retrying model load... Attempt ${retryCount + 1}/${maxRetries}`);
              await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1s before retry
              return loadModels(retryCount + 1);
            }
            throw e;
          }
        };

        // Create URLs from the cached base64 data
        const createModelUrls = (modelName: string) => {
          const shard = localStorage.getItem(`face-api-${modelName}-shard1`);
          const manifest = localStorage.getItem(`face-api-${modelName}-weights_manifest.json`);
          if (!shard || !manifest) throw new Error(`Missing model files for ${modelName}`);
          
          const blob1 = await fetch(shard).then(r => r.blob());
          const blob2 = await fetch(manifest).then(r => r.blob());
          
          const url1 = URL.createObjectURL(blob1);
          const url2 = URL.createObjectURL(blob2);
          
          return {
            shard: url1,
            manifest: url2
          };
        };

        // Load models from the cached URLs
        const maxRetries = 3;
        const loadWithRetry = async (loader: any, modelName: string) => {
          try {
            const urls = createModelUrls(modelName);
            await loader.loadFromUri(urls);
          } catch (e) {
            if (retryCount < maxRetries) {
              console.log(`Retrying model load... Attempt ${retryCount + 1}/${maxRetries}`);
              await new Promise(resolve => setTimeout(resolve, 1000));
              return loadModels(retryCount + 1);
            }
            throw e;
          }
        };

        await Promise.all([
          loadWithRetry(faceapi.nets.tinyFaceDetector, 'tiny-face'),
          loadWithRetry(faceapi.nets.faceLandmark68Net, 'landmark-68'),
          loadWithRetry(faceapi.nets.faceExpressionNet, 'expression')
        ]);

        setModelLoaded(true);
        setIsInitializing(false);
      } catch (error) {
        console.error('Error loading face detection models:', error);
        onViolation('model_error', 'Failed to load face detection models');
      }
    };

    // Clear any existing cached models
    localStorage.removeItem('face-api-tiny-face-shard1');
    localStorage.removeItem('face-api-tiny-face-weights_manifest.json');
    localStorage.removeItem('face-api-landmark-68-shard1');
    localStorage.removeItem('face-api-landmark-68-weights_manifest.json');
    localStorage.removeItem('face-api-expression-shard1');
    localStorage.removeItem('face-api-expression-weights_manifest.json');

    loadModels();
  }, [onViolation]);

  // Handle camera activation/deactivation
  useEffect(() => {
    if (isActive && modelLoaded) {
      startCamera();
    } else {
      stopCamera();
    }

    return () => stopCamera();
  }, [isActive, modelLoaded]);

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { 
          width: 640, 
          height: 480,
          facingMode: 'user',
          frameRate: { ideal: 30 }
        }
      });
      
      streamRef.current = mediaStream;
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        await new Promise((resolve) => {
          if (videoRef.current) {
            videoRef.current.onloadedmetadata = resolve;
          }
        });
      }

      startFaceDetection();
    } catch (error) {
      console.error('Error accessing camera:', error);
      onViolation('camera_error', 'Unable to access camera');
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (detectionIntervalRef.current) {
      clearInterval(detectionIntervalRef.current);
    }
    setDetectionState({
      faceDetected: false,
      multipleFaces: false,
      lookingAway: false,
      confidence: 0,
      gazeDirection: null
    });
  };

  const analyzeGazeDirection = useCallback((landmarks: faceapi.FaceLandmarks68) => {
    const leftEye = landmarks.getLeftEye();
    const rightEye = landmarks.getRightEye();
    
    // Calculate the average positions
    const leftEyeCenter = leftEye.reduce((acc, point) => ({ x: acc.x + point.x, y: acc.y + point.y }), { x: 0, y: 0 });
    const rightEyeCenter = rightEye.reduce((acc, point) => ({ x: acc.x + point.x, y: acc.y + point.y }), { x: 0, y: 0 });
    
    leftEyeCenter.x /= leftEye.length;
    leftEyeCenter.y /= leftEye.length;
    rightEyeCenter.x /= rightEye.length;
    rightEyeCenter.y /= rightEye.length;

    // Calculate horizontal gaze ratio based on eye positions
    const leftEyeWidth = Math.abs(leftEye[3].x - leftEye[0].x);
    const rightEyeWidth = Math.abs(rightEye[3].x - rightEye[0].x);
    
    const gazeRatio = (leftEyeWidth / rightEyeWidth);
    
    // Determine gaze direction based on ratio
    if (gazeRatio > 1.15) return 'left';
    if (gazeRatio < 0.85) return 'right';
    return 'center';
  }, []);

  const startFaceDetection = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const detectFaces = async () => {
      if (!videoRef.current || !isActive) return;

      try {
        const detections = await faceapi
          .detectAllFaces(videoRef.current, new faceapi.TinyFaceDetectorOptions())
          .withFaceLandmarks()
          .withFaceExpressions();

        if (detections.length === 0) {
          setDetectionState(prev => {
            if (prev.faceDetected) {
              onViolation('no_face', 'No face detected');
            }
            return {
              ...prev,
              faceDetected: false,
              confidence: 0,
              gazeDirection: null
            };
          });
        } else if (detections.length > 1) {
          onViolation('multiple_faces', 'Multiple faces detected');
          setDetectionState(prev => ({
            ...prev,
            faceDetected: true,
            multipleFaces: true,
            confidence: detections[0].detection.score
          }));
        } else {
          const detection = detections[0];
          const gazeDirection = analyzeGazeDirection(detection.landmarks);
          const lookingAway = gazeDirection !== 'center';
          
          if (lookingAway) {
            onViolation('looking_away', `Looking ${gazeDirection}`);
          }

          setDetectionState({
            faceDetected: true,
            multipleFaces: false,
            lookingAway,
            confidence: detection.detection.score,
            gazeDirection
          });

          // Draw face landmarks and tracking information
          const dims = faceapi.matchDimensions(canvasRef.current, videoRef.current, true);
          const resizedDetections = faceapi.resizeResults(detections, dims);
          
          const ctx = canvasRef.current.getContext('2d');
          if (ctx) {
            ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
            faceapi.draw.drawFaceLandmarks(canvasRef.current, resizedDetections);
            
            // Draw gaze direction indicator
            if (gazeDirection !== 'center') {
              ctx.font = '16px Arial';
              ctx.fillStyle = 'red';
              ctx.fillText(`Looking ${gazeDirection}`, 10, 30);
            }
          }
        }
      } catch (error) {
        console.error('Face detection error:', error);
      }
    };

    detectionIntervalRef.current = window.setInterval(detectFaces, 100) as unknown as number;
  };

  return (
    <Card className="relative overflow-hidden">
      {isInitializing ? (
        <div className="flex items-center justify-center h-[360px] bg-muted/10">
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Loading face detection models...</p>
          </div>
        </div>
      ) : (
        <div className="relative">
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className="w-full max-w-full rounded-lg"
            style={{ transform: 'scaleX(-1)' }}
          />
          <canvas
            ref={canvasRef}
            className="absolute top-0 left-0 w-full h-full pointer-events-none"
            style={{ transform: 'scaleX(-1)' }}
          />
          
          <div className="absolute top-2 left-2 flex flex-col gap-2">
            <Badge 
              variant={detectionState.faceDetected ? "default" : "destructive"}
              className="flex items-center gap-2"
            >
              {detectionState.faceDetected ? (
                <>Face Detected ({Math.round(detectionState.confidence * 100)}%)</>
              ) : (
                <>No Face Detected</>
              )}
            </Badge>
            
            {detectionState.gazeDirection && detectionState.gazeDirection !== 'center' && (
              <Badge variant="warning" className="animate-pulse">
                Looking {detectionState.gazeDirection}
              </Badge>
            )}
            
            {detectionState.multipleFaces && (
              <Alert variant="destructive" className="w-fit">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>Multiple faces detected</AlertDescription>
              </Alert>
            )}
          </div>
          
          <div className="absolute bottom-2 right-2">
            <Badge variant="outline" className="bg-background/50">
              AI Proctoring Active
            </Badge>
          </div>

          {!isActive && (
            <div className="absolute inset-0 bg-muted/80 flex items-center justify-center backdrop-blur-sm">
              <Alert>
                <AlertDescription>
                  Camera monitoring is disabled
                </AlertDescription>
              </Alert>
            </div>
          )}
        </div>
      )}
    </Card>
  );
};

export default ProctorCamera;