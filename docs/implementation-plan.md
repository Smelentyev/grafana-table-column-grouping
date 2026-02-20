# План: Полное копирование Grafana Table (tableNG) в Advanced Table Plugin

## Цель
Создать плагин для Grafana 12.3.1, полностью копирующий функциональность встроенного table panel (tableNG).

## Обязательные требования

### ⚠️ КРИТИЧНО: Методология разработки

1. **Инициализация плагина**
   - ✅ Плагин ДОЛЖЕН быть создан через официальный инструмент:
     ```bash
     npx @grafana/create-plugin@latest
     ```
   - Это обеспечивает правильную структуру проекта, конфигурацию сборки и совместимость с Grafana

2. **Принцип реализации: "Копировать, не кодировать"**
   - ❌ **ЗАПРЕЩЕНО**: Писать новый код с нуля
   - ✅ **ОБЯЗАТЕЛЬНО**: Копировать существующую реализацию TableNG из Grafana
   - ✅ **РАЗРЕШЕНО**: Адаптировать импорты и пути
   - ✅ **РАЗРЕШЕНО**: Исправлять ошибки компиляции
   - 🎯 **Цель**: 1-в-1 копия функциональности без изобретения велосипеда

## Текущее состояние
- **Плагин**: Advanced Table Panel v1.0.0 (alpha)
- **Локация**: `/home/ubuntu/Documents/Grafana_Advanced_Table`
- **Исходники Grafana**: `/home/ubuntu/Documents/github/grafana` (версия 12.4.0-pre)
- **Статус**: Базовая структура готова (этапы 1-4), используется `TableNG` из `@grafana/ui/unstable`
- **Цель**: Перейти от зависимости к полной копии всех компонентов

## Стратегия реализации

### Подход: Полное копирование
Скопировать все файлы TableNG из Grafana с адаптацией импортов. Это обеспечит:
- ✅ Полный контроль над функциональностью
- ✅ Независимость от unstable API Grafana
- ✅ Возможность кастомизации в будущем
- ⚠️ Объем: ~30 файлов, ~5000 строк кода

---

## Этап 1: Подготовка зависимостей

### 1.1 Добавить внешние библиотеки
**Файл**: `/home/ubuntu/Documents/Grafana_Advanced_Table/package.json`

**Новые зависимости**:
```json
{
  "react-data-grid": "grafana/react-data-grid#a922856b5ede21d55db3fdffb6d38dc76bdc7c58",
  "micro-memoize": "^4.1.2",
  "clsx": "^2.1.1",
  "uwrap": "0.1.2",
  "tinycolor2": "1.6.0",
  "ol": "10.7.0"
}
```

**Обоснование**:
- `react-data-grid` - форк Grafana для виртуализации таблицы
- `micro-memoize` - оптимизация производительности (используется в hooks)
- `clsx` - утилита для CSS классов
- `uwrap` - вычисление переноса текста
- `tinycolor2` - работа с цветами (для PillCell, BarGaugeCell)
- `ol` - OpenLayers для GeoCell (опционально)

**Действия**:
1. Обновить `package.json`
2. Выполнить `npm install`
3. Проверить отсутствие конфликтов версий

### 1.2 Настроить Webpack для CSS
**Файл**: `/home/ubuntu/Documents/Grafana_Advanced_Table/.config/webpack/webpack.config.ts`

**Изменения**:
```typescript
// Добавить в правило для CSS:
{
  test: /\.css$/,
  use: ['style-loader', 'css-loader'],
  include: [
    path.resolve(__dirname, '../../src'),
    path.resolve(__dirname, '../../node_modules/react-data-grid'), // Новая строка
  ],
}
```

**Проверка**: `npm run build` должен завершиться без ошибок

---

## Этап 2: Создание структуры директорий

### 2.1 Создать иерархию папок
**Базовый путь**: `/home/ubuntu/Documents/Grafana_Advanced_Table/src/components/Table/`

