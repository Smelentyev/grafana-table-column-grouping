The Business Table panel plugin transforms your data into an advanced table with powerful multi-level column headers and flexible grouping capabilities.

## ✨ Features

- **Multi-level Column Headers**: Create hierarchical header structures with unlimited nesting levels for better data organization
- **Flexible Column Grouping**: Organize columns with customizable vertical and horizontal grouping orientations
- **Full Table Functionality**: Includes all standard table features - sorting, filtering, and column resizing
- **Visual Configuration**: Intuitive UI for setting up complex header structures without writing code
- **Customizable Styling**: Field type icons and customizable header appearance to match your dashboard theme
- **Easy Integration**: Seamlessly integrates with existing Grafana dashboards and data sources

## 🎯 What's New

This release updates the plugin metadata and table internals to match current Grafana compatibility requirements.

- Updated the minimum supported Grafana version to `12.2.0`
- Replaced dynamic row mapping logic with a CSP-safe implementation that works in Grafana Cloud and hardened deployments
- Improved sparkline value measurement so it follows the active Grafana theme typography
- Reduced noisy error logging for invalid cell style JSON values

## 📦 Installation

### Using Grafana Catalog (Recommended)

1. Open your Grafana instance
2. Navigate to **Administration** > **Plugins**
3. Search for "Table with Column Grouping"
4. Click **Install**

### Manual Installation

1. Download the latest release from this page
2. Extract the archive to your Grafana plugins directory:
   ```bash
   unzip smelentyev-tablecolumngrouping-panel-*.zip -d /var/lib/grafana/plugins/
   ```
3. Restart Grafana:
   ```bash
   systemctl restart grafana-server
   ```
4. Verify installation in **Administration** > **Plugins**

### Using Grafana CLI

```bash
grafana-cli plugins install smelentyev-tablecolumngrouping-panel
```

## ⚙️ Requirements

- Grafana >= 12.2.0

## 🚀 Getting Started

1. Create or edit a dashboard
2. Add a new panel
3. Select **Table with Column Grouping** as the visualization type
4. Configure your data source and queries
5. Enable column grouping in the panel settings
6. Create your header structure using the visual editor

## 📚 Documentation

For detailed setup instructions and usage examples, see the [README](https://github.com/Smelentyev/grafana-table-column-grouping/blob/main/README.md).

## 🐛 Support

- [Report an issue](https://github.com/Smelentyev/grafana-table-column-grouping/issues)
- [Request a feature](https://github.com/Smelentyev/grafana-table-column-grouping/issues)
