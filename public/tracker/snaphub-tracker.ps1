<#
.SYNOPSIS
  Snap Hub tracker for Marvel Snap on PC.

.DESCRIPTION
  Watches Marvel Snap's local game file and uploads each finished game to your Snap Hub site,
  which turns them into win rate, cube rate and match history.

  Reads (never changes):
    %USERPROFILE%\AppData\LocalLow\Second Dinner\SNAP\Standalone\States\nvprod\GameState.json
    ...\nvprod\AccountState.json  (only your account ID, which the site stores as a one-way hash)

  Uploads GameState.json after each finished game. The site keeps: result, cubes, game mode, turns,
  your deck, the cards you drew and played, the locations, and your opponent's name and revealed cards.

  Only games that finish while this window is open are recorded; the game keeps just the last one on disk.
  Close the window or press Ctrl+C to stop.

  File layout knowledge comes from the open-source Marvel Snap Tracker (github.com/Razviar/marvelsnaptracker).

.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File .\snaphub-tracker.ps1 -Site https://your-site.vercel.app
#>
[CmdletBinding()]
param(
  [string]$Site,
  [string]$Key,
  [string]$StateDir = (Join-Path $env:USERPROFILE 'AppData\LocalLow\Second Dinner\SNAP\Standalone\States\nvprod'),
  [string]$ConfigDir = (Join-Path $env:APPDATA 'SnapHub'),
  [int]$IntervalSeconds = 5,
  [switch]$SaveRaw,
  [switch]$Once,
  [switch]$Reset
)

