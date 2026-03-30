param(
  [string]$FrontendUrl = "http://127.0.0.1:4173",
  [string]$BackendUrl = "http://127.0.0.1:5000",
  [string]$MlUrl = "http://127.0.0.1:8000",
  [string]$OutputPath = ".debug-runtime/e2e-demo-last.json"
)

$ErrorActionPreference = "Stop"

function Write-Step {
  param([string]$Message)
  Write-Host ""
  Write-Host "==> $Message" -ForegroundColor Cyan
}

function Invoke-Api {
  param(
    [Parameter(Mandatory = $true)]
    [ValidateSet("GET", "POST", "PATCH", "DELETE")]
    [string]$Method,

    [Parameter(Mandatory = $true)]
    [string]$Url,

    [hashtable]$Headers = @{},

    $Body = $null,

    [int]$TimeoutSec = 60
  )

  $params = @{
    Method      = $Method
    Uri         = $Url
    Headers     = $Headers
    TimeoutSec  = $TimeoutSec
    UseBasicParsing = $true
  }

  if ($null -ne $Body) {
    $params.ContentType = "application/json"
    $params.Body = ($Body | ConvertTo-Json -Depth 10 -Compress)
  }

  try {
    $response = Invoke-WebRequest @params
    $data = $null
    if ($response.Content) {
      try {
        $data = $response.Content | ConvertFrom-Json
      }
      catch {
        $data = $response.Content
      }
    }

    return [pscustomobject]@{
      Ok         = $true
      StatusCode = [int]$response.StatusCode
      Data       = $data
      Raw        = $response.Content
    }
  }
  catch {
    $statusCode = 0
    $raw = ""

    if ($_.Exception.Response) {
      $statusCode = [int]$_.Exception.Response.StatusCode
      $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
      $raw = $reader.ReadToEnd()
      $reader.Close()
    }

    $details = $raw
    if (-not $details) {
      $details = $_.Exception.Message
    }

    throw "API $Method $Url failed ($statusCode): $details"
  }
}

function Assert-True {
  param(
    [Parameter(Mandatory = $true)]
    [bool]$Condition,

    [Parameter(Mandatory = $true)]
    [string]$Message
  )

  if (-not $Condition) {
    throw $Message
  }
}

function Invoke-HealthCheck {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Name,

    [Parameter(Mandatory = $true)]
    [string]$Url
  )

  $response = Invoke-Api -Method GET -Url $Url -TimeoutSec 30
  Write-Host "[PASS] $Name -> $($response.StatusCode) $Url" -ForegroundColor Green
  return $response.Data
}

function New-Reading {
  param(
    [int]$HoursAgo,
    [string]$SensorId,
    [string]$SensorName,
    [string]$Building,
    [string]$Location,
    [double]$Water,
    [double]$Energy,
    [int]$BatteryLevel,
    [int]$SignalQuality,
    [string]$Protocol = "Webhook",
    [string]$SensorType = "multisensor",
    [double]$Latitude = 28.6139,
    [double]$Longitude = 77.2090
  )

  return [pscustomobject]@{
    hoursAgo      = $HoursAgo
    sensorId      = $SensorId
    sensorName    = $SensorName
    building      = $Building
    location      = $Location
    water         = $Water
    energy        = $Energy
    batteryLevel  = $BatteryLevel
    signalQuality = $SignalQuality
    protocol      = $Protocol
    sensorType    = $SensorType
    latitude      = $Latitude
    longitude     = $Longitude
  }
}

$backend = $BackendUrl.TrimEnd("/")
$frontend = $FrontendUrl.TrimEnd("/")
$ml = $MlUrl.TrimEnd("/")

Write-Step "Running health checks"
$null = Invoke-HealthCheck -Name "Frontend" -Url $frontend
$null = Invoke-HealthCheck -Name "Backend live" -Url "$backend/api/health/live"
$null = Invoke-HealthCheck -Name "Backend ready" -Url "$backend/api/health/ready"
$null = Invoke-HealthCheck -Name "ML health" -Url "$ml/health"

$stamp = Get-Date -Format "yyyyMMddHHmmss"
$demoEmail = "codex.demo.$stamp@example.com"
$inviteEmail = "codex.teammate.$stamp@example.com"
$demoPassword = "CodexDemo#2026!"
$organizationName = "Codex Demo Ops $stamp"

