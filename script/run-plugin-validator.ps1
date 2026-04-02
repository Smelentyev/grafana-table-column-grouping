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
      $buildOutput = Invoke-WebpackBuild -RepoRoot $repoRoot -OutputPath $tempBuildRoot
      Write-Host "Validator build output: $buildOutput" -ForegroundColor Green
    }
  }

  $archivePath = $null
  Invoke-Step -Title 'Packaging plugin archive' -Action {
    $archivePath = New-PluginArchive -BuildOutput $buildOutput
    Write-Host "Archive: $archivePath" -ForegroundColor Green
  }

  Push-Location $repoRoot
  try {
    Invoke-Step -Title 'Running Grafana plugin validator' -Action {
      $pullMode = if ($NoPull) { 'missing' } else { 'always' }
      & docker run --rm --pull=$pullMode -v "${archivePath}:/archive.zip" -v "${repoRoot}:/source_code" grafana/plugin-validator-cli -sourceCodeUri file:///source_code /archive.zip
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