$ErrorActionPreference = 'Stop'
$Version = '1.0.0'
[Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12

$ConfigFile = Join-Path $ConfigDir 'tracker.json'
$SeenFile = Join-Path $ConfigDir 'uploaded-games.txt'
New-Item -ItemType Directory -Force -Path $ConfigDir | Out-Null

function Write-Status([string]$Message, [string]$Color = 'Gray') {
  Write-Host ('[{0}] {1}' -f (Get-Date -Format 'HH:mm:ss'), $Message) -ForegroundColor $Color
}

function Read-SharedBytes([string]$Path) {
  # The game keeps its files open, so open for reading while allowing it to keep writing.
  $share = [IO.FileShare]::ReadWrite -bor [IO.FileShare]::Delete
  $fs = [IO.File]::Open($Path, [IO.FileMode]::Open, [IO.FileAccess]::Read, $share)
  try {
    $ms = New-Object IO.MemoryStream
    $fs.CopyTo($ms)
    return , $ms.ToArray()
  } finally {
    $fs.Dispose()
  }
}

function ConvertTo-Gzip([byte[]]$Bytes) {
  $ms = New-Object IO.MemoryStream
  $gz = New-Object IO.Compression.GZipStream($ms, [IO.Compression.CompressionMode]::Compress)
  $gz.Write($Bytes, 0, $Bytes.Length)
  $gz.Close()
  return , $ms.ToArray()
}

function Invoke-SnapHub([string]$Method, [string]$Path, [byte[]]$Body, [hashtable]$Headers = @{}) {
  $request = [Net.HttpWebRequest]::Create("$($script:Config.site)$Path")
  $request.Method = $Method
  $request.Timeout = 60000
  $request.UserAgent = "SnapHubTracker/$Version"
  $request.Headers.Add('Authorization', "Bearer $($script:Config.key)")
  foreach ($name in $Headers.Keys) { $request.Headers.Add($name, [string]$Headers[$name]) }
  if ($Body) {
    $request.ContentType = 'application/json'
    $request.ContentLength = $Body.Length
    $stream = $request.GetRequestStream()
    $stream.Write($Body, 0, $Body.Length)
    $stream.Close()
  }
  try {
    $response = $request.GetResponse()
  } catch {
    $ex = $_.Exception
    while ($ex -and -not ($ex -is [Net.WebException])) { $ex = $ex.InnerException }
    if ($ex -and $ex.Response) { $response = $ex.Response } else { throw }
  }
  try {
    $reader = New-Object IO.StreamReader($response.GetResponseStream())
    $text = $reader.ReadToEnd()
    $status = [int]$response.StatusCode
  } finally {
    $response.Close()
  }
  $json = $null
  try { $json = $text | ConvertFrom-Json } catch { }
  return [pscustomobject]@{ Status = $status; Body = $json; Text = $text }
}

function Get-AccountId {
  $path = Join-Path $StateDir 'AccountState.json'
  if (-not (Test-Path $path)) { return $null }
  try {
    $text = [Text.Encoding]::UTF8.GetString((Read-SharedBytes $path)).TrimStart([char]0xFEFF)
  } catch {
    return $null
  }
  $m = [regex]::Match($text, '"Account"\s*:\s*\{[^{}]*?"Id"\s*:\s*"([^"]+)"')
  if ($m.Success) { return $m.Groups[1].Value }
  try {
    $account = $text | ConvertFrom-Json
    if ($account.ServerState.Account.Id) { return [string]$account.ServerState.Account.Id }
  } catch { }
  return $null
}

function Get-FinishedGameId([string]$Text) {
  $i = $Text.IndexOf('"ClientResultMessage"')
  if ($i -lt 0) { return $null }
  $rest = $Text.Substring($i)
  if ($rest -match '^"ClientResultMessage"\s*:\s*null') { return $null }
  $m = [regex]::Match($rest, '"GameId"\s*:\s*"?([^",}\s]+)')
  if ($m.Success) { return $m.Groups[1].Value }
  return $null
}

# --- Settings -------------------------------------------------------------

$script:Config = [ordered]@{ site = ''; key = '' }
if ((Test-Path $ConfigFile) -and -not $Reset) {
  try {
    $saved = Get-Content -Raw -Path $ConfigFile | ConvertFrom-Json
    $script:Config.site = [string]$saved.site
    $script:Config.key = [string]$saved.key
  } catch { }
}
if ($Site) { $script:Config.site = $Site }
if ($Key) { $script:Config.key = $Key }
if (-not $script:Config.site) { $script:Config.site = Read-Host 'Snap Hub address (for example https://snap-hub.vercel.app)' }
if (-not $script:Config.key) { $script:Config.key = Read-Host 'Paste your tracker key (starts with shk_)' }
$script:Config.site = $script:Config.site.Trim().TrimEnd('/')
$script:Config.key = $script:Config.key.Trim()

Write-Host ''
Write-Host "  SNAP HUB tracker $Version" -ForegroundColor Yellow
Write-Host '  Build / Track / Compete' -ForegroundColor DarkYellow
Write-Host ''

try {
  $check = Invoke-SnapHub 'GET' '/api/tracker/games' $null
} catch {
  Write-Status "Can't reach $($script:Config.site): $($_.Exception.Message)" 'Red'
  exit 1
}
if ($check.Status -eq 401) {
  Write-Status 'That tracker key was not accepted. Make a new one on the Stats > Tracker page, then run again with -Reset.' 'Red'
  exit 1
}
if ($check.Status -ne 200) {
  Write-Status "Unexpected reply from the site ($($check.Status)). Check the address and try again." 'Red'
  exit 1
}
$script:Config | ConvertTo-Json | Set-Content -Path $ConfigFile -Encoding UTF8
Write-Status "Connected to $($script:Config.site) as $($check.Body.name)" 'Green'

$GameFile = Join-Path $StateDir 'GameState.json'
if (-not (Test-Path $StateDir)) {
  Write-Status "Couldn't find Marvel Snap's game files in $StateDir" 'Red'
  Write-Status 'Is the PC version of Marvel Snap installed and has it been opened once? Use -StateDir to point at the nvprod folder.' 'Red'
  exit 1
}
Write-Status "Watching $GameFile"
Write-Status 'Leave this window open while you play. Ctrl+C to stop.'

# --- Watch loop -----------------------------------------------------------

$seen = New-Object 'System.Collections.Generic.HashSet[string]'
if (Test-Path $SeenFile) { Get-Content $SeenFile | Select-Object -Last 2000 | ForEach-Object { [void]$seen.Add($_) } }
$attempts = @{}
$lastWrite = [datetime]::MinValue

while ($true) {
  try {
    $info = Get-Item -LiteralPath $GameFile -ErrorAction SilentlyContinue
    if ($info -and $info.LastWriteTimeUtc -ne $lastWrite) {
      $lastWrite = $info.LastWriteTimeUtc
      $bytes = Read-SharedBytes $GameFile
      $gameId = Get-FinishedGameId ([Text.Encoding]::UTF8.GetString($bytes))

      if ($gameId -and -not $seen.Contains($gameId)) {
        if ($SaveRaw) {
          $rawDir = Join-Path $ConfigDir 'raw'
          New-Item -ItemType Directory -Force -Path $rawDir | Out-Null
          [IO.File]::WriteAllBytes((Join-Path $rawDir (($gameId -replace '[^\w-]', '_') + '.json')), $bytes)
        }

        $headers = @{ 'X-Snaphub-Encoding' = 'gzip' }
        $accountId = Get-AccountId
        if ($accountId) { $headers['X-Snap-Account-Id'] = $accountId }
        $reply = Invoke-SnapHub 'POST' '/api/tracker/games' (ConvertTo-Gzip $bytes) $headers

        if ($reply.Status -eq 200) {
          [void]$seen.Add($gameId)
          Add-Content -Path $SeenFile -Value $gameId
          $g = $reply.Body.game
          if ($reply.Body.duplicate) {
            Write-Status "Already recorded game $gameId"
          } else {
            $cubes = if ($g.cubes -gt 0) { "+$($g.cubes)" } else { "$($g.cubes)" }
            $color = switch ($g.result) { 'win' { 'Green' } 'loss' { 'Red' } default { 'Yellow' } }
            $deck = if ($g.deckName) { $g.deckName } else { 'deck' }
            $vs = if ($g.opponentName) { " vs $($g.opponentName)" } else { '' }
            Write-Status ("{0} {1} cubes | {2}{3}" -f $g.result.ToUpper(), $cubes, $deck, $vs) $color
          }
        } elseif ($reply.Status -eq 401) {
          Write-Status 'Tracker key was revoked. Make a new one on the site and run again with -Reset.' 'Red'
          exit 1
        } else {
          $why = if ($reply.Body.error) { $reply.Body.error } else { "HTTP $($reply.Status)" }
          if ($reply.Status -eq 422 -and $reply.Body.reason -eq 'invalid-json') {
            # Caught the game mid-write. Read it again shortly; give up only if it never becomes valid.
            $attempts["partial:$gameId"] = 1 + [int]$attempts["partial:$gameId"]
            if ($attempts["partial:$gameId"] -le 20) { $lastWrite = [datetime]::MinValue }
          } elseif ($reply.Status -eq 422) {
            # The site couldn't read this game. Try again only if the file changes, up to 3 times.
            $attempts[$gameId] = 1 + [int]$attempts[$gameId]
            if ($attempts[$gameId] -ge 3) {
              [void]$seen.Add($gameId)
              Add-Content -Path $SeenFile -Value $gameId
              Write-Status "Skipped game ${gameId}: $why (run with -SaveRaw and share the file if this keeps happening)" 'Yellow'
            } else {
              Write-Status "Couldn't read game ${gameId} yet: $why" 'DarkYellow'
            }
          } else {
            Write-Status "Couldn't upload game ${gameId}: $why. Retrying." 'DarkYellow'
            $lastWrite = [datetime]::MinValue
          }
        }
      }
    }
  } catch {
    Write-Status "Problem: $($_.Exception.Message). Retrying." 'DarkYellow'
    $lastWrite = [datetime]::MinValue
  }

  if ($Once) { break }
  Start-Sleep -Seconds $IntervalSeconds
}
