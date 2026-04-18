Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Get-RepoRoot {
  return (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
}

function Invoke-Step {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Title,
    [Parameter(Mandatory = $true)]
    [scriptblock]$Action
  )

  Write-Host ""
  Write-Host "==> $Title" -ForegroundColor Cyan
  & $Action
}

function Get-PackageVersion {
  param(
    [Parameter(Mandatory = $true)]
    [string]$RepoRoot
  )

  return (Get-Content (Join-Path $RepoRoot 'package.json') -Raw | ConvertFrom-Json).version
}

function Update-PluginManifestPlaceholders {
  param(
    [Parameter(Mandatory = $true)]
    [string]$PluginJsonPath,
    [Parameter(Mandatory = $true)]
    [string]$Version
  )

  $pluginJson = Get-Content $PluginJsonPath -Raw
  $pluginJson = $pluginJson.Replace('%VERSION%', $Version)
  $pluginJson = $pluginJson.Replace('%TODAY%', (Get-Date).ToString('yyyy-MM-dd'))
  Set-Content -LiteralPath $PluginJsonPath -Value $pluginJson -Encoding utf8
}

function Invoke-WebpackBuild {
  param(
    [Parameter(Mandatory = $true)]
    [string]$RepoRoot,
    [string]$OutputPath
  )

  $version = Get-PackageVersion -RepoRoot $RepoRoot
  Push-Location $RepoRoot
  try {
    if ([string]::IsNullOrWhiteSpace($OutputPath)) {
      & npm run build | Out-Host
      if ($LASTEXITCODE -ne 0) {
        throw "Build failed with exit code $LASTEXITCODE."
      }

      return (Join-Path $RepoRoot 'dist')
    }

    & npm run build -- --env production --env "outputPath=$OutputPath" --env disableCache=true | Out-Host
    if ($LASTEXITCODE -ne 0) {
      throw "Build failed with exit code $LASTEXITCODE."
    }

    Update-PluginManifestPlaceholders -PluginJsonPath (Join-Path $OutputPath 'plugin.json') -Version $version
    return $OutputPath
  }
  finally {
    Pop-Location
  }
}

function New-PluginArchive {
  param(
    [Parameter(Mandatory = $true)]
    [string]$BuildOutput
  )

  $pluginJson = Get-Content (Join-Path $BuildOutput 'plugin.json') -Raw | ConvertFrom-Json
  $pluginId = $pluginJson.id
  $pluginVersion = $pluginJson.info.version

  $stageRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("grafana-plugin-package-" + [guid]::NewGuid())
  $packageDir = Join-Path $stageRoot $pluginId
  $archivePath = Join-Path $stageRoot "$pluginId-$pluginVersion.zip"

  New-Item -ItemType Directory -Path $packageDir -Force | Out-Null
  Copy-Item -Path (Join-Path $BuildOutput '*') -Destination $packageDir -Recurse -Force
  Compress-Archive -Path $packageDir -DestinationPath $archivePath -Force

  return $archivePath
}
