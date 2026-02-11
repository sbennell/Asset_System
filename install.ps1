#Requires -RunAsAdministrator
<#
.SYNOPSIS
    Installs the Asset Management System on Windows Server.

.DESCRIPTION
    This script automates the installation of the Asset Management System including:
    - Creating directory structure
    - Installing dependencies
    - Building the application
    - Configuring the Windows service
    - Setting up firewall rules
    - Creating backup scripts

.PARAMETER InstallPath
    Base installation path. Default: C:\AssetSystem

.PARAMETER Port
    Port for the application. Default: 3001

.PARAMETER SkipService
    Skip Windows service installation (for manual testing)

.EXAMPLE
    .\install.ps1

.EXAMPLE
    .\install.ps1 -InstallPath "D:\AssetSystem" -Port 8080
#>

param(
    [string]$InstallPath = "C:\AssetSystem",
    [int]$Port = 3001,
    [switch]$SkipService
)

$ErrorActionPreference = "Stop"

# Colors for output
function Write-Step { param($msg) Write-Host "`n>> $msg" -ForegroundColor Cyan }
function Write-Success { param($msg) Write-Host "   $msg" -ForegroundColor Green }
function Write-Warning { param($msg) Write-Host "   $msg" -ForegroundColor Yellow }
function Write-Error { param($msg) Write-Host "   $msg" -ForegroundColor Red }

# Banner
Write-Host @"

============================================
  Asset Management System Installer
============================================

"@ -ForegroundColor Cyan

Write-Host "Install Path: $InstallPath"
Write-Host "Port: $Port"
Write-Host ""

# Check prerequisites
Write-Step "Checking prerequisites..."

# Check Node.js
try {
    $nodeVersion = node --version 2>$null
    if ($nodeVersion) {
        Write-Success "Node.js found: $nodeVersion"
    } else {
        throw "Node.js not found"
    }
} catch {
    Write-Error "Node.js is not installed!"
    Write-Host "   Please install Node.js 20 LTS from https://nodejs.org/"
    exit 1
}

# Check npm
try {
    $npmVersion = npm --version 2>$null
    Write-Success "npm found: v$npmVersion"
} catch {
    Write-Error "npm is not available!"
    exit 1
}

# Get script location (where the app source is)
$SourcePath = Split-Path -Parent $MyInvocation.MyCommand.Path
Write-Success "Source path: $SourcePath"

# Create directory structure
Write-Step "Creating directory structure..."

$directories = @(
    "$InstallPath\app",
    "$InstallPath\data",
    "$InstallPath\logs",
    "$InstallPath\backups"
)