**Структура**:
```
Table/
├── TableNG/
│   ├── TableNG.tsx              # Главный компонент (939 строк)
│   ├── types.ts                 # Типы TypeScript (317 строк)
│   ├── constants.ts             # Константы (22 строки)
│   ├── utils.ts                 # Утилиты (1125 строк)
│   ├── hooks.ts                 # React хуки (670 строк)
│   ├── styles.ts                # Emotion стили (265 строк)
│   ├── Cells/                   # Рендереры ячеек
│   │   ├── renderers.tsx        # Реестр рендереров (205 строк)
│   │   ├── AutoCell.tsx         # Автоопределение (~60 строк)
│   │   ├── BarGaugeCell.tsx     # Gauge визуализация (~80 строк)
│   │   ├── SparklineCell.tsx    # Sparkline графики (~140 строк)
│   │   ├── PillCell.tsx         # Pill/badge стиль (~120 строк)
│   │   ├── ImageCell.tsx        # Изображения (~35 строк)
│   │   ├── MarkdownCell.tsx     # Markdown рендеринг (~50 строк)
│   │   ├── DataLinksCell.tsx    # Data links (~40 строк)
│   │   ├── GeoCell.tsx          # Географические данные (~25 строк)
│   │   └── ActionsCell.tsx      # Field actions (~20 строк)
│   ├── components/              # UI компоненты
│   │   ├── HeaderCell.tsx       # Заголовки колонок (110 строк)
│   │   ├── SummaryCell.tsx      # Summary row (160 строк)
│   │   ├── FooterCell.tsx       # Footer (65 строк)
│   │   ├── RowExpander.tsx      # Раскрытие строк (50 строк)
│   │   ├── TableCellActions.tsx # Действия с ячейками (70 строк)
│   │   ├── TableCellTooltip.tsx # Тултипы (180 строк)
│   │   └── MaybeWrapWithLink.tsx # Обертка для ссылок (40 строк)
│   └── Filter/                  # Система фильтрации
│       ├── Filter.tsx           # Фильтр (120 строк)
│       ├── FilterPopup.tsx      # Popup фильтра (260 строк)
│       ├── FilterList.tsx       # Список фильтров (280 строк)
│       └── utils.ts             # Утилиты фильтров (55 строк)
├── DataLinksActionsTooltip.tsx  # Тултип data links (~120 строк)
├── TableCellInspector.tsx       # Инспектор ячеек (~90 строк)
└── types.ts                     # Общие типы таблицы (~160 строк)
```

**Итого**: 34 файла, ~5000 строк кода

---

## Этап 3: Копирование файлов (порядок важен!)

### 3.1 Фундамент - Типы и константы

#### Файл 1: types.ts (TableNG)
**Источник**: `/home/ubuntu/Documents/github/grafana/packages/grafana-ui/src/components/Table/TableNG/types.ts`
**Назначение**: `/home/ubuntu/Documents/Grafana_Advanced_Table/src/components/Table/TableNG/types.ts`

**Адаптация импортов**:
```typescript
// Без изменений (используются только @grafana/* пакеты):
import { DataFrame, Field, GrafanaTheme2, ... } from '@grafana/data';
import { TableCellHeight, TableFieldOptions } from '@grafana/schema';

// Обновить:
import { TableCellInspectorMode } from '../TableCellInspector';
import { TableCellOptions } from '../types';
```

#### Файл 2: types.ts (Table общий)
**Источник**: `/home/ubuntu/Documents/github/grafana/packages/grafana-ui/src/components/Table/types.ts`
**Назначение**: `/home/ubuntu/Documents/Grafana_Advanced_Table/src/components/Table/types.ts`

**Адаптация импортов**:
```typescript
// Реэкспорты из @grafana/schema работают без изменений
export {
  type FieldTextAlignment,
  TableCellBackgroundDisplayMode,
  TableCellDisplayMode,
  ...
} from '@grafana/schema';
```

#### Файл 3: constants.ts
**Источник**: `/home/ubuntu/Documents/github/grafana/packages/grafana-ui/src/components/Table/TableNG/constants.ts`
**Назначение**: `/home/ubuntu/Documents/Grafana_Advanced_Table/src/components/Table/TableNG/constants.ts`

**Адаптация**: Нет импортов, копируется как есть

### 3.2 Утилиты и стили

