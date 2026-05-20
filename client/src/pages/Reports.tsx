import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { BarChart3, Download, Calendar, Users, CheckCircle, TrendingUp, ClipboardList, PauseCircle, MapPin, Printer, Copy, FileText, Check } from 'lucide-react'
import { migrationsApi, teamApi, locationsApi, formatRoutingType, effectiveUserCount } from '../services/api'
import { QUESTIONNAIRE_SECTIONS, type QuestionnaireData } from '../constants/questionnaireSchema'
import { useDensityPreference } from '../hooks/useDensityPreference'

// Format carrier name for display
function formatCarrierName(carrier: string): string {
  const names: Record<string, string> = {
    verizon: 'Verizon',
    fusionconnect: 'FusionConnect',
    gtt: 'GTT',
  }
  return names[carrier?.toLowerCase()] || carrier || 'Carrier'
}

// Get phase name from workflow stage
function getPhaseFromStage(stage: string): string {
  if (stage === 'estimate') return 'Cost Estimate'
  if (['estimate_accepted', 'verizon_submitted', 'verizon_in_progress'].includes(stage)) return 'Carrier Setup'
  if (['verizon_complete', 'porting_submitted', 'porting_scheduled'].includes(stage)) return 'Number Porting'
  if (['porting_complete', 'user_config'].includes(stage)) return 'Teams Config'
  if (stage === 'completed') return 'Completed'
  return stage
}

