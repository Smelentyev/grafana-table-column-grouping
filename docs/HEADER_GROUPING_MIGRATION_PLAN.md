# План переноса функциональности Header Grouping на Grafana Advanced Table

## Обзор

Перенос функции группировки заголовков (Header Grouping) из `/home/ubuntu/Documents/grafana-extended-table` в `/home/ubuntu/Documents/Grafana_Advanced_Table`.

**Что переносим:**
- **Header Grouping** - многоуровневые заголовки колонок (новая иерархическая система)
- Логика построения структуры заголовков
- UI редактор для настройки групп
- Поддержка вертикальной и горизонтальной ориентации

**Что НЕ переносим:**
- Row Grouping (Log View) - карточный режим
- Фильтрацию по заголовкам (уже есть в новой версии)
- Column resizing (уже есть в новой версии)
- Хранение состояния в localStorage
- Legacy систему группировки заголовков

---

## Фаза 1: Подготовка и создание ветки

### 1.1 Создание ветки разработки
```bash
git checkout -b feature/header-grouping
```

---

## Фаза 2: Перенос типов и конфигурации

### 2.1 Добавить типы для Header Grouping

**Файл:** `src/components/Table/TableNG/types.ts`

Добавить типы из `grafana-extended-table/src/types.ts` (строки 76-117):

```typescript
// Типы для иерархической группировки заголовков
export type Orientation = 'vertical' | 'horizontal';

export interface RootGroupItem {
  type: 'root-group';
  column: string;              // Имя поля для этой группы
  orientation: Orientation;
  children: GroupChild[];
}

export interface GroupContainerItem {
  type: 'group-container';
  orientation: Orientation;
  children: GroupChild[];
}

export interface ColumnItem {
  type: 'column';
  column: string;              // Имя поля
}

export type GroupChild = RootGroupItem | GroupContainerItem | ColumnItem;

export interface ColumnGroupingSettings {
  enabled: boolean;
  ungroupedColumns: string[];   // Колонки вне групп
  rootGroups: RootGroupItem[];  // Корневые группы
}
```

### 2.2 Обновить Options интерфейс

**Файл:** `src/panelcfg.gen.ts` (будет регенерирован) или `src/types.ts`

Добавить в Options:
```typescript
export interface Options {
  // ... существующие опции
  columnGrouping?: ColumnGroupingSettings;
}
```

**Значения по умолчанию:**
```typescript
export const defaultColumnGroupingSettings: ColumnGroupingSettings = {
  enabled: false,
  ungroupedColumns: [],
  rootGroups: [],
};
```

---

## Фаза 3: Header Grouping - Компонент рендеринга

### 3.1 Создать компонент для таблицы с группированными заголовками

**Новый файл:** `src/components/Table/TableNG/TableWithGroupedHeaders.tsx`

Скопировать логику из `grafana-extended-table/src/TableWithGroupedHeaders.tsx`:

**Ключевые функции:**
- `buildHeaderStructure()` - построение структуры заголовков из rootGroups
- `calculateRowsAndColumns()` - расчет количества строк заголовка и позиций колонок
- `renderHeaderRows()` - рендеринг нескольких строк заголовков с colspan/rowspan
- Обработка ungroupedColumns (должны растягиваться на все строки заголовка)

**Важно:**
- Адаптировать под React Data Grid (используемый в новой версии)
- Интегрировать существующие компоненты HeaderCell
- Сохранить логику известных багов (по требованию пользователя)

### 3.2 Интегрировать в TableNG

**Файл:** `src/components/Table/TableNG/TableNG.tsx`

Добавить условный рендеринг:
```typescript
// Если columnGrouping.enabled === true
if (options.columnGrouping?.enabled) {
  return <TableWithGroupedHeaders {...props} />;
}

// Иначе обычная таблица
return <ReactDataGrid {...gridProps} />;
```

---

## Фаза 4: Header Grouping - UI редактор конфигурации

### 4.1 Создать редактор группировки

**Новый файл:** `src/components/editors/ColumnGroupingEditorV2.tsx`

Скопировать логику из `grafana-extended-table/src/ColumnGroupingEditorV2.tsx`:

