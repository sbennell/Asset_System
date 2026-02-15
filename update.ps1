#Requires -RunAsAdministrator
<#
.SYNOPSIS
    Updates the Asset Management System from GitHub.

.DESCRIPTION
    This script automates updating the Asset Management System:
    - Backs up the current database
    - Pulls latest code from GitHub
    - Installs/updates dependencies
    - Rebuilds the application
    - Runs database migrations
    - Restarts the Windows service

.PARAMETER InstallPath
    Base installation path. Default: C:\ICTMS

.PARAMETER Branch
    Git branch to pull from. Default: main

.PARAMETER SkipBackup
    Skip database backup before updating

.PARAMETER SkipService
    Skip service restart (for manual testing)

.EXAMPLE
    .\update.ps1

.EXAMPLE
    .\update.ps1 -InstallPath "D:\ICTMS" -Branch "develop"
#>

param(
    [string]$InstallPath = "C:\ICTMS",
    [string]$Branch = "main",
    [switch]$SkipBackup,
    [switch]$SkipService,
    [switch]$AutoUpdate
)

$ErrorActionPreference = "Stop"

# Colors for output
function Write-Step { param($msg) Write-Host "`n>> $msg" -ForegroundColor Cyan }
function Write-Success { param($msg) Write-Host "   $msg" -ForegroundColor Green }
function Write-Warn { param($msg) Write-Host "   $msg" -ForegroundColor Yellow }
function Write-Err { param($msg) Write-Host "   $msg" -ForegroundColor Red }

# Helper: run a command via cmd.exe, check exit code
function Invoke-NativeCommand {
    param(
        [string]$Command,
        [string]$StepName,
        [string]$WorkDir
    )
    $stdoutLog = "$InstallPath\logs\_update_stdout.tmp"
    $stderrLog = "$InstallPath\logs\_update_stderr.tmp"
    $process = Start-Process -FilePath "cmd.exe" -ArgumentList "/c $Command" -WorkingDirectory $WorkDir -NoNewWindow -Wait -PassThru -RedirectStandardOutput $stdoutLog -RedirectStandardError $stderrLog
    if ($process.ExitCode -ne 0) {
        $stderr = Get-Content $stderrLog -Raw -ErrorAction SilentlyContinue
        Write-Err "$StepName failed (exit code $($process.ExitCode))"
        if ($stderr) { Write-Host "   $stderr" -ForegroundColor Red }
        return $false
    }
    return $true
}

# Web-triggered update setup
if ($AutoUpdate) {
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
    $logDir = "$InstallPath\logs"
    if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Path $logDir -Force | Out-Null }
    Start-Transcript -Path "$logDir\update.log" -Force | Out-Null
}