Write-Step "Registering a fresh workspace owner"
$register = Invoke-Api -Method POST -Url "$backend/api/auth/register" -Body @{
  name = "Codex Demo Owner"
  email = $demoEmail
  password = $demoPassword
  organizationName = $organizationName
}

$token = $register.Data.token
Assert-True -Condition ([string]::IsNullOrWhiteSpace($token) -eq $false) -Message "Registration did not return a token."
$authHeaders = @{ Authorization = "Bearer $token" }

Write-Step "Updating workspace profile"
$null = Invoke-Api -Method PATCH -Url "$backend/api/user/update" -Headers $authHeaders -Body @{
  building = "Command Center"
  teamName = "Sustainability Operations"
  industry = "Government Infrastructure"
  timezone = "Asia/Kolkata"
  apiAccessEnabled = $true
  mfaEnabled = $true
  dataRetentionDays = 540
}

Write-Step "Creating invite and API key"
$invite = Invoke-Api -Method POST -Url "$backend/api/platform/team/invites" -Headers $authHeaders -Body @{
  email = $inviteEmail
  role = "ANALYST"
  message = "Demo workspace invite"
  expiresInDays = 7
}
$apiKey = Invoke-Api -Method POST -Url "$backend/api/platform/api-keys" -Headers $authHeaders -Body @{
  label = "Demo gateway key"
  expiresInDays = 90
  scopes = @("ingest:telemetry", "analytics:read", "alerts:write")
}
$apiKeySecret = $apiKey.Data.secret
Assert-True -Condition ([string]::IsNullOrWhiteSpace($apiKeySecret) -eq $false) -Message "API key secret was not returned."
$apiKeyHeaders = @{ "x-api-key" = $apiKeySecret }

Write-Step "Registering a managed sensor"
$null = Invoke-Api -Method POST -Url "$backend/api/sensors" -Headers $authHeaders -Body @{
  sensorId = "ops-hub-$stamp"
  name = "Operations Hub"
  building = "Admin HQ"
  location = "Control Room"
  sensorType = "gateway"
  protocol = "HTTP"
  batteryLevel = 18
  firmwareVersion = "1.4.2"
  notes = "Demo low-battery sensor"
  calibrationDueAt = (Get-Date).AddDays(-1).ToString("o")
}