**Функциональность:**
- Toggle для включения/выключения группировки
- Кнопка "Add main group" для создания RootGroupItem
- Рекурсивный UI для отображения вложенных групп:
  - Expandable/collapsible секции
  - Выбор поля (column) для RootGroupItem
  - Radio buttons для выбора orientation (vertical/horizontal)
  - Кнопки "Add column" и "Add sub-group"
  - Кнопки удаления элементов
- Цветовое выделение:
  - Синий - RootGroupItem
  - Оранжевый - GroupContainerItem
  - Зеленый - ColumnItem
- Список ungroupedColumns с возможностью добавления в группы

**Адаптация:**
- Использовать Grafana UI компоненты (@grafana/ui)
- Получать список доступных полей из DataFrame
- Обновлять панельные опции через onChange callback

### 4.2 Зарегистрировать редактор в module.ts

**Файл:** `src/module.ts`

Добавить в `.setPanelOptions()`:
```typescript
.addCustomEditor({
  id: 'columnGrouping',
  path: 'columnGrouping',
  name: 'Column Grouping',
  description: 'Configure multi-level column headers',
  editor: ColumnGroupingEditorV2,
  category: ['Table Display'],
})
```

---

## Фаза 5: Интеграция с существующими функциями

### 5.1 Интеграция с фильтрацией

**Файл:** `src/components/Table/TableNG/TableWithGroupedHeaders.tsx`

Обеспечить работу существующей фильтрации в сгруппированных заголовках:
- Использовать существующий компонент Filter из `Filter/Filter.tsx`
- Передавать filter state из TableNG
- Отображать filter icon в группированных ячейках заголовков

### 5.2 Интеграция с сортировкой

Обеспечить работу сортировки:
- Сортировка применяется к полям внутри групп
- Использовать существующий механизм sortBy из TableNG
- Показывать индикаторы сортировки в соответствующих ячейках

### 5.3 Интеграция с пагинацией

Убедиться что пагинация корректно работает:
- Pagination применяется после всех трансформаций
- Использовать существующий usePaginatedRows hook

---

## Фаза 6: Стилизация

### 6.1 Добавить стили для Header Grouping

**Файл:** `src/components/Table/TableNG/styles.ts`

Добавить стили:
```typescript
export const getGroupedHeaderStyles = (theme: GrafanaTheme2) => ({
  headerRow: css`
    display: flex;
    border-bottom: 1px solid ${theme.colors.border.weak};
  `,
  headerCell: css`
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 8px;
    font-weight: ${theme.typography.fontWeightMedium};
    background: ${theme.colors.background.secondary};
    border-right: 1px solid ${theme.colors.border.weak};
  `,
  mergedCell: css`
    /* Стили для merged cells с colspan/rowspan */
  `,
  verticalGroup: css`
    /* Стили для вертикальных групп */
  `,
  horizontalGroup: css`
    /* Стили для горизонтальных групп */
  `,
});
```

---

## Фаза 7: Утилиты и вспомогательные функции

### 7.1 Добавить утилиты для Header Grouping

**Файл:** `src/components/Table/TableNG/utils.ts`

Добавить функции:
```typescript
/**
 * Получить список доступных полей для группировки
 */
export function getAvailableFieldsForGrouping(data: DataFrame): Array<SelectableValue<string>> {
  return data.fields
    .filter(field => !field.config.custom?.hideFrom?.viz)
    .map(field => ({
      label: getDisplayName(field),
      value: field.name,
    }));
}

/**
 * Получить все колонки, используемые в группах (для ungroupedColumns)
 */
export function getColumnsInGroups(rootGroups: RootGroupItem[]): Set<string> {
  const columns = new Set<string>();

  function traverse(item: GroupChild) {
    if (item.type === 'root-group') {
      columns.add(item.column);
      item.children.forEach(traverse);
    } else if (item.type === 'group-container') {
      item.children.forEach(traverse);
    } else if (item.type === 'column') {
      columns.add(item.column);
    }
  }

  rootGroups.forEach(traverse);
  return columns;
}

/**
 * Валидация структуры группировки
 */
export function validateGroupingStructure(rootGroups: RootGroupItem[], availableFields: string[]): string[] {
  const errors: string[] = [];
  const fieldSet = new Set(availableFields);

  function validate(item: GroupChild, path: string) {
    if (item.type === 'root-group') {
      if (!fieldSet.has(item.column)) {
        errors.push(`${path}: Field "${item.column}" not found in data`);
      }
      item.children.forEach((child, i) => validate(child, `${path}.children[${i}]`));
    } else if (item.type === 'group-container') {
      if (item.children.length === 0) {
        errors.push(`${path}: Container has no children`);
      }
      item.children.forEach((child, i) => validate(child, `${path}.children[${i}]`));
    } else if (item.type === 'column') {
      if (!fieldSet.has(item.column)) {
        errors.push(`${path}: Field "${item.column}" not found in data`);
      }
    }
  }

  rootGroups.forEach((group, i) => validate(group, `rootGroups[${i}]`));
  return errors;
}
```

