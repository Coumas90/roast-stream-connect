-- Create training_feedback table
CREATE TABLE public.training_feedback (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  training_request_id UUID NOT NULL,
  participant_id UUID NOT NULL,
  instructor_id UUID,
  
  -- Ratings (1-5 scale)
  overall_rating INTEGER CHECK (overall_rating >= 1 AND overall_rating <= 5),
  content_rating INTEGER CHECK (content_rating >= 1 AND content_rating <= 5),
  instructor_rating INTEGER CHECK (instructor_rating >= 1 AND instructor_rating <= 5),
  venue_rating INTEGER CHECK (venue_rating >= 1 AND venue_rating <= 5),
  
  -- Text feedback
  what_learned TEXT,
  suggestions TEXT,
  additional_comments TEXT,
  
  -- Metadata
  submitted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completion_time_minutes INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.training_feedback ENABLE ROW LEVEL SECURITY;

-- Create policies for training feedback
CREATE POLICY "Users can view feedback for their training requests" 
ON public.training_feedback 
FOR SELECT 
USING (
  auth.uid() = participant_id 
  OR auth.uid() = instructor_id
  OR is_tupa_admin()
  OR EXISTS (
    SELECT 1 FROM public.training_requests tr
    WHERE tr.id = training_feedback.training_request_id
      AND user_has_location(tr.location_id)
  )
);

CREATE POLICY "Participants can create feedback for their trainings" 
ON public.training_feedback 
FOR INSERT 
WITH CHECK (
  auth.uid() = participant_id
  AND EXISTS (
    SELECT 1 FROM public.training_requests tr
    WHERE tr.id = training_feedback.training_request_id
      AND tr.requested_by = auth.uid()
      AND tr.status = 'completed'
  )
);

CREATE POLICY "Users can update their own feedback" 
ON public.training_feedback 
FOR UPDATE 
USING (auth.uid() = participant_id OR is_tupa_admin());

CREATE POLICY "Admins can delete feedback" 
ON public.training_feedback 
FOR DELETE 
USING (is_tupa_admin());

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_training_feedback_updated_at
BEFORE UPDATE ON public.training_feedback
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for performance
CREATE INDEX idx_training_feedback_training_request_id ON public.training_feedback(training_request_id);
CREATE INDEX idx_training_feedback_participant_id ON public.training_feedback(participant_id);