#### Файл 4: utils.ts
**Источник**: `/home/ubuntu/Documents/github/grafana/packages/grafana-ui/src/components/Table/TableNG/utils.ts`
**Назначение**: `/home/ubuntu/Documents/Grafana_Advanced_Table/src/components/Table/TableNG/utils.ts`

**Критические адаптации**:
```typescript
// Функция getTextColorForBackground НЕ экспортируется из @grafana/ui
// РЕШЕНИЕ: Добавить в начало файла:
import tinycolor from 'tinycolor2';

export function getTextColorForBackground(color: string): string {
  const c = tinycolor(color);
  return c.isDark() ? 'rgba(255, 255, 255, 0.9)' : 'rgba(0, 0, 0, 0.9)';
}

// Остальные импорты:
import { useTheme2 } from '@grafana/ui';
import { Field, DataFrame, FieldType, ... } from '@grafana/data';
import { TextAlign } from './utils'; // Рекурсивный импорт - проверить!
```

**Потенциальная проблема**: Если `TextAlign` экспортируется из самого utils.ts, то импорт удалить.

#### Файл 5: styles.ts
**Источник**: `/home/ubuntu/Documents/github/grafana/packages/grafana-ui/src/components/Table/TableNG/styles.ts`
**Назначение**: `/home/ubuntu/Documents/Grafana_Advanced_Table/src/components/Table/TableNG/styles.ts`

**Адаптация импортов**:
```typescript
import { css } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
// Проверить наличие IS_SAFARI_26 в utils.ts
```

### 3.3 Cell рендереры

#### Файл 6: renderers.tsx
**Источник**: `/home/ubuntu/Documents/github/grafana/packages/grafana-ui/src/components/Table/TableNG/Cells/renderers.tsx`
**Назначение**: `/home/ubuntu/Documents/Grafana_Advanced_Table/src/components/Table/TableNG/Cells/renderers.tsx`

**Адаптация импортов**:
```typescript
import { TableCellDisplayMode } from '@grafana/schema';
import { AutoCell } from './AutoCell';
import { BarGaugeCell } from './BarGaugeCell';
// ... остальные cell импорты (относительные пути без изменений)

import { TableCellRenderer } from '../types';
import { getCellOptions } from '../utils';
```

#### Файлы 7-16: Индивидуальные рендереры
**Порядок копирования** (от простых к сложным):

1. **ActionsCell.tsx** - простейший
2. **AutoCell.tsx** - базовый текстовый рендеринг
3. **DataLinksCell.tsx** - требует `DataLinksActionsTooltip`
4. **ImageCell.tsx** - простой img рендеринг
5. **MarkdownCell.tsx** - требует `disableSanitizeHtml` prop
6. **GeoCell.tsx** - требует `ol` библиотеку
7. **PillCell.tsx** - требует `getTextColorForBackground`
8. **BarGaugeCell.tsx** - сложная визуализация
9. **SparklineCell.tsx** - графики временных рядов

**Общий паттерн адаптации**:
```typescript
// Стандартные импорты работают без изменений:
import { Field, FieldType, formattedValueToString } from '@grafana/data';
import { useTheme2 } from '@grafana/ui';

// Относительные импорты:
import { TableCellRendererProps } from '../types';
import { getTextColorForBackground } from '../utils'; // Наша локальная функция
```

### 3.4 UI компоненты

#### Файлы 17-23: UI компоненты таблицы
**Порядок копирования**:

1. **MaybeWrapWithLink.tsx** - нет зависимостей
2. **RowExpander.tsx** - простой UI компонент
3. **TableCellActions.tsx** - кнопки действий
4. **FooterCell.tsx** - футер
5. **SummaryCell.tsx** - требует hooks
6. **TableCellTooltip.tsx** - сложная логика позиционирования
7. **HeaderCell.tsx** - требует Filter компоненты

**Адаптация импортов**:
```typescript
// UI компоненты из @grafana/ui:
import { Icon, Tooltip, IconButton, useStyles2 } from '@grafana/ui';

// Относительные импорты:
import { Filter } from '../Filter/Filter';
import { TableColumn } from '../types';
```

### 3.5 Система фильтрации

