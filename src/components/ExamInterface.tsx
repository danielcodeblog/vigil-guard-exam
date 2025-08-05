import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';
import ProctorCamera from './ProctorCamera';
import AudioMonitor from './AudioMonitor';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertCircle, CheckCircle2, Clock, Flag, BookOpen, Brain, Activity } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface Question {
  id: string;
  question: string;
  options: string[];
  correct_answer: string;
  difficulty: 'easy' | 'medium' | 'hard';
  subject: string;
  explanation?: string;
  marks: number;
  category: string;
  timeRecommended?: number;
}

interface ExamInterfaceProps {
  userId: string;
}

const ExamInterface: React.FC<ExamInterfaceProps> = ({ userId }) => {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string>>({});
  const [markedQuestions, setMarkedQuestions] = useState<Set<number>>(new Set());
  const [sessionId, setSessionId] = useState<string>('');
  const [violations, setViolations] = useState<any[]>([]);
  const [examStarted, setExamStarted] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(3600); // 60 minutes
  const [currentTab, setCurrentTab] = useState('question');
  const [questionStatus, setQuestionStatus] = useState<Record<number, 'unattempted' | 'attempted' | 'marked'>>({});
  const [lastActionTime, setLastActionTime] = useState<Date>(new Date());
  const [examStats, setExamStats] = useState({
    totalMarks: 0,
    attemptedQuestions: 0,
    markedForReview: 0,
    averageTimePerQuestion: 0
  });
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

  const updateExamStats = useCallback(() => {
    const attempted = Object.keys(selectedAnswers).length;
    const marked = markedQuestions.size;
    const totalMarks = questions.reduce((sum, q) => sum + q.marks, 0);
    const timeSpent = 3600 - timeRemaining;
    const avgTime = attempted > 0 ? timeSpent / attempted : 0;

    setExamStats({
      totalMarks,
      attemptedQuestions: attempted,
      markedForReview: marked,
      averageTimePerQuestion: Math.round(avgTime)
    });
  }, [selectedAnswers, markedQuestions, questions, timeRemaining]);

  const handleAnswerChange = (questionId: string, answer: string) => {
    setSelectedAnswers(prev => ({
      ...prev,
      [questionId]: answer
    }));
    setQuestionStatus(prev => ({
      ...prev,
      [currentQuestionIndex]: 'attempted'
    }));
    setLastActionTime(new Date());
    updateExamStats();
  };

  const toggleMarkQuestion = () => {
    setMarkedQuestions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(currentQuestionIndex)) {
        newSet.delete(currentQuestionIndex);
      } else {
        newSet.add(currentQuestionIndex);
      }
      return newSet;
    });
    setQuestionStatus(prev => ({
      ...prev,
      [currentQuestionIndex]: markedQuestions.has(currentQuestionIndex) ? 'attempted' : 'marked'
    }));
    updateExamStats();
  };

  const handleNextQuestion = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
      setLastActionTime(new Date());
    }
  };

  const handlePreviousQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(prev => prev - 1);
      setLastActionTime(new Date());
    }
  };

  const jumpToQuestion = (index: number) => {
    setCurrentQuestionIndex(index);
    setLastActionTime(new Date());
  };

  const getQuestionStatus = (index: number) => {
    if (markedQuestions.has(index)) return 'marked';
    if (selectedAnswers[questions[index]?.id]) return 'attempted';
    return 'unattempted';
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
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours > 0 ? hours.toString().padStart(2, '0') + ':' : ''}${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getTimeColor = (timeLeft: number) => {
    if (timeLeft <= 300) return 'text-red-600 animate-pulse'; // 5 minutes or less
    if (timeLeft <= 600) return 'text-orange-500'; // 10 minutes or less
    return 'text-primary';
  };

  const calculateProgress = () => {
    return {
      attempted: (Object.keys(selectedAnswers).length / questions.length) * 100,
      marked: (markedQuestions.size / questions.length) * 100,
      remaining: ((questions.length - Object.keys(selectedAnswers).length - markedQuestions.size) / questions.length) * 100
    };
  };

  useEffect(() => {
    if (examStarted) {
      updateExamStats();
    }
  }, [examStarted, updateExamStats]);

  if (!examStarted) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/5 via-purple-50 to-pink-50/80 py-10 px-4 animate-[fadein_0.6s_ease-out] relative overflow-hidden">
        {/* Animated background elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute w-[500px] h-[500px] -top-48 -right-24 bg-gradient-to-br from-primary/20 via-purple-500/10 to-transparent rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute w-[500px] h-[500px] -bottom-48 -left-24 bg-gradient-to-tr from-pink-500/20 via-primary/10 to-transparent rounded-full blur-3xl animate-pulse delay-1000"></div>
          <div className="absolute inset-0 bg-grid-white/10 bg-[size:20px_20px] opacity-10"></div>
        </div>

        <div className="max-w-6xl w-full mx-auto relative z-10">
          <div className="text-center mb-10">
            <div className="inline-block">
              <h2 className="text-5xl sm:text-7xl font-display font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 via-cyan-500 to-emerald-500 mb-4 animate-[slidein_0.8s_ease-out] tracking-tight drop-shadow-lg relative">
                XhoraProc Secure Examination
                <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500/20 to-emerald-500/20 blur-2xl opacity-50"></div>
              </h2>
            </div>
            <p className="text-muted-foreground text-lg sm:text-xl font-medium animate-[fadein_0.8s_ease-out_0.2s] opacity-0 [animation-fill-mode:forwards]">
              Welcome to your AI-powered assessment experience
            </p>
          </div>

          <div className="grid lg:grid-cols-[2fr,1fr] gap-8">
            {/* Main Instructions Card */}
            <Card className="hover:scale-[1.01] transition-all duration-500 glass-effect border-primary/20 shadow-2xl backdrop-blur-md bg-white/40">
              <CardHeader className="text-center relative overflow-hidden border-b border-primary/10">
                <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-purple-200/10 to-pink-200/5"></div>
                <CardTitle className="text-3xl sm:text-4xl font-display relative z-10 bg-clip-text text-transparent bg-gradient-to-r from-primary to-purple-600">
                  Examination Overview
                </CardTitle>
              </CardHeader>
              <CardContent className="p-8">
                <div className="grid sm:grid-cols-2 gap-6">
                  {/* Time & Marks */}
                  <div className="space-y-6">
                    <div className="bg-white/40 rounded-xl p-4 border border-primary/10 shadow-inner">
                      <h3 className="text-lg font-semibold flex items-center gap-2 mb-3 text-primary">
                        <Clock className="h-5 w-5" />
                        Time & Format
                      </h3>
                      <ul className="space-y-3 text-sm">
                        <li className="flex items-start gap-2">
                          <span className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs">→</span>
                          <span>Duration: 60 minutes</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs">→</span>
                          <span>10 questions of varying difficulty</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs">→</span>
                          <span>Multiple choice format</span>
                        </li>
                      </ul>
                    </div>

                    <div className="bg-white/40 rounded-xl p-4 border border-primary/10 shadow-inner">
                      <h3 className="text-lg font-semibold flex items-center gap-2 mb-3 text-primary">
                        <Brain className="h-5 w-5" />
                        Scoring System
                      </h3>
                      <ul className="space-y-3 text-sm">
                        <li className="flex items-start gap-2">
                          <span className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs">→</span>
                          <span>Easy: 1-2 marks</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs">→</span>
                          <span>Medium: 3-4 marks</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs">→</span>
                          <span>Hard: 5-6 marks</span>
                        </li>
                      </ul>
                    </div>
                  </div>

                  {/* Rules & Features */}
                  <div className="space-y-6">
                    <div className="bg-white/40 rounded-xl p-4 border border-primary/10 shadow-inner">
                      <h3 className="text-lg font-semibold flex items-center gap-2 mb-3 text-primary">
                        <AlertCircle className="h-5 w-5" />
                        Proctoring Rules
                      </h3>
                      <ul className="space-y-3 text-sm">
                        <li className="flex items-start gap-2">
                          <span className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs">→</span>
                          <span>Face must be visible at all times</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs">→</span>
                          <span>No additional persons allowed</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs">→</span>
                          <span>Maintain quiet environment</span>
                        </li>
                      </ul>
                    </div>

                    <div className="bg-white/40 rounded-xl p-4 border border-primary/10 shadow-inner">
                      <h3 className="text-lg font-semibold flex items-center gap-2 mb-3 text-primary">
                        <BookOpen className="h-5 w-5" />
                        Features
                      </h3>
                      <ul className="space-y-3 text-sm">
                        <li className="flex items-start gap-2">
                          <span className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs">→</span>
                          <span>Mark questions for review</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs">→</span>
                          <span>Real-time progress tracking</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs">→</span>
                          <span>AI-powered monitoring</span>
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>

                <Button 
                  onClick={startExam} 
                  className="w-full mt-8 text-lg py-6 relative group overflow-hidden bg-gradient-to-r from-indigo-500 via-cyan-500 to-emerald-500 text-white font-bold shadow-lg hover:scale-[1.02] transition-all duration-300 animate-fadein delay-200"
                  size="lg"
                >
                  <span className="relative z-10">Begin Secure Examination</span>
                  <div className="absolute inset-0 bg-gradient-to-r from-primary/0 via-white/25 to-primary/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
                </Button>
              </CardContent>
            </Card>

            {/* Monitoring Preview */}
            <div className="space-y-6">
              <Card className="glass-effect border-primary/20 shadow-2xl backdrop-blur-md bg-white/40 overflow-hidden">
                <CardHeader className="relative border-b border-primary/10">
                  <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-purple-200/10 to-pink-200/5"></div>
                  <CardTitle className="text-xl relative z-10">Camera Monitoring</CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                  <div className="rounded-lg overflow-hidden">
                    <ProctorCamera onViolation={handleViolation} isActive={false} />
                  </div>
                </CardContent>
              </Card>

              <Card className="glass-effect border-primary/20 shadow-2xl backdrop-blur-md bg-white/40 overflow-hidden">
                <CardHeader className="relative border-b border-primary/10">
                  <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-purple-200/10 to-pink-200/5"></div>
                  <CardTitle className="text-xl relative z-10">Audio Monitoring</CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                  <div className="rounded-lg overflow-hidden">
                    <AudioMonitor onViolation={handleViolation} isActive={false} />
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const currentQuestion = questions[currentQuestionIndex];
  const progress = ((currentQuestionIndex + 1) / questions.length) * 100;

  return (
    <div className="min-h-screen flex flex-col bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/5 via-purple-50 to-pink-50/80 py-6 px-4 animate-[fadein_0.6s_ease-out]">
      <div className="max-w-[1600px] w-full mx-auto space-y-6">
        {/* Top Bar with Timer and Stats */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="glass-effect border-primary/20 shadow-xl backdrop-blur-sm bg-white/40 lg:col-span-2">
            <CardContent className="p-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center space-x-4">
                  <div className={`text-4xl font-mono font-bold ${getTimeColor(timeRemaining)}`}>
                    <Clock className="inline-block mr-2 h-8 w-8" />
                    {formatTime(timeRemaining)}
                  </div>
                  <Separator orientation="vertical" className="h-8" />
                  <div className="flex items-center space-x-2">
                    <Badge variant="outline" className="text-base px-4 py-2">
                      <Brain className="inline-block mr-2 h-4 w-4" />
                      Question {currentQuestionIndex + 1}/{questions.length}
                    </Badge>
                    <Badge variant="secondary" className="text-base px-4 py-2">
                      <Activity className="inline-block mr-2 h-4 w-4" />
                      {currentQuestion?.marks} marks
                    </Badge>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  {violations.length > 0 && (
                    <Alert variant="destructive" className="bg-red-50/90 border-red-200">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        {violations.length} violation{violations.length > 1 ? 's' : ''} detected
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Exam Progress Card */}
          <Card className="glass-effect border-primary/20 shadow-xl backdrop-blur-sm bg-white/40">
            <CardContent className="p-6">
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Progress</p>
                    <div className="text-2xl font-semibold">
                      {Math.round((Object.keys(selectedAnswers).length / questions.length) * 100)}%
                    </div>
                  </div>
                  <div className="space-y-1 text-right">
                    <p className="text-sm text-muted-foreground">Total Marks</p>
                    <div className="text-2xl font-semibold">{examStats.totalMarks}</div>
                  </div>
                </div>
                <div className="relative pt-2">
                  <div className="flex mb-2 items-center justify-between gap-2">
                    <div className="text-xs text-muted-foreground">
                      Attempted: {examStats.attemptedQuestions}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Marked: {examStats.markedForReview}
                    </div>
                  </div>
                  <Progress value={calculateProgress().attempted} className="h-2 mb-1" />
                  <Progress value={calculateProgress().marked} className="h-2 mb-1 bg-yellow-200" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Question Panel */}
          <div className="lg:col-span-8 space-y-6">
            <Tabs value={currentTab} onValueChange={setCurrentTab} className="w-full">
              <TabsList className="w-full">
                <TabsTrigger value="question" className="flex-1">
                  <BookOpen className="w-4 h-4 mr-2" />
                  Question
                </TabsTrigger>
                <TabsTrigger value="instructions" className="flex-1">
                  <Brain className="w-4 h-4 mr-2" />
                  Instructions
                </TabsTrigger>
              </TabsList>
              <TabsContent value="question">
                <Card className="glass-effect border-primary/20 shadow-xl">
                  <CardHeader className="space-y-4">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-2xl font-display">Question {currentQuestionIndex + 1}</CardTitle>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="capitalize">
                          {currentQuestion?.difficulty}
                        </Badge>
                        <Badge variant="outline">
                          {currentQuestion?.category}
                        </Badge>
                      </div>
                    </div>
                    <CardDescription className="text-base">
                      Subject: {currentQuestion?.subject} • Recommended Time: {currentQuestion?.timeRecommended || 'Not specified'}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="bg-gradient-to-r from-primary/10 via-purple-100 to-pink-100 p-6 rounded-xl border border-primary/10">
                      <p className="text-xl leading-relaxed">{currentQuestion?.question}</p>
                    </div>
                    <RadioGroup
                      value={selectedAnswers[currentQuestion?.id] || ''}
                      onValueChange={(value) => handleAnswerChange(currentQuestion?.id, value)}
                      className="space-y-4"
                    >
                      {currentQuestion?.options.map((option, index) => (
                        <div key={index} className="group">
                          <div className="flex items-start space-x-4 p-4 rounded-xl border border-border hover:border-primary/50 hover:bg-accent/50 transition-all duration-200 cursor-pointer shadow-sm">
                            <RadioGroupItem value={option} id={`option-${index}`} className="mt-1" />
                            <Label 
                              htmlFor={`option-${index}`} 
                              className="flex-1 text-lg leading-relaxed cursor-pointer"
                            >
                              {option}
                            </Label>
                          </div>
                        </div>
                      ))}
                    </RadioGroup>
                  </CardContent>
                  <Separator />
                  <CardContent className="p-6">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <Button 
                          variant="outline" 
                          onClick={handlePreviousQuestion}
                          disabled={currentQuestionIndex === 0}
                        >
                          ← Previous
                        </Button>
                        <Button 
                          variant="secondary"
                          onClick={toggleMarkQuestion}
                          className={markedQuestions.has(currentQuestionIndex) ? 'bg-yellow-100 hover:bg-yellow-200' : ''}
                        >
                          <Flag className="w-4 h-4 mr-2" />
                          {markedQuestions.has(currentQuestionIndex) ? 'Unmark' : 'Mark'} for Review
                        </Button>
                      </div>
                      {currentQuestionIndex === questions.length - 1 ? (
                        <Button 
                          onClick={handleSubmitExam}
                          className="bg-gradient-to-r from-primary via-purple-500 to-pink-500 text-white"
                        >
                          <CheckCircle2 className="w-4 h-4 mr-2" />
                          Submit Exam
                        </Button>
                      ) : (
                        <Button onClick={handleNextQuestion}>
                          Next →
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
              <TabsContent value="instructions">
                <Card className="glass-effect border-primary/20 shadow-xl">
                  <CardContent className="p-6">
                    <div className="prose prose-lg">
                      <h3 className="text-xl font-semibold mb-4">Question Guidelines</h3>
                      <ul className="space-y-2">
                        <li>Read each question carefully before answering</li>
                        <li>Use the "Mark for Review" feature for questions you want to revisit</li>
                        <li>Recommended time per question is shown with each question</li>
                        <li>Questions marked with a flag can be easily found in the navigation panel</li>
                      </ul>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>

          {/* Side Panel */}
          <div className="lg:col-span-4 space-y-6">
            {/* Question Navigation */}
            <Card className="glass-effect border-primary/20 shadow-xl">
              <CardHeader>
                <CardTitle className="text-xl">Question Navigator</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[300px] pr-4">
                  <div className="grid grid-cols-5 gap-2">
                    {questions.map((_, index) => {
                      const status = getQuestionStatus(index);
                      return (
                        <Button
                          key={index}
                          variant={status === 'marked' ? 'secondary' : status === 'attempted' ? 'default' : 'outline'}
                          className={`
                            aspect-square p-0 text-base font-semibold
                            ${status === 'marked' ? 'bg-yellow-100 hover:bg-yellow-200' : ''}
                            ${status === 'attempted' ? 'bg-primary/20' : ''}
                            ${currentQuestionIndex === index ? 'ring-2 ring-primary' : ''}
                          `}
                          onClick={() => jumpToQuestion(index)}
                        >
                          {index + 1}
                        </Button>
                      );
                    })}
                  </div>
                </ScrollArea>
                <div className="mt-4 space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>Attempted</span>
                    <Badge variant="outline">{Object.keys(selectedAnswers).length}</Badge>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span>Marked for Review</span>
                    <Badge variant="secondary">{markedQuestions.size}</Badge>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span>Not Attempted</span>
                    <Badge variant="outline">
                      {questions.length - Object.keys(selectedAnswers).length}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Monitoring Panel */}
            <Card className="glass-effect border-primary/20 shadow-xl">
              <CardHeader>
                <CardTitle className="text-xl">Proctoring Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-lg overflow-hidden bg-black/5">
                  <ProctorCamera onViolation={handleViolation} isActive={examStarted} />
                </div>
                <div className="rounded-lg overflow-hidden bg-black/5">
                  <AudioMonitor onViolation={handleViolation} isActive={examStarted} />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExamInterface;
