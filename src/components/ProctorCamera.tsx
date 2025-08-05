import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import * as faceapi from 'face-api.js';
import { Loader2, AlertCircle } from 'lucide-react';
import { Card } from '@/components/ui/card';

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

  // Load face detection models
  useEffect(() => {
    const loadModels = async () => {
      try {
        setIsInitializing(true);
        await faceapi.nets.tinyFaceDetector.loadFromUri('/models');
        await faceapi.nets.faceLandmark68Net.loadFromUri('/models');
        await faceapi.nets.faceExpressionNet.loadFromUri('/models');
        setModelLoaded(true);
        setIsInitializing(false);
      } catch (error) {
        console.error('Error loading face detection models:', error);
        onViolation('model_error', 'Failed to load face detection models');
      }
    };

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
        </div>
      )}
    </Card>

      {!isActive && (
        <div className="absolute inset-0 bg-muted/80 flex items-center justify-center rounded-lg">
          <Alert>
            <AlertDescription>
              Camera monitoring is disabled
            </AlertDescription>
          </Alert>
        </div>
      )}
    </div>
  );
};

export default ProctorCamera;