foreach ($dir in $directories) {
    if (-not (Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
        Write-Success "Created: $dir"
    } else {
        Write-Warning "Exists: $dir"
    }
}

# Copy application files
Write-Step "Copying application files..."

$excludeDirs = @("node_modules", ".git", "backups", "logs")
$excludeFiles = @("*.db", "*.log")

# Copy files excluding node_modules and other large directories
$itemsToCopy = Get-ChildItem -Path $SourcePath -Exclude $excludeDirs
foreach ($item in $itemsToCopy) {
    $destPath = Join-Path "$InstallPath\app" $item.Name
    if ($item.PSIsContainer) {
        if ($item.Name -notin $excludeDirs) {
            Copy-Item -Path $item.FullName -Destination $destPath -Recurse -Force
        }
    } else {
        if ($item.Extension -notin @(".db", ".log")) {
            Copy-Item -Path $item.FullName -Destination $destPath -Force
        }
    }
}
Write-Success "Application files copied"

# Helper: run a command via cmd.exe, check exit code, ignore stderr warnings
# Uses cmd.exe /c so that .cmd batch files (npm, npx) work correctly on Windows
function Invoke-NativeCommand {
    param(
        [string]$Command,
        [string]$StepName,
        [string]$WorkDir
    )
    $stdoutLog = "$InstallPath\logs\_install_stdout.tmp"
    $stderrLog = "$InstallPath\logs\_install_stderr.tmp"
    $process = Start-Process -FilePath "cmd.exe" -ArgumentList "/c $Command" -WorkingDirectory $WorkDir -NoNewWindow -Wait -PassThru -RedirectStandardOutput $stdoutLog -RedirectStandardError $stderrLog
    if ($process.ExitCode -ne 0) {
        $stderr = Get-Content $stderrLog -Raw -ErrorAction SilentlyContinue
        Write-Error "$StepName failed (exit code $($process.ExitCode))"
        if ($stderr) { Write-Host "   $stderr" -ForegroundColor Red }
        return $false
    }
    return $true
}

# Install dependencies
Write-Step "Installing dependencies (this may take a few minutes)..."

if (-not (Invoke-NativeCommand -Command "npm install" -StepName "npm install" -WorkDir "$InstallPath\app")) {
    exit 1
}
Write-Success "Dependencies installed"

# Generate Prisma client
Write-Step "Generating Prisma client..."

if (-not (Invoke-NativeCommand -Command "npx prisma generate" -StepName "prisma generate" -WorkDir "$InstallPath\app\apps\api")) {
    exit 1
}
Write-Success "Prisma client generated"

# Create environment file
Write-Step "Creating environment configuration..."

$sessionSecret = [guid]::NewGuid().ToString() + "-" + [guid]::NewGuid().ToString()
$dbPath = "$InstallPath\data\asset_system.db" -replace "\\", "/"

$envContent = @"
DATABASE_URL="file:$dbPath"
PORT=$Port
SESSION_SECRET="$sessionSecret"
"@

$envPath = "$InstallPath\app\apps\api\.env"
$envContent | Out-File -FilePath $envPath -Encoding UTF8 -Force
Write-Success "Environment file created: $envPath"

# Build application
Write-Step "Building application..."

if (-not (Invoke-NativeCommand -Command "npm run build" -StepName "npm run build" -WorkDir "$InstallPath\app")) {
    exit 1
}
Write-Success "Application built successfully"

# Initialize database
Write-Step "Initializing database..."

if (-not (Invoke-NativeCommand -Command "npx prisma db push --skip-generate" -StepName "prisma db push" -WorkDir "$InstallPath\app\apps\api")) {
    exit 1
}
Write-Success "Database initialized: $InstallPath\data\asset_system.db"

# Configure firewall
Write-Step "Configuring Windows Firewall..."

$firewallRule = Get-NetFirewallRule -DisplayName "Asset System" -ErrorAction SilentlyContinue
if ($firewallRule) {
    Write-Warning "Firewall rule already exists, updating..."
    Set-NetFirewallRule -DisplayName "Asset System" -LocalPort $Port
} else {
    New-NetFirewallRule -DisplayName "Asset System" -Direction Inbound -Protocol TCP -LocalPort $Port -Action Allow | Out-Null
    Write-Success "Firewall rule created for port $Port"
}

# Download and install NSSM
if (-not $SkipService) {
    Write-Step "Setting up Windows Service..."

    $nssmPath = "$InstallPath\nssm.exe"

    if (-not (Test-Path $nssmPath)) {
        Write-Host "   Downloading NSSM..."
        $nssmUrl = "https://nssm.cc/release/nssm-2.24.zip"
        $nssmZip = "$env:TEMP\nssm.zip"
        $nssmExtract = "$env:TEMP\nssm-extract"

        try {
            [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
            Invoke-WebRequest -Uri $nssmUrl -OutFile $nssmZip -UseBasicParsing
            Expand-Archive -Path $nssmZip -DestinationPath $nssmExtract -Force
            Copy-Item "$nssmExtract\nssm-2.24\win64\nssm.exe" $nssmPath
            Remove-Item $nssmZip -Force
            Remove-Item $nssmExtract -Recurse -Force
            Write-Success "NSSM downloaded"
        } catch {
            Write-Warning "Could not download NSSM automatically"
            Write-Host "   Please download NSSM from https://nssm.cc/download"
            Write-Host "   Extract nssm.exe to: $nssmPath"
            Write-Host "   Then run this script again or manually configure the service"
        }
    }

    if (Test-Path $nssmPath) {
        # Check if service exists
        $service = Get-Service -Name "AssetSystem" -ErrorAction SilentlyContinue
        if ($service) {
            Write-Warning "Service already exists, stopping and removing..."
            Stop-Service -Name "AssetSystem" -Force -ErrorAction SilentlyContinue
            & $nssmPath remove AssetSystem confirm 2>$null
        }

        # Get Node.js path
        $nodePath = (Get-Command node).Source

        # Install service
        & $nssmPath install AssetSystem $nodePath
        & $nssmPath set AssetSystem AppDirectory "$InstallPath\app\apps\api"
        & $nssmPath set AssetSystem AppParameters "dist\index.js"
        & $nssmPath set AssetSystem AppEnvironmentExtra "NODE_ENV=production"
        & $nssmPath set AssetSystem AppStdout "$InstallPath\logs\stdout.log"
        & $nssmPath set AssetSystem AppStderr "$InstallPath\logs\stderr.log"
        & $nssmPath set AssetSystem AppRotateFiles 1
        & $nssmPath set AssetSystem AppRotateBytes 1048576
        & $nssmPath set AssetSystem Start SERVICE_AUTO_START
        & $nssmPath set AssetSystem Description "IT Asset Management System"

        Write-Success "Windows service installed"

        # Start service
        Start-Service -Name "AssetSystem"
        Start-Sleep -Seconds 2

        $service = Get-Service -Name "AssetSystem"
        if ($service.Status -eq "Running") {
            Write-Success "Service started successfully"
        } else {
            Write-Warning "Service may not have started. Check logs at $InstallPath\logs\"
        }
    }
}

# Create backup script
Write-Step "Creating backup script..."

$backupScript = @'
$date = Get-Date -Format "yyyy-MM-dd_HHmmss"
$backupDir = "INSTALLPATH\backups"
$dbPath = "INSTALLPATH\data\asset_system.db"

if (Test-Path $dbPath) {
    Copy-Item $dbPath "$backupDir\asset_system_$date.db"
    Write-Host "Backup created: asset_system_$date.db"

    # Keep only last 30 backups
    Get-ChildItem "$backupDir\*.db" | Sort-Object CreationTime -Descending | Select-Object -Skip 30 | Remove-Item
}
'@

$backupScript = $backupScript -replace "INSTALLPATH", $InstallPath
$backupScript | Out-File -FilePath "$InstallPath\backup.ps1" -Encoding UTF8 -Force
Write-Success "Backup script created: $InstallPath\backup.ps1"

# Create scheduled task for backups
Write-Step "Creating daily backup scheduled task..."

$taskExists = Get-ScheduledTask -TaskName "AssetSystem Backup" -ErrorAction SilentlyContinue
if ($taskExists) {
    Unregister-ScheduledTask -TaskName "AssetSystem Backup" -Confirm:$false
}

$action = New-ScheduledTaskAction -Execute "PowerShell.exe" -Argument "-ExecutionPolicy Bypass -File `"$InstallPath\backup.ps1`""
$trigger = New-ScheduledTaskTrigger -Daily -At 2:00AM
Register-ScheduledTask -TaskName "AssetSystem Backup" -Action $action -Trigger $trigger -Description "Daily backup of Asset System database" | Out-Null
Write-Success "Daily backup scheduled for 2:00 AM"

# Get server IP for display
$ipAddress = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.InterfaceAlias -notlike "*Loopback*" -and $_.IPAddress -notlike "169.*" } | Select-Object -First 1).IPAddress

# Complete
Write-Host @"

============================================
  Installation Complete!
============================================

"@ -ForegroundColor Green

Write-Host "Application URL: " -NoNewline
Write-Host "http://${ipAddress}:$Port" -ForegroundColor Yellow

Write-Host ""
Write-Host "Default Login:"
Write-Host "  Username: " -NoNewline
Write-Host "admin" -ForegroundColor Yellow
Write-Host "  Password: " -NoNewline
Write-Host "admin123" -ForegroundColor Yellow

Write-Host ""
Write-Host "IMPORTANT: Change the default password after first login!" -ForegroundColor Red

Write-Host ""
Write-Host "Service Commands:"
Write-Host "  Start:   " -NoNewline -ForegroundColor Gray
Write-Host "Start-Service AssetSystem"
Write-Host "  Stop:    " -NoNewline -ForegroundColor Gray
Write-Host "Stop-Service AssetSystem"
Write-Host "  Restart: " -NoNewline -ForegroundColor Gray
Write-Host "Restart-Service AssetSystem"
Write-Host "  Status:  " -NoNewline -ForegroundColor Gray
Write-Host "Get-Service AssetSystem"

Write-Host ""
Write-Host "Logs: $InstallPath\logs\"
Write-Host "Database: $InstallPath\data\asset_system.db"
Write-Host ""
