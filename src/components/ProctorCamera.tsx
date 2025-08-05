import React, { useRef, useEffect, useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';

interface ProctorCameraProps {
  onViolation: (type: string, description: string) => void;
  isActive: boolean;
}

const ProctorCamera: React.FC<ProctorCameraProps> = ({ onViolation, isActive }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [faceDetected, setFaceDetected] = useState(false);
  const [lastFaceCheck, setLastFaceCheck] = useState(Date.now());

  useEffect(() => {
    if (isActive) {
      startCamera();
    } else {
      stopCamera();
    }

    return () => stopCamera();
  }, [isActive]);

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { 
          width: 640, 
          height: 480,
          facingMode: 'user'
        }
      });
      
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }

      // Start face detection monitoring
      startFaceDetection();
    } catch (error) {
      console.error('Error accessing camera:', error);
      onViolation('camera_error', 'Unable to access camera');
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  };

  const startFaceDetection = () => {
    const checkFace = () => {
      if (!isActive || !videoRef.current) return;

      // Simple presence detection - in a real app you'd use ML models
      const now = Date.now();
      const timeSinceLastCheck = now - lastFaceCheck;
      
      // Simulate face detection (replace with actual ML model)
      const simulatedFacePresent = Math.random() > 0.1; // 90% chance face is present
      
      if (!simulatedFacePresent && timeSinceLastCheck > 5000) {
        onViolation('no_face', 'No face detected for extended period');
        setFaceDetected(false);
      } else if (simulatedFacePresent) {
        setFaceDetected(true);
        setLastFaceCheck(now);
      }

      // Check again in 2 seconds
      if (isActive) {
        setTimeout(checkFace, 2000);
      }
    };

    checkFace();
  };

  return (
    <div className="relative">
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        className="w-full max-w-sm rounded-lg border border-border"
        style={{ transform: 'scaleX(-1)' }} // Mirror the video
      />
      
      <div className="absolute top-2 left-2">
        <Badge variant={faceDetected ? "default" : "destructive"}>
          {faceDetected ? 'Face Detected' : 'No Face'}
        </Badge>
      </div>

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