export default function Reports() {
  const [density] = useDensityPreference()
  const rowCls = density === 'compact' ? 'px-2 py-1 text-xs' : 'px-3 py-2.5 text-sm'
  const { data: migrations, isLoading } = useQuery({
    queryKey: ['migrations', 'dashboard'],
    queryFn: migrationsApi.dashboard,
  })

  const { data: questionnaires } = useQuery({
    queryKey: ['migrations', 'questionnaires'],
    queryFn: migrationsApi.listQuestionnaires,
  })

  const { data: locations = [] } = useQuery({
    queryKey: ['locations'],
    queryFn: locationsApi.list,
  })

  const [exportingAll, setExportingAll] = useState(false)
  const [statusReportCopied, setStatusReportCopied] = useState<'html' | 'text' | null>(null)

  if (isLoading) {
    return <div className="text-center py-12 text-zinc-500">Loading...</div>
  }

  // Calculate summary data
  const activeMigrations = migrations?.filter(m => !['completed', 'cancelled', 'on_hold'].includes(m.workflow_stage)) || []
  const completedMigrations = migrations?.filter(m => m.workflow_stage === 'completed') || []
  const onHoldCount = migrations?.filter(m => m.workflow_stage === 'on_hold').length || 0

  // Count by phase
  const byPhase = {
    estimate: activeMigrations.filter(m => m.workflow_stage === 'estimate').length,
    carrierSetup: activeMigrations.filter(m => ['estimate_accepted', 'verizon_submitted', 'verizon_in_progress'].includes(m.workflow_stage)).length,
    porting: activeMigrations.filter(m => ['verizon_complete', 'porting_submitted', 'porting_scheduled'].includes(m.workflow_stage)).length,
    teamsConfig: activeMigrations.filter(m => ['porting_complete', 'user_config'].includes(m.workflow_stage)).length,
  }

  // Upcoming ports (next 30 days)
  const now = new Date()
  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
  const upcomingPorts = activeMigrations
    .filter(m => m.scheduled_port_date && new Date(m.scheduled_port_date) >= now && new Date(m.scheduled_port_date) <= thirtyDaysFromNow)
    .sort((a, b) => new Date(a.scheduled_port_date!).getTime() - new Date(b.scheduled_port_date!).getTime())

  // Recently completed (last 30 days)
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  const recentlyCompleted = completedMigrations
    .filter(m => m.completed_at && new Date(m.completed_at) >= thirtyDaysAgo)
    .sort((a, b) => new Date(b.completed_at!).getTime() - new Date(a.completed_at!).getTime())

  // Total users across active migrations
  const totalActiveUsers = activeMigrations.reduce((sum, m) => sum + effectiveUserCount(m), 0)
  const totalCompletedUsers = completedMigrations.reduce((sum, m) => sum + effectiveUserCount(m), 0)

  // === Project Status Report data ===
  const onHoldMigrations = migrations?.filter(m => m.workflow_stage === 'on_hold') || []

  // Sort: completed by completion date (newest first), in-progress by stage_number,
  // on-hold by on_hold_at (newest first)
  const completedSorted = [...completedMigrations].sort((a, b) => {
    const ad = a.completed_at ? new Date(a.completed_at).getTime() : 0
    const bd = b.completed_at ? new Date(b.completed_at).getTime() : 0
    return bd - ad
  })
  const inProgressSorted = [...activeMigrations].sort((a, b) => (b.stage_number || 0) - (a.stage_number || 0))
  const onHoldSorted = [...onHoldMigrations].sort((a, b) => {
    const ad = a.on_hold_at ? new Date(a.on_hold_at).getTime() : 0
    const bd = b.on_hold_at ? new Date(b.on_hold_at).getTime() : 0
    return bd - ad
  })

  const reportDate = new Date().toLocaleDateString()
  const totalProjects = completedMigrations.length + activeMigrations.length + onHoldMigrations.length
  const completedPct = totalProjects > 0 ? Math.round((completedMigrations.length / totalProjects) * 100) : 0

  const fmtDate = (d: string | null | undefined) => d ? new Date(d).toLocaleDateString() : ''
  const niceStage = (s: string | null | undefined) => (s || '').replace(/_/g, ' ')

  // Build the rich-HTML version of the status report (used by Copy for Email).
  // Uses inline styles only — Outlook/Gmail strip class names but keep these.
  const buildStatusReportHTML = (): string => {
    const baseFont = 'font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;'
    const sectionStyle = `${baseFont}margin:0 0 24px 0;`
    const h1Style = `${baseFont}font-size:18px;font-weight:600;margin:0 0 4px 0;color:#111;`
    const subStyle = `${baseFont}font-size:12px;color:#666;margin:0 0 16px 0;`
    const sectionHeadGreen = `${baseFont}background:#10b981;color:#fff;font-weight:600;padding:6px 10px;font-size:13px;`
    const sectionHeadAmber = `${baseFont}background:#f59e0b;color:#fff;font-weight:600;padding:6px 10px;font-size:13px;`
    const sectionHeadGrey = `${baseFont}background:#71717a;color:#fff;font-weight:600;padding:6px 10px;font-size:13px;`
    const itemStyle = `${baseFont}padding:8px 10px;border-bottom:1px solid #e5e5e5;font-size:13px;color:#222;`
    const codeStyle = 'font-weight:600;color:#0369a1;font-family:Consolas,Menlo,monospace;'
    const reasonStyle = 'background:#fef3c7;color:#78350f;padding:4px 8px;border-radius:4px;display:inline-block;margin-top:4px;font-style:italic;'

    const completedRows = completedSorted.map(m => `
      <div style="${itemStyle}">
        <span style="${codeStyle}">${m.name}</span>
        <span style="color:#666"> — ${m.site_name}${m.site_city ? ', ' + m.site_city : ''}${m.site_country ? ', ' + m.site_country : ''}</span>
        <div style="font-size:12px;color:#666;margin-top:2px">
          ${m.completed_at ? 'Completed ' + fmtDate(m.completed_at) + ' &middot; ' : ''}${effectiveUserCount(m)} users &middot; ${formatCarrierName(m.target_carrier)}
        </div>
      </div>`).join('')

    const inProgressRows = inProgressSorted.map(m => {
      const dateLine = m.scheduled_port_date ? `Port: ${fmtDate(m.scheduled_port_date)}`
        : m.foc_date ? `FOC: ${fmtDate(m.foc_date)}`
        : m.verizon_request_submitted_at ? `Submitted: ${fmtDate(m.verizon_request_submitted_at)}`
        : ''
      return `
      <div style="${itemStyle}">
        <span style="${codeStyle}">${m.name}</span>
        <span style="color:#666"> — ${m.site_name}${m.site_city ? ', ' + m.site_city : ''}${m.site_country ? ', ' + m.site_country : ''}</span>
        <div style="font-size:12px;color:#666;margin-top:2px">
          ${getPhaseFromStage(m.workflow_stage)} (${niceStage(m.workflow_stage)}) &middot; ${effectiveUserCount(m)} users
          ${dateLine ? ' &middot; ' + dateLine : ''}
          ${m.assigned_to_name ? ' &middot; ' + m.assigned_to_name : ''}
        </div>
      </div>`
    }).join('')

    const onHoldRows = onHoldSorted.map(m => {
      const reason = m.on_hold_reason
      const since = m.on_hold_at
      const prev = m.on_hold_previous_stage
      return `
      <div style="${itemStyle}">
        <span style="${codeStyle}">${m.name}</span>
        <span style="color:#666"> — ${m.site_name}${m.site_city ? ', ' + m.site_city : ''}${m.site_country ? ', ' + m.site_country : ''}</span>
        <div style="font-size:12px;color:#666;margin-top:2px">
          ${since ? 'On hold since ' + fmtDate(since) : 'On hold'}${prev ? ' &middot; Was in ' + niceStage(prev) : ''} &middot; ${effectiveUserCount(m)} users
        </div>
        ${reason ? `<div style="margin-top:4px"><span style="${reasonStyle}">Reason: ${reason}</span></div>` : ''}
      </div>`
    }).join('')

    return `<div style="${baseFont}max-width:760px;color:#222;">
      <h1 style="${h1Style}">Project Status Report</h1>
      <p style="${subStyle}">${reportDate} &middot; ${totalProjects} total projects (${completedPct}% complete)</p>

      <div style="${sectionStyle}border:1px solid #e5e5e5;">
        <div style="${sectionHeadGreen}">Completed (${completedSorted.length})</div>
        ${completedRows || `<div style="${itemStyle}color:#888;">No completed projects.</div>`}
      </div>

      <div style="${sectionStyle}border:1px solid #e5e5e5;">
        <div style="${sectionHeadAmber}">In Progress (${inProgressSorted.length})</div>
        ${inProgressRows || `<div style="${itemStyle}color:#888;">No projects in progress.</div>`}
      </div>

      <div style="${sectionStyle}border:1px solid #e5e5e5;">
        <div style="${sectionHeadGrey}">On Hold (${onHoldSorted.length})</div>
        ${onHoldRows || `<div style="${itemStyle}color:#888;">No projects on hold.</div>`}
      </div>
    </div>`
  }

  // Plain-text fallback
  const buildStatusReportPlainText = (): string => {
    const sep = '-'.repeat(60)
    const lines: string[] = []
    lines.push(`PROJECT STATUS REPORT — ${reportDate}`)
    lines.push(`${totalProjects} total projects · ${completedPct}% complete`)
    lines.push('')
    lines.push(`COMPLETED (${completedSorted.length})`)
    lines.push(sep)
    if (completedSorted.length === 0) lines.push('  (none)')
    completedSorted.forEach(m => {
      lines.push(`• ${m.name} — ${m.site_name}${m.site_city ? ', ' + m.site_city : ''}${m.site_country ? ', ' + m.site_country : ''}`)
      lines.push(`    ${m.completed_at ? 'Completed ' + fmtDate(m.completed_at) + ' · ' : ''}${effectiveUserCount(m)} users · ${formatCarrierName(m.target_carrier)}`)
    })
    lines.push('')
    lines.push(`IN PROGRESS (${inProgressSorted.length})`)
    lines.push(sep)
    if (inProgressSorted.length === 0) lines.push('  (none)')
    inProgressSorted.forEach(m => {
      const dateLine = m.scheduled_port_date ? `Port: ${fmtDate(m.scheduled_port_date)}`
        : m.foc_date ? `FOC: ${fmtDate(m.foc_date)}`
        : m.verizon_request_submitted_at ? `Submitted: ${fmtDate(m.verizon_request_submitted_at)}`
        : ''
      lines.push(`• ${m.name} — ${m.site_name}${m.site_city ? ', ' + m.site_city : ''}${m.site_country ? ', ' + m.site_country : ''}`)
      const meta = [
        `${getPhaseFromStage(m.workflow_stage)} (${niceStage(m.workflow_stage)})`,
        `${effectiveUserCount(m)} users`,
        dateLine,
        m.assigned_to_name || '',
      ].filter(Boolean).join(' · ')
      lines.push(`    ${meta}`)
    })
    lines.push('')
    lines.push(`ON HOLD (${onHoldSorted.length})`)
    lines.push(sep)
    if (onHoldSorted.length === 0) lines.push('  (none)')
    onHoldSorted.forEach(m => {
      const reason = m.on_hold_reason
      const since = m.on_hold_at
      const prev = m.on_hold_previous_stage
      lines.push(`• ${m.name} — ${m.site_name}${m.site_city ? ', ' + m.site_city : ''}${m.site_country ? ', ' + m.site_country : ''}`)
      lines.push(`    ${since ? 'On hold since ' + fmtDate(since) : 'On hold'}${prev ? ' · Was in ' + niceStage(prev) : ''} · ${effectiveUserCount(m)} users`)
      if (reason) lines.push(`    Reason: ${reason}`)
    })
    return lines.join('\n')
  }

  const handleCopyForEmail = async () => {
    const html = buildStatusReportHTML()
    const container = document.createElement('div')
    container.contentEditable = 'true'
    container.innerHTML = html
    container.style.position = 'fixed'
    container.style.top = '0'
    container.style.left = '-99999px'
    container.style.opacity = '0'
    document.body.appendChild(container)
    try {
      const range = document.createRange()
      range.selectNodeContents(container)
      const sel = window.getSelection()
      sel?.removeAllRanges()
      sel?.addRange(range)
      document.execCommand('copy')
      sel?.removeAllRanges()
      setStatusReportCopied('html')
      setTimeout(() => setStatusReportCopied(null), 2000)
    } finally {
      document.body.removeChild(container)
    }
  }

  const handleCopyAsText = async () => {
    try {
      await navigator.clipboard.writeText(buildStatusReportPlainText())
      setStatusReportCopied('text')
      setTimeout(() => setStatusReportCopied(null), 2000)
    } catch { /* ignore */ }
  }

  const handlePrintReport = () => {
    window.print()
  }

  // Export functions
  const exportActiveMigrations = () => {
    const headers = ['Project Name', 'Site Name', 'Carrier', 'Routing Type', 'Phase', 'Status', 'Users', 'Submitted Date', 'FOC Date', 'Port Date']
    const rows = activeMigrations.map(m => [
      m.name,
      m.site_name,
      formatCarrierName(m.target_carrier),
      formatRoutingType(m.routing_type),
      getPhaseFromStage(m.workflow_stage),
      m.workflow_stage.replace('_', ' '),
      effectiveUserCount(m),
      m.verizon_request_submitted_at ? new Date(m.verizon_request_submitted_at).toLocaleDateString() : '',
      m.foc_date ? new Date(m.foc_date).toLocaleDateString() : '',
      m.scheduled_port_date ? new Date(m.scheduled_port_date).toLocaleDateString() : '',
    ])

    downloadCSV(headers, rows, 'active-migrations.csv')
  }

  const exportCompletedMigrations = () => {
    const headers = ['Project Name', 'Site Name', 'Carrier', 'Routing Type', 'Users', 'Created Date', 'Completed Date']
    const rows = completedMigrations.map(m => [
      m.name,
      m.site_name,
      formatCarrierName(m.target_carrier),
      formatRoutingType(m.routing_type),
      effectiveUserCount(m),
      new Date(m.created_at).toLocaleDateString(),
      m.completed_at ? new Date(m.completed_at).toLocaleDateString() : '',
    ])

    downloadCSV(headers, rows, 'completed-migrations.csv')
  }

  const exportAllMigrations = async () => {
    setExportingAll(true)
    try {
      const [allMigrations, teamMembers] = await Promise.all([
        migrationsApi.list(),
        teamApi.list().catch(() => []),
      ])
      const memberMap = new Map(teamMembers.map(t => [t.id, t.display_name]))

      const headers = [
        // Project info
        'Project Name', 'Site Name', 'City', 'State', 'Country',
        'Carrier', 'Routing Type', 'Currency', 'Phase', 'Status',
        'Assigned To',
        // Counts
        'Telephone Users', 'Total Users', 'Total Numbers', 'Ported Numbers', 'Configured Users',
        // Estimate totals
        'Estimate Monthly', 'Estimate Annual', 'Estimate One-time',
        'Estimate User Service', 'Estimate Carrier Charge', 'Estimate Usage',
        'Estimate Phone Equipment', 'Estimate Headset Equipment',
        // Calculator details
        'Calculator Method', 'Desk Phones', 'Smartphones', 'Headsets',
        'Desk Phone Unit Cost', 'Smartphone Unit Cost', 'Headset Unit Cost',
        'User Service Rate', 'Carrier Monthly Flat', 'Activation Fee',
        'Current PBX Maintenance (Annual)', 'Current Carrier (Annual)', 'Current Usage (Annual)',
        // Key dates
        'Created Date', 'Estimate Accepted', 'Accepted By',
        'Carrier Submitted', 'Carrier Completed', 'Carrier Site ID',
        'LOA Submitted', 'FOC Date', 'Scheduled Port Date', 'Actual Port Date',
        'Completed Date',
        // Notes
        'Estimate Notes',
      ]

      const rows = allMigrations.map(m => {
        const calc = (m.cost_calculator || {}) as Record<string, unknown>
        const hasCalc = m.cost_calculator && 'total_users' in calc
        const method = hasCalc ? String(calc.selected_method || '') : ''

        // Derive device counts from calculator if available
        let deskPhones = '', smartphones = '', headsetCount = ''
        if (hasCalc && method) {
          const dp = method === 'A' ? calc.desk_phones_a : method === 'B' ? calc.desk_phones_b : calc.desk_phones_c
          deskPhones = String(dp ?? '')
          if (method === 'A') smartphones = String(calc.dect_phones ?? '')
          else if (method === 'B') smartphones = String(calc.smartphones_b ?? '')
          else smartphones = String(Math.round(Number(calc.dect_phones || 0) * 0.5))
          if (method === 'A') headsetCount = String(Math.max(Number(calc.total_users || 0) - Number(calc.existing_headsets || 0), 0) + Number(calc.additional_headsets || 0))
          else if (method === 'B') headsetCount = String(calc.headsets_b ?? '')
          else headsetCount = String(Math.round(Number(calc.total_users || 0) * 0.2) + Number(calc.additional_headsets || 0))
        }

        const fmtDate = (d: string | null | undefined) => d ? new Date(d).toLocaleDateString() : ''
        const fmtNum = (v: unknown) => { const n = Number(v); return isNaN(n) ? '' : n.toFixed(2) }

        return [
          m.name,
          m.site_name,
          m.site_city || '',
          m.site_state || '',
          m.site_country || '',
          formatCarrierName(m.target_carrier),
          formatRoutingType(m.routing_type),
          m.currency || 'USD',
          getPhaseFromStage(m.workflow_stage),
          m.workflow_stage.replace(/_/g, ' '),
          (m.assigned_to && memberMap.get(m.assigned_to)) || '',
          m.telephone_users,
          m.total_users,
          m.total_numbers,
          m.ported_numbers,
          m.configured_users,
          fmtNum(m.estimate_total_monthly),
          fmtNum(Number(m.estimate_total_monthly || 0) * 12),
          fmtNum(m.estimate_total_onetime),
          fmtNum(m.estimate_user_service_charge),
          fmtNum(m.estimate_carrier_charge),
          fmtNum(m.estimate_usage_charge),
          fmtNum(m.estimate_phone_equipment_charge),
          fmtNum(m.estimate_headset_equipment_charge),
          method,
          deskPhones,
          smartphones,
          headsetCount,
          hasCalc ? fmtNum(calc.desk_phone_cost) : '',
          hasCalc ? fmtNum(calc.smartphone_cost) : '',
          hasCalc ? fmtNum(calc.headset_cost) : '',
          hasCalc ? fmtNum(calc.user_service_rate) : '',
          hasCalc ? fmtNum(calc.carrier_monthly_flat) : '',
          hasCalc ? fmtNum(calc.activation_fee) : '',
          hasCalc ? fmtNum(calc.pbx_maintenance_annual) : '',
          hasCalc ? fmtNum(calc.carrier_annual) : '',
          hasCalc ? fmtNum(calc.usage_annual) : '',
          fmtDate(m.created_at),
          fmtDate(m.estimate_accepted_at),
          m.estimate_accepted_by || '',
          fmtDate(m.verizon_request_submitted_at),
          fmtDate(m.verizon_setup_complete_at),
          m.verizon_site_id || '',
          fmtDate(m.loa_submitted_at),
          fmtDate(m.foc_date),
          fmtDate(m.scheduled_port_date),
          fmtDate(m.actual_port_date),
          fmtDate(m.completed_at),
          m.estimate_notes || '',
        ]
      })

      downloadCSV(headers, rows, 'all-migrations-full.csv')
    } catch {
      // silently fail
    } finally {
      setExportingAll(false)
    }
  }

  const escapeCSV = (value: string): string => {
    const str = String(value)
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return '"' + str.replace(/"/g, '""') + '"'
    }
    return str
  }

  const downloadCSV = (headers: string[], rows: (string | number)[][], filename: string) => {
    const csvContent = [
      headers.map(h => escapeCSV(h)).join(','),
      ...rows.map(row => row.map(cell => escapeCSV(String(cell))).join(','))
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const exportQuestionnaires = () => {
    if (!questionnaires || questionnaires.length === 0) return
    const allFields = QUESTIONNAIRE_SECTIONS.flatMap(s => s.fields)
    const headers = ['Site Name', ...allFields.map(f => f.label)]
    const rows = questionnaires.map(m => {
      const qData = (m.site_questionnaire || {}) as QuestionnaireData
      return [
        m.site_name,
        ...allFields.map(f => {
          const raw = qData[f.key]
          if (raw == null || raw === '') return ''
          if (typeof raw === 'boolean') return raw ? 'Yes' : 'No'
          return String(raw)
        }),
      ]
    })
    downloadCSV(headers, rows, 'questionnaires.csv')
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100 flex items-center gap-3">
            <BarChart3 className="h-6 w-6 text-primary-400" />
            Reports
          </h1>
          <p className="text-zinc-500">Migration status summary and exports</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={exportAllMigrations}
            className="btn btn-primary flex items-center gap-2"
            disabled={!migrations || migrations.length === 0 || exportingAll}
          >
            <Download className="h-4 w-4" />
            {exportingAll ? 'Exporting...' : `Export All (${migrations?.length || 0})`}
          </button>
          <button
            onClick={exportActiveMigrations}
            className="btn btn-secondary flex items-center gap-2"
            disabled={activeMigrations.length === 0}
          >
            <Download className="h-4 w-4" />
            Active ({activeMigrations.length})
          </button>
          <button
            onClick={exportCompletedMigrations}
            className="btn btn-secondary flex items-center gap-2"
            disabled={completedMigrations.length === 0}
          >
            <Download className="h-4 w-4" />
            Completed ({completedMigrations.length})
          </button>
          <button
            onClick={exportQuestionnaires}
            className="btn btn-secondary flex items-center gap-2"
            disabled={!questionnaires || questionnaires.length === 0}
          >
            <ClipboardList className="h-4 w-4" />
            Questionnaires ({questionnaires?.length || 0})
          </button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="card">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary-500/20 rounded-lg border border-primary-500/30">
              <TrendingUp className="h-6 w-6 text-primary-400" />
            </div>
            <div>
              <p className="text-sm text-zinc-500">Active</p>
              <p className="text-2xl font-bold text-zinc-100">{activeMigrations.length}</p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-500/20 rounded-lg border border-green-500/30">
              <CheckCircle className="h-6 w-6 text-green-400" />
            </div>
            <div>
              <p className="text-sm text-zinc-500">Completed</p>
              <p className="text-2xl font-bold text-zinc-100">{completedMigrations.length}</p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/20 rounded-lg border border-amber-500/30">
              <PauseCircle className="h-6 w-6 text-amber-400" />
            </div>
            <div>
              <p className="text-sm text-zinc-500">On Hold</p>
              <p className="text-2xl font-bold text-zinc-100">{onHoldCount}</p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500/20 rounded-lg border border-purple-500/30">
              <Users className="h-6 w-6 text-purple-400" />
            </div>
            <div>
              <p className="text-sm text-zinc-500">Users (Active)</p>
              <p className="text-2xl font-bold text-zinc-100">{totalActiveUsers}</p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/20 rounded-lg border border-amber-500/30">
              <Calendar className="h-6 w-6 text-amber-400" />
            </div>
            <div>
              <p className="text-sm text-zinc-500">Upcoming Ports</p>
              <p className="text-2xl font-bold text-zinc-100">{upcomingPorts.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Project Status Report (executive snapshot) */}
      <div className="card status-report" id="status-report">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-4 no-print">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary-400" />
            <h2 className="text-lg font-semibold text-zinc-100">Project Status Report</h2>
            <span className="text-xs text-zinc-500">{reportDate}</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleCopyForEmail} className="btn btn-secondary text-sm flex items-center gap-2">
              {statusReportCopied === 'html' ? <><Check className="h-4 w-4 text-green-400" /> Copied</> : <><Copy className="h-4 w-4" /> Copy for Email</>}
            </button>
            <button onClick={handleCopyAsText} className="btn btn-secondary text-sm flex items-center gap-2">
              {statusReportCopied === 'text' ? <><Check className="h-4 w-4 text-green-400" /> Copied</> : <><Copy className="h-4 w-4" /> Copy as Text</>}
            </button>
            <button onClick={handlePrintReport} className="btn btn-secondary text-sm flex items-center gap-2">
              <Printer className="h-4 w-4" />
              Print
            </button>
          </div>
        </div>

        <div className="text-xs text-zinc-500 mb-4 print-only" style={{ display: 'none' }}>
          Generated {reportDate} · {totalProjects} total projects · {completedPct}% complete
        </div>
        <div className="text-sm text-zinc-400 mb-4 no-print">
          {totalProjects} total projects · <span className="text-green-400">{completedMigrations.length} completed ({completedPct}%)</span> · <span className="text-amber-400">{activeMigrations.length} in progress</span> · <span className="text-zinc-300">{onHoldMigrations.length} on hold</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Completed */}
          <div className="border border-green-500/20 rounded-lg overflow-hidden">
            <div className="bg-green-500/15 border-b border-green-500/20 px-3 py-2 flex items-center justify-between">
              <span className="text-sm font-semibold text-green-300 flex items-center gap-2">
                <CheckCircle className="h-4 w-4" /> Completed
              </span>
              <span className="text-xs text-green-400 font-mono">{completedSorted.length}</span>
            </div>
            <div className="divide-y divide-surface-700 max-h-[28rem] overflow-auto">
              {completedSorted.length === 0 && <div className="px-3 py-3 text-xs text-zinc-500">No completed projects.</div>}
              {completedSorted.map(m => (
                <div key={m.id} className={rowCls}>
                  <div>
                    <span className="font-mono font-semibold text-primary-400">{m.name}</span>
                    <span className="text-zinc-500"> — {m.site_name}{m.site_city && `, ${m.site_city}`}{m.site_country && `, ${m.site_country}`}</span>
                  </div>
                  <div className="text-xs text-zinc-500 mt-0.5">
                    {m.completed_at && <>Completed {fmtDate(m.completed_at)} · </>}
                    {effectiveUserCount(m)} users · {formatCarrierName(m.target_carrier)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* In Progress */}
          <div className="border border-amber-500/20 rounded-lg overflow-hidden">
            <div className="bg-amber-500/15 border-b border-amber-500/20 px-3 py-2 flex items-center justify-between">
              <span className="text-sm font-semibold text-amber-300 flex items-center gap-2">
                <TrendingUp className="h-4 w-4" /> In Progress
              </span>
              <span className="text-xs text-amber-400 font-mono">{inProgressSorted.length}</span>
            </div>
            <div className="divide-y divide-surface-700 max-h-[28rem] overflow-auto">
              {inProgressSorted.length === 0 && <div className="px-3 py-3 text-xs text-zinc-500">No projects in progress.</div>}
              {inProgressSorted.map(m => {
                const dateLine = m.scheduled_port_date ? `Port: ${fmtDate(m.scheduled_port_date)}`
                  : m.foc_date ? `FOC: ${fmtDate(m.foc_date)}`
                  : m.verizon_request_submitted_at ? `Submitted: ${fmtDate(m.verizon_request_submitted_at)}`
                  : ''
                return (
                  <div key={m.id} className={rowCls}>
                    <div>
                      <span className="font-mono font-semibold text-primary-400">{m.name}</span>
                      <span className="text-zinc-500"> — {m.site_name}{m.site_city && `, ${m.site_city}`}{m.site_country && `, ${m.site_country}`}</span>
                    </div>
                    <div className="text-xs text-zinc-500 mt-0.5">
                      {getPhaseFromStage(m.workflow_stage)} <span className="text-zinc-600">({niceStage(m.workflow_stage)})</span> · {effectiveUserCount(m)} users
                      {dateLine && <> · {dateLine}</>}
                      {m.assigned_to_name && <> · {m.assigned_to_name}</>}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* On Hold */}
          <div className="border border-zinc-500/30 rounded-lg overflow-hidden">
            <div className="bg-zinc-500/15 border-b border-zinc-500/30 px-3 py-2 flex items-center justify-between">
              <span className="text-sm font-semibold text-zinc-300 flex items-center gap-2">
                <PauseCircle className="h-4 w-4" /> On Hold
              </span>
              <span className="text-xs text-zinc-400 font-mono">{onHoldSorted.length}</span>
            </div>
            <div className="divide-y divide-surface-700 max-h-[28rem] overflow-auto">
              {onHoldSorted.length === 0 && <div className="px-3 py-3 text-xs text-zinc-500">No projects on hold.</div>}
              {onHoldSorted.map(m => {
                const reason = m.on_hold_reason
                const since = m.on_hold_at
                const prev = m.on_hold_previous_stage
                return (
                  <div key={m.id} className={rowCls}>
                    <div>
                      <span className="font-mono font-semibold text-primary-400">{m.name}</span>
                      <span className="text-zinc-500"> — {m.site_name}{m.site_city && `, ${m.site_city}`}{m.site_country && `, ${m.site_country}`}</span>
                    </div>
                    <div className="text-xs text-zinc-500 mt-0.5">
                      {since ? `On hold since ${fmtDate(since)}` : 'On hold'}{prev && ` · Was in ${niceStage(prev)}`} · {effectiveUserCount(m)} users
                    </div>
                    {reason && (
                      <div className="text-xs text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded px-2 py-1 mt-1.5 italic">
                        Reason: {reason}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* By Phase */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="h-5 w-5 text-primary-400" />
            <h2 className="text-lg font-semibold text-zinc-100">Active by Phase</h2>
          </div>
          <div className="space-y-3">
            <PhaseBar label="Cost Estimate" count={byPhase.estimate} total={activeMigrations.length} color="bg-zinc-500" />
            <PhaseBar label="Carrier Setup" count={byPhase.carrierSetup} total={activeMigrations.length} color="bg-red-500" />
            <PhaseBar label="Number Porting" count={byPhase.porting} total={activeMigrations.length} color="bg-amber-500" />
            <PhaseBar label="Teams Config" count={byPhase.teamsConfig} total={activeMigrations.length} color="bg-purple-500" />
          </div>
        </div>

        {/* Upcoming Ports */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <Calendar className="h-5 w-5 text-amber-400" />
            <h2 className="text-lg font-semibold text-zinc-100">Upcoming Ports (30 days)</h2>
          </div>
          {upcomingPorts.length === 0 ? (
            <p className="text-zinc-500 text-sm">No ports scheduled in the next 30 days</p>
          ) : (
            <div className="space-y-2">
              {upcomingPorts.slice(0, 5).map(m => (
                <div key={m.id} className="flex items-center justify-between p-2 bg-surface-700/50 rounded-lg">
                  <div>
                    <p className="text-zinc-200 font-medium">{m.name}</p>
                    <p className="text-zinc-500 text-xs">{m.site_name}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-amber-400 font-mono text-sm">
                      {new Date(m.scheduled_port_date!).toLocaleDateString()}
                    </p>
                    <p className="text-zinc-500 text-xs">{effectiveUserCount(m)} users</p>
                  </div>
                </div>
              ))}
              {upcomingPorts.length > 5 && (
                <p className="text-zinc-500 text-xs text-center">+{upcomingPorts.length - 5} more</p>
              )}
            </div>
          )}
        </div>

        {/* Recently Completed */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <CheckCircle className="h-5 w-5 text-green-400" />
            <h2 className="text-lg font-semibold text-zinc-100">Recently Completed (30 days)</h2>
          </div>
          {recentlyCompleted.length === 0 ? (
            <p className="text-zinc-500 text-sm">No migrations completed in the last 30 days</p>
          ) : (
            <div className="space-y-2">
              {recentlyCompleted.slice(0, 5).map(m => (
                <div key={m.id} className="flex items-center justify-between p-2 bg-green-500/10 rounded-lg border border-green-500/20">
                  <div>
                    <p className="text-zinc-200 font-medium">{m.name}</p>
                    <p className="text-zinc-500 text-xs">{m.site_name}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-green-400 font-mono text-sm">
                      {m.completed_at && new Date(m.completed_at).toLocaleDateString()}
                    </p>
                    <p className="text-zinc-500 text-xs">{effectiveUserCount(m)} users</p>
                  </div>
                </div>
              ))}
              {recentlyCompleted.length > 5 && (
                <p className="text-zinc-500 text-xs text-center">+{recentlyCompleted.length - 5} more</p>
              )}
            </div>
          )}
        </div>

        {/* Users Summary */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <Users className="h-5 w-5 text-purple-400" />
            <h2 className="text-lg font-semibold text-zinc-100">User Summary</h2>
          </div>
          <div className="space-y-4">
            <div className="flex justify-between items-center p-3 bg-surface-700/50 rounded-lg">
              <span className="text-zinc-400">Active Migration Users</span>
              <span className="text-2xl font-bold text-zinc-100">{totalActiveUsers}</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-green-500/10 rounded-lg border border-green-500/20">
              <span className="text-zinc-400">Completed Migration Users</span>
              <span className="text-2xl font-bold text-green-400">{totalCompletedUsers}</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-primary-500/10 rounded-lg border border-primary-500/20">
              <span className="text-zinc-400">Total Users (All Time)</span>
              <span className="text-2xl font-bold text-primary-400">{totalActiveUsers + totalCompletedUsers}</span>
            </div>
          </div>
        </div>

        {/* Locations Coverage */}
        {locations.length > 0 && (() => {
          const total = locations.length
          const completed = locations.filter(l => l.status === 'completed').length
          const inProgress = locations.filter(l => l.status === 'in_progress').length
          const planned = locations.filter(l => l.status === 'planned').length
          const onHold = locations.filter(l => l.status === 'on_hold').length
          const completedPct = total > 0 ? (completed / total) * 100 : 0

          // Region breakdown
          const byRegion: Record<string, { total: number; completed: number }> = {}
          locations.forEach(l => {
            const r = l.region || 'Unspecified'
            if (!byRegion[r]) byRegion[r] = { total: 0, completed: 0 }
            byRegion[r].total++
            if (l.status === 'completed') byRegion[r].completed++
          })

          return (
            <div className="card lg:col-span-2">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-primary-400" />
                  <h2 className="text-lg font-semibold text-zinc-100">Locations Coverage</h2>
                </div>
                <a href="/locations" className="text-xs text-primary-400 hover:text-primary-300">View all locations →</a>
              </div>

              {/* Overall progress */}
              <div className="mb-5">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-zinc-300">{completed} of {total} sites completed</span>
                  <span className="text-primary-400 font-mono">{completedPct.toFixed(0)}%</span>
                </div>
                <div className="h-3 bg-surface-700 rounded-full overflow-hidden flex">
                  <div className="h-full bg-green-500 transition-all duration-500" style={{ width: `${completedPct}%` }} />
                  <div className="h-full bg-amber-500 transition-all duration-500" style={{ width: `${(inProgress / total) * 100}%` }} />
                  <div className="h-full bg-zinc-500 transition-all duration-500" style={{ width: `${(planned / total) * 100}%` }} />
                  <div className="h-full bg-zinc-600 transition-all duration-500" style={{ width: `${(onHold / total) * 100}%` }} />
                </div>
                <div className="flex flex-wrap gap-3 mt-2 text-xs">
                  <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-green-500" /><span className="text-zinc-400">Completed {completed}</span></span>
                  <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-500" /><span className="text-zinc-400">In Progress {inProgress}</span></span>
                  <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-zinc-500" /><span className="text-zinc-400">Planned {planned}</span></span>
                  {onHold > 0 && <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-zinc-600" /><span className="text-zinc-400">On Hold {onHold}</span></span>}
                </div>
              </div>

              {/* By region */}
              {Object.keys(byRegion).length > 0 && (
                <div>
                  <h3 className="text-xs uppercase tracking-wider text-zinc-500 mb-2">By Region</h3>
                  <div className="space-y-2">
                    {Object.entries(byRegion).sort().map(([region, stats]) => {
                      const pct = stats.total > 0 ? (stats.completed / stats.total) * 100 : 0
                      return (
                        <div key={region}>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-zinc-300 font-medium">{region}</span>
                            <span className="text-zinc-500 font-mono">{stats.completed}/{stats.total} · {pct.toFixed(0)}%</span>
                          </div>
                          <div className="h-1.5 bg-surface-700 rounded-full overflow-hidden">
                            <div className="h-full bg-green-500 transition-all duration-500" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )
        })()}
      </div>
    </div>
  )
}

// Phase progress bar component
function PhaseBar({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const percentage = total > 0 ? (count / total) * 100 : 0

  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="text-zinc-400">{label}</span>
        <span className="text-zinc-200 font-mono">{count}</span>
      </div>
      <div className="h-2 bg-surface-700 rounded-full overflow-hidden">
        <div
          className={`h-full ${color} transition-all duration-500`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  )
}
