-- Create recurring orders table for automatic weekly/monthly orders
CREATE TABLE public.recurring_orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  location_id UUID NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Toggle and scheduling
  enabled BOOLEAN NOT NULL DEFAULT false,
  frequency TEXT NOT NULL DEFAULT 'weekly' CHECK (frequency IN ('weekly', 'biweekly', 'monthly')),
  day_of_week INTEGER CHECK (day_of_week >= 1 AND day_of_week <= 7), -- 1=Monday, 7=Sunday
  
  -- Order configuration
  items JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array of products with quantities
  delivery_type TEXT DEFAULT 'standard',
  notes TEXT,
  
  -- Scheduling tracking
  next_order_date DATE,
  last_order_date DATE,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add foreign keys
ALTER TABLE public.recurring_orders 
ADD CONSTRAINT fk_recurring_orders_tenant 
FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;

ALTER TABLE public.recurring_orders 
ADD CONSTRAINT fk_recurring_orders_location 
FOREIGN KEY (location_id) REFERENCES public.locations(id) ON DELETE CASCADE;

-- Enable RLS
ALTER TABLE public.recurring_orders ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "recurring_orders_select_by_location" 
ON public.recurring_orders 
FOR SELECT 
USING (user_has_location(location_id) OR is_tupa_admin());

CREATE POLICY "recurring_orders_insert_by_location" 
ON public.recurring_orders 
FOR INSERT 
WITH CHECK (user_has_location(location_id) AND auth.uid() = created_by);

CREATE POLICY "recurring_orders_update_by_location" 
ON public.recurring_orders 
FOR UPDATE 
USING (user_has_location(location_id) OR is_tupa_admin());

CREATE POLICY "recurring_orders_delete_by_location" 
ON public.recurring_orders 
FOR DELETE 
USING (user_has_location(location_id) OR is_tupa_admin());

-- Create updated_at trigger
CREATE TRIGGER update_recurring_orders_updated_at
BEFORE UPDATE ON public.recurring_orders
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add order_status enum value if it doesn't exist (for recurring orders)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'order_status') THEN
        CREATE TYPE order_status AS ENUM ('draft', 'pending', 'approved', 'rejected', 'delivered');
    END IF;
    
    -- Add recurring source if not exists
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum e 
        JOIN pg_type t ON e.enumtypid = t.oid 
        WHERE t.typname = 'order_status' AND e.enumlabel = 'recurring'
    ) THEN
        -- This is handled at application level, recurring orders create regular order_proposals
        NULL;
    END IF;
END $$;