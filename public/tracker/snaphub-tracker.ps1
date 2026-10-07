<#
.SYNOPSIS
  Snap Hub tracker for Marvel Snap on PC.
.DESCRIPTION
  Reads (never changes) GameState.json and AccountState.json in Marvel Snap's nvprod folder.
  Saves completed games before upload. Captured games survive outages and restarts.
  Keep this window open while playing: Marvel Snap keeps only its most recent game.
  The private queue includes your tracker key; do not share it.
  -Once captures the current file and tries due uploads once (exit 1 if any remain).
  -RetryHeld retries rejected games with their ORIGINAL site, key and account header.
  -Reset changes settings for new games only; it never changes or clears queued games.
  File layout knowledge: github.com/Razviar/marvelsnaptracker.
#>
[CmdletBinding()]
param(
  [string]$Site,
  [string]$Key,
  [string]$StateDir = (Join-Path $env:USERPROFILE 'AppData\LocalLow\Second Dinner\SNAP\Standalone\States\nvprod'),
  [string]$ConfigDir = (Join-Path $env:APPDATA 'SnapHub'),
  [ValidateRange(1, 60)][int]$IntervalSeconds = 5,
  [switch]$SaveRaw,
  [switch]$Once,
  [switch]$Reset,
  [switch]$RetryHeld
)
$ErrorActionPreference = 'Stop'
$Version = '1.1.0'
[Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
Add-Type -AssemblyName System.Net.Http
$ConfigDir = [IO.Path]::GetFullPath($ConfigDir)
$ConfigFile = Join-Path $ConfigDir 'tracker.json'
$SeenFile = Join-Path $ConfigDir 'uploaded-games.txt'
$CapturedFile = Join-Path $ConfigDir 'last-captured-game.txt'
$QueueDir = Join-Path $ConfigDir 'queue'
New-Item -ItemType Directory -Force -Path $QueueDir | Out-Null

function Write-Status([string]$Message, [string]$Color = 'Gray') {
  Write-Host ('[{0}] {1}' -f (Get-Date -Format 'HH:mm:ss'), $Message) -ForegroundColor $Color
}
function Write-AtomicText([string]$Path, [string]$Text) {
  $temporary = "$Path.$([guid]::NewGuid().ToString('N')).tmp"
  try {
    $bytes = [Text.Encoding]::UTF8.GetBytes($Text)
    $stream = [IO.File]::Open($temporary, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write, [IO.FileShare]::None)
    try { $stream.Write($bytes, 0, $bytes.Length); $stream.Flush($true) } finally { $stream.Dispose() }
    if ([IO.File]::Exists($Path)) { [IO.File]::Replace($temporary, $Path, [NullString]::Value) }
    else { [IO.File]::Move($temporary, $Path) }
  } finally { if ([IO.File]::Exists($temporary)) { [IO.File]::Delete($temporary) } }
}
function Get-Hash([string]$Text) {
  $hash = [Security.Cryptography.SHA256]::Create()
  try { return ([BitConverter]::ToString($hash.ComputeHash([Text.Encoding]::UTF8.GetBytes($Text)))).Replace('-', '').ToLowerInvariant() }
  finally { $hash.Dispose() }
}
function Read-SharedBytes([string]$Path) {
  $share = [IO.FileShare]::ReadWrite -bor [IO.FileShare]::Delete
  $fs = [IO.File]::Open($Path, [IO.FileMode]::Open, [IO.FileAccess]::Read, $share)
  $ms = New-Object IO.MemoryStream
  try { $fs.CopyTo($ms); return , $ms.ToArray() }
  finally { $fs.Dispose(); $ms.Dispose() }
}
function ConvertTo-Gzip([byte[]]$Bytes) {
  $ms = New-Object IO.MemoryStream
  $gz = New-Object IO.Compression.GZipStream($ms, [IO.Compression.CompressionMode]::Compress)
  try { $gz.Write($Bytes, 0, $Bytes.Length); $gz.Close(); return , $ms.ToArray() }
  finally { $gz.Dispose(); $ms.Dispose() }
}
function Get-AccountId {
  $path = Join-Path $StateDir 'AccountState.json'
  if (-not (Test-Path -LiteralPath $path)) { return $null }
  try {
    $text = [Text.Encoding]::UTF8.GetString((Read-SharedBytes $path)).TrimStart([char]0xFEFF)
    $m = [regex]::Match($text, '"Account"\s*:\s*\{[^{}]*?"Id"\s*:\s*"([^"]+)"')
    if ($m.Success) { return $m.Groups[1].Value }
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
function Save-Entry($Entry) { Write-AtomicText $Entry.Path ($Entry.Data | ConvertTo-Json -Depth 6 -Compress) }
function Show-Queue {
  $held = @($script:Queue.Values | Where-Object { $_.Data.held }).Count + $script:Unreadable
  $suffix = if ($held) { " ($held need attention)" } else { '' }
  Write-Status ("{0} games waiting to upload{1}." -f ($script:Queue.Count + $script:Unreadable), $suffix)
}
function Set-UploadFailure($Entry, [string]$Why, [bool]$Held, [int]$RetryAfter = 0) {
  $Entry.Data.attempts = 1 + [int]$Entry.Data.attempts
  $delay = [int][Math]::Min(300, 10 * [Math]::Pow(2, [Math]::Min(5, $Entry.Data.attempts - 1)))
  $delay = [Math]::Max($delay, [Math]::Min(3600, $RetryAfter))
  $Entry.Data.nextAttempt = [DateTime]::UtcNow.AddSeconds($delay).ToString('o')
  $Entry.Data.held = $Held
  $Entry.Data.lastError = $Why
  Save-Entry $Entry
  if ($Held) {
    Write-Status "Game $($Entry.Data.gameId) needs attention: $Why. Its local copy is kept in $QueueDir." 'Red'
    Write-Status 'Fix the original key/site or report the parser error, then run with -RetryHeld. A new key only applies to new games.' 'Yellow'
  } else {
    Write-Status "Upload unavailable ($Why). Saved locally; retrying in $delay seconds while still watching games." 'DarkYellow'
  }
  Show-Queue
}
function Start-Upload($Entry) {
  # Bind requests to capture-time settings. Never reassign a backlog to another account.
  $request = New-Object Net.Http.HttpRequestMessage([Net.Http.HttpMethod]::Post, "$($Entry.Data.site)/api/tracker/games")
  $request.Headers.Authorization = New-Object Net.Http.Headers.AuthenticationHeaderValue('Bearer', [string]$Entry.Data.key)
  [void]$request.Headers.TryAddWithoutValidation('X-Snaphub-Encoding', 'gzip')
  if ($Entry.Data.created) {
    # PowerShell 7.5 converts ISO strings to DateTime while 5.1 keeps strings.
    $capturedAt = if ($Entry.Data.created -is [DateTime]) { $Entry.Data.created.ToUniversalTime().ToString('o', [Globalization.CultureInfo]::InvariantCulture) } else { [string]$Entry.Data.created }
    [void]$request.Headers.TryAddWithoutValidation('X-Snaphub-Captured-At', $capturedAt)
  }
  if ($Entry.Data.accountId) { [void]$request.Headers.TryAddWithoutValidation('X-Snap-Account-Id', [string]$Entry.Data.accountId) }
  $body = [Convert]::FromBase64String($Entry.Data.body)
  $request.Content = New-Object Net.Http.ByteArrayContent(, $body)
  $request.Content.Headers.ContentType = New-Object Net.Http.Headers.MediaTypeHeaderValue('application/json')
  try { return [pscustomobject]@{ Entry = $Entry; Request = $request; Task = $script:Client.SendAsync($request) } }
  catch { $request.Dispose(); throw }
}
function Complete-Upload($Upload) {
  $entry = $Upload.Entry
  $response = $null
  try {
    try { $response = $Upload.Task.GetAwaiter().GetResult() }
    catch { Set-UploadFailure $entry 'connection failed or timed out' $false; return }
    $status = [int]$response.StatusCode
    $reply = $null
    try { $reply = $response.Content.ReadAsStringAsync().GetAwaiter().GetResult() | ConvertFrom-Json } catch { }
    # A login page returning 200 is not an acknowledgement. Server dedupe returns a game too.
    if ($status -eq 200 -and $reply.ok -eq $true -and $reply.game.gameId -eq $entry.Data.gameId) {
      # Persist acknowledgement before removing payload; a lost response safely deduplicates.
      $history = @(@($script:SeenOrder) + @([string]$entry.Data.gameId) | Select-Object -Last 2000)
      Write-AtomicText $SeenFile (($history -join "`n") + "`n")
      $script:SeenOrder = $history
      [void]$script:Seen.Add([string]$entry.Data.gameId)
      [IO.File]::Delete($entry.Path)
      [void]$script:Queue.Remove($entry.Path)
      if ($reply.duplicate) { Write-Status "Already recorded game $($entry.Data.gameId)" }
      else {
        $g = $reply.game
        $cubes = if ($g.cubes -gt 0) { "+$($g.cubes)" } else { "$($g.cubes)" }
        $color = switch ($g.result) { 'win' { 'Green' } 'loss' { 'Red' } default { 'Yellow' } }
        Write-Status ("{0} {1} cubes | {2}" -f ([string]$g.result).ToUpper(), $cubes, $g.deckName) $color
      }
      Show-Queue
    } else {
      $held = $status -ge 400 -and $status -lt 500 -and $status -notin @(408, 425, 429)
      $why = "HTTP $status"
      if ($status -in @(401, 403)) { $why += ' - original tracker key was not accepted' }
      elseif ($status -eq 422) { $why += ' - the site could not read this game' }
      elseif ($status -eq 200) { $why += ' - missing game acknowledgement' }
      $retryAfter = 0
      if ($response.Headers.RetryAfter) {
        if ($response.Headers.RetryAfter.Delta) { $retryAfter = [int]$response.Headers.RetryAfter.Delta.TotalSeconds }
        elseif ($response.Headers.RetryAfter.Date) { $retryAfter = [int]($response.Headers.RetryAfter.Date.UtcDateTime - [DateTime]::UtcNow).TotalSeconds }
      }
      Set-UploadFailure $entry $why $held $retryAfter
    }
  } finally {
    if ($response) { $response.Dispose() }
    $Upload.Request.Dispose()
  }
}

# Multiple windows must not race to capture, acknowledge or remove the same files.
try { $lock = [IO.File]::Open((Join-Path $ConfigDir 'tracker.lock'), [IO.FileMode]::OpenOrCreate, [IO.FileAccess]::ReadWrite, [IO.FileShare]::None) }
catch { Write-Status 'Another tracker is already using this settings folder. Close that window first.' 'Red'; exit 1 }
$script:Client = $null
$active = $null
$exitCode = 0
try {
  $config = [ordered]@{ site = ''; key = '' }
  if ((Test-Path -LiteralPath $ConfigFile) -and -not $Reset) {
    try {
      $saved = Get-Content -Raw -LiteralPath $ConfigFile | ConvertFrom-Json
      $config.site = [string]$saved.site; $config.key = [string]$saved.key
    } catch { }
  }
  if ($Site) { $config.site = $Site }
  if ($Key) { $config.key = $Key }
  if (-not $config.site) { $config.site = Read-Host 'Snap Hub address (for example https://snap-hub.app)' }
  if (-not $config.key) { $config.key = Read-Host 'Paste your tracker key (starts with shk_)' }
  $config.site = $config.site.Trim().TrimEnd('/')
  $config.key = $config.key.Trim()
  $uri = $null
  if (-not [Uri]::TryCreate($config.site, [UriKind]::Absolute, [ref]$uri) -or $uri.Scheme -notin @('https', 'http') -or $uri.UserInfo -or $uri.Query -or $uri.Fragment) {
    throw 'Use a complete http(s) site address without a query or sign-in details.'
  }
  Write-AtomicText $ConfigFile ($config | ConvertTo-Json)
  Write-Host "`n  SNAP HUB tracker $Version`n" -ForegroundColor Yellow
  $GameFile = Join-Path $StateDir 'GameState.json'
  Write-Status "Watching $GameFile"
  Write-Status "Captured games are saved in $QueueDir before upload. Keep this folder private."
  Write-Status 'Leave this window open while you play. Ctrl+C to stop.'
  if (-not (Test-Path -LiteralPath $StateDir)) {
    Write-Status 'Game folder is missing. Open Marvel Snap or use -StateDir for its nvprod folder. Saved uploads will still be retried.' 'Yellow'
  }
  $script:Seen = New-Object 'System.Collections.Generic.HashSet[string]'
  $script:SeenOrder = @()
  if (Test-Path -LiteralPath $SeenFile) {
    $script:SeenOrder = @(Get-Content -LiteralPath $SeenFile | Select-Object -Last 2000)
    foreach ($id in $script:SeenOrder) { [void]$script:Seen.Add($id) }
  }
  # Separate from the bounded history: changing settings or draining a large backlog
  # must not recapture the unchanged current file under a different key/account.
  $lastCaptured = ''
  if (Test-Path -LiteralPath $CapturedFile) { $lastCaptured = (Get-Content -Raw -LiteralPath $CapturedFile).Trim() }
  $script:Queue = @{}
  $script:Unreadable = 0
  $known = New-Object 'System.Collections.Generic.HashSet[string]'
  foreach ($file in @(Get-ChildItem -LiteralPath $QueueDir -Filter '*.json' -Recurse -File)) {
    try {
      $data = Get-Content -Raw -LiteralPath $file.FullName | ConvertFrom-Json
      if ($data.version -ne 1 -or -not $data.gameId -or -not $data.site -or -not $data.key -or -not $data.body) { throw 'Invalid queue record' }
      $null = [DateTime]::Parse($data.nextAttempt)
      if ($script:Seen.Contains([string]$data.gameId)) { [IO.File]::Delete($file.FullName); continue }
      [void]$known.Add([string]$data.gameId)
      $entry = [pscustomobject]@{ Path = $file.FullName; Data = $data }
      if ($RetryHeld -and $data.held) { $data.held = $false; $data.nextAttempt = [DateTime]::MinValue.ToString('o'); Save-Entry $entry }
      $script:Queue[$file.FullName] = $entry
      if ($data.held) { Write-Status "Saved game $($data.gameId) needs attention ($($data.lastError)). Fix the original key/site or parser issue, then use -RetryHeld." 'Yellow' }
    } catch {
      $script:Unreadable++
      Write-Status "Cannot read queued file $($file.FullName). It has been preserved; other games can still upload." 'Red'
    }
  }
  Show-Queue
  $handler = New-Object Net.Http.HttpClientHandler
  $handler.AllowAutoRedirect = $false
  $script:Client = New-Object Net.Http.HttpClient($handler)
  $script:Client.Timeout = [TimeSpan]::FromSeconds(30)
  $script:Client.DefaultRequestHeaders.UserAgent.ParseAdd("SnapHubTracker/$Version")
  $lastWrite = [DateTime]::MinValue
  $nextCapture = [DateTime]::MinValue
  $script:NextUpload = [DateTime]::MinValue
  $captureError = ''
  $attempted = New-Object 'System.Collections.Generic.HashSet[string]'
  $capturedOnce = $false
  while ($true) {
    if ((-not $Once -or -not $capturedOnce) -and [DateTime]::UtcNow -ge $nextCapture) {
      $capturedOnce = $true
      $nextCapture = [DateTime]::UtcNow.AddSeconds($IntervalSeconds)
      try {
        $info = Get-Item -LiteralPath $GameFile -ErrorAction SilentlyContinue
        if ($info -and $info.LastWriteTimeUtc -ne $lastWrite) {
          $bytes = Read-SharedBytes $GameFile
          $text = [Text.Encoding]::UTF8.GetString($bytes).TrimStart([char]0xFEFF)
          $gameId = Get-FinishedGameId $text
          if ($gameId -and $gameId -ne $lastCaptured -and -not $known.Contains($gameId) -and -not $script:Seen.Contains($gameId)) {
            # Reject partial JSON locally, so we never freeze a mid-write payload in the queue.
            $null = $text | ConvertFrom-Json
            $scopeDir = Join-Path $QueueDir (Get-Hash ("$($config.site)`n$($config.key)"))
            New-Item -ItemType Directory -Force -Path $scopeDir | Out-Null
            $data = [pscustomobject]@{
              version = 1; gameId = $gameId; site = $config.site; key = $config.key
              accountId = Get-AccountId; body = [Convert]::ToBase64String((ConvertTo-Gzip $bytes))
              created = [DateTime]::UtcNow.ToString('o'); attempts = 0
              nextAttempt = [DateTime]::MinValue.ToString('o'); held = $false; lastError = ''
            }
            $entry = [pscustomobject]@{ Path = (Join-Path $scopeDir ((Get-Hash $gameId) + '.json')); Data = $data }
            $size = (Get-ChildItem -LiteralPath $QueueDir -Recurse -File | Measure-Object -Property Length -Sum).Sum
            if ($size + [Text.Encoding]::UTF8.GetByteCount(($data | ConvertTo-Json -Depth 6 -Compress)) -gt 256MB) {
              throw "Queue has reached 256 MB. New games cannot be saved until uploads recover or held files are moved out of $QueueDir. No saved games were deleted."
            }
            Save-Entry $entry
            $script:Queue[$entry.Path] = $entry
            [void]$known.Add($gameId)
            Write-AtomicText $CapturedFile $gameId
            $lastCaptured = $gameId
            Write-Status "Saved game $gameId locally."
            Show-Queue
            if ($SaveRaw) {
              $rawDir = Join-Path $ConfigDir 'raw'
              New-Item -ItemType Directory -Force -Path $rawDir | Out-Null
              [IO.File]::WriteAllBytes((Join-Path $rawDir ((Get-Hash $gameId) + '.json')), $bytes)
            }
          }
          $lastWrite = $info.LastWriteTimeUtc
        }
        $captureError = ''
      } catch {
        $message = $_.Exception.Message
        if ($message -ne $captureError) { Write-Status "Could not save the current game: $message. Watching for another read; existing queued games are safe." 'Red' }
        $captureError = $message
      }
    }
    if ($active -and $active.Task.IsCompleted) {
      try { Complete-Upload $active }
      catch {
        Write-Status 'Could not save upload progress. The queued copy is kept and will be retried after restart.' 'Red'
        $active.Entry.Data.held = $true
      }
      $active = $null
    }
    if (-not $active -and [DateTime]::UtcNow -ge $script:NextUpload) {
      $due = @($script:Queue.Values | Where-Object {
        -not $_.Data.held -and [DateTime]::Parse($_.Data.nextAttempt).ToUniversalTime() -le [DateTime]::UtcNow -and (-not $Once -or -not $attempted.Contains($_.Path))
      } | Sort-Object { $_.Data.created } | Select-Object -First 1)
      if ($due.Count) {
        [void]$attempted.Add($due[0].Path)
        # Space requests, but keep retry backoff per game. One failing endpoint must
        # not starve games captured for a different working endpoint.
        $script:NextUpload = [DateTime]::UtcNow.AddSeconds(1)
        try { $active = Start-Upload $due[0] }
        catch { Set-UploadFailure $due[0] 'could not prepare the saved upload' $true }
      }
    }
    if ($Once -and -not $active) {
      $remainingDue = @($script:Queue.Values | Where-Object {
        -not $_.Data.held -and -not $attempted.Contains($_.Path) -and [DateTime]::Parse($_.Data.nextAttempt).ToUniversalTime() -le [DateTime]::UtcNow
      }).Count
      if (-not $remainingDue) {
        if ($script:Queue.Count -or $script:Unreadable -or $captureError) { $exitCode = 1 }
        break
      }
    }
    Start-Sleep -Milliseconds 200
  }
} catch { Write-Status "Tracker stopped: $($_.Exception.Message)" 'Red'; $exitCode = 1 }
finally {
  if ($script:Client) { $script:Client.Dispose() }
  if ($active) { $active.Request.Dispose() }
  $lock.Dispose()
}
exit $exitCode
