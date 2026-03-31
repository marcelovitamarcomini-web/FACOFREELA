$ErrorActionPreference = 'Stop'

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
$distDir = Join-Path $repoRoot 'dist'
$deployDir = Join-Path $repoRoot 'deploy'
$stageDir = Join-Path $deployDir 'hostgator-root'
$zipPath = Join-Path $deployDir 'beta.facofreela.com.br.zip'
$requiredItems = @('index.html', '.htaccess', 'assets')

if (-not (Test-Path -LiteralPath $distDir)) {
  throw "Build nao encontrado em '$distDir'. Rode 'npm run build:client' antes de empacotar."
}

foreach ($item in $requiredItems) {
  if (-not (Test-Path -LiteralPath (Join-Path $distDir $item))) {
    throw "Item obrigatorio ausente no build: '$item'."
  }
}

if (Test-Path -LiteralPath $stageDir) {
  Remove-Item -LiteralPath $stageDir -Recurse -Force
}

if (-not (Test-Path -LiteralPath $deployDir)) {
  New-Item -ItemType Directory -Path $deployDir | Out-Null
}

New-Item -ItemType Directory -Path $stageDir | Out-Null

Get-ChildItem -LiteralPath $distDir -Force | ForEach-Object {
  if ($_.Name -eq 'server') {
    return
  }

  Copy-Item -LiteralPath $_.FullName -Destination (Join-Path $stageDir $_.Name) -Recurse -Force
}

if (Test-Path -LiteralPath $zipPath) {
  Remove-Item -LiteralPath $zipPath -Force
}

$archiveItems = Get-ChildItem -LiteralPath $stageDir -Force
if (-not $archiveItems) {
  throw "Nenhum arquivo encontrado em '$stageDir' para gerar o ZIP."
}

Compress-Archive -LiteralPath $archiveItems.FullName -DestinationPath $zipPath -Force

Write-Host "Pacote HostGator pronto:"
Write-Host "  Pasta: $stageDir"
Write-Host "  ZIP:   $zipPath"
