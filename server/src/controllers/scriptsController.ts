import { Request, Response, NextFunction } from 'express';
import { query } from '../utils/db.js';
import { ApiError } from '../middleware/errorHandler.js';
import { EndUser, PhoneNumber, ResourceAccount, AutoAttendant, CallQueue, Migration } from '../types/index.js';

interface GeneratedScript {
  id: string;
  migration_id: string;
  script_type: string;
  name: string;
  description: string | null;
  script_content: string;
  was_executed: boolean;
  executed_at: Date | null;
  generated_at: Date;
}

interface UserWithNumber {
  id: string;
  display_name: string;
  upn: string;
  phone_number: string;
  department: string | null;
}

export const list = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { migration_id } = req.query;

    let sql = 'SELECT * FROM generated_scripts WHERE 1=1';
    const params: unknown[] = [];

    if (migration_id) {
      params.push(migration_id);
      sql += ` AND migration_id = $${params.length}`;
    }

    sql += ' ORDER BY generated_at DESC';

    const scripts = await query<GeneratedScript>(sql, params);
    res.json(scripts);
  } catch (err) {
    next(err);
  }
};

export const getById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const scripts = await query<GeneratedScript>('SELECT * FROM generated_scripts WHERE id = $1', [id]);

    if (scripts.length === 0) {
      throw ApiError.notFound('Script not found');
    }

    res.json(scripts[0]);
  } catch (err) {
    next(err);
  }
};