#### Файлы 24-27: Filter компоненты
**Источники**: `/home/ubuntu/Documents/github/grafana/packages/grafana-ui/src/components/Table/TableNG/Filter/`
**Назначение**: `/home/ubuntu/Documents/Grafana_Advanced_Table/src/components/Table/TableNG/Filter/`

**Порядок**:
1. **utils.ts** - утилиты фильтрации
2. **Filter.tsx** - базовый компонент фильтра
3. **FilterList.tsx** - список активных фильтров
4. **FilterPopup.tsx** - popup UI фильтра

**Адаптация импортов**:
```typescript
import { SelectableValue } from '@grafana/data';
import { Checkbox, Input, Button, Select, useStyles2 } from '@grafana/ui';

// Относительные:
import { FilterType } from '../types';
import { filterMatchesSearchQuery } from './utils';
```

### 3.6 Вспомогательные компоненты таблицы

#### Файл 28: DataLinksActionsTooltip.tsx
**Источник**: `/home/ubuntu/Documents/github/grafana/packages/grafana-ui/src/components/Table/DataLinksActionsTooltip.tsx`
**Назначение**: `/home/ubuntu/Documents/Grafana_Advanced_Table/src/components/Table/DataLinksActionsTooltip.tsx`

**Адаптация импортов**:
```typescript
import { LinkModel } from '@grafana/data';
import { ContextMenu, MenuGroup, MenuItem, useStyles2 } from '@grafana/ui';
```

#### Файл 29: TableCellInspector.tsx
**Источник**: `/home/ubuntu/Documents/github/grafana/packages/grafana-ui/src/components/Table/TableCellInspector.tsx`
**Назначение**: `/home/ubuntu/Documents/Grafana_Advanced_Table/src/components/Table/TableCellInspector.tsx`

**Адаптация импортов**:
```typescript
import { Modal, CodeEditor, useTheme2 } from '@grafana/ui';
import { GrafanaTheme2 } from '@grafana/data';
```

### 3.7 Хуки и главный компонент

#### Файл 30: hooks.ts
**Источник**: `/home/ubuntu/Documents/github/grafana/packages/grafana-ui/src/components/Table/TableNG/hooks.ts`
**Назначение**: `/home/ubuntu/Documents/Grafana_Advanced_Table/src/components/Table/TableNG/hooks.ts`

**Адаптация импортов**:
```typescript
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { TableColumn as ReactDataGridColumn } from 'react-data-grid';

import { Field, DataFrame } from '@grafana/data';

// Относительные импорты:
import { TableColumn, FilterType, TableRow } from './types';
import { computeColWidths, applySort, shouldTextWrap, estimateHeight } from './utils';
```

**Критично**: Все 6 хуков зависят от utils.ts, проверить, что все функции доступны.

#### Файл 31: TableNG.tsx (ГЛАВНЫЙ)
**Источник**: `/home/ubuntu/Documents/github/grafana/packages/grafana-ui/src/components/Table/TableNG/TableNG.tsx`
**Назначение**: `/home/ubuntu/Documents/Grafana_Advanced_Table/src/components/Table/TableNG/TableNG.tsx`

**Критические изменения**:
```typescript
// ОБЯЗАТЕЛЬНО добавить в начало файла:
import 'react-data-grid/lib/styles.css';

// Стандартные импорты:
import { useTheme2, useStyles2, usePanelContext, Pagination } from '@grafana/ui';
import { DataFrame, Field, GrafanaTheme2 } from '@grafana/data';

// Относительные импорты:
import { getCellRenderer } from './Cells/renderers';
import { HeaderCell } from './components/HeaderCell';
import { FooterCell } from './components/FooterCell';
import { RowExpander } from './components/RowExpander';
import { TableCellTooltip } from './components/TableCellTooltip';
import { useFilteredRows, useSortedRows, usePaginatedRows, useColWidths, useRowHeight } from './hooks';
import { frameToRecords, getDisplayName, getCellOptions } from './utils';
import { getTableStyles } from './styles';
import { TableNGProps, TableColumn, TableRow, InspectCellProps } from './types';

// Компоненты, которые могут не экспортироваться из @grafana/ui:
// Проверить наличие TableCellInspector
import { TableCellInspector } from '../TableCellInspector';
```

