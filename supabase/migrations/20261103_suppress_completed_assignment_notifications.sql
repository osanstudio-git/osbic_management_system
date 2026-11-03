-- =============================================================================
-- Migration: Suppress assignment notifications for completed/cancelled or self-assigned jobs
-- =============================================================================

CREATE OR REPLACE FUNCTION public.handle_job_services_assignment_notification()
RETURNS TRIGGER AS $$
DECLARE
  v_sender_name TEXT;
  v_job_creator_id UUID;
  v_job_code TEXT;
BEGIN
  -- Get sender name if authenticated
  IF auth.uid() IS NOT NULL THEN
    SELECT full_name INTO v_sender_name FROM public.profiles WHERE id = auth.uid();
  END IF;
  IF v_sender_name IS NULL THEN
    v_sender_name := 'System';
  END IF;

  -- Get job creator and job code
  SELECT employee_id, job_code INTO v_job_creator_id, v_job_code FROM public.jobs WHERE id = NEW.job_id;

  -- Check if ops_employee_id is changing and is not null
  -- IMPORTANT: Never notify if the task is already completed or cancelled, OR if self-assigned (auth.uid() = ops_employee_id)
  IF ((TG_OP = 'INSERT' AND NEW.ops_employee_id IS NOT NULL) OR 
      (TG_OP = 'UPDATE' AND OLD.ops_employee_id IS DISTINCT FROM NEW.ops_employee_id AND NEW.ops_employee_id IS NOT NULL))
     AND NEW.status NOT IN ('completed', 'cancelled')
     AND (auth.uid() IS NULL OR auth.uid() <> NEW.ops_employee_id) THEN
     
     -- 1. Create notification for the new assignee
     INSERT INTO public.notifications (
       recipient_id,
       sender_id,
       job_id,
       type,
       title_en,
       title_ar,
       body_en,
       body_ar,
       action_required,
       action_url
     ) VALUES (
       NEW.ops_employee_id,
       auth.uid(),
       NEW.job_id,
       'action_required',
       'New Task Assigned',
       'تم تكليفك بمهمة جديدة',
       'You have been assigned to task: ' || NEW.service_name || ' (Applicant: ' || COALESCE(NEW.applicant_name, '#' || NEW.item_number::text) || ') by ' || v_sender_name || '.',
       'تم تعيينك للمهمة: ' || NEW.service_name || ' (المتقدم: ' || COALESCE(NEW.applicant_name, '#' || NEW.item_number::text) || ') بواسطة ' || v_sender_name || '.',
       TRUE,
       '/employee/tasks?jobId=' || NEW.job_id
     );
  END IF;

  -- 2. If an employee declined/skipped a task
  IF TG_OP = 'UPDATE' AND OLD.ops_employee_id IS NOT NULL AND NEW.ops_employee_id IS NULL AND NEW.acceptance_status = 'declined' THEN
    -- Notify the job creator (Sales Agent)
    IF v_job_creator_id IS NOT NULL THEN
      INSERT INTO public.notifications (
        recipient_id,
        sender_id,
        job_id,
        type,
        title_en,
        title_ar,
        body_en,
        body_ar,
        action_required,
        action_url
      ) VALUES (
        v_job_creator_id,
        auth.uid(),
        NEW.job_id,
        'alert',
        'Task Assignment Declined',
        'تم رفض تكليف المهمة',
        'Employee ' || v_sender_name || ' declined/skipped task: ' || NEW.service_name || '. Reason: ' || COALESCE(NEW.decline_reason, 'None') || '.',
        'رفض الموظف ' || v_sender_name || ' المهمة: ' || NEW.service_name || '. السبب: ' || COALESCE(NEW.decline_reason, 'لا يوجد') || '.',
        TRUE,
        '/employee/tasks?jobId=' || NEW.job_id
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
