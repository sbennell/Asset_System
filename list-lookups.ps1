$assets = Import-Csv 'c:\Users\sb\Documents\GitHub\Asset_System\csv-export\Assets.csv'

Write-Host "=== CATEGORIES ==="
$assets | Where-Object { $_.Category } | Group-Object Category | Select-Object Name, Count | Sort-Object Count -Descending | Format-Table

Write-Host "`n=== MANUFACTURERS ==="
$assets | Where-Object { $_.Manufacturer } | Group-Object Manufacturer | Select-Object Name, Count | Sort-Object Count -Descending | Format-Table

Write-Host "`n=== LOCATIONS (top 15) ==="
$assets | Where-Object { $_.Location } | Group-Object Location | Select-Object Name, Count | Sort-Object Count -Descending | Select-Object -First 15 | Format-Table
