import React, { useState } from 'react';
import { StandardEditorProps, GrafanaTheme2 } from '@grafana/data';
import { Button, Field, Switch, VerticalGroup, HorizontalGroup, Icon, Select, RadioButtonGroup, useStyles2 } from '@grafana/ui';
import { css } from '@emotion/css';
import {
  ColumnGroupingSettings,
  Orientation,
  GroupItem,
  RootGroupItem,
  GroupContainerItem,
  ColumnItem,
} from '../Table/TableNG/types';

// Default settings
const defaultColumnGroupingSettings: ColumnGroupingSettings = {
  enabled: false,
  ungroupedColumns: [],
  rootGroups: [],
};

type Props = StandardEditorProps<ColumnGroupingSettings>;

export const ColumnGroupingEditorV2: React.FC<Props> = ({ value, onChange, context }) => {
  const settings = value || defaultColumnGroupingSettings;
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});
  const styles = useStyles2(getStyles);

  // Get available columns from the data
  const availableColumns =
    (context.data &&
      context.data[0]?.fields?.map((f) => ({
        label: f.name,
        value: f.name,
      }))) ||
    [];

  const handleEnabledChange = (enabled: boolean) => {
    onChange({
      ...settings,
      enabled,
    });
  };

  const handleAddRootGroup = () => {
    const newRootGroup: RootGroupItem = {
      id: `root-${Date.now()}`,
      type: 'root-group',
      column: '',
      orientation: 'vertical',
      children: [],
    };
    onChange({
      ...settings,
      rootGroups: [...(settings.rootGroups || []), newRootGroup],
    });
    setExpandedItems((prev) => ({ ...prev, [newRootGroup.id]: true }));
  };

  const handleRemoveRootGroup = (groupId: string) => {
    onChange({
      ...settings,
      rootGroups: (settings.rootGroups || []).filter((g) => g.id !== groupId),
    });
  };

  const handleUpdateRootGroup = (groupId: string, updates: Partial<RootGroupItem>) => {
    onChange({
      ...settings,
      rootGroups: (settings.rootGroups || []).map((g) => (g.id === groupId ? { ...g, ...updates } : g)),
    });
  };

  const handleAddChild = (parentId: string, childType: 'root-group' | 'group-container' | 'column') => {
    const createChild = (): GroupItem => {
      const id = `${childType}-${Date.now()}`;
      if (childType === 'group-container') {
        return {
          id,
          type: 'group-container',
          orientation: 'vertical',
          children: [],
        } as GroupContainerItem;
      } else {
        return {
          id,
          type: 'column',
          column: '',
        } as ColumnItem;
      }
    };

    const updateChildren = (item: GroupItem): GroupItem => {
      if (item.id === parentId) {
        if (item.type === 'root-group' || item.type === 'group-container') {
          return {
            ...item,
            children: [...item.children, createChild()],
          };
        }
      }

      if (item.type === 'root-group' || item.type === 'group-container') {
        return {
          ...item,
          children: item.children.map(updateChildren),
        };
      }

      return item;
    };

    onChange({
      ...settings,
      rootGroups: (settings.rootGroups || []).map(updateChildren) as RootGroupItem[],
    });
  };

  const handleRemoveChild = (parentId: string, childId: string) => {
    const removeFromChildren = (item: GroupItem): GroupItem => {
      if (item.id === parentId) {
        if (item.type === 'root-group' || item.type === 'group-container') {
          return {
            ...item,
            children: item.children.filter((c) => c.id !== childId),
          };
        }
      }

      if (item.type === 'root-group' || item.type === 'group-container') {
        return {
          ...item,
          children: item.children.map(removeFromChildren),
        };
      }

      return item;
    };

    onChange({
      ...settings,
      rootGroups: (settings.rootGroups || []).map(removeFromChildren) as RootGroupItem[],
    });
  };

  const handleUpdateChild = (childId: string, updates: any) => {
    const updateItem = (item: GroupItem): GroupItem => {
      if (item.id === childId) {
        return { ...item, ...updates } as GroupItem;
      }

      if (item.type === 'root-group' || item.type === 'group-container') {
        return {
          ...item,
          children: item.children.map(updateItem),
        };
      }

      return item;
    };

    onChange({
      ...settings,
      rootGroups: (settings.rootGroups || []).map(updateItem) as RootGroupItem[],
    });
  };

  const toggleExpanded = (itemId: string) => {
    setExpandedItems((prev) => ({
      ...prev,
      [itemId]: !prev[itemId],
    }));
  };

  const renderGroupItem = (item: GroupItem, parentId: string, depth = 0): JSX.Element => {
    const isExpanded = expandedItems[item.id] ?? true;

    if (item.type === 'column') {
      // Render column item
      return (
        <div key={item.id} className={styles.columnItem} style={{ marginLeft: `${depth * 20}px` }}>
          <HorizontalGroup justify="space-between" align="center">
            <Icon name="file-blank" />
            <Field label="" style={{ flex: 1, marginBottom: 0 }}>
              <Select
                options={availableColumns}
                value={item.column}
                onChange={(v) => {
                  handleUpdateChild(item.id, { column: v.value || '' });
                }}
                placeholder="Select column"
                isClearable
              />
            </Field>
            <Button
              variant="destructive"
              size="sm"
              icon="trash-alt"
              onClick={() => handleRemoveChild(parentId, item.id)}
            >
              Delete
            </Button>
          </HorizontalGroup>
        </div>
      );
    }

    if (item.type === 'group-container') {
      // Render group container
      return (
        <div key={item.id} className={styles.groupContainer} style={{ marginLeft: `${depth * 20}px` }}>
          <div className={styles.groupHeader} onClick={() => toggleExpanded(item.id)}>
            <Icon name={isExpanded ? 'angle-down' : 'angle-right'} />
            <Icon name="folder" />
            <span className={styles.groupTitle}>Group</span>
            <Button
              variant="destructive"
              size="sm"
              icon="trash-alt"
              onClick={(e) => {
                e.stopPropagation();
                handleRemoveChild(parentId, item.id);
              }}
            >
              Delete
            </Button>
          </div>

          {isExpanded && (
            <div className={styles.groupContent}>
              <Field
                label="Child elements orientation"
                description="Defines how child elements are arranged"
              >
                <RadioButtonGroup
                  options={[
                    { label: 'Vertical', value: 'vertical' as Orientation },
                    { label: 'Horizontal', value: 'horizontal' as Orientation },
                  ]}
                  value={item.orientation}
                  onChange={(v) => {
                    handleUpdateChild(item.id, { orientation: v });
                  }}
                />
              </Field>

              <div className={styles.childrenSection}>
                {item.children.map((child) => renderGroupItem(child, item.id, depth + 1))}
                <HorizontalGroup>
                  <Button
                    variant="secondary"
                    size="sm"
                    icon="plus"
                    onClick={() => handleAddChild(item.id, 'column')}
                  >
                    Add column
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    icon="folder-plus"
                    onClick={() => handleAddChild(item.id, 'group-container')}
                  >
                    Add group
                  </Button>
                </HorizontalGroup>
              </div>
            </div>
          )}
        </div>
      );
    }

    return <></>;
  };

  const renderRootGroup = (rootGroup: RootGroupItem): JSX.Element => {
    const isExpanded = expandedItems[rootGroup.id] ?? true;
    const groupLabel = rootGroup.column || 'Root group';

    return (
      <div key={rootGroup.id} className={styles.rootGroup}>
        <div className={styles.rootGroupHeader} onClick={() => toggleExpanded(rootGroup.id)}>
          <Icon name={isExpanded ? 'angle-down' : 'angle-right'} />
          <Icon name="cube" />
          <span className={styles.groupTitle}>{groupLabel}</span>
          <Button
            variant="destructive"
            size="sm"
            icon="trash-alt"
            onClick={(e) => {
              e.stopPropagation();
              handleRemoveRootGroup(rootGroup.id);
            }}
          >
            Delete group
          </Button>
        </div>

        {isExpanded && (
          <div className={styles.rootGroupContent}>
            <Field label="Main column" description="Column that will be the group header">
              <Select
                options={availableColumns}
                value={rootGroup.column}
                onChange={(v) => {
                  handleUpdateRootGroup(rootGroup.id, { column: v.value || '' });
                }}
                placeholder="Select column"
                isClearable
              />
            </Field>

            <Field
              label="Child elements orientation"
              description="Defines how child elements are arranged"
            >
              <RadioButtonGroup
                options={[
                  { label: 'Vertical', value: 'vertical' as Orientation },
                  { label: 'Horizontal', value: 'horizontal' as Orientation },
                ]}
                value={rootGroup.orientation}
                onChange={(v) => {
                  handleUpdateRootGroup(rootGroup.id, { orientation: v });
                }}
              />
            </Field>

            <div className={styles.childrenSection}>
              {rootGroup.children.map((child) => renderGroupItem(child, rootGroup.id, 0))}
              <HorizontalGroup>
                <Button
                  variant="secondary"
                  size="sm"
                  icon="plus"
                  onClick={() => handleAddChild(rootGroup.id, 'column')}
                >
                  Add column
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  icon="folder-plus"
                  onClick={() => handleAddChild(rootGroup.id, 'group-container')}
                >
                  Add group
                </Button>
              </HorizontalGroup>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <VerticalGroup spacing="md">
      <Field label="Enable column grouping" description="Enable multi-level table headers">
        <Switch value={settings.enabled} onChange={(e) => handleEnabledChange(e.currentTarget.checked)} />
      </Field>

      {settings.enabled && (
        <>
          <div className={styles.groupsContainer}>
            <div className={styles.headerRow}>
              <h3>Root groups</h3>
              <Button variant="secondary" size="sm" icon="plus" onClick={handleAddRootGroup}>
                Add root group
              </Button>
            </div>
            {(settings.rootGroups || []).map((rootGroup) => renderRootGroup(rootGroup))}
          </div>
        </>
      )}
    </VerticalGroup>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  groupsContainer: css({
    border: `1px solid ${theme.colors.border.weak}`,
    borderRadius: theme.shape.radius.default,
    padding: theme.spacing(1.5),
    background: theme.colors.background.secondary,
  }),
  headerRow: css({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing(1.5),

    h3: {
      margin: 0,
      fontSize: theme.typography.size.md,
      fontWeight: theme.typography.fontWeightMedium,
    },
  }),
  rootGroup: css({
    border: `1px solid ${theme.colors.border.medium}`,
    borderRadius: theme.shape.radius.default,
    marginBottom: theme.spacing(1),
    background: theme.colors.background.primary,
  }),
  rootGroupHeader: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.75),
    padding: theme.spacing(1, 1.25),
    cursor: 'pointer',
    userSelect: 'none',
    background: theme.colors.background.secondary,
    borderRadius: `${theme.shape.radius.default} ${theme.shape.radius.default} 0 0`,

    '&:hover': {
      background: theme.colors.emphasize(theme.colors.background.secondary, 0.03),
    },
  }),
  rootGroupContent: css({
    padding: theme.spacing(1.25),
  }),
  groupContainer: css({
    border: `1px solid ${theme.colors.border.weak}`,
    borderRadius: theme.shape.radius.default,
    marginBottom: theme.spacing(0.75),
    background: theme.colors.background.primary,
  }),
  groupHeader: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.75),
    padding: theme.spacing(0.75, 1),
    cursor: 'pointer',
    userSelect: 'none',
    background: theme.colors.background.secondary,
    borderRadius: `${theme.shape.radius.default} ${theme.shape.radius.default} 0 0`,

    '&:hover': {
      background: theme.colors.emphasize(theme.colors.background.secondary, 0.03),
    },
  }),
  groupContent: css({
    padding: theme.spacing(1),
  }),
  groupTitle: css({
    flex: 1,
    fontWeight: theme.typography.fontWeightMedium,
    fontSize: theme.typography.size.sm,
  }),
  childrenSection: css({
    marginTop: theme.spacing(0.75),
    paddingTop: 0,
  }),
  columnItem: css({
    border: `1px solid ${theme.colors.border.weak}`,
    borderRadius: theme.shape.radius.default,
    padding: theme.spacing(0.75),
    marginBottom: theme.spacing(0.75),
    background: theme.colors.background.primary,
  }),
});
