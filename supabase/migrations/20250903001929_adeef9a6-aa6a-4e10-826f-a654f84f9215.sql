-- Create storage bucket for coffee variety images
INSERT INTO storage.buckets (id, name, public) 
VALUES ('coffee-images', 'coffee-images', true);

-- Create storage policies for coffee images
CREATE POLICY "Coffee images are publicly accessible" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'coffee-images');

CREATE POLICY "Admins can upload coffee images" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'coffee-images' AND is_tupa_admin());

CREATE POLICY "Admins can update coffee images" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'coffee-images' AND is_tupa_admin());

CREATE POLICY "Admins can delete coffee images" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'coffee-images' AND is_tupa_admin());

-- Add image_url column to coffee_varieties table
ALTER TABLE public.coffee_varieties 
ADD COLUMN image_url text;

-- Add index for better performance
CREATE INDEX idx_coffee_varieties_image_url ON public.coffee_varieties(image_url) WHERE image_url IS NOT NULL;