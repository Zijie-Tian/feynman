param(
  [string]$Version = "latest"
)

$ErrorActionPreference = "Stop"

function Resolve-Version {
  param([string]$RequestedVersion)

  if ($RequestedVersion -and $RequestedVersion -ne "latest") {
    return $RequestedVersion.TrimStart("v")
  }

  $release = Invoke-RestMethod -Uri "https://api.github.com/repos/getcompanion-ai/feynman/releases/latest"
  if (-not $release.tag_name) {
    throw "Failed to resolve the latest Feynman release version."
  }

  return $release.tag_name.TrimStart("v")
}

function Get-ArchSuffix {
  $arch = [System.Runtime.InteropServices.RuntimeInformation]::OSArchitecture
  switch ($arch.ToString()) {
    "X64" { return "x64" }
    "Arm64" { return "arm64" }
    default { throw "Unsupported architecture: $arch" }
  }
}

$resolvedVersion = Resolve-Version -RequestedVersion $Version
$archSuffix = Get-ArchSuffix
$bundleName = "feynman-$resolvedVersion-win32-$archSuffix"
$archiveName = "$bundleName.zip"
$baseUrl = if ($env:FEYNMAN_INSTALL_BASE_URL) { $env:FEYNMAN_INSTALL_BASE_URL } else { "https://github.com/getcompanion-ai/feynman/releases/download/v$resolvedVersion" }
$downloadUrl = "$baseUrl/$archiveName"

$installRoot = Join-Path $env:LOCALAPPDATA "Programs\feynman"
$installBinDir = Join-Path $installRoot "bin"
$bundleDir = Join-Path $installRoot $bundleName

$tmpDir = Join-Path ([System.IO.Path]::GetTempPath()) ("feynman-install-" + [System.Guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Path $tmpDir | Out-Null

try {
  $archivePath = Join-Path $tmpDir $archiveName
  Write-Host "==> Downloading $archiveName"
  Invoke-WebRequest -Uri $downloadUrl -OutFile $archivePath

  New-Item -ItemType Directory -Path $installRoot -Force | Out-Null
  if (Test-Path $bundleDir) {
    Remove-Item -Recurse -Force $bundleDir
  }

  Write-Host "==> Extracting $archiveName"
  Expand-Archive -LiteralPath $archivePath -DestinationPath $installRoot -Force

  New-Item -ItemType Directory -Path $installBinDir -Force | Out-Null

  $shimPath = Join-Path $installBinDir "feynman.cmd"
  Write-Host "==> Linking feynman into $installBinDir"
  @"
@echo off
"$bundleDir\feynman.cmd" %*
"@ | Set-Content -Path $shimPath -Encoding ASCII

  $currentUserPath = [Environment]::GetEnvironmentVariable("Path", "User")
  if (-not $currentUserPath.Split(';').Contains($installBinDir)) {
    $updatedPath = if ([string]::IsNullOrWhiteSpace($currentUserPath)) {
      $installBinDir
    } else {
      "$currentUserPath;$installBinDir"
    }
    [Environment]::SetEnvironmentVariable("Path", $updatedPath, "User")
    Write-Host "Updated user PATH. Open a new shell to run feynman."
  } else {
    Write-Host "$installBinDir is already on PATH."
  }

  Write-Host "Feynman $resolvedVersion installed successfully."
} finally {
  if (Test-Path $tmpDir) {
    Remove-Item -Recurse -Force $tmpDir
  }
}
