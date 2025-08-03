import React, { useRef, useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

interface AudioMonitorProps {
  onViolation: (type: string, description: string) => void;
  isActive: boolean;
}

const AudioMonitor: React.FC<AudioMonitorProps> = ({ onViolation, isActive }) => {
  const [audioLevel, setAudioLevel] = useState(0);
  const [suspiciousAudio, setSuspiciousAudio] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (isActive) {
      startAudioMonitoring();
    } else {
      stopAudioMonitoring();
    }

    return () => stopAudioMonitoring();
  }, [isActive]);

  const startAudioMonitoring = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const audioContext = new AudioContext();
      const analyser = audioContext.createAnalyser();
      const source = audioContext.createMediaStreamSource(stream);
      
      analyser.fftSize = 256;
      source.connect(analyser);
      
      audioContextRef.current = audioContext;
      analyserRef.current = analyser;

      monitorAudio();
    } catch (error) {
      console.error('Error accessing microphone:', error);
      onViolation('audio_error', 'Unable to access microphone');
    }
  };

  const stopAudioMonitoring = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
    }
  };

  const monitorAudio = () => {
    if (!analyserRef.current || !isActive) return;

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(dataArray);

    // Calculate average volume
    const average = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;
    const normalizedLevel = (average / 255) * 100;
    
    setAudioLevel(normalizedLevel);

    // Check for suspicious audio patterns
    if (normalizedLevel > 30) { // Threshold for suspicious activity
      setSuspiciousAudio(true);
      onViolation('suspicious_audio', `High audio activity detected (${normalizedLevel.toFixed(1)}%)`);
    } else {
      setSuspiciousAudio(false);
    }

    // Continue monitoring
    if (isActive) {
      requestAnimationFrame(monitorAudio);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Audio Level</span>
        <Badge variant={suspiciousAudio ? "destructive" : "secondary"}>
          {suspiciousAudio ? 'Suspicious' : 'Normal'}
        </Badge>
      </div>
      
      <Progress 
        value={audioLevel} 
        className="h-2"
      />
      
      <div className="text-xs text-muted-foreground">
        Level: {audioLevel.toFixed(1)}%
      </div>
    </div>
  );
};

export default AudioMonitor;