---

## Фаза 8: Тестирование и отладка

### 8.1 Ручное тестирование Header Grouping

**Тестовые сценарии:**
1. ✅ **Vertical RootGroup с вертикальными детьми**
   - Создать root group с vertical orientation
   - Добавить несколько column items
   - Проверить: колонки в одном столбце, несколько строк заголовков

2. ✅ **Vertical RootGroup с одним horizontal Group child**
   - Создать root group с vertical orientation
   - Добавить container с horizontal orientation и несколько columns
   - Проверить: дети располагаются горизонтально под root

3. ⚠️ **Horizontal RootGroup** (известный баг - не исправляем)
   - Создать root group с horizontal orientation
   - Проверить: дети на неправильном уровне (баг сохраняется)

4. ✅ **Ungrouped columns**
   - Создать группы
   - Оставить некоторые колонки вне групп
   - Проверить: ungrouped колонки растягиваются на все строки заголовков

5. ✅ **Вложенные структуры**
   - Создать глубоко вложенные группы
   - Проверить расчет rowspan/colspan

### 8.2 Интеграционное тестирование

1. **Совместимость с существующими функциями**
   - Pagination (должна работать с группированными заголовками)
   - Sorting (должен работать в группированных колонках)
   - Filtering (должен работать в группированных заголовках)

2. **Переключение режимов**
   - Переключаться между обычной таблицей и Header Grouping
   - Проверить: нет ошибок, корректное отображение

3. **Column resizing**
   - Проверить работу изменения размера сгруппированных колонок

---

## Фаза 9: Документация

### 9.1 Обновить README.md

Добавить секции:
- **Header Grouping**: описание функции, как настроить, примеры использования
- **Known Issues**: список известных проблем (перенесенных из старой версии)
  - Horizontal RootGroup размещает дочерние элементы на неправильном уровне заголовка
  - Vertical RootGroup с несколькими horizontal children может работать некорректно
  - Сложные вложенные структуры могут иметь проблемы с рендерингом

### 9.2 Добавить комментарии в код

- JSDoc комментарии для всех публичных функций
- Пояснения для сложной логики расчета colspan/rowspan
- Предупреждения о известных багах с отметкой "Known issue: inherited from grafana-extended-table"

---

## Критические файлы для изменения

### Новые файлы:
1. `src/components/Table/TableNG/TableWithGroupedHeaders.tsx` - рендеринг сгруппированных заголовков
2. `src/components/editors/ColumnGroupingEditorV2.tsx` - редактор группировки заголовков

### Изменяемые файлы:
1. `src/components/Table/TableNG/types.ts` - добавление типов для Header Grouping
2. `src/components/Table/TableNG/utils.ts` - добавление утилит для работы с группами
3. `src/components/Table/TableNG/styles.ts` - добавление стилей для заголовков
4. `src/components/Table/TableNG/TableNG.tsx` - интеграция группированных заголовков
5. `src/module.ts` - регистрация редактора группировки
6. `src/types.ts` - обновление Options (если нужно)
7. `README.md` - документация функциональности

---

## Верификация (End-to-End тестирование)

### Шаг 1: Запуск плагина
```bash
cd /home/ubuntu/Documents/Grafana_Advanced_Table
npm install
npm run dev
```

