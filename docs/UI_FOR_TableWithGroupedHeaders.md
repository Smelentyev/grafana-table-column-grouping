# План: Реализация UI поведения колонок в TableWithGroupedHeaders

## Цель
Реализовать полное UI поведение колонок в `TableWithGroupedHeaders` аналогично оригинальной `TableNG`:
- Сортировка
- Фильтрация
- Type icons
- Hover states

## Файлы для изменения

| Файл | Изменения |
|------|-----------|
| [TableWithGroupedHeaders.tsx](../src/components/Table/TableNG/TableWithGroupedHeaders.tsx) | Основные изменения (~135 строк) |

## Этап 1: Добавление сортировки

### 1.1 Новые импорты
```typescript
import { SortColumn } from 'react-data-grid';
import { Icon } from '@grafana/ui';
import { FieldType } from '@grafana/data';
import { applySort, getColumnTypes, getDisplayName } from './utils';
```

### 1.2 Обновить интерфейс HeaderCell
```typescript
interface HeaderCell {
  name: string;
  colSpan: number;
  rowSpan: number;
  level: number;
  columnIndex: number;
  field?: Field;
  isSortable: boolean;    // NEW: только для leaf headers с field
  isFilterable: boolean;  // NEW: из field.config.custom.filterable
}
```

### 1.3 Добавить состояние сортировки
```typescript
const [sortColumns, setSortColumns] = useState<SortColumn[]>([]);
const columnTypes = useMemo(() => getColumnTypes(data.fields), [data.fields]);
```

### 1.4 Создать handleHeaderClick
```typescript
const handleHeaderClick = useCallback((cell: HeaderCell) => {
  if (!cell.field || !cell.isSortable) return;

  const fieldName = cell.field.name;
  setSortColumns(prev => {
    const existing = prev.find(sc => sc.columnKey === fieldName);
    if (!existing) return [{ columnKey: fieldName, direction: 'ASC' }];
    if (existing.direction === 'ASC') return [{ columnKey: fieldName, direction: 'DESC' }];
    return [];
  });
}, []);
```

### 1.5 Применить сортировку к данным
```typescript
const sortedData = useMemo(() => {
  if (sortColumns.length === 0) return filteredData;

  // Конвертировать в TableRow[], сортировать, конвертировать обратно
  const rows = frameToTableRows(filteredData);
  const sorted = applySort(rows, filteredData.fields, sortColumns, columnTypes, false);
  return tableRowsToFrame(sorted, filteredData);
}, [filteredData, sortColumns, columnTypes]);
```

### 1.6 Добавить иконку сортировки в заголовок
```tsx
{sortColumns.some(sc => sc.columnKey === cell.field?.name) && (
  <Icon
    name={sortColumns.find(sc => sc.columnKey === cell.field?.name)?.direction === 'ASC'
      ? 'arrow-up' : 'arrow-down'}
    size="lg"
  />
)}
```

## Этап 2: Type Icons

### 2.1 Добавить функцию getFieldTypeIcon
```typescript
function getFieldTypeIcon(field: Field): string {
  switch (field.type) {
    case FieldType.time: return 'clock-nine';
    case FieldType.string: return 'font';
    case FieldType.number: return 'calculator-alt';
    case FieldType.boolean: return 'toggle-on';
    case FieldType.other: return 'brackets-curly';
    default: return 'question-circle';
  }
}
```

### 2.2 Рендерить иконку в заголовке
```tsx
{showTypeIcons && cell.field && (
  <Icon
    className={styles.headerCellIcon}
    name={getFieldTypeIcon(cell.field) as any}
    title={cell.field.type}
    size="sm"
  />
)}
```

## Этап 3: Интеграция Filter

### 3.1 Импорты
```typescript
import { Filter } from './Filter/Filter';
import { FilterType, TableRow } from './types';
```

### 3.2 Добавить состояние фильтра
```typescript
const [filter, setFilter] = useState<FilterType>({});
const crossFilterOrder = useMemo(() => Object.keys(filter), [filter]);
const crossFilterRows = useMemo(() => {/* логика из hooks.ts */}, [tableRows, filter]);
```

### 3.3 Создать tableRows для Filter
```typescript
const tableRows = useMemo((): TableRow[] => {
  const rows: TableRow[] = [];
  for (let i = 0; i < data.length; i++) {
    const row: TableRow = { __depth: 0, __index: i };
    data.fields.forEach(field => {
      row[getDisplayName(field)] = field.values[i];
    });
    rows.push(row);
  }
  return rows;
}, [data]);
```

### 3.4 Рендерить Filter в заголовке
```tsx
{cell.isFilterable && cell.field && (
  <Filter
    name={cell.field.name}
    rows={tableRows}
    filter={filter}
    setFilter={setFilter}
    field={cell.field}
    crossFilterOrder={crossFilterOrder}
    crossFilterRows={crossFilterRows}
    iconClassName={styles.headerCellIcon}
  />
)}
```

## Этап 4: Hover States

### 4.1 Добавить CSS стили
```typescript
sortableHeader: css`
  cursor: pointer;
  &:hover {
    text-decoration: underline;
  }
`,
headerCellIcon: css`
  margin-left: ${theme.spacing(0.5)};
  color: ${theme.colors.text.secondary};
`,
headerCellClickable: css`
  cursor: pointer;
  &:hover {
    background-color: ${theme.colors.action.hover};
  }
`,
```

### 4.2 Применить стили к th
```tsx
<th
  className={cx(
    styles.headerCell,
    wrapHeaderText ? styles.headerCellWrap : styles.headerCellNoWrap,
    cell.isSortable && styles.headerCellClickable
  )}
  onClick={() => cell.isSortable && handleHeaderClick(cell)}
>
```

## Этап 5: Обновить processGroupItem

В местах создания HeaderCell добавить флаги:
```typescript
rows[startLevel].push({
  name: field.name,
  colSpan: 1,
  rowSpan: 1,
  level: startLevel,
  columnIndex: startColumnIndex,
  field: field,
  isSortable: true, // leaf element
  isFilterable: field.config?.custom?.filterable ?? false,
});
```

## Верификация

1. **Сортировка:**
   - [ ] Клик на заголовок меняет направление ASC → DESC → none
   - [ ] Иконка arrow-up/arrow-down отображается
   - [ ] Данные в таблице сортируются
   - [ ] Grouped headers (не-leaf) не реагируют на клик

2. **Фильтрация:**
   - [ ] Иконка фильтра появляется для filterable полей
   - [ ] Popup открывается при клике
   - [ ] Выбор значений фильтрует данные
   - [ ] Cross-filtering работает

3. **Type Icons:**
   - [ ] Иконки типов отображаются когда `showTypeIcons=true`
   - [ ] Правильные иконки для каждого типа

4. **Hover States:**
   - [ ] cursor:pointer на кликабельных заголовках
   - [ ] underline при hover
   - [ ] Визуальный feedback

5. **Существующий функционал:**
   - [ ] Resize колонок работает
   - [ ] Data Links работают
   - [ ] Cell Actions работают
