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
      <div className="space-y-6 lg:space-y-8">
        <div className="text-center mb-8">
          <h2 className="text-3xl sm:text-4xl font-display font-bold gradient-primary bg-clip-text text-transparent mb-2">
            Xhora Secure Examination Environment
          </h2>
          <p className="text-muted-foreground text-lg">Prepare for your AI-monitored assessment</p>
        </div>
           <Button
             onClick={handleSignOut}
             className="mt-6 bg-cyan-600 text-white font-bold px-6 py-3 rounded shadow hover:bg-cyan-700 border-none transition-all duration-200"
             size="lg"
           >
             Sign Out
           </Button>
        
        <Card className="hover-lift glass-effect border-primary/20 shadow-xl">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl sm:text-3xl font-display">Exam Instructions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="gradient-secondary p-6 rounded-lg border border-primary/10">
              <p className="font-medium mb-4 text-lg">Please read the following instructions carefully:</p>
              <ul className="space-y-3 text-sm sm:text-base">
                <li className="flex items-start space-x-3">
                  <span className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0"></span>
                  <span>Your camera and microphone will be monitored throughout the exam</span>
                </li>
                <li className="flex items-start space-x-3">
                  <span className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0"></span>
                  <span>Do not leave the exam window or switch to other applications</span>
                </li>
                <li className="flex items-start space-x-3">
                  <span className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0"></span>
                  <span>Keep your face visible to the camera at all times</span>
                </li>
                <li className="flex items-start space-x-3">
                  <span className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0"></span>
                  <span>Maintain a quiet environment</span>
                </li>
                <li className="flex items-start space-x-3">
                  <span className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0"></span>
                  <span>You have 60 minutes to complete the exam</span>
                </li>
              </ul>
            </div>
            
            <Button 
              onClick={startExam} 
              className="w-full text-lg py-6 gradient-primary hover:opacity-90 transition-all duration-300"
              size="lg"
            >
              Begin Secure Examination
            </Button>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
          <ProctorCamera onViolation={handleViolation} isActive={false} />
          <AudioMonitor onViolation={handleViolation} isActive={false} />
        </div>
      </div>
    );
  }

  const currentQuestion = questions[currentQuestionIndex];
  const progress = ((currentQuestionIndex + 1) / questions.length) * 100;

  return (
    <div className="space-y-6 lg:space-y-8">
      {/* Timer and Progress */}
      <div className="glass-effect p-4 sm:p-6 rounded-lg border border-primary/20">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2 sm:gap-4">
            <Badge variant="outline" className="text-sm sm:text-base px-3 py-1">
              Question {currentQuestionIndex + 1} of {questions.length}
            </Badge>
            <Badge variant={violations.length > 0 ? "destructive" : "secondary"} className="text-sm sm:text-base px-3 py-1">
              Violations: {violations.length}
            </Badge>
          </div>
          <div className="text-2xl sm:text-3xl font-mono font-bold gradient-primary bg-clip-text text-transparent">
            {formatTime(timeRemaining)}
          </div>
        </div>
        
        <div className="mt-4">
          <Progress value={progress} className="h-3 sm:h-4" />
          <p className="text-xs sm:text-sm text-muted-foreground mt-2 text-center">
            {Math.round(progress)}% Complete
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 lg:gap-8">
        {/* Question */}
        <div className="xl:col-span-2">
          <Card className="glass-effect border-primary/20 shadow-xl">
            <CardHeader>
              <CardTitle className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                <span className="text-xl sm:text-2xl font-display">Question {currentQuestionIndex + 1}</span>
                <Badge variant="outline" className="text-sm px-3 py-1 capitalize">
                  {currentQuestion?.difficulty}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 lg:space-y-8">
              <div className="gradient-secondary p-4 sm:p-6 rounded-lg border border-primary/10">
                <p className="text-lg sm:text-xl leading-relaxed">{currentQuestion?.question}</p>
              </div>

              <RadioGroup
                value={selectedAnswers[currentQuestion?.id] || ''}
                onValueChange={(value) => handleAnswerChange(currentQuestion?.id, value)}
                className="space-y-3 sm:space-y-4"
              >
                {Array.isArray(currentQuestion?.options) && currentQuestion.options.map((option, index) => (
                  <div key={index} className="group">
                    <div className="flex items-start space-x-3 p-3 sm:p-4 rounded-lg border border-border hover:border-primary/50 hover:bg-accent/50 transition-all duration-200 cursor-pointer">
                      <RadioGroupItem value={option} id={`option-${index}`} className="mt-1" />
                      <Label 
                        htmlFor={`option-${index}`} 
                        className="flex-1 text-base sm:text-lg leading-relaxed cursor-pointer"
                      >
                        {option}
                      </Label>
                    </div>
                  </div>
                ))}
              </RadioGroup>

              <div className="flex flex-col sm:flex-row justify-between gap-4 pt-4 border-t border-border">
                <Button 
                  variant="outline" 
                  onClick={handlePreviousQuestion}
                  disabled={currentQuestionIndex === 0}
                  className="w-full sm:w-auto px-6 py-3 text-base"
                  size="lg"
                >
                  ← Previous
                </Button>
                
                {currentQuestionIndex === questions.length - 1 ? (
                  <Button 
                    onClick={handleSubmitExam}
                    className="w-full sm:w-auto px-8 py-3 text-base gradient-primary hover:opacity-90"
                    size="lg"
                  >
                    Submit Exam
                  </Button>
                ) : (
                  <Button 
                    onClick={handleNextQuestion}
                    className="w-full sm:w-auto px-6 py-3 text-base"
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
        <div className="space-y-6 xl:space-y-8">
          <ProctorCamera onViolation={handleViolation} isActive={examStarted} />
          <AudioMonitor onViolation={handleViolation} isActive={examStarted} />
        </div>
      </div>
    </div>
  );
};

export default ExamInterface;
