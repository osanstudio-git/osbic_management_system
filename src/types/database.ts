export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type DocumentRow = {
  id: string
  job_id: string
  job_step_id: string | null
  job_sub_task_id: string | null
  uploaded_by: string
  file_name: string
  file_path: string
  file_size: number | null
  file_type: string | null
  document_type: string
  version: number
  status: 'pending' | 'approved' | 'rejected'
  rejection_reason: string | null
  expiry_date: string | null
  is_client_visible: boolean
  created_at: string
}

type NullableKeys<T> = {
  [K in keyof T]: null extends T[K] ? K : never
}[keyof T];

type TableDef<
  Row, 
  InsertOmit extends keyof Row = never,
  InsertOptional extends keyof Row = never
> = {
  Row: Row
  Insert: Omit<
    Omit<Row, InsertOmit>,
    NullableKeys<Omit<Row, InsertOmit>> | Extract<InsertOptional, keyof Omit<Row, InsertOmit>>
  > & Partial<
    Pick<Omit<Row, InsertOmit>, Extract<NullableKeys<Omit<Row, InsertOmit>> | InsertOptional, keyof Omit<Row, InsertOmit>>>
  >
  Update: Partial<
    Omit<
      Omit<Row, InsertOmit>,
      NullableKeys<Omit<Row, InsertOmit>> | Extract<InsertOptional, keyof Omit<Row, InsertOmit>>
    > & Partial<
      Pick<Omit<Row, InsertOmit>, Extract<NullableKeys<Omit<Row, InsertOmit>> | InsertOptional, keyof Omit<Row, InsertOmit>>>
    >
  >
  Relationships: never[]
}

