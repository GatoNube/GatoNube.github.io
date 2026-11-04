# Deploy a GitHub USER PAGE -> short URL https://<username>.github.io
# Requires a public repo literally named  <username>.github.io
$ErrorActionPreference = 'Continue'
$GH  = 'C:\Program Files\GitHub CLI\gh.exe'
$DIR = 'D:\AI\github-pages'

function Step($t) { Write-Host ''; Write-Host "===== $t =====" -ForegroundColor Cyan }

Set-Location $DIR

Step '1. auth status'
$status = (& $GH auth status 2>&1 | Out-String)
if ($status -notmatch 'Logged in') { Write-Host 'NOT LOGGED IN' -ForegroundColor Red; exit 1 }
Write-Host 'logged in'

Step '2. resolve username'
$user = (& $GH api user --jq ".login" 2>&1 | Out-String).Trim()
Write-Host "username: $user"
if (-not $user -or $user -match 'error') { exit 1 }

$REPO = "$user.github.io"
Write-Host "user-page repo will be: $REPO"

Step "3. create repo $user/$REPO (public)"
& $GH repo view "$user/$REPO" *> $null
if ($LASTEXITCODE -eq 0) {
  Write-Host 'repo already exists, skipping create'
} else {
  & $GH repo create "$user/$REPO" --public --description "user page" 2>&1 | Out-String | Write-Host
  if ($LASTEXITCODE -ne 0) { Write-Host 'repo create failed' -ForegroundColor Red; exit 1 }
}

Step '4. commit local changes'
& git add -A 2>&1 | Out-String | Write-Host
& git commit -m "switch to user page (short URL)" 2>&1 | Out-String | Write-Host

Step '5. point origin at the user-page repo and push'
& git remote set-url origin "https://github.com/$user/$REPO.git" 2>&1 | Out-String | Write-Host
& git push -u origin main --force 2>&1 | Out-String | Write-Host
Write-Host "push exit code: $LASTEXITCODE"

Step '6. enable GitHub Pages'
$tmp = Join-Path $env:TEMP 'pages-body2.json'
Set-Content -Path $tmp -Value '{"source":{"branch":"main","path":"/"}}' -Encoding ascii
& $GH api -X POST "/repos/$user/$REPO/pages" --input $tmp 2>&1 | Out-String | Write-Host
if ($LASTEXITCODE -ne 0) {
  Write-Host 'POST failed (maybe exists), trying PUT' -ForegroundColor Yellow
  & $GH api -X PUT "/repos/$user/$REPO/pages" --input $tmp 2>&1 | Out-String | Write-Host
}

Step '7. pages status'
Start-Sleep -Seconds 5
$url   = (& $GH api "/repos/$user/$REPO/pages" --jq ".html_url" 2>&1 | Out-String).Trim()
$state = (& $GH api "/repos/$user/$REPO/pages" --jq ".status"   2>&1 | Out-String).Trim()
Write-Host "html_url : $url"
Write-Host "status   : $state"

Write-Host ''
Write-Host '==================================================' -ForegroundColor Green
Write-Host " SHORT URL : https://$user.github.io" -ForegroundColor Green
Write-Host " REPO      : https://github.com/$user/$REPO" -ForegroundColor Green
Write-Host '==================================================' -ForegroundColor Green