export const generateUserAssignments = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { migration_id } = req.body;

    if (!migration_id) {
      throw ApiError.badRequest('migration_id is required');
    }

    // Get migration details
    const migrations = await query<Migration>(
      'SELECT * FROM migrations WHERE id = $1',
      [migration_id]
    );

    if (migrations.length === 0) {
      throw ApiError.notFound('Migration not found');
    }

    const migration = migrations[0];

    // Get users with phone numbers (phone_number is directly on end_users)
    const usersWithNumbers = await query<UserWithNumber>(
      `SELECT id, display_name, upn, phone_number, department
       FROM end_users
       WHERE migration_id = $1 AND phone_number IS NOT NULL AND phone_number != ''
       ORDER BY display_name`,
      [migration_id]
    );

    if (usersWithNumbers.length === 0) {
      throw ApiError.badRequest('No users with assigned phone numbers found');
    }

    // Generate PowerShell script
    let script = `# PortFlow - User Phone Number Assignment Script
# Migration: ${migration.name}
# Generated: ${new Date().toISOString()}
# Total Users: ${usersWithNumbers.length}
#
# Prerequisites:
#   - Microsoft Teams PowerShell Module installed
#   - Connected to Microsoft Teams: Connect-MicrosoftTeams
#   - Appropriate admin permissions
#
# Usage: Run this script after connecting to Microsoft Teams
# ============================================================

# Connect to Microsoft Teams (uncomment if not already connected)
# Connect-MicrosoftTeams

Write-Host "Starting phone number assignments for ${migration.name}..." -ForegroundColor Cyan
Write-Host "Total users to process: ${usersWithNumbers.length}" -ForegroundColor Cyan
Write-Host ""

$successCount = 0
$failCount = 0
$errors = @()

`;

    const phoneNumberType = migration.routing_type === 'direct_routing' ? 'DirectRouting'
      : migration.routing_type === 'calling_plan' ? 'CallingPlan' : 'OperatorConnect';
    const voiceRoutingPolicyParam = migration.routing_type === 'direct_routing' && migration.voice_routing_policy
      ? `\n    Grant-CsOnlineVoiceRoutingPolicy -Identity "${'{upn}'}" -PolicyName "${migration.voice_routing_policy}"`
      : '';
    const dialPlanParam = migration.dial_plan
      ? `\n    Grant-CsTenantDialPlan -Identity "${'{upn}'}" -PolicyName "${migration.dial_plan}"`
      : '';

    for (const user of usersWithNumbers) {
      const userVrpLine = voiceRoutingPolicyParam.replace('{upn}', user.upn);
      const userDialPlanLine = dialPlanParam.replace('{upn}', user.upn);
      script += `# ${user.display_name}${user.department ? ` (${user.department})` : ''}
try {
    Write-Host "Assigning ${user.phone_number} to ${user.upn}..." -NoNewline
    Set-CsPhoneNumberAssignment -Identity "${user.upn}" -PhoneNumber "${user.phone_number}" -PhoneNumberType ${phoneNumberType}${userVrpLine}${userDialPlanLine}
    Write-Host " SUCCESS" -ForegroundColor Green
    $successCount++
} catch {
    Write-Host " FAILED: \$(\$_.Exception.Message)" -ForegroundColor Red
    $failCount++
    \$errors += @{ User = "${user.upn}"; Error = \$_.Exception.Message }
}

`;
    }

    script += `# Summary
Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "Assignment Complete" -ForegroundColor Cyan
Write-Host "  Successful: $successCount" -ForegroundColor Green
Write-Host "  Failed: $failCount" -ForegroundColor $(if ($failCount -gt 0) { "Red" } else { "Green" })
Write-Host "============================================" -ForegroundColor Cyan

if ($errors.Count -gt 0) {
    Write-Host ""
    Write-Host "Failed Assignments:" -ForegroundColor Red
    $errors | ForEach-Object {
        Write-Host "  $($_.User): $($_.Error)" -ForegroundColor Red
    }
}
`;

    // Save script to database
    const savedScripts = await query<GeneratedScript>(
      `INSERT INTO generated_scripts (migration_id, script_type, name, description, script_content)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        migration_id,
        'user_assignment',
        `${migration.site_name} - ${migration.name}`,
        `Assigns phone numbers to ${usersWithNumbers.length} users`,
        script,
      ]
    );

    res.status(201).json(savedScripts[0]);
  } catch (err) {
    next(err);
  }
};

export const generateResourceAccounts = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { migration_id } = req.body;

    if (!migration_id) {
      throw ApiError.badRequest('migration_id is required');
    }

    const resourceAccounts = await query<ResourceAccount>(
      'SELECT * FROM resource_accounts WHERE migration_id = $1 ORDER BY display_name',
      [migration_id]
    );

    if (resourceAccounts.length === 0) {
      throw ApiError.badRequest('No resource accounts found for this migration');
    }

    const migrations = await query<Migration>('SELECT * FROM migrations WHERE id = $1', [migration_id]);
    const migration = migrations[0];

    let script = `# PortFlow - Resource Account Creation Script
# Migration: ${migration.name}
# Generated: ${new Date().toISOString()}
# Total Resource Accounts: ${resourceAccounts.length}
#
# Prerequisites:
#   - Microsoft Teams PowerShell Module installed
#   - Microsoft Graph PowerShell Module installed
#   - Connected to Microsoft Teams: Connect-MicrosoftTeams
#   - Appropriate admin permissions
#
# ============================================================

Write-Host "Creating resource accounts for ${migration.name}..." -ForegroundColor Cyan
Write-Host ""

`;

    for (const ra of resourceAccounts) {
      const appType = ra.account_type === 'auto_attendant'
        ? 'ce933385-9390-45d1-9512-c8d228074e07'  // Auto Attendant
        : '11cd3e2e-fccb-42ad-ad00-878b93575e07'; // Call Queue

      script += `# ${ra.display_name} (${ra.account_type})
try {
    Write-Host "Creating resource account: ${ra.upn}..." -NoNewline
    New-CsOnlineApplicationInstance -UserPrincipalName "${ra.upn}" -DisplayName "${ra.display_name}" -ApplicationId "${appType}"
    Write-Host " SUCCESS" -ForegroundColor Green
} catch {
    Write-Host " FAILED: $($_.Exception.Message)" -ForegroundColor Red
}

`;
    }

    script += `
Write-Host ""
Write-Host "Resource account creation complete." -ForegroundColor Cyan
Write-Host "Note: You must assign licenses to these resource accounts before assigning phone numbers." -ForegroundColor Yellow
`;

    const savedScripts = await query<GeneratedScript>(
      `INSERT INTO generated_scripts (migration_id, script_type, name, description, script_content)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        migration_id,
        'resource_account',
        `Resource Accounts - ${new Date().toLocaleDateString()}`,
        `Creates ${resourceAccounts.length} resource accounts`,
        script,
      ]
    );

    res.status(201).json(savedScripts[0]);
  } catch (err) {
    next(err);
  }
};

