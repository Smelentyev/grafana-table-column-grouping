# Changelog

## 1.0.10 (2026-04-18)

### Fixed
- Updated the minimum supported Grafana version to `>= 12.2.0` to match the plugin's actual runtime requirements
- Replaced CSP-blocked dynamic row mapping in the table pipeline with a standard loop-based implementation
- Switched sparkline value measurement to use the active Grafana theme typography instead of a hardcoded font size
- Removed raw invalid cell style values from error logging
- Fixed Windows execution issues in the local plugin validator scripts

### Validation
- `npm run typecheck`
- `npx eslint --no-cache .`
- `npm run build`
- `npx jest --runInBand`
- `npm run e2e`
- `./script/run-plugin-validator.ps1 -NoPull`

## 1.0.9 (2026-04-02)

### Fixed
- Adjusted the GitHub release workflow so release artifacts are still published while public-plugin signing is unavailable during Grafana review

### Notes
- Signing remains enabled as a non-blocking step and can be used after Grafana assigns a signature level


## 1.0.8 (2026-04-02)

### Fixed
- Replaced `Expression` filter execution based on arbitrary JavaScript with a safe restricted expression evaluator
- Fixed `Expression` operator selection and application flow in recent Grafana versions
- Normalized filter value handling so expression and comparison filters work reliably with raw values and display values
- Removed leftover production `console.warn(...)` from grouped header pipeline
- Replaced global react-data-grid style injection with direct stylesheet import
- Updated end-to-end tests and catalog screenshot generation to match the current provisioned dashboard
- Updated CI and release workflows for current Grafana plugin packaging and validation flow

### Validation
- `npm run typecheck`
- `npm run lint`
- `npx jest --runInBand --passWithNoTests`
- `npx playwright test`
- `grafana/plugin-validator-cli`

## 1.0.7 (2026-03-26)

### Changed
- Simplified the GitHub release workflow to publish unsigned ZIP and SHA1 artifacts while Grafana review and signing issues are unresolved

### Notes
- Public plugin signing currently fails with `409 InvalidArgument` for this plugin while it remains in `Waiting For Review`

## 1.0.6 (2026-03-26)

### Fixed
- Restored the previously working Grafana release workflow based on `grafana/plugin-actions/build-plugin@build-plugin/v1.0.2`
- Reverted the custom release pipeline after repeated signing failures in tag-based release runs

## 1.0.5 (2026-03-26)

### Fixed
- Reworked the GitHub release workflow to use the same build, sign, package, and validation steps that already pass in CI
- Switched release publishing to a direct GitHub draft release upload flow with ZIP and SHA1 artifacts

## 1.0.4 (2026-03-26)

### Fixed
- Fixed CI lint failures caused by hook dependency and array type style violations
- Updated the GitHub release workflow to use the current Grafana build action and required permissions

## 1.0.3 (2026-03-26)

### Changed
- Simplified grouped table virtual row height calculation to remove DOM measurement from the table body
- Reduced virtualized table rendering complexity by using a deterministic record height
- Removed unused table body refs and row position markers from grouped header rendering

## 1.0.1 (2026-02-20)

Initial public release with the following features:

### Features
- Multi-level column headers with hierarchical organization
- Flexible vertical and horizontal column grouping
- Root groups with customizable orientation
- Nested group containers for complex table structures
- Sorting capabilities on leaf columns
- Filtering with cross-filter support
- Column resizing with drag handles
- Field type icons display
- Customizable header text wrapping
- Cell inspection and filtering actions
- Support for data links in cells
- Responsive styling with Grafana theme integration
