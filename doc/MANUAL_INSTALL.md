# Windows Server 2025 Installation Guide

This guide covers deploying the Asset Management System on Windows Server 2025 without Docker.

## Quick Install (Automated)

For a fully automated installation, run the PowerShell script as Administrator:

```powershell
# From the application source directory
.\install.ps1

# Or with custom options
.\install.ps1 -InstallPath "D:\AssetSystem" -Port 8080
```

The script handles everything: directory setup, dependencies, build, database, service, firewall, and backups.

---

## Manual Installation

Follow the steps below if you prefer manual installation or need to customize the process.

## Prerequisites

### System Requirements
- Windows Server 2025 (Standard or Datacenter)
- 2 GB RAM minimum (4 GB recommended)
- 10 GB disk space
- Network access on port 3001 (or your chosen port)

### Software Requirements
- **Node.js 20 LTS** or later
- **Git** (optional, for cloning from repository)

## Step 1: Install Node.js

1. Download Node.js 20 LTS from https://nodejs.org/
2. Run the installer with default options
3. Verify installation by opening PowerShell and running:
   ```powershell
   node --version
   npm --version
   ```

## Step 2: Create Directory Structure

Open PowerShell as Administrator and run:

```powershell
# Create application directories
New-Item -ItemType Directory -Path "C:\ICTMS\app" -Force
New-Item -ItemType Directory -Path "C:\ICTMS\data" -Force
New-Item -ItemType Directory -Path "C:\ICTMS\logs" -Force
```

## Step 3: Deploy Application Files

### Option A: Download Release Archive

1. Download the latest release archive
2. Extract contents to `C:\ICTMS\app`

### Option B: Clone from Git

```powershell
cd C:\ICTMS
git clone https://github.com/sbennell/Asset_System.git app
```

## Step 4: Install Dependencies

```powershell
cd C:\ICTMS\app
npm install
```

## Step 5: Configure Environment

Create the environment file at `C:\ICTMS\app\apps\api\.env`:

```powershell
@"
DATABASE_URL="file:C:/AssetSystem/data/asset_system.db"
PORT=3001
SESSION_SECRET="$(New-Guid)-$(New-Guid)"
"@ | Out-File -FilePath "C:\ICTMS\app\apps\api\.env" -Encoding UTF8
```

Or manually create `C:\ICTMS\app\apps\api\.env` with:

```
DATABASE_URL="file:C:/AssetSystem/data/asset_system.db"
PORT=3001
SESSION_SECRET="your-strong-random-secret-here"
```

**Important**: Replace the SESSION_SECRET with a long, random string. You can generate one with:
```powershell
[guid]::NewGuid().ToString() + "-" + [guid]::NewGuid().ToString()
```

## Step 6: Build Application

```powershell
cd C:\ICTMS\app

# Generate Prisma client
cd apps\api
npx prisma generate

# Build both frontend and backend
cd ..\..
npm run build

# Initialize database
cd apps\api
npx prisma db push
```

## Step 7: Test the Application

Start the application to verify it works:

```powershell
cd C:\ICTMS\app
npm run start
```

Open a browser and navigate to `http://localhost:3001`. You should see the login page.

Press `Ctrl+C` to stop the application.

## Step 8: Configure Windows Firewall

Allow inbound connections on port 3001:

```powershell
New-NetFirewallRule -DisplayName "Asset System" -Direction Inbound -Protocol TCP -LocalPort 3001 -Action Allow
```

## Step 9: Install as Windows Service

We'll use NSSM (Non-Sucking Service Manager) to run the application as a Windows service.

### Install NSSM via Chocolatey

```powershell
# Install Chocolatey if not already installed
Set-ExecutionPolicy Bypass -Scope Process -Force
[System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072
iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))

# Install NSSM
choco install nssm -y
```

### Create Service Account (Optional but Recommended)

For better security, create a dedicated user account to run the service:

```powershell
# Create local user account
$username = "AssetSystemSvc"
$password = ConvertTo-SecureString "YourStrongPassword123!" -AsPlainText -Force
New-LocalUser -Name $username -Password $password -Description "Asset System Service Account" -PasswordNeverExpires

# Add user to local administrators (for service permissions)
Add-LocalGroupMember -Group "Administrators" -Member $username

# Grant permissions to application directories
$acl = Get-Acl "C:\ICTMS"
$rule = New-Object System.Security.AccessControl.FileSystemAccessRule($username, "FullControl", "ContainerInherit,ObjectInherit", "None", "Allow")
$acl.SetAccessRule($rule)
Set-Acl "C:\ICTMS" $acl
```

