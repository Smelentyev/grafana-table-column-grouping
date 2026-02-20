# Table with Column Grouping

![Grafana](https://img.shields.io/badge/Grafana-11.6%2B-orange)
![License](https://img.shields.io/github/license/Smelentyev/grafana-table-column-grouping)

`Table with Column Grouping` extends the standard Grafana table panel with configurable multi-level headers and column group layouts.

## Why this plugin

Grafana's default table is strong for flat column structures. This plugin is designed for datasets where columns belong to logical groups and need a clearer visual hierarchy.

Use it when you need:
- Multi-level column headers with nested groups
- Vertical or horizontal group orientation
- Familiar table behavior (sorting, filtering, resizing)
- A visual editor for group configuration

## Requirements

- Grafana `>= 11.6.0`

## Installation

### Grafana Catalog (after publication approval)

1. Open your Grafana instance.
2. Go to **Administration** -> **Plugins**.
3. Search for **Table with Column Grouping**.
4. Click **Install**.

### Manual installation (development / pre-release)

1. Build or download a plugin package.
2. Extract it into the Grafana plugins directory:

```bash
unzip smelentyev-tablecolumngrouping-panel-<version>.zip -d /var/lib/grafana/plugins/
```

3. Restart Grafana:

```bash
systemctl restart grafana-server
```

4. Verify installation in **Administration** -> **Plugins**.

## Quick start

1. Create (or edit) a dashboard panel.
2. Select **Table with Column Grouping** as visualization.
3. Configure your query.
4. In panel options, enable/configure column grouping.
5. Build header hierarchy in the grouping editor.
6. Fine-tune field display options and widths.

## Feature highlights

- Nested group headers with flexible depth
- Group orientation controls (vertical / horizontal)
- Integrated sorting and filtering flows
- Column resize support
- Compatible with field options and display modes

## Development

### Getting started

```bash
npm install
```

### Build

```bash
npm run build
```

### Type check

```bash
npm run typecheck
```

### Lint

```bash
npm run lint
```

### Unit tests

```bash
npm run test:ci
```

### Run Grafana locally (Docker)

```bash
npm run server
```

### E2E tests

```bash
npm run e2e
```

## Publishing notes

For Grafana catalog submission, keep these assets current:
- `README.md` (clear user-facing docs)
- `CHANGELOG.md` (release notes)
- `src/plugin.json` metadata (description, links, screenshots)

## License

Apache-2.0. See [LICENSE](LICENSE).

## Support

- Issues: https://github.com/Smelentyev/grafana-table-column-grouping/issues
- Repository: https://github.com/Smelentyev/grafana-table-column-grouping
