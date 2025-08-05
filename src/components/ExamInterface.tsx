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
      <div className="min-h-screen flex flex-col items-center justify-center bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/5 via-purple-50 to-pink-50/80 py-10 px-4 animate-[fadein_0.6s_ease-out]">
        <div className="max-w-4xl w-full mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-4xl sm:text-6xl font-display font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-primary via-purple-600 to-pink-600 mb-4 animate-[slidein_0.8s_ease-out] tracking-tight drop-shadow-lg">
              XhoraProc Secure Examination
            </h2>
            <p className="text-muted-foreground text-lg sm:text-xl font-medium animate-[fadein_0.8s_ease-out_0.2s] opacity-0 [animation-fill-mode:forwards]">
              Welcome to your AI-monitored assessment experience
            </p>
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
                  <CardContent className="p-8">
                    <div className="space-y-8">
                      {/* Exam Rules */}
                      <section className="space-y-4">
                        <h3 className="text-2xl font-display font-semibold text-primary">Examination Rules</h3>
                        <div className="grid gap-4 sm:grid-cols-2">
                          <div className="bg-white/40 p-4 rounded-lg border border-primary/10">
                            <h4 className="font-semibold mb-2 flex items-center gap-2">
                              <Clock className="h-5 w-5 text-primary" />
                              Time Management
                            </h4>
                            <ul className="space-y-2 text-sm">
                              <li>Total duration: 60 minutes</li>
                              <li>Timer cannot be paused once started</li>
                              <li>Auto-submission when time expires</li>
                              <li>Pay attention to recommended time per question</li>
                            </ul>
                          </div>
                          <div className="bg-white/40 p-4 rounded-lg border border-primary/10">
                            <h4 className="font-semibold mb-2 flex items-center gap-2">
                              <AlertCircle className="h-5 w-5 text-primary" />
                              Proctoring Guidelines
                            </h4>
                            <ul className="space-y-2 text-sm">
                              <li>Maintain clear face visibility</li>
                              <li>No additional persons allowed</li>
                              <li>Avoid looking away from screen</li>
                              <li>Maintain a quiet environment</li>
                            </ul>
                          </div>
                        </div>
                      </section>

                      {/* Navigation Tips */}
                      <section className="space-y-4">
                        <h3 className="text-2xl font-display font-semibold text-primary">Navigation & Features</h3>
                        <div className="grid gap-4 sm:grid-cols-2">
                          <div className="bg-white/40 p-4 rounded-lg border border-primary/10">
                            <h4 className="font-semibold mb-2 flex items-center gap-2">
                              <BookOpen className="h-5 w-5 text-primary" />
                              Question Navigation
                            </h4>
                            <ul className="space-y-2 text-sm">
                              <li>Use Previous/Next buttons to move between questions</li>
                              <li>Question navigator shows all questions at a glance</li>
                              <li>Click question numbers to jump directly</li>
                              <li>Color coding indicates question status</li>
                            </ul>
                          </div>
                          <div className="bg-white/40 p-4 rounded-lg border border-primary/10">
                            <h4 className="font-semibold mb-2 flex items-center gap-2">
                              <Flag className="h-5 w-5 text-primary" />
                              Review System
                            </h4>
                            <ul className="space-y-2 text-sm">
                              <li>"Mark for Review" to flag difficult questions</li>
                              <li>Track attempted vs unattempted questions</li>
                              <li>Review marked questions before submission</li>
                              <li>Progress tracker shows completion status</li>
                            </ul>
                          </div>
                        </div>
                      </section>

                      {/* Important Instructions */}
                      <section className="space-y-4">
                        <h3 className="text-2xl font-display font-semibold text-primary">Important Instructions</h3>
                        <div className="bg-white/40 p-6 rounded-lg border border-primary/10">
                          <ul className="space-y-4 text-sm">
                            <li className="flex items-start gap-3">
                              <span className="flex-shrink-0 h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold">1</span>
                              <span>Read each question and all options carefully before selecting your answer. Once submitted, answers cannot be changed.</span>
                            </li>
                            <li className="flex items-start gap-3">
                              <span className="flex-shrink-0 h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold">2</span>
                              <span>Each question has a different mark value. Focus on higher mark questions to maximize your score.</span>
                            </li>
                            <li className="flex items-start gap-3">
                              <span className="flex-shrink-0 h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold">3</span>
                              <span>Any violation of proctoring rules (multiple faces, looking away, etc.) will be recorded and may affect your results.</span>
                            </li>
                            <li className="flex items-start gap-3">
                              <span className="flex-shrink-0 h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold">4</span>
                              <span>In case of technical issues, your progress is automatically saved. Contact support if you need assistance.</span>
                            </li>
                          </ul>
                        </div>
                      </section>

                      {/* Additional Information */}
                      <section className="bg-primary/5 p-6 rounded-lg border border-primary/10">
                        <h4 className="font-semibold mb-3 text-primary">Scoring Information</h4>
                        <div className="grid gap-4 sm:grid-cols-3 text-sm">
                          <div>
                            <p className="font-medium">Easy Questions</p>
                            <p className="text-muted-foreground">1-2 marks each</p>
                          </div>
                          <div>
                            <p className="font-medium">Medium Questions</p>
                            <p className="text-muted-foreground">3-4 marks each</p>
                          </div>
                          <div>
                            <p className="font-medium">Hard Questions</p>
                            <p className="text-muted-foreground">5-6 marks each</p>
                          </div>
                        </div>
                      </section>
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