Write-Step "Seeding telemetry through the API key gateway"
$readings = @(
  (New-Reading -HoursAgo 18 -SensorId "hostel-a-main-$stamp" -SensorName "Hostel A Main Meter" -Building "Hostel A" -Location "North Wing" -Water 78 -Energy 48 -BatteryLevel 94 -SignalQuality 88),
  (New-Reading -HoursAgo 17 -SensorId "lab-west-$stamp" -SensorName "Lab West Load Meter" -Building "Research Lab" -Location "West Block" -Water 42 -Energy 118 -BatteryLevel 89 -SignalQuality 83),
  (New-Reading -HoursAgo 16 -SensorId "admin-core-$stamp" -SensorName "Admin Core Meter" -Building "Admin HQ" -Location "Main Lobby" -Water 36 -Energy 44 -BatteryLevel 91 -SignalQuality 86),
  (New-Reading -HoursAgo 15 -SensorId "hostel-a-main-$stamp" -SensorName "Hostel A Main Meter" -Building "Hostel A" -Location "North Wing" -Water 82 -Energy 52 -BatteryLevel 93 -SignalQuality 87),
  (New-Reading -HoursAgo 14 -SensorId "lab-west-$stamp" -SensorName "Lab West Load Meter" -Building "Research Lab" -Location "West Block" -Water 45 -Energy 126 -BatteryLevel 88 -SignalQuality 82),
  (New-Reading -HoursAgo 13 -SensorId "admin-core-$stamp" -SensorName "Admin Core Meter" -Building "Admin HQ" -Location "Main Lobby" -Water 34 -Energy 41 -BatteryLevel 90 -SignalQuality 84),
  (New-Reading -HoursAgo 12 -SensorId "hostel-a-main-$stamp" -SensorName "Hostel A Main Meter" -Building "Hostel A" -Location "North Wing" -Water 88 -Energy 56 -BatteryLevel 92 -SignalQuality 86),
  (New-Reading -HoursAgo 11 -SensorId "lab-west-$stamp" -SensorName "Lab West Load Meter" -Building "Research Lab" -Location "West Block" -Water 48 -Energy 132 -BatteryLevel 87 -SignalQuality 80),
  (New-Reading -HoursAgo 10 -SensorId "admin-core-$stamp" -SensorName "Admin Core Meter" -Building "Admin HQ" -Location "Main Lobby" -Water 38 -Energy 43 -BatteryLevel 89 -SignalQuality 83),
  (New-Reading -HoursAgo 9 -SensorId "hostel-a-main-$stamp" -SensorName "Hostel A Main Meter" -Building "Hostel A" -Location "North Wing" -Water 91 -Energy 59 -BatteryLevel 90 -SignalQuality 84),
  (New-Reading -HoursAgo 8 -SensorId "lab-west-$stamp" -SensorName "Lab West Load Meter" -Building "Research Lab" -Location "West Block" -Water 51 -Energy 139 -BatteryLevel 85 -SignalQuality 78),
  (New-Reading -HoursAgo 7 -SensorId "admin-core-$stamp" -SensorName "Admin Core Meter" -Building "Admin HQ" -Location "Main Lobby" -Water 37 -Energy 45 -BatteryLevel 88 -SignalQuality 82),
  (New-Reading -HoursAgo 6 -SensorId "hostel-a-main-$stamp" -SensorName "Hostel A Main Meter" -Building "Hostel A" -Location "North Wing" -Water 96 -Energy 61 -BatteryLevel 86 -SignalQuality 80),
  (New-Reading -HoursAgo 5 -SensorId "lab-west-$stamp" -SensorName "Lab West Load Meter" -Building "Research Lab" -Location "West Block" -Water 56 -Energy 152 -BatteryLevel 79 -SignalQuality 71),
  (New-Reading -HoursAgo 4 -SensorId "hostel-a-main-$stamp" -SensorName "Hostel A Main Meter" -Building "Hostel A" -Location "North Wing" -Water 254 -Energy 162 -BatteryLevel 19 -SignalQuality 34),
  (New-Reading -HoursAgo 3 -SensorId "lab-west-$stamp" -SensorName "Lab West Load Meter" -Building "Research Lab" -Location "West Block" -Water 59 -Energy 188 -BatteryLevel 72 -SignalQuality 63),
  (New-Reading -HoursAgo 2 -SensorId "hostel-a-main-$stamp" -SensorName "Hostel A Main Meter" -Building "Hostel A" -Location "North Wing" -Water 268 -Energy 171 -BatteryLevel 15 -SignalQuality 30),
  (New-Reading -HoursAgo 1 -SensorId "admin-core-$stamp" -SensorName "Admin Core Meter" -Building "Admin HQ" -Location "Main Lobby" -Water 39 -Energy 46 -BatteryLevel 86 -SignalQuality 81)
)

foreach ($reading in ($readings | Sort-Object -Property hoursAgo -Descending)) {
  $payload = @{
    sensorId = $reading.sensorId
    sensorName = $reading.sensorName
    building = $reading.building
    location = $reading.location
    water = $reading.water
    energy = $reading.energy
    batteryLevel = $reading.batteryLevel
    signalQuality = $reading.signalQuality
    protocol = $reading.protocol
    sensorType = $reading.sensorType
    latitude = $reading.latitude
    longitude = $reading.longitude
    timestamp = (Get-Date).AddHours(-1 * $reading.hoursAgo).ToString("o")
  }

  $null = Invoke-Api -Method POST -Url "$backend/api/iot/webhook/ingest" -Headers $apiKeyHeaders -Body $payload
}

Write-Step "Seeding one manual dashboard reading through the user flow"
$null = Invoke-Api -Method POST -Url "$backend/api/data" -Headers $authHeaders -Body @{
  building = "Sports Complex"
  location = "Pump Room"
  water = 143
  energy = 84
  sensorId = "manual-console-$stamp"
  sensorName = "Manual Console Entry"
  sensorType = "manual"
  protocol = "manual"
  batteryLevel = 100
  signalQuality = 100
  latitude = 28.6121
  longitude = 77.2295
}

