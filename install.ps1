#Requires -RunAsAdministrator
<#
.SYNOPSIS
    Installs the Asset Management System on Windows Server.

.DESCRIPTION
    This script automates the installation of the Asset Management System including:
    - Cloning the repository from GitHub
    - Creating directory structure
    - Installing dependencies
    - Building the application
    - Configuring the Windows service
    - Setting up firewall rules
    - Creating backup scripts

.PARAMETER InstallPath
    Base installation path. Default: C:\ICTMS

.PARAMETER Port
    Port for the application. Default: 3001

.PARAMETER Branch
    Git branch to install from. Default: main

.PARAMETER SkipService
    Skip Windows service installation (for manual testing)

.EXAMPLE
    .\install.ps1

.EXAMPLE
    .\install.ps1 -InstallPath "D:\ICTMS" -Port 8080

.EXAMPLE
    .\install.ps1 -Branch "develop"
#>

param(
    [string]$InstallPath = "C:\ICTMS",
    [int]$Port = 3001,
    [string]$Branch = "main",
    [switch]$SkipService
)

$ErrorActionPreference = "Stop"
$RepoUrl = "https://github.com/sbennell/Asset_System.git"

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
Write-Host "Port:         $Port"
Write-Host "Branch:       $Branch"
Write-Host "Repository:   $RepoUrl"
Write-Host ""

# Check prerequisites
Write-Step "Checking prerequisites..."

# Temporarily allow errors for prerequisite checks (native commands write to stderr)
$ErrorActionPreference = "Continue"

# Check/install Chocolatey
$chocoInstalled = $false
$chocoVersion = choco --version 2>&1
if ($LASTEXITCODE -eq 0 -and $chocoVersion) {
    Write-Success "Chocolatey found: v$chocoVersion"
    $chocoInstalled = $true
}

if (-not $chocoInstalled) {
    Write-Warning "Chocolatey not found, installing..."
    $ErrorActionPreference = "Stop"
    try {
        Set-ExecutionPolicy Bypass -Scope Process -Force
        [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072
        Invoke-Expression ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))
        $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
        Write-Success "Chocolatey installed"
        $chocoInstalled = $true
    } catch {
        Write-Error "Failed to install Chocolatey: $_"
        Write-Host "   Install manually from https://chocolatey.org/install"
        exit 1
    }
    $ErrorActionPreference = "Continue"
}

# Check/install Git
$gitFound = $false
$gitVersion = git --version 2>&1
if ($LASTEXITCODE -eq 0 -and $gitVersion) {
    Write-Success "Git found: $gitVersion"
    $gitFound = $true
}

if (-not $gitFound) {
    Write-Warning "Git not found, installing via Chocolatey..."
    choco install git.install -y --no-progress 2>&1 | Out-Null
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
    $gitVersion = git --version 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Success "Git installed: $gitVersion"
    } else {
        Write-Error "Failed to install Git!"
        Write-Host "   Try manually: choco install git.install"
        exit 1
    }
}

# Check/install Node.js
$nodeFound = $false
$nodeVersion = node --version 2>&1
if ($LASTEXITCODE -eq 0 -and $nodeVersion) {
    Write-Success "Node.js found: $nodeVersion"
    $nodeFound = $true
}

if (-not $nodeFound) {
    Write-Warning "Node.js not found, installing via Chocolatey..."
    choco install nodejs-lts -y --no-progress 2>&1 | Out-Null
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
    $nodeVersion = node --version 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Success "Node.js installed: $nodeVersion"
    } else {
        Write-Error "Failed to install Node.js!"
        Write-Host "   Try manually: choco install nodejs-lts"
        exit 1
    }
}

# Check npm
$npmVersion = npm --version 2>&1
if ($LASTEXITCODE -eq 0 -and $npmVersion) {
    Write-Success "npm found: v$npmVersion"
} else {
    Write-Error "npm is not available! Node.js may not have installed correctly."
    Write-Host "   Try: choco install nodejs-lts --force"
    exit 1
}

# Restore strict error handling
$ErrorActionPreference = "Stop"

# Check if already installed
if (Test-Path "$InstallPath\app\.git") {
    Write-Error "Asset System is already installed at $InstallPath"
    Write-Host "   To update, run: .\update.ps1 -InstallPath `"$InstallPath`""
    Write-Host "   To reinstall, remove the directory first: Remove-Item `"$InstallPath`" -Recurse"
    exit 1
}

# Create directory structure
Write-Step "Creating directory structure..."

