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
  // Add sign out function using window.location for simplicity
  const handleSignOut = () => {
    window.location.href = '/'; // Or use router if available
  };
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
      <div className="min-h-screen flex flex-col items-center justify-center bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/5 via-purple-50 to-pink-50/80 py-10 px-4 animate-[fadein_0.6s_ease-out]">
        <div className="max-w-2xl w-full mx-auto backdrop-blur-sm">
          <div className="text-center mb-10 relative">
            <div className="absolute inset-0 bg-gradient-to-r from-primary/20 via-purple-300/20 to-pink-300/20 blur-3xl -z-10 rounded-full"></div>
            <h2 className="text-4xl sm:text-6xl font-display font-extrabold bg-gradient-to-br from-primary via-purple-600 to-pink-600 bg-clip-text text-transparent mb-4 drop-shadow-2xl animate-[slidein_0.8s_ease-out] tracking-tight">
              Xhora Secure Examination
            </h2>
            <p className="text-muted-foreground text-lg sm:text-xl font-medium animate-[fadein_0.8s_ease-out_0.2s] opacity-0 [animation-fill-mode:forwards]">Prepare for your AI-monitored assessment</p>
          </div>
          <Card className="hover:scale-[1.02] transition-all duration-500 glass-effect border-primary/20 shadow-2xl backdrop-blur-md bg-white/40">
            <CardHeader className="text-center relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-purple-200/20 to-pink-200/10 animate-pulse"></div>
              <CardTitle className="text-2xl sm:text-3xl font-display relative z-10">Exam Instructions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-8">
              <div className="bg-gradient-to-br from-primary/5 via-purple-50 to-pink-50 p-8 rounded-2xl border border-primary/10 animate-[fadein_0.8s_ease-out_0.4s] opacity-0 [animation-fill-mode:forwards] shadow-inner">
                <p className="font-semibold mb-6 text-xl bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">Please read the following instructions carefully:</p>
                <ul className="space-y-6 text-base">
                  <li className="flex items-start space-x-3">
                    <span className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0 animate-pulse"></span>
                    <span>Your camera and microphone will be monitored throughout the exam</span>
                  </li>
                  <li className="flex items-start space-x-3">
                    <span className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0 animate-pulse"></span>
                    <span>Do not leave the exam window or switch to other applications</span>
                  </li>
                  <li className="flex items-start space-x-3">
                    <span className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0 animate-pulse"></span>
                    <span>Keep your face visible to the camera at all times</span>
                  </li>
                  <li className="flex items-start space-x-3">
                    <span className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0 animate-pulse"></span>
                    <span>Maintain a quiet environment</span>
                  </li>
                  <li className="flex items-start space-x-3">
                    <span className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0 animate-pulse"></span>
                    <span>You have 60 minutes to complete the exam</span>
                  </li>
                </ul>
              </div>
              <Button 
                onClick={startExam} 
                className="w-full text-lg py-6 bg-gradient-to-r from-primary via-purple-500 to-pink-500 text-white font-bold shadow-lg hover:scale-105 transition-all duration-300 animate-fadein delay-200"
                size="lg"
              >
                Begin Secure Examination
              </Button>
            </CardContent>
          </Card>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-10 animate-[fadein_0.8s_ease-out_0.8s] opacity-0 [animation-fill-mode:forwards]">
            <div className="rounded-2xl shadow-xl bg-white/40 backdrop-blur-sm p-6 hover:scale-[1.02] transition-all duration-500 border border-primary/10">
              <div className="relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-purple-50 to-pink-50 animate-pulse"></div>
                <ProctorCamera onViolation={handleViolation} isActive={false} />
              </div>
            </div>
            <div className="rounded-2xl shadow-xl bg-white/40 backdrop-blur-sm p-6 hover:scale-[1.02] transition-all duration-500 border border-primary/10">
              <div className="relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-purple-50 to-pink-50 animate-pulse"></div>
                <AudioMonitor onViolation={handleViolation} isActive={false} />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const currentQuestion = questions[currentQuestionIndex];
  const progress = ((currentQuestionIndex + 1) / questions.length) * 100;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/5 via-purple-50 to-pink-50/80 py-10 px-4 animate-[fadein_0.6s_ease-out]">
      <div className="max-w-6xl w-full mx-auto space-y-10">
        {/* Timer and Progress */}
        <div className="glass-effect p-6 sm:p-8 rounded-2xl border border-primary/20 shadow-2xl backdrop-blur-sm bg-white/40 animate-[slidein_0.8s_ease-out]">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-purple-200/20 to-pink-200/10 animate-pulse rounded-2xl"></div>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 relative z-10">
              <div className="flex flex-wrap items-center gap-4">
              <Badge variant="outline" className="text-base sm:text-lg px-4 py-2 shadow-lg backdrop-blur-sm bg-white/60 border-primary/20">
                Question {currentQuestionIndex + 1} of {questions.length}
              </Badge>
              <Badge 
                variant={violations.length > 0 ? "destructive" : "secondary"} 
                className={`text-base sm:text-lg px-4 py-2 shadow-lg backdrop-blur-sm ${
                  violations.length > 0 
                    ? 'bg-red-50/80 text-red-600 border-red-200'
                    : 'bg-white/60 border-primary/20'
                }`}
              >
                Violations: {violations.length}
              </Badge>
            </div>
            <div className="text-3xl sm:text-4xl font-mono font-bold bg-gradient-to-br from-primary via-purple-600 to-pink-600 bg-clip-text text-transparent [text-shadow:0_4px_8px_rgba(0,0,0,0.1)] animate-pulse">
              {formatTime(timeRemaining)}
              </div>
            </div>
          </div>
          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-primary/20 via-purple-300/20 to-pink-300/20 blur-lg"></div>
              <Progress 
                value={progress} 
                className="h-4 sm:h-5 rounded-full relative z-10 overflow-hidden shadow-lg"
                style={{
                  background: 'linear-gradient(to right, rgba(255,255,255,0.1), rgba(255,255,255,0.2))'
                }}
              />
            </div>
            <p className="text-sm sm:text-base text-muted-foreground mt-3 text-center font-medium">
              {Math.round(progress)}% Complete
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-10 lg:gap-14 animate-fadein delay-200">
          {/* Question */}
          <div className="xl:col-span-2">
            <Card className="glass-effect border-primary/20 shadow-2xl hover:scale-[1.01] transition-transform duration-300">
              <CardHeader>
                <CardTitle className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <span className="text-2xl sm:text-3xl font-display">Question {currentQuestionIndex + 1}</span>
                  <Badge variant="outline" className="text-base px-4 py-2 capitalize">
                    {currentQuestion?.difficulty}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-8 lg:space-y-10">
                <div className="bg-gradient-to-r from-primary/10 via-purple-100 to-pink-100 p-6 rounded-xl border border-primary/10 animate-fadein">
                  <p className="text-xl sm:text-2xl leading-relaxed font-medium">{currentQuestion?.question}</p>
                </div>
                <RadioGroup
                  value={selectedAnswers[currentQuestion?.id] || ''}
                  onValueChange={(value) => handleAnswerChange(currentQuestion?.id, value)}
                  className="space-y-4 sm:space-y-5"
                >
                  {Array.isArray(currentQuestion?.options) && currentQuestion.options.map((option, index) => (
                    <div key={index} className="group">
                      <div className="flex items-start space-x-4 p-4 sm:p-5 rounded-xl border border-border hover:border-primary/50 hover:bg-accent/50 transition-all duration-200 cursor-pointer shadow-md">
                        <RadioGroupItem value={option} id={`option-${index}`} className="mt-1" />
                        <Label 
                          htmlFor={`option-${index}`} 
                          className="flex-1 text-lg sm:text-xl leading-relaxed cursor-pointer"
                        >
                          {option}
                        </Label>
                      </div>
                    </div>
                  ))}
                </RadioGroup>
                <div className="flex flex-col sm:flex-row justify-between gap-6 pt-6 border-t border-border">
                  <Button 
                    variant="outline" 
                    onClick={handlePreviousQuestion}
                    disabled={currentQuestionIndex === 0}
                    className="w-full sm:w-auto px-8 py-4 text-lg font-semibold shadow-md"
                    size="lg"
                  >
                    ← Previous
                  </Button>
                  {currentQuestionIndex === questions.length - 1 ? (
                    <Button 
                      onClick={handleSubmitExam}
                      className="w-full sm:w-auto px-10 py-4 text-lg font-bold bg-gradient-to-r from-primary via-purple-500 to-pink-500 text-white shadow-lg hover:scale-105 transition-all duration-300"
                      size="lg"
                    >
                      Submit Exam
                    </Button>
                  ) : (
                    <Button 
                      onClick={handleNextQuestion}
                      className="w-full sm:w-auto px-8 py-4 text-lg font-semibold shadow-md"
                      size="lg"
                    >
                      Next →
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
          {/* Monitoring Panel */}
          <div className="space-y-8 xl:space-y-10">
            <div className="rounded-xl shadow-lg bg-white/60 p-4">
              <ProctorCamera onViolation={handleViolation} isActive={examStarted} />
            </div>
            <div className="rounded-xl shadow-lg bg-white/60 p-4">
              <AudioMonitor onViolation={handleViolation} isActive={examStarted} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExamInterface;
