# Transform Access export to Asset System import format

$inputPath = 'c:\Users\sb\Documents\GitHub\Asset_System\csv-export\Assets.csv'
$outputPath = 'c:\Users\sb\Documents\GitHub\Asset_System\csv-export\Assets-import.csv'

# Read the CSV
$assets = Import-Csv $inputPath

# Function to convert date format
function Convert-DateFormat {
    param([string]$dateStr)
    if ([string]::IsNullOrWhiteSpace($dateStr)) { return '' }
    try {
        # Parse "30/04/2009 12:00:00 AM" format
        $date = [DateTime]::ParseExact($dateStr.Trim(), 'dd/MM/yyyy hh:mm:ss tt', [System.Globalization.CultureInfo]::InvariantCulture)
        return $date.ToString('yyyy-MM-dd')
    } catch {
        try {
            # Try alternative format
            $date = [DateTime]::Parse($dateStr)
            return $date.ToString('yyyy-MM-dd')
        } catch {
            return ''
        }
    }
}

# Function to map condition values
function Map-Condition {
    param([string]$condition)
    if ([string]::IsNullOrWhiteSpace($condition)) { return '' }

    # Strip prefix like "(1) ", "(2) ", "(3) " etc.
    $cleaned = $condition.Trim() -replace '^\(\d+\)\s*', ''

    $conditionMap = @{
        'New' = 'NEW'
        'Good' = 'GOOD'
        'Great' = 'NEW'
        'Fair' = 'FAIR'
        'Satisfactory' = 'FAIR'
        'Poor' = 'POOR'
        'Damaged' = 'DAMAGED'
    }
    $mapped = $conditionMap[$cleaned]
    if ($mapped) { return $mapped }
    return $cleaned.ToUpper()
}

# Function to map status values
function Map-Status {
    param([string]$status)
    $statusMap = @{
        'In Use' = 'In Use'
        'Disposed' = 'Decommissioned - Written Off'
        'Spare' = 'Awaiting allocation'
        'Decomissioned - In storage' = 'Decommissioned - In storage'
        'Decomissioned - User left school' = 'Decommissioned - User left school'
        'Not Working' = 'Decommissioned - Damaged'
        'Missing' = 'Retired - Lost'
    }
    if ([string]::IsNullOrWhiteSpace($status)) { return 'Awaiting allocation' }
    $mapped = $statusMap[$status.Trim()]
    if ($mapped) { return $mapped }
    return $status
}

# Transform and output - use exact property names expected by CSV parser
$transformed = $assets | ForEach-Object {
    [PSCustomObject]@{
        'itemNumber' = $_.'Item'
        'serialNumber' = $_.'Serial'
        'manufacturer' = $_.'Manufacturer'
        'model' = $_.'Model'
        'category' = $_.'Category'
        'description' = $_.'Description'
        'status' = Map-Status $_.'Status'
        'condition' = if ($_.'Condition') { Map-Condition $_.'Condition' } else { '' }
        'acquiredDate' = Convert-DateFormat $_.'Acquired Date'
        'purchasePrice' = $_.'Purchase Price'
        'supplier' = $_.'Supplier'
        'orderNumber' = $_.'Order Number'
        'hostname' = $_.'Hostname'
        'deviceUsername' = $_.'Username'
        'devicePassword' = $_.'Password'
        'lanMacAddress' = $_.'LAN MAC Address'
        'wlanMacAddress' = $_.'WLAN MAC Address'
        'ipAddress' = $_.'IP Address'
        'assignedTo' = $_.'Assigned To'
        'location' = $_.'Location'
        'warrantyExpiration' = Convert-DateFormat $_.'WarrExp'
        'endOfLifeDate' = Convert-DateFormat $_.'End-of-Life Date'
        'comments' = $_.'Comments'
    }
}

# Export without BOM
$utf8NoBom = New-Object System.Text.UTF8Encoding $false
$csvContent = ($transformed | ConvertTo-Csv -NoTypeInformation) -join "`r`n"
[System.IO.File]::WriteAllText($outputPath, $csvContent, $utf8NoBom)

Write-Host "Transformed $($transformed.Count) assets"
Write-Host "Output saved to: $outputPath"

# Show sample
Write-Host "`nSample data (first 3 rows):"
$transformed | Select-Object -First 3 | Format-Table 'itemNumber', 'manufacturer', 'model', 'status'
