param(
  [switch]$SkipBuild,
  [switch]$NoPull
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

. (Join-Path $PSScriptRoot 'Common.ps1')

$repoRoot = Get-RepoRoot
$buildOutput = Join-Path $repoRoot 'dist'
$tempBuildRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("grafana-validator-build-" + [guid]::NewGuid())

try {
  if (-not $SkipBuild) {
    Invoke-Step -Title 'Building plugin for validator' -Action {
      $script:buildOutput = Invoke-WebpackBuild -RepoRoot $repoRoot -OutputPath $tempBuildRoot
      Write-Host "Validator build output: $script:buildOutput" -ForegroundColor Green
    }
  }

  $archivePath = $null
  Invoke-Step -Title 'Packaging plugin archive' -Action {
    $script:archivePath = New-PluginArchive -BuildOutput $script:buildOutput
    Write-Host "Archive: $script:archivePath" -ForegroundColor Green
  }

  Push-Location $repoRoot
  try {
    Invoke-Step -Title 'Running Grafana plugin validator' -Action {
      $pullMode = if ($NoPull) { 'missing' } else { 'always' }
      $archivePathResolved = (Resolve-Path -LiteralPath $script:archivePath).ProviderPath
      $repoRootResolved = (Resolve-Path -LiteralPath $repoRoot).ProviderPath
      $dockerArgs = @(
        'run',
        '--rm',
        "--pull=$pullMode",
        '--mount',
        "type=bind,src=$archivePathResolved,dst=/archive.zip,readonly",
        '--mount',
        "type=bind,src=$repoRootResolved,dst=/source_code,readonly",
        'grafana/plugin-validator-cli',
        '-sourceCodeUri',
        'file:///source_code',
        '/archive.zip'
      )
      & docker @dockerArgs
      if ($LASTEXITCODE -ne 0) {
        throw "Plugin validator failed with exit code $LASTEXITCODE."
      }
    }
  }
  finally {
    Pop-Location
  }
}
finally {
  if ((Test-Path $tempBuildRoot) -and -not $SkipBuild) {
    Remove-Item -LiteralPath $tempBuildRoot -Recurse -Force
  }
}