### Шаг 2: Настройка Header Grouping
1. Открыть панель в Grafana
2. Перейти в настройки панели → Table Display → Column Grouping
3. Включить группировку
4. Создать 2-3 root groups с разными orientations
5. Добавить вложенные группы и колонки
6. Проверить визуальное отображение заголовков
7. Проверить работу фильтрации в сгруппированных заголовках
8. Проверить работу сортировки
9. Проверить изменение размера колонок

### Шаг 3: Проверка граничных случаев
1. Данные без выбранных полей → должно показывать предупреждение или пустую таблицу
2. Пустой DataFrame → должен рендериться без ошибок
3. Большое количество данных → должна работать пагинация
4. Переключение между обычным режимом и Header Grouping → без ошибок в консоли
5. Удаление всех групп → таблица должна вернуться к обычному виду

### Шаг 4: Проверка совместимости
1. Протестировать с разными источниками данных (Prometheus, InfluxDB, TestData)
2. Проверить с разными размерами панели (resize)
3. Проверить в разных темах Grafana (light/dark)
4. Проверить работу с существующими cell types (sparkline, bar gauge, image, etc.)
5. Проверить работу с frozen columns

---

## Ожидаемые проблемы и их решения

### Проблема 1: React Data Grid не поддерживает multi-row headers
**Решение:** Создать кастомный заголовок, рендерить вручную через `headerRowHeight` и custom header renderer

### Проблема 2: Конфликт с существующим HeaderCell компонентом
**Решение:** Переиспользовать HeaderCell где возможно, создать GroupedHeaderCell для специфичной логики

### Проблема 3: Performance при большом количестве групп
**Решение:** Мемоизация расчетов colspan/rowspan, использовать useMemo для header structure

### Проблема 4: Performance при рендеринге сложных групп
**Решение:** Использовать React.memo для компонентов ячеек, мемоизация header structure

---

## Итоговый чеклист

**Фаза 1:**
- [ ] Создать ветку `feature/header-grouping`

**Фаза 2:**
- [ ] Добавить типы для Header Grouping в types.ts
- [ ] Обновить Options интерфейс
- [ ] Добавить значения по умолчанию

**Фаза 3:**
- [ ] Создать TableWithGroupedHeaders.tsx
- [ ] Реализовать buildHeaderStructure()
- [ ] Реализовать calculateRowsAndColumns()
- [ ] Реализовать renderHeaderRows()
- [ ] Интегрировать в TableNG.tsx

**Фаза 4:**
- [ ] Создать ColumnGroupingEditorV2.tsx
- [ ] Реализовать UI для управления группами
- [ ] Реализовать рекурсивный рендеринг групп
- [ ] Добавить цветовое выделение типов элементов
- [ ] Зарегистрировать в module.ts

**Фаза 5:**
- [ ] Интеграция с фильтрацией
- [ ] Интеграция с сортировкой
- [ ] Интеграция с пагинацией

**Фаза 6:**
- [ ] Добавить стили для Header Grouping
- [ ] Стили для merged cells
- [ ] Стили для вертикальных/горизонтальных групп

**Фаза 7:**
- [ ] Добавить утилиты getAvailableFieldsForGrouping()
- [ ] Добавить утилиты getColumnsInGroups()
- [ ] Добавить утилиты validateGroupingStructure()

**Фаза 8:**
- [ ] Ручное тестирование Header Grouping (5 сценариев)
- [ ] Интеграционное тестирование (3 сценария)

**Фаза 9:**
- [ ] Обновить README.md
- [ ] Добавить JSDoc комментарии
- [ ] Документировать известные проблемы

**Верификация:**
- [ ] E2E тестирование (4 шага)
- [ ] Проверка в production build (`npm run build`)
- [ ] Code review готов

---

## Примечания

1. **Известные баги сохраняются**: Horizontal RootGroup на неправильном уровне (по требованию пользователя)
2. **Только новая система**: Используем Hierarchical grouping (RootGroupItem/GroupContainerItem/ColumnItem), Legacy не переносим
3. **Переносим только логику**: Смотрим на поведение и структуру, а не на конкретную реализацию
4. **Адаптация под React Data Grid**: Новая версия использует react-data-grid, потребуется адаптация рендеринга