Write-Step "Collecting API outputs across the product"
$latest = Invoke-Api -Method GET -Url "$backend/api/data" -Headers $authHeaders
$history = Invoke-Api -Method GET -Url "$backend/api/data/history" -Headers $authHeaders
$summary = Invoke-Api -Method GET -Url "$backend/api/analytics/summary" -Headers $authHeaders
$score = Invoke-Api -Method GET -Url "$backend/api/analytics/score" -Headers $authHeaders
$trend = Invoke-Api -Method GET -Url "$backend/api/analytics/trend" -Headers $authHeaders
$insights = Invoke-Api -Method GET -Url "$backend/api/analytics/insights" -Headers $authHeaders
$commandCenter = Invoke-Api -Method GET -Url "$backend/api/analytics/command-center" -Headers $authHeaders
$modelBefore = Invoke-Api -Method GET -Url "$backend/api/analytics/model" -Headers $authHeaders
$training = Invoke-Api -Method POST -Url "$backend/api/analytics/model/train" -Headers $authHeaders -Body @{ limit = 48 }
$modelAfter = Invoke-Api -Method GET -Url "$backend/api/analytics/model" -Headers $authHeaders
$prediction = Invoke-Api -Method GET -Url "$backend/api/predict" -Headers $authHeaders
$forecast = Invoke-Api -Method POST -Url "$backend/api/ai/forecast" -Headers $authHeaders -Body @{}
$aiAnswer = Invoke-Api -Method POST -Url "$backend/api/ai/query" -Headers $authHeaders -Body @{
  question = "What should I prioritize right now across my buildings?"
  skipLLM = $true
}
$alerts = Invoke-Api -Method GET -Url "$backend/api/alerts" -Headers $authHeaders
$notifications = Invoke-Api -Method GET -Url "$backend/api/notifications?limit=10" -Headers $authHeaders
$sensors = Invoke-Api -Method GET -Url "$backend/api/sensors" -Headers $authHeaders
$sensorSummary = Invoke-Api -Method GET -Url "$backend/api/sensors/summary" -Headers $authHeaders
$workspaceOverview = Invoke-Api -Method GET -Url "$backend/api/platform/overview" -Headers $authHeaders
$workspaceTeam = Invoke-Api -Method GET -Url "$backend/api/platform/team" -Headers $authHeaders
$workspaceKeys = Invoke-Api -Method GET -Url "$backend/api/platform/api-keys" -Headers $authHeaders
$workspaceAudit = Invoke-Api -Method GET -Url "$backend/api/platform/audit?limit=10" -Headers $authHeaders
$bridge = Invoke-Api -Method GET -Url "$backend/api/iot/bridge" -Headers $authHeaders

$alertItems = @($alerts.Data)
if ($alertItems.Count -gt 0) {
  Write-Step "Acknowledging the highest-priority alert"
  $null = Invoke-Api -Method PATCH -Url "$backend/api/alerts/$($alertItems[0]._id)" -Headers $authHeaders -Body @{
    status = "ACKNOWLEDGED"
    assignToSelf = $true
    ownerName = "Codex Demo Owner"
    ownerTeam = "Sustainability Ops"
  }
  $alerts = Invoke-Api -Method GET -Url "$backend/api/alerts" -Headers $authHeaders
}

