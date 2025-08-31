-- Add missing fields to order_proposals table for complete replenishment functionality
ALTER TABLE public.order_proposals 
ADD COLUMN IF NOT EXISTS delivery_type text,
ADD COLUMN IF NOT EXISTS notes text,
ADD COLUMN IF NOT EXISTS coffee_variety text;