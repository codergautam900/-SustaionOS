param(
  [Parameter(Mandatory = $true)]
  [string]$FrontendUrl,

  [Parameter(Mandatory = $true)]
  [string]$BackendUrl,

  [Parameter(Mandatory = $false)]
  [string]$MlUrl
)

function Invoke-Check {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Name,

    [Parameter(Mandatory = $true)]
    [string]$Url
  )

  try {
    $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 20
    Write-Host "[PASS] $Name -> $($response.StatusCode) $Url" -ForegroundColor Green
    return $true
  }
  catch {
    Write-Host "[FAIL] $Name -> $Url" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor DarkRed
    return $false
  }
}

$frontendOk = Invoke-Check -Name "Frontend" -Url ($FrontendUrl.TrimEnd("/"))
$backendOk = Invoke-Check -Name "Backend Health" -Url ("{0}/api/health" -f $BackendUrl.TrimEnd("/"))

$mlOk = $true
if ($MlUrl) {
  $mlOk = Invoke-Check -Name "ML Health" -Url ("{0}/health" -f $MlUrl.TrimEnd("/"))
}

if ($frontendOk -and $backendOk -and $mlOk) {
  Write-Host ""
  Write-Host "All deploy smoke checks passed." -ForegroundColor Green
  exit 0
}

Write-Host ""
Write-Host "One or more smoke checks failed." -ForegroundColor Yellow
exit 1