export const generateAutoAttendant = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const autoAttendants = await query<AutoAttendant>(
      `SELECT aa.*, ra.upn as resource_account_upn
       FROM auto_attendants aa
       LEFT JOIN resource_accounts ra ON aa.resource_account_id = ra.id
       WHERE aa.id = $1`,
      [id]
    );

    if (autoAttendants.length === 0) {
      throw ApiError.notFound('Auto Attendant not found');
    }

    const aa = autoAttendants[0] as AutoAttendant & { resource_account_upn?: string; phone_number?: string };

    let script = `# PortFlow - Auto Attendant Creation Script
# Auto Attendant: ${aa.name}
# Generated: ${new Date().toISOString()}
#
# Prerequisites:
#   - Microsoft Teams PowerShell Module installed
#   - Connected to Microsoft Teams: Connect-MicrosoftTeams
#   - Resource account already created: ${aa.resource_account_upn || 'N/A'}
#
# ============================================================

`;

    // Build menu options
    const menuOptionsScript = aa.menu_options
      ? (aa.menu_options as Array<{ key: string; action: string; target: string; prompt: string }>)
          .map((opt) => `    New-CsAutoAttendantMenuOption -DtmfResponse Tone${opt.key} -Action TransferCallToTarget -CallTarget (New-CsAutoAttendantCallableEntity -Identity "${opt.target}" -Type User)`)
          .join('\n')
      : '';

    script += `# Create the Auto Attendant
$aaParams = @{
    Name = "${aa.name}"
    LanguageId = "${aa.language_id}"
    TimeZoneId = "${aa.timezone}"
    DefaultCallFlow = New-CsAutoAttendantCallFlow -Name "Default" -Menu (
        New-CsAutoAttendantMenu -Name "Main Menu" -MenuOptions @(
${menuOptionsScript || '            # Add menu options here'}
        )
    )
}

`;

    if (aa.greeting_text) {
      script += `# Add greeting
$aaParams.DefaultCallFlow.Greetings = @(
    New-CsAutoAttendantPrompt -TextToSpeechPrompt "${aa.greeting_text}"
)

`;
    }

    script += `try {
    Write-Host "Creating Auto Attendant: ${aa.name}..." -NoNewline
    $aa = New-CsAutoAttendant @aaParams
    Write-Host " SUCCESS" -ForegroundColor Green
    Write-Host "Auto Attendant ID: $($aa.Identity)"
`;

    if (aa.resource_account_upn) {
      script += `
    # Associate with resource account
    Write-Host "Associating with resource account..." -NoNewline
    $raInstance = Get-CsOnlineApplicationInstance -Identity "${aa.resource_account_upn}"
    New-CsOnlineApplicationInstanceAssociation -Identities @($raInstance.ObjectId) -ConfigurationId $aa.Identity -ConfigurationType AutoAttendant
    Write-Host " SUCCESS" -ForegroundColor Green
`;
    }

    script += `} catch {
    Write-Host " FAILED: $($_.Exception.Message)" -ForegroundColor Red
}
`;

    const savedScripts = await query<GeneratedScript>(
      `INSERT INTO generated_scripts (migration_id, script_type, name, description, script_content)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        aa.migration_id,
        'auto_attendant',
        `Auto Attendant - ${aa.name}`,
        `Creates auto attendant: ${aa.name}`,
        script,
      ]
    );

    res.status(201).json(savedScripts[0]);
  } catch (err) {
    next(err);
  }
};

export const generateCallQueue = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const callQueues = await query<CallQueue>(
      `SELECT cq.*, ra.upn as resource_account_upn
       FROM call_queues cq
       LEFT JOIN resource_accounts ra ON cq.resource_account_id = ra.id
       WHERE cq.id = $1`,
      [id]
    );

    if (callQueues.length === 0) {
      throw ApiError.notFound('Call Queue not found');
    }

    const cq = callQueues[0] as CallQueue & { resource_account_upn?: string };

    // Get agents from agent_ids JSONB array
    let agents: { upn: string; display_name: string }[] = [];
    if (cq.agent_ids && cq.agent_ids.length > 0) {
      agents = await query<{ upn: string; display_name: string }>(
        `SELECT upn, display_name FROM end_users WHERE id = ANY($1::uuid[])`,
        [cq.agent_ids]
      );
    }

    let script = `# PortFlow - Call Queue Creation Script
# Call Queue: ${cq.name}
# Generated: ${new Date().toISOString()}
# Agents: ${agents.length}
#
# Prerequisites:
#   - Microsoft Teams PowerShell Module installed
#   - Connected to Microsoft Teams: Connect-MicrosoftTeams
#   - Resource account already created: ${cq.resource_account_upn || 'N/A'}
#
# ============================================================

`;

    // Build agents list
    if (agents.length > 0) {
      script += `# Get agent object IDs
$agents = @()
`;
      for (const agent of agents) {
        script += `$agents += (Get-CsOnlineUser -Identity "${agent.upn}").Identity  # ${agent.display_name}
`;
      }
      script += '\n';
    }

    const routingMethodMap: Record<string, string> = {
      attendant: 'Attendant',
      serial: 'Serial',
      round_robin: 'RoundRobin',
      longest_idle: 'LongestIdle',
    };

    script += `# Create the Call Queue
$cqParams = @{
    Name = "${cq.name}"
    LanguageId = "${cq.language_id}"
    RoutingMethod = "${routingMethodMap[cq.routing_method] || 'Attendant'}"
`;

    if (agents.length > 0) {
      script += `    Users = $agents
`;
    }

    script += `}

`;

    if (cq.greeting_text) {
      script += `# Add greeting
$cqParams.WelcomeMusicAudioFilePrompt = New-CsAutoAttendantPrompt -TextToSpeechPrompt "${cq.greeting_text}"

`;
    }

    script += `try {
    Write-Host "Creating Call Queue: ${cq.name}..." -NoNewline
    $cq = New-CsCallQueue @cqParams
    Write-Host " SUCCESS" -ForegroundColor Green
    Write-Host "Call Queue ID: $($cq.Identity)"
`;

    if (cq.resource_account_upn) {
      script += `
    # Associate with resource account
    Write-Host "Associating with resource account..." -NoNewline
    $raInstance = Get-CsOnlineApplicationInstance -Identity "${cq.resource_account_upn}"
    New-CsOnlineApplicationInstanceAssociation -Identities @($raInstance.ObjectId) -ConfigurationId $cq.Identity -ConfigurationType CallQueue
    Write-Host " SUCCESS" -ForegroundColor Green
`;
    }

    script += `} catch {
    Write-Host " FAILED: $($_.Exception.Message)" -ForegroundColor Red
}
`;

    const savedScripts = await query<GeneratedScript>(
      `INSERT INTO generated_scripts (migration_id, script_type, name, description, script_content)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        cq.migration_id,
        'call_queue',
        `Call Queue - ${cq.name}`,
        `Creates call queue: ${cq.name} with ${agents.length} agents`,
        script,
      ]
    );

    res.status(201).json(savedScripts[0]);
  } catch (err) {
    next(err);
  }
};