Write-Step "Validating seeded results"
Assert-True -Condition ($summary.Data.totalRecords -ge 19) -Message "Expected at least 19 telemetry records after seeding."
Assert-True -Condition (@($trend.Data).Count -ge 1) -Message "Trend data did not populate."
Assert-True -Condition ($commandCenter.Data.portfolio.trackedBuildings -ge 3) -Message "Command center did not detect multiple buildings."
Assert-True -Condition (@($commandCenter.Data.hotspots).Count -ge 1) -Message "No command-center hotspots were generated."
Assert-True -Condition (@($alerts.Data).Count -ge 1) -Message "No alerts were generated from anomaly seeding."
Assert-True -Condition ($notifications.Data.unreadCount -ge 1) -Message "Notifications did not populate."
Assert-True -Condition (@($sensors.Data.sensors).Count -ge 3) -Message "Sensors did not populate."
Assert-True -Condition ($workspaceOverview.Data.workspace.organizationName -eq $organizationName) -Message "Workspace overview does not match the seeded organization."
Assert-True -Condition (@($workspaceTeam.Data.invites).Count -ge 1) -Message "Workspace invite flow did not persist."
Assert-True -Condition (@($workspaceKeys.Data.apiKeys).Count -ge 1) -Message "Workspace API key inventory is empty."
Assert-True -Condition ($training.Data.success -eq $true) -Message "Model training failed."
Assert-True -Condition ($prediction.Data.success -eq $true -and $null -ne $prediction.Data.prediction) -Message "Prediction endpoint did not return a forecast."
Assert-True -Condition ($forecast.Data.status -eq "success" -and $null -ne $forecast.Data.prediction) -Message "AI forecast did not return a prediction."
Assert-True -Condition ($bridge.Data.success -eq $true) -Message "IoT bridge status endpoint failed."

$summaryOutput = [ordered]@{
  generatedAt = (Get-Date).ToString("o")
  credentials = @{
    email = $demoEmail
    password = $demoPassword
  }
  workspace = @{
    organizationName = $organizationName
    inviteEmail = $inviteEmail
    inviteLink = $invite.Data.inviteLink
    apiKeyPrefix = $apiKey.Data.apiKey.prefix
  }
  telemetry = @{
    totalRecords = $summary.Data.totalRecords
    totalWater = $summary.Data.totalWater
    totalEnergy = $summary.Data.totalEnergy
    latestBuilding = $latest.Data.building
    latestWater = $latest.Data.water
    latestEnergy = $latest.Data.energy
  }
  analytics = @{
    score = $score.Data.score
    riskLevel = $score.Data.risk
    historyPoints = @($history.Data).Count
    trendPoints = @($trend.Data).Count
    nextBestAction = $insights.Data.nextBestAction
  }
  commandCenter = @{
    headline = $commandCenter.Data.story.headline
    trackedBuildings = $commandCenter.Data.portfolio.trackedBuildings
    topHotspot = $commandCenter.Data.hotspots[0].building
    topIssue = $commandCenter.Data.hotspots[0].issue
    savingsOpportunity = $commandCenter.Data.portfolio.monthlySavingsOpportunity
  }
  operations = @{
    alerts = @($alerts.Data).Count
    notifications = $notifications.Data.unreadCount
    sensors = @($sensors.Data.sensors).Count
    sensorHealthScore = $sensorSummary.Data.healthScore
  }
  ml = @{
    modelActive = $modelAfter.Data.model.active
    readyToTrain = $modelBefore.Data.readyToTrain
    trainedOn = $training.Data.trainedOn
    predictedEnergyNextHour = $prediction.Data.prediction.predictedEnergyNextHour
    predictedWaterNextHour = $prediction.Data.prediction.predictedWaterNextHour
  }
  ai = @{
    mode = $aiAnswer.Data.aiMode
    preview = [string]($aiAnswer.Data.answer | Out-String)
  }
}

$outputDirectory = Split-Path -Parent $OutputPath
if ($outputDirectory) {
  New-Item -ItemType Directory -Force -Path $outputDirectory | Out-Null
}
$summaryOutput | ConvertTo-Json -Depth 10 | Set-Content -Path $OutputPath

Write-Step "End-to-end demo completed"
Write-Host "Demo user: $demoEmail" -ForegroundColor Green
Write-Host "Workspace: $organizationName" -ForegroundColor Green
Write-Host "Telemetry records: $($summary.Data.totalRecords)" -ForegroundColor Green
Write-Host "Alerts: $(@($alerts.Data).Count)" -ForegroundColor Green
Write-Host "Hotspot: $($commandCenter.Data.hotspots[0].building) -> $($commandCenter.Data.hotspots[0].issue)" -ForegroundColor Green
Write-Host "Prediction next hour: energy $($prediction.Data.prediction.predictedEnergyNextHour), water $($prediction.Data.prediction.predictedWaterNextHour)" -ForegroundColor Green
Write-Host "Summary saved to $OutputPath" -ForegroundColor Green