try {

# Banner
Write-Host @"

============================================
  Asset Management System Updater
============================================

"@ -ForegroundColor Cyan

$AppPath = "$InstallPath\app"

# Verify installation exists
if (-not (Test-Path $AppPath)) {
    Write-Err "Installation not found at $AppPath"
    Write-Host "   Run install.ps1 first to install the application."
    exit 1
}

# Get current version
$currentVersion = "unknown"
$versionHistory = "$AppPath\VERSION_HISTORY.md"
if (Test-Path $versionHistory) {
    $match = Select-String -Path $versionHistory -Pattern '##\s*\[(\d+\.\d+\.\d+)\]' | Select-Object -First 1
    if ($match) {
        $currentVersion = $match.Matches[0].Groups[1].Value
    }
}
Write-Host "Install Path:    $InstallPath"
Write-Host "Current Version: $currentVersion"
Write-Host "Branch:          $Branch"
Write-Host ""

# Check for git
Write-Step "Checking prerequisites..."

$ErrorActionPreference = "Continue"
$gitVersion = git --version 2>&1
$ErrorActionPreference = "Stop"

if ($LASTEXITCODE -ne 0 -or -not $gitVersion) {
    Write-Err "Git is not installed!"
    Write-Host "   Please install Git from https://git-scm.com/"
    exit 1
}
Write-Success "Git found: $gitVersion"

# Check if it's a git repo
if (-not (Test-Path "$AppPath\.git")) {
    Write-Err "The app directory is not a git repository."
    Write-Host "   To enable updates, re-install by cloning from GitHub:"
    Write-Host "   git clone https://github.com/sbennell/Asset_System.git `"$AppPath`""
    exit 1
}

# Check for remote updates
Write-Step "Checking for updates..."

Push-Location $AppPath

$ErrorActionPreference = "Continue"
git fetch origin $Branch 2>&1 | Out-Null
$ErrorActionPreference = "Stop"

if ($LASTEXITCODE -ne 0) {
    Write-Err "Failed to fetch from remote. Check your internet connection."
    Pop-Location
    exit 1
}

$localHash = (git rev-parse HEAD 2>&1).Trim()
$remoteHash = (git rev-parse "origin/$Branch" 2>&1).Trim()

if ($localHash -eq $remoteHash) {
    Write-Success "Already up to date (v$currentVersion)"
    Write-Host ""
    Pop-Location
    exit 0
}

# Get new version from remote
$newVersion = "unknown"
$ErrorActionPreference = "Continue"
$remoteVersionContent = git show "origin/${Branch}:VERSION_HISTORY.md" 2>&1
$ErrorActionPreference = "Stop"
if ($remoteVersionContent) {
    $versionMatch = $remoteVersionContent | Select-String -Pattern '##\s*\[(\d+\.\d+\.\d+)\]' | Select-Object -First 1
    if ($versionMatch) {
        $newVersion = $versionMatch.Matches[0].Groups[1].Value
    }
}

Write-Success "Update available: v$currentVersion -> v$newVersion"

# Show commits to be applied
$ErrorActionPreference = "Continue"
$commits = git log --oneline "$localHash..$remoteHash" 2>&1
$ErrorActionPreference = "Stop"
if ($commits) {
    Write-Host ""
    Write-Host "   Changes:" -ForegroundColor Gray
    $commits | ForEach-Object { Write-Host "     $_" -ForegroundColor Gray }
    Write-Host ""
}

Pop-Location

# Confirm update
if (-not $AutoUpdate) {
    $confirm = Read-Host "Proceed with update? (Y/n)"
    if ($confirm -and $confirm -notin @("Y", "y", "Yes", "yes", "")) {
        Write-Host "Update cancelled."
        exit 0
    }
}

# Backup database
if (-not $SkipBackup) {
    Write-Step "Backing up database..."

    $dbPath = "$InstallPath\data\asset_system.db"
    $backupDir = "$InstallPath\backups"

    if (-not (Test-Path $backupDir)) {
        New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
    }

    if (Test-Path $dbPath) {
        $date = Get-Date -Format "yyyy-MM-dd_HHmmss"
        $backupFile = "$backupDir\asset_system_pre-update_$date.db"
        Copy-Item $dbPath $backupFile
        Write-Success "Database backed up: $backupFile"
    } else {
        Write-Warn "No database found at $dbPath, skipping backup"
    }
} else {
    Write-Warn "Skipping database backup (--SkipBackup)"
}

# Stop service
if (-not $SkipService) {
    Write-Step "Stopping service..."

    $service = Get-Service -Name "AssetSystem" -ErrorAction SilentlyContinue
    if ($service -and $service.Status -eq "Running") {
        Stop-Service -Name "AssetSystem" -Force
        Start-Sleep -Seconds 2
        Write-Success "Service stopped"
    } else {
        Write-Warn "Service not running or not found"
    }
}

# Pull latest code
Write-Step "Pulling latest code from GitHub..."

Push-Location $AppPath

# Stash any local changes (like .env)
$ErrorActionPreference = "Continue"
$stashResult = git stash 2>&1
$hasStash = "$stashResult" -notlike "*No local changes*"

# Pull latest
$pullOutput = git pull origin $Branch 2>&1
$pullExitCode = $LASTEXITCODE
$ErrorActionPreference = "Stop"

if ($pullExitCode -ne 0) {
    Write-Err "Git pull failed. You may have local conflicts."
    Write-Host "   Output: $pullOutput"
    Write-Host "   Try resolving manually in: $AppPath"
    if ($hasStash) {
        $ErrorActionPreference = "Continue"
        git stash pop 2>&1 | Out-Null
        $ErrorActionPreference = "Stop"
    }
    Pop-Location
    exit 1
}

# Restore stashed changes
if ($hasStash) {
    $ErrorActionPreference = "Continue"
    git stash pop 2>&1 | Out-Null
    $ErrorActionPreference = "Stop"
    Write-Success "Local configuration restored"
}

Write-Success "Code updated"
Pop-Location

# Install dependencies
Write-Step "Installing dependencies..."

if (-not (Invoke-NativeCommand -Command "npm install" -StepName "npm install" -WorkDir $AppPath)) {
    exit 1
}
Write-Success "Dependencies installed"

# Generate Prisma client
Write-Step "Generating Prisma client..."

if (-not (Invoke-NativeCommand -Command "npx prisma generate" -StepName "prisma generate" -WorkDir "$AppPath\apps\api")) {
    exit 1
}
Write-Success "Prisma client generated"

# Run database migrations
Write-Step "Updating database schema..."

if (-not (Invoke-NativeCommand -Command "npx prisma db push --skip-generate" -StepName "prisma db push" -WorkDir "$AppPath\apps\api")) {
    exit 1
}
Write-Success "Database schema updated"

# Build application
Write-Step "Building application..."

if (-not (Invoke-NativeCommand -Command "npm run build" -StepName "npm run build" -WorkDir $AppPath)) {
    exit 1
}
Write-Success "Application built successfully"

# Start service
if (-not $SkipService) {
    Write-Step "Starting service..."

    $service = Get-Service -Name "AssetSystem" -ErrorAction SilentlyContinue
    if ($service) {
        Start-Service -Name "AssetSystem"
        Start-Sleep -Seconds 3

        $service = Get-Service -Name "AssetSystem"
        if ($service.Status -eq "Running") {
            Write-Success "Service started successfully"
        } else {
            Write-Warn "Service may not have started. Check logs at $InstallPath\logs\"
        }
    } else {
        Write-Warn "Service not found. Start the application manually."
    }
}

# Get updated version
$updatedVersion = "unknown"
if (Test-Path $versionHistory) {
    $match = Select-String -Path $versionHistory -Pattern '##\s*\[(\d+\.\d+\.\d+)\]' | Select-Object -First 1
    if ($match) {
        $updatedVersion = $match.Matches[0].Groups[1].Value
    }
}

# Get server IP for display
$ipAddress = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.InterfaceAlias -notlike "*Loopback*" -and $_.IPAddress -notlike "169.*" } | Select-Object -First 1).IPAddress

# Complete
Write-Host @"

============================================
  Update Complete!
============================================

"@ -ForegroundColor Green

Write-Host "Updated:  v$currentVersion -> v$updatedVersion"
Write-Host "URL:      " -NoNewline
Write-Host "http://${ipAddress}:3001" -ForegroundColor Yellow
Write-Host ""
Write-Host "Logs:     $InstallPath\logs\"
Write-Host "Backup:   $InstallPath\backups\"
Write-Host ""

} finally {
    if ($AutoUpdate) {
        # Ensure service is running (even if update failed after stopping it)
        $svc = Get-Service -Name "AssetSystem" -ErrorAction SilentlyContinue
        if ($svc -and $svc.Status -ne "Running") {
            Start-Service -Name "AssetSystem" -ErrorAction SilentlyContinue
            Start-Sleep -Seconds 5
        }
        Stop-Transcript -ErrorAction SilentlyContinue | Out-Null
    }
}