export const generateFullMigration = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { migrationId } = req.params;

    // This would combine all scripts for the migration
    // For now, return a placeholder that references the individual scripts

    const migrations = await query<Migration>('SELECT * FROM migrations WHERE id = $1', [migrationId]);

    if (migrations.length === 0) {
      throw ApiError.notFound('Migration not found');
    }

    const migration = migrations[0];

    const script = `# PortFlow - Full Migration Script
# Migration: ${migration.name}
# Generated: ${new Date().toISOString()}
#
# This is a master script that runs all migration steps in order.
# Review each section before running.
#
# ============================================================

# Step 1: Connect to Microsoft Teams
Connect-MicrosoftTeams

# Step 2: Create Resource Accounts
# Generate and run the Resource Accounts script first

# Step 3: Assign licenses to Resource Accounts (manual step in M365 Admin Center)

# Step 4: Create Auto Attendants
# Generate and run Auto Attendant scripts

# Step 5: Create Call Queues
# Generate and run Call Queue scripts

# Step 6: Assign phone numbers to users
# Generate and run User Assignment script

# Step 7: Assign phone numbers to Resource Accounts
# This is done when associating numbers with AA/CQ

Write-Host "Migration steps complete. Verify all configurations in Teams Admin Center." -ForegroundColor Green
`;

    const savedScripts = await query<GeneratedScript>(
      `INSERT INTO generated_scripts (migration_id, script_type, name, description, script_content)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        migrationId,
        'full_migration',
        `Full Migration - ${migration.name}`,
        'Master script with all migration steps',
        script,
      ]
    );

    res.status(201).json(savedScripts[0]);
  } catch (err) {
    next(err);
  }
};

export const generateAdPhoneNumbers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { migration_id } = req.body;

    if (!migration_id) {
      throw ApiError.badRequest('migration_id is required');
    }

    // Get migration details
    const migrations = await query<Migration>(
      'SELECT * FROM migrations WHERE id = $1',
      [migration_id]
    );

    if (migrations.length === 0) {
      throw ApiError.notFound('Migration not found');
    }

    const migration = migrations[0];

    // Get users with phone numbers
    const usersWithNumbers = await query<UserWithNumber>(
      `SELECT id, display_name, upn, phone_number, department
       FROM end_users
       WHERE migration_id = $1 AND phone_number IS NOT NULL AND phone_number != ''
       ORDER BY display_name`,
      [migration_id]
    );

    if (usersWithNumbers.length === 0) {
      throw ApiError.badRequest('No users with assigned phone numbers found');
    }

    // Generate PowerShell script for AD phone number updates
    let script = `# PortFlow - Active Directory Phone Number Update Script
# Migration: ${migration.name}
# Generated: ${new Date().toISOString()}
# Total Users: ${usersWithNumbers.length}
#
# Prerequisites:
#   - Active Directory PowerShell Module installed
#   - Appropriate AD permissions to modify user attributes
#
# Usage: Run this script on a domain controller or machine with RSAT tools
# ============================================================

# Import Active Directory module (uncomment if not already loaded)
# Import-Module ActiveDirectory

Write-Host "Starting AD phone number updates for ${migration.name}..." -ForegroundColor Cyan
Write-Host "Total users to process: ${usersWithNumbers.length}" -ForegroundColor Cyan
Write-Host ""

$successCount = 0
$failCount = 0
$errors = @()

`;

    for (const user of usersWithNumbers) {
      // Format phone number for E.164 (remove any existing formatting first)
      const cleanNumber = user.phone_number.replace(/[^0-9+]/g, '');

      script += `# ${user.display_name}${user.department ? ` (${user.department})` : ''}
try {
    Write-Host "Updating phone number for ${user.upn}..." -NoNewline
    Set-ADUser -Identity "${user.upn}" -Replace @{telephoneNumber="${cleanNumber}"}
    Write-Host " SUCCESS" -ForegroundColor Green
    $successCount++
} catch {
    Write-Host " FAILED: \$(\$_.Exception.Message)" -ForegroundColor Red
    $failCount++
    \$errors += @{ User = "${user.upn}"; Error = \$_.Exception.Message }
}

`;
    }

    script += `# Summary
Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "AD Phone Number Update Complete" -ForegroundColor Cyan
Write-Host "  Successful: $successCount" -ForegroundColor Green
Write-Host "  Failed: $failCount" -ForegroundColor $(if ($failCount -gt 0) { "Red" } else { "Green" })
Write-Host "============================================" -ForegroundColor Cyan

if ($errors.Count -gt 0) {
    Write-Host ""
    Write-Host "Failed Updates:" -ForegroundColor Red
    $errors | ForEach-Object {
        Write-Host "  $($_.User): $($_.Error)" -ForegroundColor Red
    }
}
`;

    // Save script to database
    const savedScripts = await query<GeneratedScript>(
      `INSERT INTO generated_scripts (migration_id, script_type, name, description, script_content)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        migration_id,
        'ad_phone_numbers',
        `${migration.site_name} - ${migration.name} (AD)`,
        `Updates AD phone numbers for ${usersWithNumbers.length} users`,
        script,
      ]
    );

    res.status(201).json(savedScripts[0]);
  } catch (err) {
    next(err);
  }
};

export const remove = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const result = await query('DELETE FROM generated_scripts WHERE id = $1 RETURNING id', [id]);

    if (result.length === 0) {
      throw ApiError.notFound('Script not found');
    }

    res.status(204).send();
  } catch (err) {
    next(err);
  }
};
