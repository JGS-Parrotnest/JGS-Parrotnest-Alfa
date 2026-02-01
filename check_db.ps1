$dbPath = "c:\Users\user\Music\Komunikator JGS\Alfa v5.0\parrotnest.db"
$dllPath = "c:\Users\user\Music\Komunikator JGS\Alfa v5.0\Server\bin\Release\net10.0-windows\Microsoft.Data.Sqlite.dll"

Write-Host "Checking database at: $dbPath"
if (-not (Test-Path $dbPath)) {
    Write-Host "Database file not found at $dbPath" -ForegroundColor Red
    exit
}

if (-not (Test-Path $dllPath)) {
    # Try debug path if release not found
    $dllPath = "c:\Users\user\Music\Komunikator JGS\Alfa v5.0\Server\bin\Debug\net10.0-windows\Microsoft.Data.Sqlite.dll"
    if (-not (Test-Path $dllPath)) {
         Write-Host "DLL not found at $dllPath" -ForegroundColor Red
         exit
    }
}

Add-Type -Path $dllPath

$connStr = "Data Source=$dbPath"
$conn = New-Object Microsoft.Data.Sqlite.SqliteConnection($connStr)

try {
    $conn.Open()
    Write-Host "Connected to database." -ForegroundColor Green

    $cmd = $conn.CreateCommand()
    $cmd.CommandText = "PRAGMA table_info(Messages);"
    $reader = $cmd.ExecuteReader()
    
    $columns = @()
    while ($reader.Read()) {
        $columns += $reader["name"]
    }
    $reader.Close()

    Write-Host "Columns in Messages table: $($columns -join ', ')" -ForegroundColor Cyan

    $missing = @()
    if ("ImageUrl" -notin $columns) { $missing += "ImageUrl" }
    if ("ReplyToId" -notin $columns) { $missing += "ReplyToId" }
    if ("Reactions" -notin $columns) { $missing += "Reactions" }

    if ($missing.Count -gt 0) {
        Write-Host "Missing columns: $($missing -join ', ')" -ForegroundColor Yellow
        foreach ($col in $missing) {
            try {
                $alterCmd = $conn.CreateCommand()
                $type = if ($col -eq "ReplyToId") { "INTEGER" } else { "TEXT" }
                $alterCmd.CommandText = "ALTER TABLE Messages ADD COLUMN $col $type NULL;"
                $alterCmd.ExecuteNonQuery()
                Write-Host "Added column $col" -ForegroundColor Green
            } catch {
                Write-Host "Failed to add column $col : $_" -ForegroundColor Red
            }
        }
    } else {
        Write-Host "All required columns exist." -ForegroundColor Green
    }
} catch {
    Write-Host "Error: $_" -ForegroundColor Red
} finally {
    $conn.Close()
    $conn.Dispose()
}
