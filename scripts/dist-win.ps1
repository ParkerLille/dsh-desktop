$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$cache = Join-Path $root '.cache\electron-builder'
$nsisArchive = Join-Path $cache 'nsis-3.0.4.1.7z'
$resourcesArchive = Join-Path $cache 'nsis-resources-3.4.1.7z'
$nsisDir = Join-Path $cache 'nsis-3.0.4.1'
$resourcesDir = Join-Path $cache 'nsis-resources-3.4.1'
$nsisHash = '9877df902530f96357d13a7a31ae2b9df67f48b11ffc9a1700a7c961574ec5fa'
$resourcesHash = '593a9a92ef958321293ac6a2ee61e64bf1bd543142a5bd6b3d310709cc924103'
$mirror = 'https://registry.npmmirror.com/-/binary/electron-builder-binaries'

function Get-VerifiedArchive([string]$url, [string]$path, [string]$hash) {
  if (Test-Path $path) {
    $actual = (Get-FileHash $path -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($actual -eq $hash) { return }
    Remove-Item $path -Force
  }
  Invoke-WebRequest -Uri $url -OutFile $path -TimeoutSec 120
  $actual = (Get-FileHash $path -Algorithm SHA256).Hash.ToLowerInvariant()
  if ($actual -ne $hash) { throw "Checksum mismatch for $path" }
}

New-Item -ItemType Directory -Force -Path $cache | Out-Null
Get-VerifiedArchive "$mirror/nsis-3.0.4.1/nsis-3.0.4.1.7z" $nsisArchive $nsisHash
Get-VerifiedArchive "$mirror/nsis-resources-3.4.1/nsis-resources-3.4.1.7z" $resourcesArchive $resourcesHash

$sevenZip = Get-ChildItem (Join-Path $root 'node_modules\.pnpm') -Filter '7z.exe' -Recurse |
  Where-Object FullName -Like '*electron-winstaller*' |
  Select-Object -First 1 -ExpandProperty FullName
if (-not $sevenZip) { throw '7z.exe from electron-winstaller was not found; run pnpm install first' }

if (-not (Test-Path (Join-Path $nsisDir 'Bin\makensis.exe'))) {
  New-Item -ItemType Directory -Force -Path $nsisDir | Out-Null
  & $sevenZip x $nsisArchive "-o$nsisDir" -y | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'NSIS extraction failed' }
}
if (-not (Test-Path (Join-Path $resourcesDir 'plugins'))) {
  New-Item -ItemType Directory -Force -Path $resourcesDir | Out-Null
  & $sevenZip x $resourcesArchive "-o$resourcesDir" -y | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'NSIS resources extraction failed' }
}

$env:ELECTRON_BUILDER_NSIS_DIR = $nsisDir
$env:ELECTRON_BUILDER_NSIS_RESOURCES_DIR = $resourcesDir
Push-Location $root
try {
  pnpm build
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
  pnpm exec electron-builder --win nsis
  exit $LASTEXITCODE
} finally {
  Pop-Location
}
