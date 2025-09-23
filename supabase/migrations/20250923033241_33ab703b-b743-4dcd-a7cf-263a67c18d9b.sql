-- Enable realtime for notifications table (if not already enabled)
ALTER TABLE public.notifications REPLICA IDENTITY FULL;

-- Function to create training notifications
CREATE OR REPLACE FUNCTION public.notify_training_request_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  notification_title text;
  notification_message text;
  target_user_id uuid;
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    -- Notify the user who made the request
    target_user_id := NEW.created_by;
    
    CASE NEW.status
      WHEN 'accepted' THEN
        notification_title := 'Solicitud de capacitación aceptada';
        notification_message := 'Tu solicitud de capacitación ha sido aceptada. Te contactaremos pronto.';
      WHEN 'rejected' THEN
        notification_title := 'Solicitud de capacitación rechazada';
        notification_message := 'Tu solicitud de capacitación ha sido rechazada. Puedes intentar nuevamente más tarde.';
      WHEN 'completed' THEN
        notification_title := 'Capacitación completada';
        notification_message := 'Has completado exitosamente la capacitación solicitada.';
      ELSE
        RETURN NEW; -- No notification for other status changes
    END CASE;

    -- Create notification
    PERFORM public.create_notification(
      target_user_id,
      'training',
      notification_title,
      notification_message,
      NEW.tenant_id,
      NEW.location_id,
      jsonb_build_object('training_request_id', NEW.id, 'status', NEW.status)
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Function to create order notifications
CREATE OR REPLACE FUNCTION public.notify_order_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  notification_title text;
  notification_message text;
  target_user_id uuid;
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    -- Notify the user who created the order
    target_user_id := NEW.created_by;
    
    CASE NEW.status
      WHEN 'approved' THEN
        notification_title := 'Pedido aprobado';
        notification_message := format('Tu pedido ha sido aprobado y está en preparación.');
      WHEN 'processing' THEN
        notification_title := 'Pedido en proceso';
        notification_message := format('Tu pedido está siendo preparado.');
      WHEN 'shipped' THEN
        notification_title := 'Pedido enviado';
        notification_message := format('Tu pedido ha sido enviado y está en camino.');
      WHEN 'delivered' THEN
        notification_title := 'Pedido entregado';
        notification_message := format('Tu pedido ha sido entregado exitosamente.');
      WHEN 'cancelled' THEN
        notification_title := 'Pedido cancelado';
        notification_message := format('Tu pedido ha sido cancelado.');
      ELSE
        RETURN NEW; -- No notification for other status changes
    END CASE;

    -- Create notification
    PERFORM public.create_notification(
      target_user_id,
      'order',
      notification_title,
      notification_message,
      NEW.tenant_id,
      NEW.location_id,
      jsonb_build_object('order_id', NEW.id, 'status', NEW.status)
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Create triggers
DROP TRIGGER IF EXISTS trigger_training_request_notification ON public.training_requests;
CREATE TRIGGER trigger_training_request_notification
  AFTER UPDATE ON public.training_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_training_request_status_change();

DROP TRIGGER IF EXISTS trigger_order_proposal_notification ON public.order_proposals;
CREATE TRIGGER trigger_order_proposal_notification
  AFTER UPDATE ON public.order_proposals
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_order_status_change();