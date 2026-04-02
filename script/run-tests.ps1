Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

. (Join-Path $PSScriptRoot 'Common.ps1')

$repoRoot = Get-RepoRoot

Push-Location $repoRoot
try {
  Invoke-Step -Title 'Running Jest' -Action {
    & npm run test:ci
    if ($LASTEXITCODE -ne 0) {
      throw "Jest failed with exit code $LASTEXITCODE."
    }
  }

  Invoke-Step -Title 'Running ESLint' -Action {
    & npx eslint . --no-cache
    if ($LASTEXITCODE -ne 0) {
      throw "ESLint failed with exit code $LASTEXITCODE."
    }
  }

  Invoke-Step -Title 'Running Playwright' -Action {
    & npm run e2e
    if ($LASTEXITCODE -ne 0) {
      throw "Playwright failed with exit code $LASTEXITCODE."
    }
  }
}
finally {
  Pop-Location
}

