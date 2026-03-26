# Changelog

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