**Потенциальные проблемы**:
- `usePanelContext` - проверить экспорт из `@grafana/ui`
- Функция `getTextColorForBackground` - использовать локальную из utils.ts

---

## Этап 4: Интеграция с плагином

### 4.1 Обновить TablePanel.tsx
**Файл**: `/home/ubuntu/Documents/Grafana_Advanced_Table/src/components/TablePanel.tsx`

**Изменения**:
```typescript
// УДАЛИТЬ:
// import { TableNG } from '@grafana/ui/unstable';

// ДОБАВИТЬ:
import { TableNG } from './Table/TableNG/TableNG';

// Скопировать логику из Grafana panel:
// Источник: /home/ubuntu/Documents/github/grafana/public/app/plugins/panel/table/TablePanel.tsx
```

**Ключевые функции для копирования**:
1. **Frame selection** (строки 44-50 в Grafana) - выбор активного DataFrame
2. **Multi-frame handling** (строки 58-119) - обработка множественных фреймов
3. **getCellActions** (строки 174-213) - если нужны field actions

**Упрощения**:
- Убрать зависимость от `getActions` из Grafana app
- Использовать props напрямую для actions

### 4.2 Обновить module.tsx
**Файл**: `/home/ubuntu/Documents/Grafana_Advanced_Table/src/module.tsx`

**Источник конфигурации**: `/home/ubuntu/Documents/github/grafana/public/app/plugins/panel/table/module.tsx`

**Копируем**:
1. **Field config** (строки 27-179) - все опции колонок
2. **Panel options** (строки 181-228) - опции панели

**Адаптация**:
```typescript
import { PanelPlugin } from '@grafana/data';
import { TablePanel } from './components/TablePanel';
import { TableCellOptionEditor } from './components/TableCellOptionEditor';
import { PaginationEditor } from './components/PaginationEditor';

// НЕ импортируем:
// - tableMigrationHandler (нет миграций)
// - tableSuggestionsSupplier (опционально)

export const plugin = new PanelPlugin<Options, FieldConfig>(TablePanel)
  .useFieldConfig({
    standardOptions: {
      [FieldConfigProperty.Actions]: {
        hideFromDefaults: false,
      },
    },
    useCustomConfig: (builder) => {
      // Скопировать всю логику из Grafana module.tsx (строки 27-179)
    },
  })
  .setPanelOptions((builder) => {
    // Скопировать всю логику из Grafana module.tsx (строки 181-228)
  });
  // НЕ добавляем: .setSuggestionsSupplier() (пока не нужно)
```

### 4.3 Обновить types.ts
**Файл**: `/home/ubuntu/Documents/Grafana_Advanced_Table/src/types.ts`

**Источник**: `/home/ubuntu/Documents/github/grafana/public/app/plugins/panel/table/panelcfg.gen.ts`

**Добавить**:
```typescript
import { TableCellHeight, TableSortByFieldState } from './components/Table/TableNG/types';
import { TableFieldOptions, TableCellOptions } from './components/Table/types';

export interface Options {
  showHeader: boolean;
  cellHeight?: TableCellHeight;
  frozenColumns?: { left?: number };
  maxRowHeight?: number;
  enablePagination?: boolean;
  showTypeIcons?: boolean;
  disableKeyboardEvents?: boolean;
  frameIndex: number;
  sortBy?: TableSortByFieldState[];
}

export interface FieldConfig extends TableFieldOptions {
  // Дополнительные поля, если нужны
}

export const defaultOptions: Partial<Options> = {
  showHeader: true,
  frameIndex: 0,
  showTypeIcons: false,
  cellHeight: TableCellHeight.Sm,
};
```

---

## Этап 5: Обработка проблем импортов

### Проблема 1: i18n переводы
**Симптом**: `Module '@grafana/i18n' not found`

**Решение A** (рекомендуется):
Заменить все `<Trans>` компоненты на обычные строки:
```typescript
// ИЗ:
import { Trans } from '@grafana/i18n';
<Trans i18nKey="table.no-data">No data</Trans>

// В:
<>No data</>
```

**Решение B**:
Добавить `@grafana/i18n` в зависимости (если доступен в Grafana 12.3.0)

