param(
  [string]$OutputPath
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

. (Join-Path $PSScriptRoot 'Common.ps1')

$repoRoot = Get-RepoRoot
$resolvedOutputPath = $null

if (-not [string]::IsNullOrWhiteSpace($OutputPath)) {
  $resolvedOutputPath = if ([System.IO.Path]::IsPathRooted($OutputPath)) {
    $OutputPath
  } else {
    Join-Path $repoRoot $OutputPath
  }
}

Invoke-Step -Title 'Building plugin dist' -Action {
  $buildOutput = Invoke-WebpackBuild -RepoRoot $repoRoot -OutputPath $resolvedOutputPath
  Write-Host "Build output: $buildOutput" -ForegroundColor Green
}

