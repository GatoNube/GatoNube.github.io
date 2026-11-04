# GitHub Pages one-shot deploy for a project page.
# Repo: je0on   URL: https://<username>.github.io/je0on
$ErrorActionPreference = 'Continue'
$GH   = 'C:\Program Files\GitHub CLI\gh.exe'
$DIR  = 'D:\AI\github-pages'
$REPO = 'je0on'

function Step($t) { Write-Host ''; Write-Host "===== $t =====" -ForegroundColor Cyan }

Set-Location $DIR

Step '1. auth status'
$status = (& $GH auth status 2>&1 | Out-String)
Write-Host $status
if ($status -notmatch 'Logged in') { Write-Host 'NOT LOGGED IN - run: gh auth login' -ForegroundColor Red; exit 1 }

Step '2. resolve username'
$user = (& $GH api user --jq ".login" 2>&1 | Out-String).Trim()
Write-Host "username: $user"
if (-not $user -or $user -match 'error') { Write-Host 'cannot resolve username' -ForegroundColor Red; exit 1 }

Step "3. create repo $user/$REPO"
& $GH repo view "$user/$REPO" *> $null
if ($LASTEXITCODE -eq 0) {
  Write-Host 'repo already exists, skipping create'
} else {
  & $GH repo create "$user/$REPO" --public --description "project page" 2>&1 | Out-String | Write-Host
  if ($LASTEXITCODE -ne 0) { Write-Host 'repo create failed' -ForegroundColor Red; exit 1 }
}

Step '4. git init / commit / push'
if (-not (Test-Path (Join-Path $DIR '.git'))) { & git init -b main 2>&1 | Out-String | Write-Host }
& git add -A 2>&1 | Out-String | Write-Host
& git rev-parse --verify HEAD *> $null
if ($LASTEXITCODE -ne 0) { & git commit -m "init: GitHub Pages site" 2>&1 | Out-String | Write-Host }
else { & git commit -m "update site" 2>&1 | Out-String | Write-Host }
$remoteUrl = "https://github.com/$user/$REPO.git"
$remotes = (& git remote 2>&1) -join ','
if ($remotes -notmatch 'origin') { & git remote add origin $remoteUrl 2>&1 | Out-String | Write-Host }
else { & git remote set-url origin $remoteUrl 2>&1 | Out-String | Write-Host }
& git push -u origin main --force 2>&1 | Out-String | Write-Host
Write-Host "push exit code: $LASTEXITCODE"

Step '5. enable GitHub Pages'
$tmp = Join-Path $env:TEMP 'pages-body.json'
Set-Content -Path $tmp -Value '{"source":{"branch":"main","path":"/"}}' -Encoding ascii
& $GH api -X POST "/repos/$user/$REPO/pages" --input $tmp 2>&1 | Out-String | Write-Host
if ($LASTEXITCODE -ne 0) {
  Write-Host 'POST failed (maybe exists), trying PUT' -ForegroundColor Yellow
  & $GH api -X PUT "/repos/$user/$REPO/pages" --input $tmp 2>&1 | Out-String | Write-Host
}

Step '6. pages status'
Start-Sleep -Seconds 5
$url   = (& $GH api "/repos/$user/$REPO/pages" --jq ".html_url" 2>&1 | Out-String).Trim()
$state = (& $GH api "/repos/$user/$REPO/pages" --jq ".status"   2>&1 | Out-String).Trim()
$html  = (& $GH api "/repos/$user/$REPO/pages/builds/latest" --jq ".status" 2>&1 | Out-String).Trim()
Write-Host "html_url : $url"
Write-Host "status   : $state"
Write-Host "lastbuild: $html"

Write-Host ''
Write-Host '==================================================' -ForegroundColor Green
Write-Host " SITE : https://$user.github.io/$REPO" -ForegroundColor Green
Write-Host " REPO : https://github.com/$user/$REPO" -ForegroundColor Green
Write-Host ' first publish takes 1-3 minutes' -ForegroundColor Green
Write-Host '==================================================' -ForegroundColor Green