### Проблема 2: Внутренние типы
**Симптом**: `Module '@grafana/ui/internal' has no exported member 'TableSortByFieldState'`

**Решение**: Все типы уже скопированы в локальный `types.ts`, импортировать оттуда:
```typescript
import { TableSortByFieldState } from './components/Table/TableNG/types';
```

### Проблема 3: GeoCell и OpenLayers
**Симптом**: Bundle слишком большой (~300KB от `ol`)

**Решение**: Lazy loading для GeoCell:
```typescript
// В Cells/renderers.tsx:
const GeoCell = lazy(() => import('./GeoCell'));
```

Или полностью отключить GeoCell в первой версии.

---

## Этап 6: Тестирование

### 6.1 Компиляция
**Команды**:
```bash
npm run typecheck  # Проверка TypeScript
npm run build      # Webpack build
```

**Критерий успеха**: 0 ошибок TypeScript и Webpack

### 6.2 Локальный запуск
**Команды**:
```bash
npm run dev        # Watch mode для разработки
npm run server     # Docker с Grafana
```

**Проверки**:
1. Плагин загружается в Grafana без ошибок
2. Можно создать новую панель Advanced Table
3. В консоли браузера нет ошибок

### 6.3 Функциональное тестирование

**Тест-кейсы**:

1. **Базовый рендеринг**
   - Создать dashboard с TestData source
   - Добавить панель Advanced Table
   - Выбрать "Random Walk" сценарий
   - ✅ Таблица отображает данные
   - ✅ Все колонки видны

2. **Сортировка**
   - Кликнуть на заголовок колонки
   - ✅ Данные пересортировываются
   - ✅ Индикатор направления сортировки появляется

3. **Фильтрация**
   - Навести на заголовок колонки
   - Открыть фильтр (иконка воронки)
   - Выбрать значения для фильтра
   - ✅ Таблица фильтруется корректно

4. **Пагинация**
   - Включить "Enable pagination" в настройках
   - ✅ Элементы управления пагинацией появляются
   - Переключить страницы
   - ✅ Данные меняются корректно

5. **Изменение размера колонок**
   - Навести на край заголовка колонки
   - Перетащить границу
   - ✅ Ширина колонки меняется
   - Обновить панель
   - ✅ Ширина сохранилась

6. **Типы ячеек**
   - Создать колонку с numeric данными
   - Field options → Cell type → Gauge
   - ✅ Ячейки отображаются как gauge
   - Попробовать: ColorText, ColorBackground, Sparkline
   - ✅ Все типы работают

7. **Frozen columns**
   - Настройки панели → Frozen columns = 1
   - ✅ Первая колонка зафиксирована при горизонтальном скролле

8. **Footer calculations**
   - Field options → Footer → Calculation → Mean
   - ✅ В футере отображается среднее значение

9. **Темы**
   - Переключить Grafana на Dark theme
   - ✅ Таблица корректно отображается
   - Переключить на Light theme
   - ✅ Таблица корректно отображается

10. **Nested tables** (если есть данные)
    - Использовать DataFrame с nested frames
    - ✅ Кнопка раскрытия строки появляется
    - Кликнуть на раскрытие
    - ✅ Вложенная таблица отображается

### 6.4 Производительность
**Тест**: Таблица с 1000 строк
- ✅ Рендеринг < 1 секунды
- ✅ Скролл плавный (нет лагов)
- ✅ Сортировка < 500ms

---

## Этап 7: Финальная проверка

### 7.1 Чеклист совместимости с Grafana 12.3.1

