$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

Write-Host "Building release APK and AAB..."
.\gradlew.bat :app:assembleProdRelease :app:bundleProdRelease :app:assembleCloneRelease :app:bundleCloneRelease

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupDir = Join-Path $root "backup\releases\$timestamp"
New-Item -ItemType Directory -Force $backupDir | Out-Null

$files = @(
    "app\build\outputs\apk\prod\release\app-prod-release.apk",
    "app\build\outputs\apk\prod\release\app-prod-release-unsigned.apk",
    "app\build\outputs\bundle\prodRelease\app-prod-release.aab",
    "app\build\outputs\apk\clone\release\app-clone-release.apk",
    "app\build\outputs\apk\clone\release\app-clone-release-unsigned.apk",
    "app\build\outputs\bundle\cloneRelease\app-clone-release.aab"
)

foreach ($relPath in $files) {
    $full = Join-Path $root $relPath
    if (Test-Path $full) {
        Copy-Item $full $backupDir -Force
    }
}

Write-Host "Backup created: $backupDir"
Get-ChildItem $backupDir | Select-Object Name, Length
