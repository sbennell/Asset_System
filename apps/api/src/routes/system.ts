import { Router, Request, Response } from 'express';
import { requireAdmin } from './auth.js';
import { existsSync, writeFileSync, unlinkSync, mkdirSync } from 'fs';
import { spawn } from 'child_process';
import path from 'path';

const router = Router();

// Derive paths from compiled output location (apps/api/dist/)
const appRoot = path.resolve(__dirname, '../../..');
const installPath = path.resolve(appRoot, '..');
const lockFile = path.join(installPath, 'logs', 'update.lock');
const updateLog = path.join(installPath, 'logs', 'update.log');

// POST /api/system/update - trigger update from GitHub (admin only, production only)
router.post('/update', requireAdmin, async (req: Request, res: Response) => {
  const isProduction = process.env.NODE_ENV === 'production';
  if (!isProduction) {
    return res.status(400).json({ error: 'Updates can only be triggered in production mode' });
  }

  // Check if already updating
  if (existsSync(lockFile)) {
    return res.status(409).json({ error: 'Update already in progress' });
  }

  // Ensure logs directory exists and write lock file
  const logsDir = path.join(installPath, 'logs');
  try {
    if (!existsSync(logsDir)) {
      mkdirSync(logsDir, { recursive: true });
    }
    writeFileSync(lockFile, new Date().toISOString(), 'utf8');
  } catch (err: any) {
    console.error('Failed to create update lock file:', err);
    return res.status(500).json({ error: `Failed to create update lock file: ${err.message}` });
  }

  // Build the PowerShell update script
  const dbPath = path.join(installPath, 'data', 'asset_system.db');
  const backupDir = path.join(installPath, 'backups');
  const logPath = updateLog;
  const lockPath = lockFile;
  const appPath = appRoot;

  const script = `
$ErrorActionPreference = "Continue"
$logFile = "${logPath}"

function Log { param($msg)
  $line = "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] $msg"
  $line | Out-File -FilePath $logFile -Append -Encoding UTF8
}

function Run-Step {
  param([string]$Command, [string]$StepName, [string]$WorkDir)
  Log "Running: $StepName"
  $stdout = "$env:TEMP\\_update_stdout.tmp"
  $stderr = "$env:TEMP\\_update_stderr.tmp"
  $proc = Start-Process -FilePath "cmd.exe" -ArgumentList "/c $Command" -WorkingDirectory $WorkDir -NoNewWindow -Wait -PassThru -RedirectStandardOutput $stdout -RedirectStandardError $stderr
  $out = Get-Content $stdout -Raw -ErrorAction SilentlyContinue
  $err = Get-Content $stderr -Raw -ErrorAction SilentlyContinue
  if ($out) { Log "  STDOUT: $out" }
  if ($err) { Log "  STDERR: $err" }
  Remove-Item $stdout, $stderr -Force -ErrorAction SilentlyContinue
  if ($proc.ExitCode -ne 0) {
    Log "ERROR: $StepName failed (exit code $($proc.ExitCode))"
    return $false
  }
  Log "$StepName completed"
  return $true
}

try {
  "========================================" | Out-File -FilePath $logFile -Encoding UTF8 -Force
  Log "Web-triggered update started"

  # Backup database
  Log "Backing up database..."
  $dbPath = "${dbPath}"
  $backupDir = "${backupDir}"
  if (-not (Test-Path $backupDir)) {
    New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
  }
  if (Test-Path $dbPath) {
    $date = Get-Date -Format "yyyy-MM-dd_HHmmss"
    Copy-Item $dbPath "$backupDir\\asset_system_pre-update_$date.db"
    Log "Database backed up"
  }

  # Stop service
  Log "Stopping service..."
  $svc = Get-Service -Name "AssetSystem" -ErrorAction SilentlyContinue
  if ($svc -and $svc.Status -eq "Running") {
    Stop-Service -Name "AssetSystem" -Force
    Start-Sleep -Seconds 3
    Log "Service stopped"
  } else {
    Log "Service not running"
  }

  # Pull latest code
  Log "Pulling latest code..."
  Push-Location "${appPath}"
  $stashResult = git stash 2>&1
  $hasStash = "$stashResult" -notlike "*No local changes*"
  $pullOutput = git pull origin main 2>&1
  $pullExit = $LASTEXITCODE
  if ($hasStash) { git stash pop 2>&1 | Out-Null }
  Pop-Location

  if ($pullExit -ne 0) {
    Log "ERROR: git pull failed: $pullOutput"
    throw "git pull failed"
  }
  Log "Code updated"

  # Install dependencies
  if (-not (Run-Step -Command "npm install" -StepName "npm install" -WorkDir "${appPath}")) {
    throw "npm install failed"
  }

  # Generate Prisma client
  if (-not (Run-Step -Command "npx prisma generate" -StepName "prisma generate" -WorkDir "${appPath}\\apps\\api")) {
    throw "prisma generate failed"
  }

  # Update database schema
  if (-not (Run-Step -Command "npx prisma db push --skip-generate" -StepName "prisma db push" -WorkDir "${appPath}\\apps\\api")) {
    throw "prisma db push failed"
  }

  # Build application
  if (-not (Run-Step -Command "npm run build" -StepName "npm run build" -WorkDir "${appPath}")) {
    throw "npm run build failed"
  }

  Log "Update completed successfully"

} catch {
  Log "Update failed: $_"
} finally {
  # Always remove lock file and restart service
  Remove-Item "${lockPath}" -Force -ErrorAction SilentlyContinue
  Log "Lock file removed"

  Log "Starting service..."
  Start-Service -Name "AssetSystem" -ErrorAction SilentlyContinue
  Start-Sleep -Seconds 3
  $svc = Get-Service -Name "AssetSystem" -ErrorAction SilentlyContinue
  if ($svc -and $svc.Status -eq "Running") {
    Log "Service started successfully"
  } else {
    Log "WARNING: Service may not have started"
  }
  Log "Update process finished"
}
`;

  // Write script to temp file
  const scriptPath = path.join(installPath, 'logs', '_web_update.ps1');
  try {
    writeFileSync(scriptPath, script, 'utf8');
  } catch (err: any) {
    unlinkSync(lockFile);
    console.error('Failed to write update script:', err);
    return res.status(500).json({ error: `Failed to write update script: ${err.message}` });
  }

  // Spawn a fully independent PowerShell process using Start-Process.
  // A simple detached child would be killed by NSSM when the service stops,
  // so we use PowerShell Start-Process to break out of the process tree.
  const child = spawn('powershell', [
    '-ExecutionPolicy', 'Bypass', '-Command',
    `Start-Process -FilePath 'powershell' -ArgumentList '-ExecutionPolicy Bypass -File "${scriptPath}"' -WindowStyle Hidden`
  ], {
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
  });
  child.unref();

  res.json({ status: 'updating' });
});

// GET /api/system/update-status - check if update is in progress
router.get('/update-status', requireAdmin, async (_req: Request, res: Response) => {
  res.json({ updating: existsSync(lockFile) });
});

export default router;
