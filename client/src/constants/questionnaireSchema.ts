export type FieldType = 'text' | 'number' | 'textarea' | 'boolean' | 'date'

export interface QuestionnaireField {
  key: string
  label: string
  type: FieldType
  placeholder?: string
}

export interface QuestionnaireSection {
  title: string
  fields: QuestionnaireField[]
}

export type QuestionnaireData = Record<string, string | number | boolean | null>

export const QUESTIONNAIRE_SECTIONS: QuestionnaireSection[] = [
  {
    title: 'Contact Information',
    fields: [
      { key: 'email', label: 'Email', type: 'text', placeholder: 'contact@company.com' },
      { key: 'name', label: 'Contact Name', type: 'text', placeholder: 'Full name' },
      { key: 'company_name', label: 'Company Name', type: 'text', placeholder: 'Company name' },
      { key: 'legal_entity_code', label: 'Legal Entity Code', type: 'text', placeholder: 'e.g. DE01' },
      { key: 'site_address', label: 'Site Address', type: 'textarea', placeholder: 'Full site address' },
      { key: 'project_requestor', label: 'Project Requestor', type: 'text', placeholder: 'Name of person requesting the project' },
      { key: 'head_of_location', label: 'Head of Location', type: 'text', placeholder: 'Name of location head' },
      { key: 'infrastructure_contact', label: 'Infrastructure Contact', type: 'text', placeholder: 'Name / email of infra contact' },
      { key: 'service_desk', label: 'Service Desk', type: 'text', placeholder: 'Service desk contact info' },
    ],
  },
  {
    title: 'Phone System',
    fields: [
      { key: 'phone_system_manufacturer', label: 'Phone System Manufacturer', type: 'text', placeholder: 'e.g. Avaya, Cisco, Mitel' },
      { key: 'phone_system_model', label: 'Phone System Model', type: 'text', placeholder: 'Model number or name' },
      { key: 'phone_system_age', label: 'Phone System Age (years)', type: 'number', placeholder: 'Age in years' },
      { key: 'phone_system_maintenance', label: 'Maintenance Contract Details', type: 'textarea', placeholder: 'Current maintenance/support contract details' },
      { key: 'telephony_provider', label: 'Telephony Provider', type: 'text', placeholder: 'Current telephony provider' },
      { key: 'provider_contract_term', label: 'Provider Contract Term', type: 'text', placeholder: 'e.g. 36 months, expires Dec 2025' },
      { key: 'earliest_cancel_date', label: 'Earliest Cancellation Date', type: 'date' },
      { key: 'connection_details', label: 'Connection Type & Details', type: 'textarea', placeholder: 'e.g. SIP trunk, PRI, analog lines' },
      { key: 'concurrent_channels', label: 'Concurrent Channels / Lines', type: 'number', placeholder: 'Number of concurrent channels' },
      { key: 'main_subscriber_range', label: 'Main Subscriber Number Range', type: 'text', placeholder: 'e.g. +49 30 1234 0-99' },
      { key: 'total_end_user_count', label: 'Total End User Count', type: 'number', placeholder: 'Number of end users' },
    ],
  },
  {
    title: 'Endpoints & Devices',
    fields: [
      { key: 'personal_desk_phones', label: 'Personal Desk Phones', type: 'number', placeholder: 'Count of desk phones' },
      { key: 'headset_percentage', label: 'Headset Usage (%)', type: 'number', placeholder: 'Percentage of users with headsets' },
      { key: 'headset_count', label: 'Headset Count', type: 'number', placeholder: 'Number of headsets needed' },
      { key: 'default_headset', label: 'Default Headset Model', type: 'text', placeholder: 'e.g. Jabra Evolve2 75' },
      { key: 'conference_room_devices', label: 'Conference Room Devices', type: 'number', placeholder: 'Count of conference devices' },
      { key: 'cordless_dect_in_use', label: 'Cordless / DECT in Use', type: 'boolean' },
      { key: 'dect_details', label: 'DECT System Details', type: 'textarea', placeholder: 'DECT manufacturer, model, coverage' },
      { key: 'dect_count', label: 'DECT Handset Count', type: 'number', placeholder: 'Number of DECT handsets' },
      { key: 'dect_smartphone_percentage', label: 'DECT Smartphone Replacement (%)', type: 'number', placeholder: 'Percentage replaceable by smartphone' },
      { key: 'mobile_standard_device', label: 'Mobile Standard Device', type: 'text', placeholder: 'e.g. iPhone 15, Samsung S24' },
      { key: 'special_endpoints', label: 'Special Endpoints Present', type: 'boolean' },
      { key: 'special_endpoint_config', label: 'Special Endpoint Configuration', type: 'textarea', placeholder: 'Elevator phones, door intercoms, fax, franking machines...' },
      { key: 'special_call_flow', label: 'Special Call Flows', type: 'textarea', placeholder: 'IVR trees, hunt groups, ring groups, call recording...' },
    ],
  },
  {
    title: 'Emergency & Network',
    fields: [
      { key: 'internal_emergency_number', label: 'Internal Emergency Number', type: 'text', placeholder: 'e.g. 112, 911' },
      { key: 'public_emergency_numbers', label: 'Public Emergency Numbers', type: 'textarea', placeholder: 'List all public emergency numbers' },
      { key: 'infrastructure_operator', label: 'Infrastructure Operator', type: 'text', placeholder: 'Name of infra operator' },
      { key: 'network_standard_planned', label: 'Network Standard Upgrade Planned', type: 'boolean' },
      { key: 'network_project_timeline', label: 'Network Project Timeline', type: 'text', placeholder: 'e.g. Q2 2025' },
      { key: 'lan_subnets', label: 'LAN Subnets', type: 'textarea', placeholder: 'Voice VLAN, data VLAN details' },
      { key: 'client_access_port_speed', label: 'Client Access Port Speed', type: 'text', placeholder: 'e.g. 1 Gbps' },
      { key: 'wlan_coverage', label: 'WLAN Coverage', type: 'text', placeholder: 'e.g. Full building, partial, none' },
      { key: 'redundant_wan', label: 'Redundant WAN Connection', type: 'boolean' },
      { key: 'wan_bandwidth', label: 'WAN Bandwidth', type: 'text', placeholder: 'e.g. 100 Mbps MPLS + 50 Mbps Internet' },
    ],
  },
]
