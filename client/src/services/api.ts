import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor: attach JWT token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('portflow_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Response interceptor: handle 401
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Don't redirect if already on auth pages
      const path = window.location.pathname
      if (path !== '/login' && path !== '/setup') {
        localStorage.removeItem('portflow_token')
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)

// Types
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
  | 'cancelled'

export const WORKFLOW_STAGES: { stage: WorkflowStage; label: string; description: string }[] = [
  { stage: 'estimate', label: 'Cost Estimate', description: 'Preparing cost estimate for customer' },
  { stage: 'estimate_accepted', label: 'Estimate Accepted', description: 'Customer accepted the estimate' },
  { stage: 'verizon_submitted', label: 'Carrier Requested', description: 'Site request submitted to carrier' },
  { stage: 'verizon_in_progress', label: 'Carrier Setup', description: 'Carrier creating site (1-2 weeks)' },
  { stage: 'verizon_complete', label: 'Carrier Complete', description: 'Carrier site setup complete' },
  { stage: 'porting_submitted', label: 'Porting Submitted', description: 'LOA submitted for number porting' },
  { stage: 'porting_scheduled', label: 'Porting Scheduled', description: 'FOC received, port date confirmed' },
  { stage: 'porting_complete', label: 'Porting Complete', description: 'Numbers successfully ported' },
  { stage: 'user_config', label: 'User Configuration', description: 'Assigning numbers in Teams' },
  { stage: 'completed', label: 'Completed', description: 'Migration complete' },
]

export interface PhaseTask {
  key: string
  label: string
  done: boolean
}

export interface Migration {
  id: string
  name: string
  survey_id: string | null
  workflow_stage: WorkflowStage
  target_carrier: string
  routing_type: string
  voice_routing_policy: string | null  // Only for direct_routing
  dial_plan: string | null
  country_code: string  // E.164 country code for phone number validation (e.g., '+1')
  currency: string  // Currency code for estimate amounts (USD or EUR)

  // Site info
  site_name: string
  site_address: string | null
  site_city: string | null
  site_state: string | null
  site_country: string
  site_timezone: string
  current_pbx_type: string | null
  current_carrier: string | null

  // Estimate inputs
  telephone_users: number
  physical_phones_needed: number
  monthly_calling_minutes: number | null
  is_porting_numbers: boolean
  new_numbers_requested: number

  // Estimate amounts
  estimate_user_service_charge: number | null
  estimate_equipment_charge: number | null
  estimate_usage_charge: number | null
  estimate_carrier_charge: number | null
  estimate_phone_equipment_charge: number | null
  estimate_headset_equipment_charge: number | null
  estimate_total_monthly: number | null
  estimate_total_onetime: number | null
  estimate_created_at: string | null
  estimate_accepted_at: string | null
  estimate_notes: string | null

  // Billing contact
  billing_contact_name: string | null
  billing_contact_email: string | null
  billing_contact_phone: string | null

  // Local contact
  local_contact_name: string | null
  local_contact_email: string | null
  local_contact_phone: string | null

  // Verizon tracking
  verizon_request_submitted_at: string | null
  verizon_request_email_sent_to: string | null
  verizon_site_id: string | null
  verizon_setup_complete_at: string | null
  verizon_notes: string | null

  // Porting
  carrier_invoice_received: boolean
  carrier_invoice_notes: string | null
  carrier_account_number: string | null
  carrier_pin: string | null
  loa_submitted_at: string | null
  loa_submitted_to: string | null
  foc_date: string | null
  scheduled_port_date: string | null
  actual_port_date: string | null
  porting_notes: string | null

  // User config
  user_data_collection_complete: boolean
  teams_config_complete: boolean
  magic_link_token: string | null
  magic_link_expires_at: string | null

  // Estimate link
  estimate_link_token: string | null
  estimate_link_expires_at: string | null
  estimate_accepted_by: string | null

  // Site questionnaire
  site_questionnaire: Record<string, unknown>
  questionnaire_link_token: string | null
  questionnaire_link_expires_at: string | null
  questionnaire_submitted_at: string | null

  // Phase subtask checklists
  phase_tasks: Record<string, PhaseTask[]> | null

  // Counts
  total_numbers: number
  ported_numbers: number
  total_users: number
  configured_users: number

  // Dashboard
  stage_number?: number

  // Creator
  created_by: string | null
  created_by_name: string | null

  // Assignee
  assigned_to: string | null
  assigned_to_name: string | null

  notes: string | null
  created_at: string
  updated_at: string
  completed_at: string | null
}

export interface EndUser {
  id: string
  migration_id: string
  display_name: string
  upn: string
  phone_number: string | null
  department: string | null
  job_title: string | null
  is_configured: boolean
  entered_via_magic_link: boolean
}

export interface PhoneNumber {
  id: string
  migration_id: string
  number: string
  number_type: string
  porting_status: string
  assigned_user_id: string | null
  assigned_user_name?: string
}

export interface GeneratedScript {
  id: string
  migration_id: string
  script_type: string
  name: string
  description: string | null
  script_content: string
  generated_at: string
}

export interface TeamMember {
  id: string
  email: string
  display_name: string
  role: 'admin' | 'member' | 'viewer'
  is_active: boolean
  last_login_at: string | null
  created_at: string
  updated_at: string
}

export interface Carrier {
  id: string
  slug: string
  display_name: string
  carrier_type: string
  monthly_charge: number
  is_active: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

export function formatRoutingType(routingType: string | undefined | null): string {
  switch (routingType) {
    case 'direct_routing': return 'Direct Routing'
    case 'operator_connect': return 'Operator Connect'
    case 'calling_plan': return 'MS Calling Plans'
    default: return routingType || ''
  }
}

export function formatCarrierType(carrierType: string | undefined | null): string {
  switch (carrierType) {
    case 'direct_routing': return 'Direct Routing'
    case 'operator_connect': return 'Operator Connect'
    case 'calling_plan': return 'MS Calling Plans'
    default: return carrierType || ''
  }
}

export interface VoiceRoutingPolicy {
  id: string
  name: string
  description: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface DialPlan {
  id: string
  name: string
  description: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface AppSetting {
  key: string
  value: unknown
  updated_at: string
  updated_by: string | null
}

export interface AuditLogEntry {
  id: string
  team_member_id: string | null
  action: string
  details: string | null
  migration_id: string | null
  created_at: string
  actor_name?: string
  actor_email?: string
  migration_name?: string
}

// API functions
export const authApi = {
  login: (email: string, password: string) =>
    api.post<{ token: string; user: TeamMember }>('/auth/login', { email, password }).then((r) => r.data),
  me: () => api.get<TeamMember>('/auth/me').then((r) => r.data),
  changePassword: (current_password: string, new_password: string) =>
    api.post('/auth/change-password', { current_password, new_password }).then((r) => r.data),
  setup: (data: { email: string; display_name: string; password: string }) =>
    api.post<{ token: string; user: TeamMember }>('/auth/setup', data).then((r) => r.data),
  checkSetup: () => api.get<{ setup_complete: boolean }>('/auth/check-setup').then((r) => r.data),
}

export const teamApi = {
  list: () => api.get<TeamMember[]>('/team').then((r) => r.data),
  get: (id: string) => api.get<TeamMember>(`/team/${id}`).then((r) => r.data),
  create: (data: { email: string; display_name: string; role?: string; password?: string }) =>
    api.post<TeamMember>('/team', data).then((r) => r.data),
  update: (id: string, data: Partial<TeamMember>) =>
    api.put<TeamMember>(`/team/${id}`, data).then((r) => r.data),
  resetPassword: (id: string, new_password: string) =>
    api.post(`/team/${id}/reset-password`, { new_password }).then((r) => r.data),
  remove: (id: string) => api.delete(`/team/${id}`),
}

export const settingsApi = {
  getAll: () => api.get<AppSetting[]>('/settings').then((r) => r.data),
  get: (key: string) => api.get<AppSetting>(`/settings/${key}`).then((r) => r.data),
  update: (key: string, value: unknown) =>
    api.put<AppSetting>(`/settings/${key}`, { value }).then((r) => r.data),
}

export const carriersApi = {
  list: () => api.get<Carrier[]>('/settings/carriers').then((r) => r.data),
  create: (data: Partial<Carrier>) => api.post<Carrier>('/settings/carriers', data).then((r) => r.data),
  update: (id: string, data: Partial<Carrier>) =>
    api.put<Carrier>(`/settings/carriers/${id}`, data).then((r) => r.data),
  remove: (id: string) => api.delete(`/settings/carriers/${id}`),
}

export const voiceRoutingPoliciesApi = {
  list: () => api.get<VoiceRoutingPolicy[]>('/settings/voice-routing-policies').then((r) => r.data),
  create: (data: Partial<VoiceRoutingPolicy>) =>
    api.post<VoiceRoutingPolicy>('/settings/voice-routing-policies', data).then((r) => r.data),
  update: (id: string, data: Partial<VoiceRoutingPolicy>) =>
    api.put<VoiceRoutingPolicy>(`/settings/voice-routing-policies/${id}`, data).then((r) => r.data),
  remove: (id: string) => api.delete(`/settings/voice-routing-policies/${id}`),
  import: (policies: { name: string; description?: string }[]) =>
    api.post<{ success: number; failed: number; errors: { row: number; error: string }[] }>('/settings/voice-routing-policies/import', { policies }).then((r) => r.data),
}

export const dialPlansApi = {
  list: () => api.get<DialPlan[]>('/settings/dial-plans').then((r) => r.data),
  create: (data: Partial<DialPlan>) =>
    api.post<DialPlan>('/settings/dial-plans', data).then((r) => r.data),
  update: (id: string, data: Partial<DialPlan>) =>
    api.put<DialPlan>(`/settings/dial-plans/${id}`, data).then((r) => r.data),
  remove: (id: string) => api.delete(`/settings/dial-plans/${id}`),
  import: (policies: { name: string; description?: string }[]) =>
    api.post<{ success: number; failed: number; errors: { row: number; error: string }[] }>('/settings/dial-plans/import', { policies }).then((r) => r.data),
}

export const notificationsApi = {
  subscribe: (migrationId: string) =>
    api.post(`/migrations/${migrationId}/subscribe`).then((r) => r.data),
  unsubscribe: (migrationId: string) =>
    api.delete(`/migrations/${migrationId}/subscribe`).then((r) => r.data),
  getMySubscriptions: () =>
    api.get<string[]>('/notifications/my-subscriptions').then((r) => r.data),
}

export const auditApi = {
  list: (params?: { migration_id?: string; team_member_id?: string; action?: string; from?: string; to?: string; page?: number; limit?: number }) =>
    api.get<{ entries: AuditLogEntry[]; total: number }>('/settings/audit-log', { params }).then((r) => r.data),
}

export const migrationsApi = {
  list: (params?: { stage?: string }) =>
    api.get<Migration[]>('/migrations', { params }).then((r) => r.data),
  dashboard: () => api.get<Migration[]>('/migrations/dashboard').then((r) => r.data),
  get: (id: string) => api.get<Migration>(`/migrations/${id}`).then((r) => r.data),
  create: (data: Partial<Migration>) => api.post<Migration>('/migrations', data).then((r) => r.data),
  update: (id: string, data: Partial<Migration>) =>
    api.put<Migration>(`/migrations/${id}`, data).then((r) => r.data),

  // Workflow transitions
  updateStage: (id: string, stage: WorkflowStage) =>
    api.patch<Migration>(`/migrations/${id}/stage`, { stage }).then((r) => r.data),

  // Phase 1: Estimate
  updateEstimate: (id: string, data: {
    estimate_user_service_charge?: number
    estimate_equipment_charge?: number
    estimate_usage_charge?: number
    estimate_carrier_charge?: number
    estimate_phone_equipment_charge?: number
    estimate_headset_equipment_charge?: number
    estimate_notes?: string
  }) => api.patch<Migration>(`/migrations/${id}/estimate`, data).then((r) => r.data),
  acceptEstimate: (id: string) =>
    api.post<Migration>(`/migrations/${id}/accept-estimate`).then((r) => r.data),

  // Phase 2: Verizon
  updateVerizonRequest: (id: string, data: {
    billing_contact_name?: string
    billing_contact_email?: string
    billing_contact_phone?: string
    local_contact_name?: string
    local_contact_email?: string
    local_contact_phone?: string
    verizon_notes?: string
  }) => api.patch<Migration>(`/migrations/${id}/verizon-request`, data).then((r) => r.data),
  submitVerizonRequest: (id: string, email_sent_to: string) =>
    api.post<Migration>(`/migrations/${id}/submit-verizon`, { email_sent_to }).then((r) => r.data),
  completeVerizonSetup: (id: string, verizon_site_id?: string) =>
    api.post<Migration>(`/migrations/${id}/complete-verizon`, { verizon_site_id }).then((r) => r.data),

  // Phase 3: Porting
  updatePortingInfo: (id: string, data: {
    carrier_invoice_received?: boolean
    carrier_invoice_notes?: string
    carrier_account_number?: string
    carrier_pin?: string
    porting_notes?: string
  }) => api.patch<Migration>(`/migrations/${id}/porting`, data).then((r) => r.data),
  submitLoa: (id: string, loa_submitted_to: string) =>
    api.post<Migration>(`/migrations/${id}/submit-loa`, { loa_submitted_to }).then((r) => r.data),
  setFocDate: (id: string, foc_date: string, scheduled_port_date: string) =>
    api.post<Migration>(`/migrations/${id}/set-foc`, { foc_date, scheduled_port_date }).then((r) => r.data),
  completePorting: (id: string) =>
    api.post<Migration>(`/migrations/${id}/complete-porting`).then((r) => r.data),

  // Phase 4: User config
  generateMagicLink: (id: string, expires_in_days?: number) =>
    api.post<Migration & { magic_link_url: string }>(`/migrations/${id}/magic-link`, { expires_in_days }).then((r) => r.data),

  // Estimate link for customer acceptance
  generateEstimateLink: (id: string, expires_in_days?: number) =>
    api.post<Migration & { estimate_link_url: string }>(`/migrations/${id}/estimate-link`, { expires_in_days }).then((r) => r.data),

  // Questionnaire link for customer
  generateQuestionnaireLink: (id: string, expires_in_days?: number) =>
    api.post<Migration & { questionnaire_link_url: string }>(`/migrations/${id}/questionnaire-link`, { expires_in_days }).then((r) => r.data),

  delete: (id: string) => api.delete(`/migrations/${id}`),

  // Questionnaire bulk export
  listQuestionnaires: () =>
    api.get<Pick<Migration, 'id' | 'name' | 'site_name' | 'site_questionnaire'>[]>('/migrations/questionnaires').then(r => r.data),

  // Survey import
  importPreview: (rows: Record<string, unknown>[]) =>
    api.post<{ existing_ids: string[] }>('/migrations/import/preview', { rows }).then(r => r.data),
  importSurvey: (rows: Record<string, unknown>[]) =>
    api.post<{ created: number; skipped: number; errors: { row: number; error: string }[] }>('/migrations/import', { rows }).then(r => r.data),
}

export const usersApi = {
  list: (params?: { migration_id?: string }) =>
    api.get<EndUser[]>('/users', { params }).then((r) => r.data),
  get: (id: string) => api.get<EndUser>(`/users/${id}`).then((r) => r.data),
  create: (data: Partial<EndUser>) => api.post<EndUser>('/users', data).then((r) => r.data),
  import: (migration_id: string, users: Partial<EndUser>[]) =>
    api.post('/users/import', { migration_id, users }).then((r) => r.data),
  update: (id: string, data: Partial<EndUser>) =>
    api.put<EndUser>(`/users/${id}`, data).then((r) => r.data),
  delete: (id: string) => api.delete(`/users/${id}`),
}

export const phoneNumbersApi = {
  list: (params?: { migration_id?: string; status?: string }) =>
    api.get<PhoneNumber[]>('/phone-numbers', { params }).then((r) => r.data),
  get: (id: string) => api.get<PhoneNumber>(`/phone-numbers/${id}`).then((r) => r.data),
  create: (data: Partial<PhoneNumber>) =>
    api.post<PhoneNumber>('/phone-numbers', data).then((r) => r.data),
  import: (migration_id: string, numbers: Partial<PhoneNumber>[]) =>
    api.post('/phone-numbers/import', { migration_id, numbers }).then((r) => r.data),
  delete: (id: string) => api.delete(`/phone-numbers/${id}`),
}

export const scriptsApi = {
  list: (params?: { migration_id?: string }) =>
    api.get<GeneratedScript[]>('/scripts', { params }).then((r) => r.data),
  get: (id: string) => api.get<GeneratedScript>(`/scripts/${id}`).then((r) => r.data),
  generateUserAssignments: (migration_id: string) =>
    api.post<GeneratedScript>('/scripts/generate/user-assignments', { migration_id }).then((r) => r.data),
  generateAdPhoneNumbers: (migration_id: string) =>
    api.post<GeneratedScript>('/scripts/generate/ad-phone-numbers', { migration_id }).then((r) => r.data),
  delete: (id: string) => api.delete(`/scripts/${id}`),
}

// Public API (no auth)
export const publicApi = {
  getCollectPage: (token: string) =>
    api.get<{ migration: Partial<Migration>; users: EndUser[] }>(`/public/collect/${token}`).then((r) => r.data),
  submitUsers: (token: string, users: Partial<EndUser>[], submit: boolean = true) =>
    api.post<{ success: number; failed: number; errors: { row: number; error: string }[] }>(
      `/public/collect/${token}/users`,
      { users, submit }
    ).then((r) => r.data),
  // Estimate acceptance
  getEstimate: (token: string) =>
    api.get<{ migration: Partial<Migration> }>(`/public/estimate/${token}`).then((r) => r.data),
  acceptEstimate: (token: string, accepted_by?: string) =>
    api.post<{ success: boolean; message: string }>(`/public/estimate/${token}/accept`, { accepted_by }).then((r) => r.data),
  // Questionnaire
  getQuestionnaire: (token: string) =>
    api.get<{ migration: { name: string; site_name: string; site_questionnaire: Record<string, unknown>; questionnaire_submitted_at: string | null } }>(`/public/questionnaire/${token}`).then((r) => r.data),
  submitQuestionnaire: (token: string, data: Record<string, unknown>, submit: boolean) =>
    api.post<{ success: boolean; message: string }>(`/public/questionnaire/${token}/submit`, { data, submit }).then((r) => r.data),
}

export default api
