import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.54.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RecurringOrder {
  id: string;
  tenant_id: string;
  location_id: string;
  created_by: string | null;
  enabled: boolean;
  frequency: 'weekly' | 'biweekly' | 'monthly';
  day_of_week: number | null;
  items: Array<{
    variety: string;
    quantity: number;
    unit: string;
    type: 'ground' | 'product';
  }>;
  delivery_type: string | null;
  notes: string | null;
  next_order_date: string | null;
  last_order_date: string | null;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format

    console.log(`Processing recurring orders for date: ${today}`);

    // Find all enabled recurring orders that should execute today
    const { data: recurringOrders, error: fetchError } = await supabase
      .from('recurring_orders')
      .select('*')
      .eq('enabled', true)
      .eq('next_order_date', today);

    if (fetchError) {
      console.error('Error fetching recurring orders:', fetchError);
      throw fetchError;
    }

    console.log(`Found ${recurringOrders?.length || 0} recurring orders to process`);

    let processedCount = 0;
    let errorCount = 0;

    for (const order of recurringOrders || []) {
      try {
        console.log(`Processing recurring order ${order.id} for location ${order.location_id}`);

        // Create the order proposal
        const { data: orderProposal, error: orderError } = await supabase
          .from('order_proposals')
          .insert({
            tenant_id: order.tenant_id,
            location_id: order.location_id,
            coffee_variety: order.items.map(item => `${item.variety} (${item.quantity}${item.unit === 'kg' ? 'kg' : 'u'})`).join(", "),
            delivery_type: order.delivery_type || 'standard',
            notes: `Pedido automático - ${order.notes || ''}`.trim(),
            items: order.items,
            created_by: order.created_by,
            source: 'recurring',
            status: 'pending'
          })
          .select()
          .single();

        if (orderError) {
          console.error(`Error creating order proposal for ${order.id}:`, orderError);
          errorCount++;
          continue;
        }

        // Create detailed order items for ground coffee
        const groundItems = order.items.filter(item => item.type === 'ground');
        if (groundItems.length > 0) {
          // We'd need to map variety names to IDs here
          // For now, we'll skip the detailed items as we don't have the mapping
          console.log(`Skipping detailed items creation for ${groundItems.length} ground coffee items`);
        }

        // Calculate next order date
        const nextDate = calculateNextOrderDate(order.frequency, order.day_of_week);
        
        // Update the recurring order with new dates
        const { error: updateError } = await supabase
          .from('recurring_orders')
          .update({
            last_order_date: today,
            next_order_date: nextDate
          })
          .eq('id', order.id);

        if (updateError) {
          console.error(`Error updating recurring order ${order.id}:`, updateError);
          errorCount++;
          continue;
        }

        // Log the successful creation
        await supabase.from('pos_logs').insert({
          level: 'info',
          scope: 'recurring_orders',
          message: `Automatic order created successfully`,
          location_id: order.location_id,
          tenant_id: order.tenant_id,
          meta: {
            recurring_order_id: order.id,
            order_proposal_id: orderProposal.id,
            frequency: order.frequency,
            items_count: order.items.length,
            next_order_date: nextDate
          }
        });

        processedCount++;
        console.log(`Successfully processed recurring order ${order.id}`);

      } catch (error) {
        console.error(`Error processing recurring order ${order.id}:`, error);
        errorCount++;
        
        // Log the error
        await supabase.from('pos_logs').insert({
          level: 'error',
          scope: 'recurring_orders',
          message: `Failed to process automatic order: ${error.message}`,
          location_id: order.location_id,
          tenant_id: order.tenant_id,
          meta: {
            recurring_order_id: order.id,
            error: error.message,
            stack: error.stack
          }
        });
      }
    }

    const summary = {
      date: today,
      total_found: recurringOrders?.length || 0,
      processed: processedCount,
      errors: errorCount,
      timestamp: new Date().toISOString()
    };

    console.log('Processing summary:', summary);

    // Log the overall job completion
    await supabase.from('pos_logs').insert({
      level: errorCount > 0 ? 'warn' : 'info',
      scope: 'recurring_orders',
      message: `Recurring orders processing completed`,
      meta: summary
    });

    return new Response(JSON.stringify(summary), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    });

  } catch (error: any) {
    console.error('Fatal error in recurring order processor:', error);
    
    return new Response(JSON.stringify({ 
      error: error.message,
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    });
  }
};

function calculateNextOrderDate(frequency: string, dayOfWeek: number | null): string {
  const today = new Date();
  
  if (frequency === 'weekly' && dayOfWeek) {
    const currentDayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const targetDay = dayOfWeek === 7 ? 0 : dayOfWeek; // Convert Sunday from 7 to 0
    
    let daysUntilNext = targetDay - currentDayOfWeek;
    if (daysUntilNext <= 0) {
      daysUntilNext += 7; // Next week
    }
    
    const nextDate = new Date(today);
    nextDate.setDate(today.getDate() + daysUntilNext);
    return nextDate.toISOString().split('T')[0];
  }
  
  if (frequency === 'biweekly') {
    const nextDate = new Date(today);
    nextDate.setDate(today.getDate() + 14);
    return nextDate.toISOString().split('T')[0];
  }
  
  if (frequency === 'monthly') {
    const nextDate = new Date(today);
    nextDate.setMonth(today.getMonth() + 1);
    return nextDate.toISOString().split('T')[0];
  }
  
  // Default: next week
  const nextDate = new Date(today);
  nextDate.setDate(today.getDate() + 7);
  return nextDate.toISOString().split('T')[0];
}

serve(handler);