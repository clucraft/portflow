<#
.SYNOPSIS
    Exports Dial Plans and Voice Routing Policies from Microsoft Teams for import into PortFlow.

.DESCRIPTION
    Connects to Microsoft Teams PowerShell and exports:
      - Tenant Dial Plans → DialPlans.csv
      - Online Voice Routing Policies → VoiceRoutingPolicies.csv

    The resulting CSV files can be uploaded directly in PortFlow → Settings → Policies.

.NOTES
    Requires the MicrosoftTeams PowerShell module.
    Install with: Install-Module MicrosoftTeams -Scope CurrentUser
#>

#Requires -Modules MicrosoftTeams

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# Verify Teams connection
try {
    $null = Get-CsTenant -ErrorAction Stop
    Write-Host "Connected to Teams tenant." -ForegroundColor Green
} catch {
    Write-Host "Not connected to Microsoft Teams. Connecting..." -ForegroundColor Yellow
    Connect-MicrosoftTeams
}

# --- Export Dial Plans ---
Write-Host "Exporting Dial Plans..." -ForegroundColor Cyan
$dialPlans = Get-CsTenantDialPlan | ForEach-Object {
    [PSCustomObject]@{
        name        = ($_.Identity -replace '^Tag:', '')
        description = $_.Description
    }
}

if ($dialPlans) {
    $dialPlans | Export-Csv -Path ".\DialPlans.csv" -NoTypeInformation -Encoding UTF8
    Write-Host "  Exported $($dialPlans.Count) dial plan(s) to DialPlans.csv" -ForegroundColor Green
} else {
    Write-Host "  No tenant dial plans found." -ForegroundColor Yellow
}

# --- Export Voice Routing Policies ---
Write-Host "Exporting Voice Routing Policies..." -ForegroundColor Cyan
$vrps = Get-CsOnlineVoiceRoutingPolicy | Where-Object { $_.Identity -ne 'Global' } | ForEach-Object {
    [PSCustomObject]@{
        name        = ($_.Identity -replace '^Tag:', '')
        description = $_.Description
    }
}

if ($vrps) {
    $vrps | Export-Csv -Path ".\VoiceRoutingPolicies.csv" -NoTypeInformation -Encoding UTF8
    Write-Host "  Exported $($vrps.Count) voice routing policy(ies) to VoiceRoutingPolicies.csv" -ForegroundColor Green
} else {
    Write-Host "  No voice routing policies found." -ForegroundColor Yellow
}

Write-Host "`nDone! Upload the CSV files in PortFlow → Settings → Policies." -ForegroundColor Green
