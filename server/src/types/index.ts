// Enum types matching database schema v2

export type WorkflowStage =
  | 'estimate'
  | 'estimate_accepted'
  | 'verizon_submitted'
  | 'verizon_in_progress'
  | 'verizon_complete'
  | 'porting_submitted'
  | 'porting_scheduled'
  | 'porting_complete'
  | 'user_config'
  | 'completed'
  | 'on_hold'
  | 'cancelled';

export type TargetCarrier = 'verizon' | 'fusionconnect' | 'gtt';

export type RoutingType = 'direct_routing' | 'operator_connect';

export type PhoneNumberType =
  | 'user'
  | 'auto_attendant'
  | 'call_queue'
  | 'fax'
  | 'conference_room'
  | 'shared'
  | 'other';

export type PortingStatus =
  | 'not_started'
  | 'loa_submitted'
  | 'loa_rejected'
  | 'foc_received'
  | 'port_scheduled'
  | 'ported'
  | 'verified'
  | 'failed';

export type ResourceAccountType = 'auto_attendant' | 'call_queue';

export type TeamRole = 'admin' | 'member' | 'viewer';

// Workflow stage metadata for UI
export const WORKFLOW_STAGES: { stage: WorkflowStage; label: string; description: string }[] = [
  { stage: 'estimate', label: 'Cost Estimate', description: 'Preparing cost estimate for customer' },
  { stage: 'estimate_accepted', label: 'Estimate Accepted', description: 'Customer accepted the estimate' },
  { stage: 'verizon_submitted', label: 'Verizon Requested', description: 'Site request submitted to Verizon' },
  { stage: 'verizon_in_progress', label: 'Verizon Setup', description: 'Verizon creating site (1-2 weeks)' },
  { stage: 'verizon_complete', label: 'Verizon Complete', description: 'Verizon site setup complete' },
  { stage: 'porting_submitted', label: 'Porting Submitted', description: 'LOA submitted for number porting' },
  { stage: 'porting_scheduled', label: 'Porting Scheduled', description: 'FOC received, port date confirmed' },
  { stage: 'porting_complete', label: 'Porting Complete', description: 'Numbers successfully ported' },
  { stage: 'user_config', label: 'User Configuration', description: 'Assigning numbers in Teams' },
  { stage: 'completed', label: 'Completed', description: 'Migration complete' },
];

// Entity interfaces

export interface TeamMember {
  id: string;
  email: string;
  display_name: string;
  role: TeamRole;
  is_active: boolean;
  last_login_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface Migration {
  id: string;
  name: string;
  workflow_stage: WorkflowStage;
  target_carrier: TargetCarrier;
  routing_type: RoutingType;

  // Site info
  site_name: string;
  site_address: string | null;
  site_city: string | null;
  site_state: string | null;
  site_country: string;
  site_timezone: string;
  current_pbx_type: string | null;
  current_carrier: string | null;

  // Estimate inputs
  telephone_users: number;
  physical_phones_needed: number;
  monthly_calling_minutes: number | null;
  is_porting_numbers: boolean;
  new_numbers_requested: number;

  // Estimate amounts
  estimate_user_service_charge: number | null;
  estimate_equipment_charge: number | null;
  estimate_usage_charge: number | null;
  estimate_total_monthly: number | null;
  estimate_total_onetime: number | null;
  estimate_created_at: Date | null;
  estimate_accepted_at: Date | null;
  estimate_notes: string | null;

  // Billing contact
  billing_contact_name: string | null;
  billing_contact_email: string | null;
  billing_contact_phone: string | null;

  // Local contact
  local_contact_name: string | null;
  local_contact_email: string | null;
  local_contact_phone: string | null;

  // Verizon tracking
  verizon_request_submitted_at: Date | null;
  verizon_request_email_sent_to: string | null;
  verizon_site_id: string | null;
  verizon_setup_complete_at: Date | null;
  verizon_notes: string | null;

  // Porting
  carrier_invoice_received: boolean;
  carrier_invoice_notes: string | null;
  carrier_account_number: string | null;
  carrier_pin: string | null;
  loa_submitted_at: Date | null;
  loa_submitted_to: string | null;
  foc_date: Date | null;
  scheduled_port_date: Date | null;
  actual_port_date: Date | null;
  porting_notes: string | null;

  // User config
  user_data_collection_complete: boolean;
  teams_config_complete: boolean;
  teams_config_date: Date | null;

  // Magic link
  magic_link_token: string | null;
  magic_link_created_at: Date | null;
  magic_link_expires_at: Date | null;
  magic_link_accessed_at: Date | null;

  // Completion
  completed_at: Date | null;

  // Summary counts
  total_numbers: number;
  ported_numbers: number;
  total_users: number;
  configured_users: number;

  notes: string | null;
  created_by: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface EndUser {
  id: string;
  migration_id: string;
  display_name: string;
  upn: string;
  phone_number: string | null;
  department: string | null;
  job_title: string | null;
  is_configured: boolean;
  configuration_date: Date | null;
  entered_via_magic_link: boolean;
  notes: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface PhoneNumber {
  id: string;
  migration_id: string;
  number: string;
  number_type: PhoneNumberType;
  original_carrier: string | null;
  porting_status: PortingStatus;
  ported_date: Date | null;
  verified_date: Date | null;
  assigned_user_id: string | null;
  notes: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface ResourceAccount {
  id: string;
  migration_id: string;
  upn: string;
  display_name: string;
  account_type: ResourceAccountType;
  phone_number: string | null;
  is_created_in_azure: boolean;
  is_licensed: boolean;
  notes: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface AutoAttendant {
  id: string;
  migration_id: string;
  name: string;
  resource_account_id: string | null;
  phone_number: string | null;
  language_id: string;
  timezone: string;
  greeting_text: string | null;
  menu_options: unknown[] | null;
  business_hours: Record<string, unknown> | null;
  is_deployed: boolean;
  teams_aa_id: string | null;
  notes: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface CallQueue {
  id: string;
  migration_id: string;
  name: string;
  resource_account_id: string | null;
  phone_number: string | null;
  language_id: string;
  routing_method: string;
  greeting_text: string | null;
  agent_ids: string[] | null;
  is_deployed: boolean;
  teams_cq_id: string | null;
  notes: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface GeneratedScript {
  id: string;
  migration_id: string;
  script_type: string;
  name: string;
  description: string | null;
  script_content: string;
  generated_by: string | null;
  generated_at: Date;
}

// Dashboard view type
export interface MigrationDashboard extends Migration {
  stage_number: number;
}
