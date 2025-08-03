import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';
import ProctorCamera from './ProctorCamera';
import AudioMonitor from './AudioMonitor';

interface Question {
  id: string;
  question: string;
  options: any; // JSON field from database
  correct_answer: string;
  difficulty: string;
  subject: string;
}

interface ExamInterfaceProps {
  userId: string;
}

const ExamInterface: React.FC<ExamInterfaceProps> = ({ userId }) => {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string>>({});
  const [sessionId, setSessionId] = useState<string>('');
  const [violations, setViolations] = useState<any[]>([]);
  const [examStarted, setExamStarted] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(3600); // 60 minutes
  const { toast } = useToast();

  useEffect(() => {
    loadQuestions();
  }, []);

  useEffect(() => {
    if (examStarted && timeRemaining > 0) {
      const timer = setInterval(() => {
        setTimeRemaining(prev => {
          if (prev <= 1) {
            handleSubmitExam();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [examStarted, timeRemaining]);

  const loadQuestions = async () => {
    const { data, error } = await supabase
      .from('exam_questions')
      .select('*')
      .limit(10);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to load questions",
        variant: "destructive"
      });
    } else {
      setQuestions(data || []);
    }
  };

  const startExam = async () => {
    const { data, error } = await supabase
      .from('exam_sessions')
      .insert({
        user_id: userId,
        status: 'active',
        violations: []
      })
      .select()
      .single();

    if (error) {
      toast({
        title: "Error",
        description: "Failed to start exam session",
        variant: "destructive"
      });
    } else {
      setSessionId(data.id);
      setExamStarted(true);
      toast({
        title: "Exam Started",
        description: "Your session is being monitored"
      });
    }
  };

  const handleViolation = async (type: string, description: string) => {
    const violation = {
      type,
      description,
      timestamp: new Date().toISOString()
    };

    const updatedViolations = [...violations, violation];
    setViolations(updatedViolations);

    // Update session with violation
    await supabase
      .from('exam_sessions')
      .update({ violations: updatedViolations })
      .eq('id', sessionId);

    toast({
      title: "Violation Detected",
      description: description,
      variant: "destructive"
    });
  };

  const handleAnswerChange = (questionId: string, answer: string) => {
    setSelectedAnswers(prev => ({
      ...prev,
      [questionId]: answer
    }));
  };

  const handleNextQuestion = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
    }
  };

  const handlePreviousQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(prev => prev - 1);
    }
  };

  const handleSubmitExam = async () => {
    await supabase
      .from('exam_sessions')
      .update({ 
        status: 'completed',
        ended_at: new Date().toISOString()
      })
      .eq('id', sessionId);

    setExamStarted(false);
    toast({
      title: "Exam Submitted",
      description: "Your exam has been submitted successfully"
    });
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (!examStarted) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Exam Instructions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p>Please read the following instructions carefully:</p>
            <ul className="list-disc list-inside space-y-2 text-sm">
              <li>Your camera and microphone will be monitored throughout the exam</li>
              <li>Do not leave the exam window or switch to other applications</li>
              <li>Keep your face visible to the camera at all times</li>
              <li>Maintain a quiet environment</li>
              <li>You have 60 minutes to complete the exam</li>
            </ul>
            <Button onClick={startExam} className="w-full">
              Start Exam
            </Button>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <ProctorCamera onViolation={handleViolation} isActive={false} />
          <AudioMonitor onViolation={handleViolation} isActive={false} />
        </div>
      </div>
    );
  }

  const currentQuestion = questions[currentQuestionIndex];
  const progress = ((currentQuestionIndex + 1) / questions.length) * 100;

  return (
    <div className="space-y-6">
      {/* Timer and Progress */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Badge variant="outline">
            Question {currentQuestionIndex + 1} of {questions.length}
          </Badge>
          <Badge variant={violations.length > 0 ? "destructive" : "secondary"}>
            Violations: {violations.length}
          </Badge>
        </div>
        <div className="text-lg font-mono">
          {formatTime(timeRemaining)}
        </div>
      </div>

      <Progress value={progress} className="h-2" />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Question */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Question {currentQuestionIndex + 1}</span>
                <Badge variant="outline">{currentQuestion?.difficulty}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <p className="text-lg">{currentQuestion?.question}</p>

              <RadioGroup
                value={selectedAnswers[currentQuestion?.id] || ''}
                onValueChange={(value) => handleAnswerChange(currentQuestion?.id, value)}
              >
                {Array.isArray(currentQuestion?.options) && currentQuestion.options.map((option, index) => (
                  <div key={index} className="flex items-center space-x-2">
                    <RadioGroupItem value={option} id={`option-${index}`} />
                    <Label htmlFor={`option-${index}`} className="flex-1">
                      {option}
                    </Label>
                  </div>
                ))}
              </RadioGroup>

              <div className="flex justify-between">
                <Button 
                  variant="outline" 
                  onClick={handlePreviousQuestion}
                  disabled={currentQuestionIndex === 0}
                >
                  Previous
                </Button>
                
                {currentQuestionIndex === questions.length - 1 ? (
                  <Button onClick={handleSubmitExam}>
                    Submit Exam
                  </Button>
                ) : (
                  <Button onClick={handleNextQuestion}>
                    Next
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Monitoring Panel */}
        <div className="space-y-4">
          <ProctorCamera onViolation={handleViolation} isActive={examStarted} />
          <AudioMonitor onViolation={handleViolation} isActive={examStarted} />
        </div>
      </div>
    </div>
  );
};

export default ExamInterface;