Alternatively, use an existing domain user account.

### Install the Service

```powershell
# Install the service
nssm install AssetSystem "C:\Program Files\nodejs\node.exe"

# Configure service parameters
nssm set AssetSystem AppDirectory "C:\ICTMS\app\apps\api"
nssm set AssetSystem AppParameters "dist\index.js"
nssm set AssetSystem AppEnvironmentExtra "NODE_ENV=production"

# Configure logging
nssm set AssetSystem AppStdout "C:\ICTMS\logs\stdout.log"
nssm set AssetSystem AppStderr "C:\ICTMS\logs\stderr.log"
nssm set AssetSystem AppRotateFiles 1
nssm set AssetSystem AppRotateBytes 1048576

# Set service to start automatically
nssm set AssetSystem Start SERVICE_AUTO_START

# Set service description
nssm set AssetSystem Description "IT Asset Management System"

# Run service as a specific user (replace with your username)
nssm set AssetSystem ObjectName ".\AssetSystemSvc" "YourStrongPassword123!"

# Start the service
Start-Service AssetSystem
```

### Verify Service is Running

```powershell
Get-Service AssetSystem
```

## Step 10: Post-Installation Setup

1. Open a browser and navigate to `http://your-server-ip:3001`
2. On first login, enter any username and password to create the initial admin account
3. Configure your organization name in Settings > Organization

## Optional: IIS Reverse Proxy

If you want to use IIS as a reverse proxy (for SSL termination or to use port 80/443):

### Install IIS and Required Modules

```powershell
# Install IIS
Install-WindowsFeature -Name Web-Server -IncludeManagementTools

# Install URL Rewrite Module
# Download from: https://www.iis.net/downloads/microsoft/url-rewrite

# Install Application Request Routing (ARR)
# Download from: https://www.iis.net/downloads/microsoft/application-request-routing
```

### Configure Reverse Proxy

1. Open IIS Manager
2. Create a new website or use Default Web Site
3. Open URL Rewrite
4. Add a reverse proxy rule:
   - Pattern: `(.*)`
   - Rewrite URL: `http://localhost:3001/{R:1}`
5. Enable ARR proxy functionality in server-level settings

### Enable SSL (Optional)

1. Obtain an SSL certificate (or use a self-signed certificate for internal use)
2. Bind the certificate to your IIS site on port 443
3. Redirect HTTP to HTTPS as needed

## Backup Strategy

### Database Backup

The SQLite database is a single file. Create a scheduled task to back it up:

```powershell
# Create backup script
@"
`$date = Get-Date -Format "yyyy-MM-dd_HHmmss"
Copy-Item "C:\ICTMS\data\asset_system.db" "C:\ICTMS\backups\asset_system_`$date.db"

# Keep only last 30 backups
Get-ChildItem "C:\ICTMS\backups\*.db" | Sort-Object CreationTime -Descending | Select-Object -Skip 30 | Remove-Item
"@ | Out-File -FilePath "C:\ICTMS\backup.ps1" -Encoding UTF8

# Create backup directory
New-Item -ItemType Directory -Path "C:\ICTMS\backups" -Force
```

### Schedule Daily Backups

```powershell
$action = New-ScheduledTaskAction -Execute "PowerShell.exe" -Argument "-ExecutionPolicy Bypass -File C:\ICTMS\backup.ps1"
$trigger = New-ScheduledTaskTrigger -Daily -At 2:00AM
Register-ScheduledTask -TaskName "AssetSystem Backup" -Action $action -Trigger $trigger -Description "Daily backup of Asset System database"
```

## Step 11: Create Web Update Scheduled Task

This scheduled task allows admin users to trigger updates from the web interface. It runs independently of the NSSM service so the update survives the service being restarted.

```powershell
$updateAction = New-ScheduledTaskAction -Execute "PowerShell.exe" -Argument "-ExecutionPolicy Bypass -File `"C:\ICTMS\app\update.ps1`" -AutoUpdate -InstallPath `"C:\ICTMS`""

