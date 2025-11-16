import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Pencil, Trash2, Plus, ArrowLeft } from 'lucide-react';

interface Question {
  id: string;
  question: string;
  options: string[];
  correct_answer: string;
  difficulty: string;
  subject: string;
}

const Admin = () => {
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: roleLoading } = useUserRole();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [questions, setQuestions] = useState<Question[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    question: '',
    option1: '',
    option2: '',
    option3: '',
    option4: '',
    correct_answer: '',
    difficulty: 'easy',
    subject: 'Mathematics'
  });

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!roleLoading && !isAdmin) {
      navigate('/');
      toast({
        title: "Access Denied",
        description: "You don't have permission to access the admin panel.",
        variant: "destructive"
      });
    }
  }, [isAdmin, roleLoading, navigate, toast]);

  useEffect(() => {
    if (isAdmin) {
      loadQuestions();
    }
  }, [isAdmin]);

  const loadQuestions = async () => {
    try {
      const { data, error } = await supabase
        .from('exam_questions')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      const parsedQuestions = (data || []).map(q => ({
        ...q,
        options: typeof q.options === 'string' ? JSON.parse(q.options) : q.options
      }));
      
      setQuestions(parsedQuestions);
    } catch (error) {
      console.error('Error loading questions:', error);
      toast({
        title: "Error",
        description: "Failed to load questions",
        variant: "destructive"
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const options = [formData.option1, formData.option2, formData.option3, formData.option4];
    
    try {
      if (editingId) {
        const { error } = await supabase
          .from('exam_questions')
          .update({
            question: formData.question,
            options: JSON.stringify(options),
            correct_answer: formData.correct_answer,
            difficulty: formData.difficulty,
            subject: formData.subject
          })
          .eq('id', editingId);

        if (error) throw error;
        toast({ title: "Success", description: "Question updated successfully" });
      } else {
        const { error } = await supabase
          .from('exam_questions')
          .insert({
            question: formData.question,
            options: JSON.stringify(options),
            correct_answer: formData.correct_answer,
            difficulty: formData.difficulty,
            subject: formData.subject
          });

        if (error) throw error;
        toast({ title: "Success", description: "Question added successfully" });
      }
      
      resetForm();
      loadQuestions();
    } catch (error) {
      console.error('Error saving question:', error);
      toast({
        title: "Error",
        description: "Failed to save question",
        variant: "destructive"
      });
    }
  };

  const handleEdit = (question: Question) => {
    setEditingId(question.id);
    setFormData({
      question: question.question,
      option1: question.options[0] || '',
      option2: question.options[1] || '',
      option3: question.options[2] || '',
      option4: question.options[3] || '',
      correct_answer: question.correct_answer,
      difficulty: question.difficulty,
      subject: question.subject
    });
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this question?')) return;
    
    try {
      const { error } = await supabase
        .from('exam_questions')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast({ title: "Success", description: "Question deleted successfully" });
      loadQuestions();
    } catch (error) {
      console.error('Error deleting question:', error);
      toast({
        title: "Error",
        description: "Failed to delete question",
        variant: "destructive"
      });
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setFormData({
      question: '',
      option1: '',
      option2: '',
      option3: '',
      option4: '',
      correct_answer: '',
      difficulty: 'easy',
      subject: 'Mathematics'
    });
  };

  if (authLoading || roleLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-900 via-blue-800 to-cyan-600">
        <div className="text-white text-xl font-bold">Loading...</div>
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-800 to-cyan-600">
      <header className="glass-effect border-b border-primary/20 backdrop-blur-lg sticky top-0 z-50">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Button variant="ghost" onClick={() => navigate('/')} className="text-white">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
              <h1 className="text-2xl sm:text-3xl font-display font-bold text-white">
                Admin Panel
              </h1>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Form Section */}
          <Card className="glass-effect border-primary/20">
            <CardHeader>
              <CardTitle className="text-white">
                {editingId ? 'Edit Question' : 'Add New Question'}
              </CardTitle>
              <CardDescription className="text-white/80">
                {editingId ? 'Update the exam question' : 'Create a new exam question'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="question" className="text-white">Question</Label>
                  <Textarea
                    id="question"
                    value={formData.question}
                    onChange={(e) => setFormData({ ...formData, question: e.target.value })}
                    required
                    className="bg-white/10 border-white/20 text-white"
                  />
                </div>

                {[1, 2, 3, 4].map((num) => (
                  <div key={num}>
                    <Label htmlFor={`option${num}`} className="text-white">Option {num}</Label>
                    <Input
                      id={`option${num}`}
                      value={formData[`option${num}` as keyof typeof formData]}
                      onChange={(e) => setFormData({ ...formData, [`option${num}`]: e.target.value })}
                      required
                      className="bg-white/10 border-white/20 text-white"
                    />
                  </div>
                ))}

                <div>
                  <Label htmlFor="correct_answer" className="text-white">Correct Answer</Label>
                  <Input
                    id="correct_answer"
                    value={formData.correct_answer}
                    onChange={(e) => setFormData({ ...formData, correct_answer: e.target.value })}
                    required
                    className="bg-white/10 border-white/20 text-white"
                  />
                </div>

                <div>
                  <Label htmlFor="difficulty" className="text-white">Difficulty</Label>
                  <Select value={formData.difficulty} onValueChange={(value) => setFormData({ ...formData, difficulty: value })}>
                    <SelectTrigger className="bg-white/10 border-white/20 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="easy">Easy</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="hard">Hard</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="subject" className="text-white">Subject</Label>
                  <Input
                    id="subject"
                    value={formData.subject}
                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                    required
                    className="bg-white/10 border-white/20 text-white"
                  />
                </div>

                <div className="flex gap-2">
                  <Button type="submit" className="flex-1">
                    {editingId ? 'Update' : 'Add'} Question
                  </Button>
                  {editingId && (
                    <Button type="button" variant="outline" onClick={resetForm}>
                      Cancel
                    </Button>
                  )}
                </div>
              </form>
            </CardContent>
          </Card>

          {/* Questions List */}
          <div className="space-y-4">
            <Card className="glass-effect border-primary/20">
              <CardHeader>
                <CardTitle className="text-white">Exam Questions ({questions.length})</CardTitle>
              </CardHeader>
              <CardContent className="max-h-[calc(100vh-200px)] overflow-y-auto space-y-3">
                {questions.map((q) => (
                  <Card key={q.id} className="bg-white/10 border-white/20">
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start gap-2">
                        <div className="flex-1">
                          <p className="text-white font-medium mb-2">{q.question}</p>
                          <div className="text-sm text-white/70 space-y-1">
                            <p>Subject: {q.subject}</p>
                            <p>Difficulty: {q.difficulty}</p>
                            <p>Answer: {q.correct_answer}</p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" variant="ghost" onClick={() => handleEdit(q)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => handleDelete(q.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Admin;
