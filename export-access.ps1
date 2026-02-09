$connString = 'Provider=Microsoft.ACE.OLEDB.12.0;Data Source=c:\Users\sb\Documents\GitHub\Asset_System\Asset_System.accdb'
$conn = New-Object System.Data.OleDb.OleDbConnection($connString)
$conn.Open()

# Get all tables
$tables = $conn.GetSchema('Tables') | Where-Object { $_.TABLE_TYPE -eq 'TABLE' } | Select-Object -ExpandProperty TABLE_NAME

Write-Host "Found tables:"
$tables | ForEach-Object { Write-Host "  - $_" }

# Create export directory
$exportDir = 'c:\Users\sb\Documents\GitHub\Asset_System\csv-export'
if (-not (Test-Path $exportDir)) {
    New-Item -ItemType Directory -Path $exportDir | Out-Null
}

# Export each table to CSV
foreach ($table in $tables) {
    Write-Host "`nExporting $table..."
    $cmd = New-Object System.Data.OleDb.OleDbCommand("SELECT * FROM [$table]", $conn)
    $adapter = New-Object System.Data.OleDb.OleDbDataAdapter($cmd)
    $dataTable = New-Object System.Data.DataTable
    $adapter.Fill($dataTable) | Out-Null

    $csvPath = Join-Path $exportDir "$table.csv"
    $dataTable | Export-Csv -Path $csvPath -NoTypeInformation -Encoding UTF8
    Write-Host "  Exported $($dataTable.Rows.Count) rows to $csvPath"
}

$conn.Close()
Write-Host "`nExport complete! Files saved to $exportDir"