$directories = @(
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

# Clone repository
Write-Step "Cloning repository from GitHub..."

# Set up log file
$logFile = "$InstallPath\logs\install.log"
"[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] Starting installation" | Out-File -FilePath $logFile -Encoding UTF8 -Force

if (Test-Path "$InstallPath\app") {
    "Removing existing app directory..." | Out-File -FilePath $logFile -Append -Encoding UTF8
    Remove-Item "$InstallPath\app" -Recurse -Force
}

$cloneCmd = "git clone --branch $Branch --single-branch $RepoUrl `"$InstallPath\app`""
Write-Host "   Running: $cloneCmd" -ForegroundColor Gray
"[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] Running: $cloneCmd" | Out-File -FilePath $logFile -Append -Encoding UTF8

# Run git clone via Start-Process so we capture all output cleanly
$stdoutLog = "$InstallPath\logs\_clone_stdout.tmp"
$stderrLog = "$InstallPath\logs\_clone_stderr.tmp"
$process = Start-Process -FilePath "git" -ArgumentList "clone --branch $Branch --single-branch $RepoUrl `"$InstallPath\app`"" -NoNewWindow -Wait -PassThru -RedirectStandardOutput $stdoutLog -RedirectStandardError $stderrLog

$stdoutContent = if (Test-Path $stdoutLog) { Get-Content $stdoutLog -Raw -ErrorAction SilentlyContinue } else { "" }
$stderrContent = if (Test-Path $stderrLog) { Get-Content $stderrLog -Raw -ErrorAction SilentlyContinue } else { "" }

# Log all output
"[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] Exit code: $($process.ExitCode)" | Out-File -FilePath $logFile -Append -Encoding UTF8
"STDOUT: $stdoutContent" | Out-File -FilePath $logFile -Append -Encoding UTF8
"STDERR: $stderrContent" | Out-File -FilePath $logFile -Append -Encoding UTF8

if ($process.ExitCode -ne 0) {
    Write-Error "Failed to clone repository! (exit code: $($process.ExitCode))"
    Write-Host "   URL: $RepoUrl"
    Write-Host "   Target: $InstallPath\app" -ForegroundColor Gray
    if ($stderrContent) {
        Write-Host "   Error: $stderrContent" -ForegroundColor Red
    }
    if ($stdoutContent) {
        Write-Host "   Output: $stdoutContent" -ForegroundColor Gray
    }
    Write-Host "   Full log: $logFile" -ForegroundColor Gray
    Write-Host ""
    Write-Host "   Troubleshooting:" -ForegroundColor Yellow
    Write-Host "     1. Test: git clone $RepoUrl `"$env:TEMP\test-clone`"" -ForegroundColor Gray
    Write-Host "     2. Check: git config --global http.sslBackend" -ForegroundColor Gray
    Write-Host "     3. Try:   git config --global http.sslBackend schannel" -ForegroundColor Gray
    exit 1
}

# Clean up temp files
Remove-Item $stdoutLog, $stderrLog -Force -ErrorAction SilentlyContinue

Write-Success "Repository cloned (branch: $Branch)"
"[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] Clone successful" | Out-File -FilePath $logFile -Append -Encoding UTF8

# Get version info
$versionHistory = "$InstallPath\app\VERSION_HISTORY.md"
$installedVersion = "unknown"
if (Test-Path $versionHistory) {
    $match = Select-String -Path $versionHistory -Pattern '##\s*\[(\d+\.\d+\.\d+)\]' | Select-Object -First 1
    if ($match) {
        $installedVersion = $match.Matches[0].Groups[1].Value
    }
}
Write-Success "Version: $installedVersion"

# Helper: run a command via cmd.exe, check exit code, log output
# Uses cmd.exe /c so that .cmd batch files (npm, npx) work correctly on Windows
function Invoke-NativeCommand {
    param(
        [string]$Command,
        [string]$StepName,
        [string]$WorkDir
    )
    "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] Running: $Command (in $WorkDir)" | Out-File -FilePath $logFile -Append -Encoding UTF8
    $stdoutLog = "$InstallPath\logs\_install_stdout.tmp"
    $stderrLog = "$InstallPath\logs\_install_stderr.tmp"
    $process = Start-Process -FilePath "cmd.exe" -ArgumentList "/c $Command" -WorkingDirectory $WorkDir -NoNewWindow -Wait -PassThru -RedirectStandardOutput $stdoutLog -RedirectStandardError $stderrLog
    $stdout = Get-Content $stdoutLog -Raw -ErrorAction SilentlyContinue
    $stderr = Get-Content $stderrLog -Raw -ErrorAction SilentlyContinue
    "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] $StepName exit code: $($process.ExitCode)" | Out-File -FilePath $logFile -Append -Encoding UTF8
    if ($stdout) { "STDOUT: $stdout" | Out-File -FilePath $logFile -Append -Encoding UTF8 }
    if ($stderr) { "STDERR: $stderr" | Out-File -FilePath $logFile -Append -Encoding UTF8 }
    if ($process.ExitCode -ne 0) {
        Write-Error "$StepName failed (exit code $($process.ExitCode))"
        if ($stderr) { Write-Host "   $stderr" -ForegroundColor Red }
        Write-Host "   See full log: $logFile" -ForegroundColor Gray
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

# Install NSSM and configure Windows Service
if (-not $SkipService) {
    Write-Step "Setting up Windows Service..."

    # Install NSSM via Chocolatey (reliable, unlike direct download from nssm.cc)
    $ErrorActionPreference = "Continue"
    $nssmPath = (Get-Command nssm -ErrorAction SilentlyContinue).Source
    $ErrorActionPreference = "Stop"

    if (-not $nssmPath) {
        Write-Host "   Installing NSSM via Chocolatey..."
        $ErrorActionPreference = "Continue"
        choco install nssm -y --no-progress 2>&1 | Out-Null
        $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
        $nssmPath = (Get-Command nssm -ErrorAction SilentlyContinue).Source
        $ErrorActionPreference = "Stop"

        if ($nssmPath) {
            Write-Success "NSSM installed: $nssmPath"
        } else {
            Write-Error "Failed to install NSSM!"
            Write-Host "   Try manually: choco install nssm"
            Write-Host "   Then re-run this script"
            exit 1
        }
    } else {
        Write-Success "NSSM found: $nssmPath"
    }

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
    & $nssmPath set AssetSystem AppEnvironmentExtra "NODE_ENV=production" "DATABASE_URL=file:$dbPath" "PORT=$Port" "SESSION_SECRET=$sessionSecret"
    & $nssmPath set AssetSystem AppStdout "$InstallPath\logs\stdout.log"
    & $nssmPath set AssetSystem AppStderr "$InstallPath\logs\stderr.log"
    & $nssmPath set AssetSystem AppRotateFiles 1
    & $nssmPath set AssetSystem AppRotateBytes 1048576
    & $nssmPath set AssetSystem Start SERVICE_AUTO_START
    & $nssmPath set AssetSystem Description "IT Asset Management System"

    Write-Success "Windows service installed"

    # Configure service account for printer access
    Write-Step "Configuring service account for label printing..."

    # Get current user in DOMAIN\USER format
    $currentUser = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
    Write-Host "Service will run as: $currentUser" -ForegroundColor Yellow
    Write-Host "This ensures proper printer access for label printing."
    Write-Host ""

    # Prompt for password
    $password = Read-Host "Enter password for $currentUser" -AsSecureString

    # Set the service to run as this user
    & $nssmPath set AssetSystem ObjectName "$currentUser" (ConvertFrom-SecureString -SecureString $password -AsPlainText)
    Write-Success "Service configured to run as: $currentUser"
    Write-Host ""

    # Start service
    Start-Service -Name "AssetSystem"
    Start-Sleep -Seconds 3

    $service = Get-Service -Name "AssetSystem"
    if ($service.Status -eq "Running") {
        Write-Success "Service started successfully"
    } else {
        Write-Warning "Service may not have started. Check logs at $InstallPath\logs\"
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

# Create web update scheduled task (used by web interface to trigger updates)
Write-Step "Creating web update scheduled task..."

$taskExists = Get-ScheduledTask -TaskName "AssetSystemWebUpdate" -ErrorAction SilentlyContinue
if ($taskExists) {
    Unregister-ScheduledTask -TaskName "AssetSystemWebUpdate" -Confirm:$false
}

$updateAction = New-ScheduledTaskAction -Execute "PowerShell.exe" -Argument "-ExecutionPolicy Bypass -File `"$InstallPath\app\update.ps1`" -AutoUpdate -InstallPath `"$InstallPath`""
$updatePrincipal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
$updateSettings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
Register-ScheduledTask -TaskName "AssetSystemWebUpdate" -Action $updateAction -Principal $updatePrincipal -Settings $updateSettings -Description "Web-triggered update for Asset System" | Out-Null
Write-Success "Web update task created (triggered from web interface)"

# Get server IP for display
$ipAddress = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.InterfaceAlias -notlike "*Loopback*" -and $_.IPAddress -notlike "169.*" } | Select-Object -First 1).IPAddress

"[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] Installation complete (v$installedVersion)" | Out-File -FilePath $logFile -Append -Encoding UTF8

# Complete
Write-Host @"

============================================
  Installation Complete!
============================================

"@ -ForegroundColor Green

Write-Host "Version:         " -NoNewline
Write-Host "v$installedVersion" -ForegroundColor Yellow

Write-Host "Application URL: " -NoNewline
Write-Host "http://${ipAddress}:$Port" -ForegroundColor Yellow

Write-Host ""
Write-Host "First Login:" -ForegroundColor Yellow
Write-Host "  Enter any username and password to create the initial admin account."

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
Write-Host "Update:   " -NoNewline -ForegroundColor Gray
Write-Host ".\update.ps1 -InstallPath `"$InstallPath`""

Write-Host ""
Write-Host "Logs:     $InstallPath\logs\"
Write-Host "Database: $InstallPath\data\asset_system.db"
Write-Host ""