# Run as the service account user (use same account as service)
$updatePrincipal = New-ScheduledTaskPrincipal -UserId ".\AssetSystemSvc" -LogonType Password -RunLevel Highest

$updateSettings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
Register-ScheduledTask -TaskName "AssetSystemWebUpdate" -Action $updateAction -Principal $updatePrincipal -Settings $updateSettings -Description "Web-triggered update for Asset System"
```

> **Note**: Adjust paths if using a custom install path.

## Service Management

### Common Commands

```powershell
# Check service status
Get-Service AssetSystem

# Stop the service
Stop-Service AssetSystem

# Start the service
Start-Service AssetSystem

# Restart the service
Restart-Service AssetSystem

# View recent logs
Get-Content "C:\ICTMS\logs\stdout.log" -Tail 50
Get-Content "C:\ICTMS\logs\stderr.log" -Tail 50
```

### Uninstall Service

```powershell
Stop-Service AssetSystem
nssm remove AssetSystem confirm
```

## Updating the Application

### Option A: Web-Based Update (Recommended)

Admin users can trigger updates directly from the web interface:

1. When a new version is available, an "Update to vX.X.X" notification appears in the sidebar
2. Click the notification to open the About dialog
3. Click the **Update** button to start the update
4. The system will back up the database, pull latest code, rebuild, and restart automatically

This requires the `AssetSystemWebUpdate` scheduled task (see Step 11 below).

### Option B: Update Script

Run the update script from PowerShell as Administrator:

```powershell
cd C:\ICTMS\app
.\update.ps1 -InstallPath "C:\ICTMS"
```

The script checks for updates, backs up the database, pulls code, rebuilds, and restarts the service.

### Option C: Manual Update

1. Stop the service:
   ```powershell
   Stop-Service AssetSystem
   ```

2. Back up the database:
   ```powershell
   $date = Get-Date -Format "yyyy-MM-dd_HHmmss"
   Copy-Item "C:\ICTMS\data\asset_system.db" "C:\ICTMS\backups\asset_system_$date.db"
   ```

3. Pull latest code and rebuild:
   ```powershell
   cd C:\ICTMS\app
   git pull origin main
   npm install
   cd apps\api
   npx prisma generate
   npx prisma db push --skip-generate
   cd ..\..
   npm run build
   ```

4. Start the service:
   ```powershell
   Start-Service AssetSystem
   ```

## Troubleshooting

### Service Won't Start

1. Check logs at `C:\ICTMS\logs\stderr.log`
2. Verify Node.js path: `C:\Program Files\nodejs\node.exe`
3. Verify the application builds correctly:
   ```powershell
   cd C:\ICTMS\app\apps\api
   node dist\index.js
   ```

### Database Errors

1. Verify the data directory exists: `C:\ICTMS\data`
2. Check DATABASE_URL in `.env` uses forward slashes: `file:C:/AssetSystem/data/...`
3. Run database migration:
   ```powershell
   cd C:\ICTMS\app\apps\api
   npx prisma db push
   ```

### Port Already in Use

1. Check what's using port 3001:
   ```powershell
   netstat -ano | findstr :3001
   ```
2. Change the PORT in `.env` to another value (e.g., 3002)
3. Update firewall rule for new port
4. Restart the service

### Cannot Access from Other Machines

1. Verify firewall rule exists:
   ```powershell
   Get-NetFirewallRule -DisplayName "Asset System"
   ```
2. Check the server is listening on all interfaces (0.0.0.0, not 127.0.0.1)
3. Verify no other firewall (Windows Defender, third-party) is blocking

## Directory Reference

```
C:\ICTMS\
├── app\                          # Application files (git repo)
│   ├── apps\
│   │   ├── api\
│   │   │   ├── dist\             # Compiled backend
│   │   │   ├── prisma\           # Database schema
│   │   │   └── .env              # Environment config
│   │   └── web\
│   │       └── dist\             # Compiled frontend
│   ├── update.ps1                # Update script
│   └── package.json
├── data\
│   └── asset_system.db           # SQLite database
├── logs\
│   ├── stdout.log                # Application output
│   ├── stderr.log                # Application errors
│   └── update.log                # Web update log
├── backups\                      # Database backups
└── backup.ps1                    # Backup script
```