- [ ] Все зависимости >=12.3.0
- [ ] PanelPlugin API соответствует 12.3.1
- [ ] react-data-grid коммит `a922856b5ede21d55db3fdffb6d38dc76bdc7c58`
- [ ] Нет использования deprecated API
- [ ] Все @grafana/* импорты из публичных пакетов

### 7.2 Чеклист функций

**Обязательные функции**:
- [ ] Рендеринг таблицы с данными
- [ ] Сортировка по колонкам
- [ ] Фильтрация значений
- [ ] Пагинация
- [ ] Изменение размера колонок
- [ ] Frozen columns
- [ ] Cell types: Auto, ColorText, ColorBackground, Gauge, Sparkline
- [ ] Footer calculations
- [ ] Tooltips
- [ ] Cell inspector

**Опциональные функции** (могут быть отключены):
- [ ] GeoCell (требует OpenLayers)
- [ ] Field actions (требует интеграцию с Grafana app)
- [ ] Shared crosshair
- [ ] Nested tables
- [ ] Data links

### 7.3 Документация
**Обновить файлы**:
1. **README.md** - описать все функции
2. **CHANGELOG.md** - добавить запись о полной копии TableNG
3. **docs/tasks.md** - отметить завершение этапов 5-7

---

## Критические файлы для реализации

### Топ-5 файлов по приоритету:

1. **src/components/Table/TableNG/types.ts**
   - Фундамент всей системы типов
   - Зависимости: нет (только @grafana/*)

2. **src/components/Table/TableNG/utils.ts**
   - Ядро бизнес-логики (1125 строк)
   - Функции: frameToRecords, computeColWidths, applySort, getCellOptions
   - Зависимости: types.ts, tinycolor2

3. **src/components/Table/TableNG/hooks.ts**
   - 6 критичных хуков для функциональности
   - Зависимости: utils.ts, types.ts, react-data-grid

4. **src/components/Table/TableNG/Cells/renderers.tsx**
   - Реестр всех типов ячеек
   - Зависимости: все Cell компоненты

5. **src/components/Table/TableNG/TableNG.tsx**
   - Главный компонент-оркестратор (939 строк)
   - Зависимости: ВСЕ вышеперечисленные файлы

---

## Оценка трудозатрат

| Этап | Описание | Время |
|------|----------|-------|
| 1 | Зависимости и конфигурация | 1-2 часа |
| 2-3 | Копирование файлов и адаптация импортов | 8-12 часов |
| 4 | Интеграция с плагином | 2-3 часа |
| 5 | Исправление проблем импортов | 2-4 часа |
| 6 | Тестирование | 4-6 часов |
| 7 | Финальная проверка и документация | 1-2 часа |
| **Итого** | | **18-29 часов** |

---

## Критерии успеха

Плагин считается готовым, когда:

✅ **Компиляция**:
- 0 ошибок TypeScript
- 0 ошибок Webpack
- 0 ошибок линтера

✅ **Функциональность**:
- Все 10 тест-кейсов проходят успешно
- Нет ошибок в консоли браузера
- Нет предупреждений Grafana при загрузке плагина

✅ **Производительность**:
- Таблица с 1000 строк рендерится < 1 сек
- Плавный скролл без лагов

✅ **Совместимость**:
- Работает в Grafana 12.3.0+
- Поддерживает Light и Dark темы
- Корректно работает с разными источниками данных

---

## Риски и митигации

| Риск | Вероятность | Митигация |
|------|-------------|-----------|
| Проблемы с react-data-grid fork | Средняя | Использовать точный коммит из Grafana |
| Большой размер bundle | Высокая | Lazy loading для GeoCell, tree-shaking |
| Недостающие API из @grafana/ui | Средняя | Копировать функции локально |
| Сложности с i18n | Низкая | Заменить на статичные строки |
| Actions не работают | Средняя | Упростить или отключить в первой версии |

---

## Следующие шаги после завершения

После успешной реализации базового функционала:

1. **Добавить unit тесты** (Jest)
2. **Добавить E2E тесты** (Playwright)
3. **Оптимизировать bundle size** (code splitting)
4. **Добавить миграции** (для обновления со старой версии)
5. **Реализовать suggestions** (для Grafana AI)
6. **Расширения** (custom cell renderers, экспорт данных)

---

## Верификация плана

Файлы для модификации/создания:
- ✅ package.json - добавление зависимостей
- ✅ webpack.config.ts - настройка CSS loader
- ✅ 30+ новых файлов в src/components/Table/
- ✅ TablePanel.tsx - интеграция
- ✅ module.tsx - конфигурация панели
- ✅ types.ts - типы опций

Тестирование:
- ✅ 10 функциональных тест-кейсов
- ✅ Проверка производительности
- ✅ Проверка совместимости с Grafana 12.3.1
- ✅ Проверка тем (Light/Dark)

План готов к исполнению! 🚀
