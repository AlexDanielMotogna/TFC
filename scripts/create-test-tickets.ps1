# Create GitHub Issues from Test Tickets
#
# Usage:
#   .\scripts\create-test-tickets.ps1                    # Create all tickets
#   .\scripts\create-test-tickets.ps1 -DryRun            # Preview without creating
#   .\scripts\create-test-tickets.ps1 -Filter "critical" # Only critical label
#   .\scripts\create-test-tickets.ps1 -Filter "pre-fight" # Only pre-fight tickets
#
# Prerequisites:
#   - GitHub CLI installed: https://cli.github.com/
#   - Authenticated: gh auth login

param(
    [switch]$DryRun,
    [string]$Filter = ""
)

$ticketsPath = Join-Path $PSScriptRoot "..\docs\test-tickets.json"
$data = Get-Content $ticketsPath | ConvertFrom-Json
$tickets = $data.tickets

# Filter if specified
if ($Filter -ne "") {
    $tickets = $tickets | Where-Object {
        $_.labels -contains $Filter -or
        $_.id -like "*$Filter*" -or
        $_.title -like "*$Filter*"
    }
    Write-Host "Filtered to $($tickets.Count) tickets matching '$Filter'"
}

Write-Host ""
Write-Host "=" * 60
Write-Host "GitHub Issue Creator - $($tickets.Count) tickets"
Write-Host "=" * 60
Write-Host ""

if ($DryRun) {
    Write-Host "DRY RUN MODE - No issues will be created" -ForegroundColor Yellow
    Write-Host ""
}

$created = 0
$failed = 0

foreach ($ticket in $tickets) {
    Write-Host "[$($ticket.id)] $($ticket.title)"

    if ($DryRun) {
        Write-Host "  Labels: $($ticket.labels -join ', ')" -ForegroundColor Gray
        Write-Host "  Body preview: $($ticket.body.Substring(0, [Math]::Min(100, $ticket.body.Length)))..." -ForegroundColor Gray
        Write-Host "  -> Would create issue" -ForegroundColor Green
        Write-Host ""
        $created++
        continue
    }

    try {
        $labels = $ticket.labels -join ","
        $title = $ticket.title

        # Write body to temp file
        $tempFile = Join-Path $PSScriptRoot ".temp-body.md"
        $ticket.body | Out-File -FilePath $tempFile -Encoding utf8

        $ghPath = "C:\Program Files\GitHub CLI\gh.exe"
        $result = & $ghPath issue create --title "$title" --label "$labels" --body-file "$tempFile" 2>&1

        if ($LASTEXITCODE -eq 0) {
            Write-Host "  -> Created: $result" -ForegroundColor Green
            $created++
        } else {
            throw $result
        }

        # Clean up
        Remove-Item $tempFile -ErrorAction SilentlyContinue

        # Rate limit protection
        Start-Sleep -Milliseconds 500

    } catch {
        Write-Host "  -> FAILED: $_" -ForegroundColor Red
        $failed++
    }

    Write-Host ""
}

Write-Host "=" * 60
Write-Host "Summary: $created created, $failed failed"
Write-Host "=" * 60