export interface Database {
  public: { // Osbic Public Schema
    Tables: {
      branches: TableDef<{
        id: string
        name: string
        code: string
        address: string | null
        phone: string | null
        is_active: boolean
        created_at: string
      }, 'id' | 'created_at', 'is_active'>

      profiles: TableDef<{
        id: string
        branch_id: string | null
        full_name: string | null
        email: string | null
        phone: string | null
        role: 'admin' | 'employee' | 'client'
        avatar_url: string | null
        language_preference: 'en' | 'ar' | null
        is_active: boolean | null
        employee_code: string | null
        client_code: string | null
        is_manager: boolean | null
        department: 'sales' | 'operations' | 'accounts' | 'pro' | 'marketing' | null
        created_by: string | null
        created_at: string | null
        updated_at: string | null
        whatsapp: string | null
        nationality: string | null
        company_name: string | null
        can_do_sales: boolean | null
        can_do_ops: boolean | null
        can_do_accounts: boolean | null
        can_do_marketing: boolean | null
        is_pro: boolean | null
        monthly_target: number | null
      }, never, 'role'>


      services: TableDef<{
        id: string
        name_en: string
        name_ar: string
        description_en: string | null
        description_ar: string | null
        category: 'company_formation' | 'visa' | 'cr_renewal' | 'labor' | 'other'
        estimated_days: number | null
        is_active: boolean
        icon: string | null
        created_by: string | null
        created_at: string
        updated_at: string
        work_fee: number
        ministry_fee: number
        default_work_fee: number | null
        default_ministry_fee: number | null
        requires_pro: boolean | null
      }, 'id' | 'created_at' | 'updated_at'>

      workflow_steps: TableDef<{
        id: string
        service_id: string
        step_order: number
        name_en: string
        name_ar: string
        description_en: string | null
        description_ar: string | null
        required_documents: string[] | null
        is_client_visible: boolean
        is_blocking: boolean
        estimated_hours: number | null
        created_at: string
      }, 'id' | 'created_at'>

      jobs: TableDef<{
        id: string
        branch_id: string | null
        job_code: string
        client_id: string
        employee_id: string
        assigned_by: string | null
        service_id: string
        current_step_id: string | null
        status: 'draft' | 'active' | 'on_hold' | 'completed' | 'cancelled'
        total_fee: number
        work_fee: number
        ministry_fee: number
        ministry_fee_type: 'fixed' | 'percentage'
        ministry_fee_percentage: number | null
        advance_percentage: number
        advance_amount: number | null
        advance_paid: boolean
        advance_paid_at: string | null
        remaining_amount: number | null
        remaining_paid: boolean
        remaining_paid_at: string | null
        service_expiry_date: string | null
        expiry_reminder_60_sent: boolean
        expiry_reminder_30_sent: boolean
        notes: string | null
        started_at: string
        completed_at: string | null
        created_at: string
        updated_at: string
        entry_type: 'lead' | 'walkin' | 'direct' | 'renewal'
        sales_employee_id: string | null
        ops_employee_id: string | null
        package_group_id: string | null
        custom_name: string | null
      }, 'id' | 'created_at' | 'updated_at', 'status' | 'advance_percentage' | 'advance_paid' | 'remaining_paid' | 'expiry_reminder_60_sent' | 'expiry_reminder_30_sent'>

      job_payments: TableDef<{
        id: string
        job_id: string
        amount: number
        payment_method: 'cash' | 'bank_transfer' | 'pos' | 'online'
        reference_number: string | null
        notes: string | null
        recorded_by: string | null
        status: 'pending' | 'verified' | 'rejected'
        verified_by: string | null
        verified_at: string | null
        created_at: string
      }, 'id' | 'created_at' | 'status'>

      job_steps: TableDef<{
        id: string
        job_id: string
        workflow_step_id: string | null
        custom_name: string | null
        assigned_to: string | null
        assigned_by: string | null
        status: 'pending' | 'in_progress' | 'completed' | 'rejected' | 'skipped'
        started_at: string | null
        completed_at: string | null
        completed_by: string | null
        notes: string | null
        rejection_reason: string | null
        is_client_visible: boolean
        deadline: string | null
        created_at: string
        updated_at: string
      }, 'id' | 'created_at' | 'updated_at', 'status' | 'is_client_visible'>

      job_sub_tasks: TableDef<{
        id: string
        job_step_id: string
        name: string
        status: 'pending' | 'applied' | 'approved' | 'rejected' | 'expired'
        notes: string | null
        ministry_fee: number | null
        issued_date: string | null
        expiry_date: string | null
        created_at: string
        updated_at: string
      }, 'id' | 'created_at' | 'updated_at', 'status'>

      job_additional_charges: TableDef<{
        id: string
        job_id: string
        description: string
        amount: number
        created_by: string | null
        created_at: string
      }, 'id' | 'created_at'>

      documents: TableDef<DocumentRow, 'id' | 'created_at'>

      notifications: TableDef<{
        id: string
        recipient_id: string
        sender_id: string | null
        job_id: string | null
        type: string
        title_en: string
        title_ar: string
        body_en: string | null
        body_ar: string | null
        is_read: boolean
        action_required: boolean
        action_url: string | null
        created_at: string
      }, 'id' | 'created_at'>

      branch_cash_reconciliations: TableDef<{
        id: string
        branch_id: string
        reconciliation_date: string
        opening_cash: number
        closing_cash_actual: number
        pos_card_total_actual: number
        expected_cash: number
        expected_card: number
        variance: number
        bank_deposit_amount: number | null
        deposit_reference: string | null
        deposit_slip_url: string | null
        status: 'draft' | 'submitted' | 'verified' | 'discrepancy'
        notes: string | null
        created_by: string | null
        verified_by: string | null
        created_at: string
        updated_at: string
      }, 'id' | 'created_at' | 'updated_at', 'status' | 'opening_cash' | 'closing_cash_actual' | 'pos_card_total_actual' | 'expected_cash' | 'expected_card' | 'variance'>

      branch_document_vault: TableDef<{
        id: string
        branch_id: string
        client_id: string | null
        job_id: string | null
        document_type: 'cr_certificate' | 'company_stamp' | 'passport' | 'civil_id' | 'tenancy_contract' | 'pki_token' | 'power_of_attorney' | 'municipal_license' | 'other'
        document_name: string
        document_identifier: string | null
        client_name: string
        contact_phone: string | null
        locker_location: string | null
        status: 'in_vault' | 'with_pro' | 'returned_to_client' | 'archived'
        current_holder_id: string | null
        checkout_reason: string | null
        checkout_time: string | null
        expected_return_date: string | null
        received_by: string | null
        received_at: string
        returned_to_client_at: string | null
        returned_by: string | null
        notes: string | null
        created_at: string
        updated_at: string
      }, 'id' | 'created_at' | 'updated_at', 'status' | 'received_at'>

      branch_document_vault_logs: TableDef<{
        id: string
        vault_item_id: string
        action: 'received_in_vault' | 'checked_out_to_pro' | 'returned_to_vault' | 'handed_over_to_client' | 'note_added'
        performed_by: string | null
        recipient_holder_id: string | null
        notes: string | null
        created_at: string
      }, 'id' | 'created_at'>

      branch_monthly_targets: TableDef<{
        id: string
        branch_id: string
        target_month: string
        revenue_target: number
        deals_target: number
        leads_target: number | null
        notes: string | null
        created_by: string | null
        created_at: string
        updated_at: string
      }, 'id' | 'created_at' | 'updated_at', 'revenue_target' | 'deals_target'>

      messages: TableDef<{
        id: string
        job_id: string
        sender_id: string
        content: string
        is_read: boolean
        created_at: string
      }, 'id' | 'created_at'>

      chat_rooms: TableDef<{
        id: string
        type: 'direct' | 'group'
        name: string | null
        created_by: string | null
        created_at: string
        updated_at: string
      }, 'id' | 'created_at' | 'updated_at'>

      chat_participants: TableDef<{
        chat_id: string
        user_id: string
        role: 'member' | 'admin'
        joined_at: string
        last_read_at: string
      }, 'joined_at' | 'last_read_at'>

      chat_messages: TableDef<{
        id: string
        chat_id: string
        sender_id: string | null
        content: string
        created_at: string
      }, 'id' | 'created_at'>

      employee_requests: TableDef<{
        id: string
        employee_id: string
        job_id: string | null
        type: 'price_adjustment' | 'step_skip' | 'deadline_extension' | 'other'
        description: string
        status: 'pending' | 'approved' | 'rejected'
        admin_response: string | null
        reviewed_by: string | null
        reviewed_at: string | null
        created_at: string
      }, 'id' | 'created_at', 'status'>

      service_interests: TableDef<{
        id: string
        client_id: string | null
        service_id: string | null
        notes: string | null
        status: 'new' | 'contacted' | 'converted' | 'ignored'
        created_at: string
        updated_at: string
      }, 'id' | 'created_at' | 'updated_at', 'status'>

      audit_logs: TableDef<{
        id: string
        actor_id: string | null
        action: string
        entity_type: string | null
        entity_id: string | null
        old_values: Json | null
        new_values: Json | null
        ip_address: string | null
        created_at: string
      }, 'id' | 'created_at'>

      leads: TableDef<{
        id: string
        branch_id: string | null
        lead_code: string | null
        client_id: string | null
        contact_name: string
        contact_phone: string | null
        contact_whatsapp: string | null
        contact_email: string | null
        company_name: string | null
        nationality: string | null
        source_id: string | null
        assigned_to: string | null
        assigned_by: string | null
        status: 'new' | 'contacted' | 'interested' | 'qualified' | 'quoted' | 'negotiating' | 'converted' | 'lost' | 'on_hold'
        lost_reason: string | null
        next_follow_up_at: string | null
        follow_up_notes: string | null
        converted_at: string | null
        converted_job_id: string | null
        notes: string | null
        interested_services: Json | null
        utm_source: string | null
        utm_medium: string | null
        utm_campaign: string | null
        utm_term: string | null
        utm_content: string | null
        gclid: string | null
        fbclid: string | null
        leadgen_id: string | null
        landing_page_url: string | null
        form_id: string | null
        ip_country: string | null
        created_at: string
        updated_at: string
      }, 'id' | 'created_at' | 'updated_at', 'status'>

      lead_sources: TableDef<{
        id: string
        name: string
        is_active: boolean
        created_at: string
      }, 'id' | 'created_at', 'is_active'>

      lead_services: TableDef<{
        lead_id: string
        service_id: string
      }>

      lead_interactions: TableDef<{
        id: string
        lead_id: string
        employee_id: string | null
        type: 'call' | 'whatsapp' | 'email' | 'meeting' | 'note'
        direction: 'inbound' | 'outbound'
        duration_mins: number | null
        outcome: string | null
        notes: string
        next_action: string | null
        created_at: string
      }, 'id' | 'created_at'>



      quotations: TableDef<{
        id: string
        quotation_number: string
        lead_id: string | null
        client_id: string | null
        created_by: string | null
        status: 'draft' | 'sent' | 'viewed' | 'accepted' | 'rejected' | 'expired'
        valid_until: string | null
        notes: string | null
        terms: string | null
        subtotal: number
        discount_amount: number
        tax_percentage: number
        tax_amount: number
        total_amount: number
        advance_percentage: number
        advance_amount: number | null
        accepted_at: string | null
        rejected_at: string | null
        rejection_reason: string | null
        converted_job_ids: string[] | null
        created_at: string
        updated_at: string
      }, 'id' | 'created_at' | 'updated_at', 'status' | 'discount_amount' | 'tax_percentage' | 'tax_amount' | 'advance_percentage'>

      quotation_items: TableDef<{
        id: string
        quotation_id: string
        service_id: string | null
        package_id: string | null
        description: string | null
        quantity: number
        work_fee: number
        ministry_fee: number
        unit_price: number
        total: number
        display_order: number
      }, 'id'>

      invoices: TableDef<{
        id: string
        invoice_number: string
        client_id: string | null
        lead_id: string | null
        job_id: string | null
        employee_id: string | null
        type: 'quotation' | 'invoice'
        status: 'draft' | 'unpaid' | 'paid' | 'partially_paid' | 'cancelled'
        subtotal: number
        tax_percentage: number
        tax_amount: number
        discount_amount: number
        total_amount: number
        issue_date: string | null
        due_date: string | null
        paid_date: string | null
        notes: string | null
        terms: string | null
        metadata: Json | null
        created_at: string
      }, 'id' | 'created_at', 'status' | 'discount_amount' | 'tax_percentage' | 'tax_amount'>

      invoice_items: TableDef<{
        id: string
        invoice_id: string
        description: string
        quantity: number
        unit_price: number
        total: number
      }, 'id'>

      service_packages: TableDef<{
        id: string
        name_en: string
        name_ar: string
        description_en: string | null
        description_ar: string | null
        icon: string | null
        discount_percentage: number
        is_active: boolean
        notes: string | null
        created_at: string
        updated_at: string
      }, 'id' | 'created_at' | 'updated_at', 'is_active' | 'discount_percentage'>

      package_services: TableDef<{
        id: string
        package_id: string
        service_id: string
        display_order: number
        default_quantity: number
        is_optional: boolean
        is_parallel: boolean
        estimated_days_min: number | null
        estimated_days_max: number | null
        notes: string | null
        created_at: string
      }, 'id' | 'created_at'>

      service_document_requirements: TableDef<{
        id: string
        service_id: string
        document_name: string
        document_name_ar: string | null
        is_required: boolean
        is_client_upload: boolean
        is_employee_upload: boolean
        notes: string | null
        display_order: number | null
        created_at: string
      }, 'id' | 'created_at'>

      package_job_groups: TableDef<{
        id: string
        group_code: string
        quotation_id: string | null
        client_id: string
        package_id: string | null
        sales_employee_id: string | null
        ops_employee_id: string | null
        total_price: number | null
        status: 'active' | 'completed' | 'cancelled' | string
        created_at: string
        updated_at: string | null
      }, 'id' | 'created_at' | 'updated_at', 'status'>

      job_services: TableDef<{
        id: string
        job_id: string
        service_id: string
        service_name: string
        display_order: number
        quantity: number
        item_number: number
        applicant_name: string | null
        applicant_details: Json | null
        ops_employee_id: string | null
        assigned_by: string | null
        assigned_at: string | null
        status: 'pending' | 'in_progress' | 'applied' | 'assigned_to_pro' | 'gov_approved' | 'gov_rejected' | 'completed' | 'on_hold' | 'cancelled'
        pending_reason: string | null
        rejection_reason: string | null
        cancellation_reason: string | null
        pro_id: string | null
        pro_shared_at: string | null
        pro_status: 'submitted' | 'approved' | 'rejected' | null
        pro_notes: string | null
        government_ref: string | null
        government_approved_at: string | null
        work_fee: number
        ministry_fee: number
        total_fee: number
        ministry_fee_allocated: number | null
        service_fee_allocated: number | null
        ministry_fee_pending: number | null
        service_fee_pending: number | null
        started_at: string | null
        completed_at: string | null
        deadline: string | null
        notes: string | null
        created_at: string
        updated_at: string
      }, 'id' | 'created_at' | 'updated_at'>

      job_service_steps: TableDef<{
        id: string
        job_service_id: string
        step_name: string
        step_name_ar: string | null
        display_order: number
        assigned_to: string | null
        assigned_by: string | null
        status: 'pending' | 'in_progress' | 'applied' | 'assigned_to_pro' | 'gov_approved' | 'gov_rejected' | 'completed' | 'skipped' | 'on_hold' | 'cancelled'
        pending_reason: string | null
        rejection_reason: string | null
        pro_id: string | null
        pro_shared_at: string | null
        pro_status: string | null
        government_ref: string | null
        estimated_days_min: number | null
        estimated_days_max: number | null
        started_at: string | null
        completed_at: string | null
        is_client_visible: boolean
        notes: string | null
        created_at: string
        updated_at: string
      }, 'id' | 'created_at' | 'updated_at'>

      job_service_documents: TableDef<{
        id: string
        job_service_id: string
        job_service_step_id: string | null
        job_id: string
        document_name: string
        file_name: string | null
        file_path: string | null
        file_size: number | null
        file_type: string | null
        document_category: string | null
        uploaded_by: string | null
        upload_source: string | null
        status: 'pending' | 'approved' | 'rejected' | 'expired'
        rejection_reason: string | null
        is_client_visible: boolean
        issue_date: string | null
        expiry_date: string | null
        version: number
        notes: string | null
        created_at: string
      }, 'id' | 'created_at'>

      job_additional_services: TableDef<{
        id: string
        job_id: string
        service_id: string | null
        custom_name: string | null
        quantity: number
        work_fee: number
        ministry_fee: number
        reason: string | null
        added_by: string | null
        approved_by: string | null
        created_at: string
      }, 'id' | 'created_at'>

      job_additional_fees: TableDef<{
        id: string
        job_id: string
        description: string
        amount: number
        fee_type: 'work' | 'ministry' | 'other'
        reason: string | null
        added_by: string | null
        created_at: string
      }, 'id' | 'created_at'>

      payment_allocations: TableDef<{
        id: string
        payment_id: string
        job_service_id: string
        amount: number
        allocation_type: 'ministry_fee' | 'service_fee'
        created_at: string
        created_by: string | null
      }, 'id' | 'created_at'>

      job_expenses: TableDef<{
        id: string
        job_id: string
        job_service_id: string
        amount: number
        expense_type: string
        receipt_url: string | null
        notes: string | null
        status: 'pending_approval' | 'approved' | 'rejected'
        created_at: string
        created_by: string | null
      }, 'id' | 'created_at' | 'status' | 'expense_type'>

      branch_client_escalations: TableDef<{
        id: string
        branch_id: string
        job_id: string | null
        lead_id: string | null
        client_name: string
        client_phone: string | null
        client_email: string | null
        assigned_staff_id: string | null
        logged_by: string
        category: 'sla_breach' | 'milestone_delay' | 'quality_complaint' | 'fee_dispute' | 'unresponsive_staff' | 'general'
        severity: 'low' | 'medium' | 'high' | 'critical'
        status: 'open' | 'investigating' | 'resolved' | 'escalated_to_hq'
        title: string
        description: string
        feedback_channel: 'walk_in' | 'whatsapp' | 'phone_call' | 'portal_review' | 'manager_flag'
        resolution_notes: string | null
        resolved_by: string | null
        resolved_at: string | null
        rating: number | null
        created_at: string
        updated_at: string
      }, 'id' | 'created_at' | 'updated_at'>
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_quick_task: {
        Args: {
          p_employee_id: string | undefined
          p_task_description: string
          p_amount: number
          p_payment_method: string
          p_customer_name: string | null
          p_customer_phone?: string | null
          p_status?: string
        }
        Returns: any
      }
    }
  }
}
