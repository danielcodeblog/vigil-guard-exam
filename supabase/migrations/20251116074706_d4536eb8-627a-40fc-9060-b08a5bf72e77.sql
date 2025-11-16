-- Create exam_questions table
CREATE TABLE IF NOT EXISTS public.exam_questions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  question TEXT NOT NULL,
  options JSONB NOT NULL,
  correct_answer TEXT NOT NULL,
  difficulty TEXT NOT NULL,
  subject TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create exam_sessions table
CREATE TABLE IF NOT EXISTS public.exam_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  violations JSONB DEFAULT '[]'::jsonb,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  ended_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.exam_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_sessions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for exam_questions
-- Anyone can view questions (they're exam content)
CREATE POLICY "Anyone can view exam questions"
ON public.exam_questions
FOR SELECT
USING (true);

-- Only authenticated users can view their own exam sessions
CREATE POLICY "Users can view their own exam sessions"
ON public.exam_sessions
FOR SELECT
USING (auth.uid() = user_id);

-- Only authenticated users can create their own exam sessions
CREATE POLICY "Users can create their own exam sessions"
ON public.exam_sessions
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Only authenticated users can update their own exam sessions
CREATE POLICY "Users can update their own exam sessions"
ON public.exam_sessions
FOR UPDATE
USING (auth.uid() = user_id);

-- Create index for better query performance
CREATE INDEX idx_exam_sessions_user_id ON public.exam_sessions(user_id);
CREATE INDEX idx_exam_sessions_status ON public.exam_sessions(status);