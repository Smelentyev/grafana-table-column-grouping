import { Field, SelectableValue, formattedValueToString } from '@grafana/data';

const uniqueValueCache = new WeakMap<Field, Map<string, Record<string, unknown>>>();
type ComparableValue = string | number | boolean;
type ExpressionBinaryOperator = '+' | '-' | '*' | '/' | '%' | '=' | '==' | '!=' | '<' | '<=' | '>' | '>=' | '&&' | '||';
type ExpressionUnaryOperator = '!' | '-';

type ExpressionNode =
  | { type: 'literal'; value: ComparableValue }
  | { type: 'placeholder' }
  | { type: 'unary'; operator: ExpressionUnaryOperator; operand: ExpressionNode }
  | { type: 'binary'; operator: ExpressionBinaryOperator; left: ExpressionNode; right: ExpressionNode };

type Token =
  | { type: 'placeholder' }
  | { type: 'literal'; value: ComparableValue }
  | { type: 'operator'; value: ExpressionBinaryOperator | ExpressionUnaryOperator }
  | { type: 'paren'; value: '(' | ')' };

export function buildIndicesSignature(indices: number[]): string {
  let hash = 0;
  for (let i = 0; i < indices.length; i++) {
    hash = (hash * 31 + indices[i]) >>> 0;
  }
  const first = indices[0] ?? -1;
  const last = indices.length > 0 ? indices[indices.length - 1] : -1;
  return `${indices.length}:${first}:${last}:${hash}`;
}

export function calculateUniqueFieldValues(indices: number[], field?: Field) {
  if (!field || indices.length === 0) {
    return {};
  }

  const set: Record<string, unknown> = {};

  for (let i = 0; i < indices.length; i++) {
    const fieldValue = field.values[indices[i]];
    const label = getFilterValueLabel(field, fieldValue);

    set[label] = fieldValue;
  }

  return set;
}

export function calculateUniqueFieldValuesCached(indices: number[], field?: Field) {
  if (!field || indices.length === 0) {
    return {};
  }

  const signature = buildIndicesSignature(indices);
  const fieldCache = uniqueValueCache.get(field);
  if (fieldCache?.has(signature)) {
    return fieldCache.get(signature)!;
  }

  const calculated = calculateUniqueFieldValues(indices, field);
  const nextFieldCache = fieldCache ?? new Map<string, Record<string, unknown>>();
  nextFieldCache.set(signature, calculated);
  uniqueValueCache.set(field, nextFieldCache);
  return calculated;
}

export function comparableValue(value: unknown): ComparableValue {
  const normalized = String(value ?? '')
    .trim()
    .replace(/\\/g, '');

  const num = parseFloat(normalized);
  if (!Number.isNaN(num) && normalized !== '') {
    return num;
  }

  const lower = normalized.toLowerCase();
  if (lower === 'true' || lower === 'false') {
    return lower === 'true';
  }

  return normalized;
}

export function getFilterValueLabel(field: Field | undefined, value: unknown): string {
  if (!field) {
    return String(value ?? '') || '(Blanks)';
  }

  const displayValue = field.display ? formattedValueToString(field.display(value)) : String(value ?? '');
  return displayValue || '(Blanks)';
}

export function evaluateExpressionFilter(expression: string, candidateValue: unknown): boolean {
  const tokens = tokenizeExpression(expression);
  if (tokens.length === 0) {
    return false;
  }

  const parser = new ExpressionParser(tokens);
  const ast = parser.parseExpression();
  parser.assertFullyConsumed();

  return evaluateExpressionNode(ast, comparableValue(candidateValue)) === true;
}

export function normalizeConditionalFilterInput(searchFilter: string): string {
  return searchFilter.replace(/\\(.)/g, '$1');
}

export function getMatchingFilterOptions(
  options: SelectableValue[],
  searchFilter: string,
  operatorValue: string | undefined,
  caseSensitive?: boolean
): SelectableValue[] {
  const normalizedSearchFilter =
    operatorValue && operatorValue !== 'Contains' ? normalizeConditionalFilterInput(searchFilter) : searchFilter;
  const regex = new RegExp(searchFilter, caseSensitive ? undefined : 'i');

  return options.filter((option) => {
    if (!searchFilter || operatorValue === 'Contains') {
      if (option.label === undefined) {
        return false;
      }
      return regex.test(option.label);
    }

    if (operatorValue === 'Expression') {
      if (option.value === undefined) {
        return false;
      }

      try {
        return evaluateExpressionFilter(normalizedSearchFilter, option.value);
      } catch {
        return false;
      }
    }

    if (option.value === undefined) {
      return false;
    }

    const value1 = comparableValue(option.value);
    const value2 = comparableValue(normalizedSearchFilter);

    switch (operatorValue) {
      case '=':
        return value1 === value2;
      case '!=':
        return value1 !== value2;
      case '>':
        return value1 > value2;
      case '>=':
        return value1 >= value2;
      case '<':
        return value1 < value2;
      case '<=':
        return value1 <= value2;
      default:
        return false;
    }
  });
}

export function getFilteredOptions(options: SelectableValue[], filterValues?: SelectableValue[]): SelectableValue[] {
  if (!filterValues) {
    return [];
  }

  return options.filter((option) =>
    filterValues.some(
      (filtered) => filtered.label === option.label || filtered.value === option.value
    )
  );
}

export function valuesToOptions(unique: Record<string, unknown>): SelectableValue[] {
  return Object.keys(unique)
    .map((key) => ({ value: unique[key], label: key }))
    .sort(sortOptions);
}

function sortOptions(a: SelectableValue, b: SelectableValue): number {
  if (a.label === undefined && b.label === undefined) {
    return 0;
  }

  if (a.label === undefined && b.label !== undefined) {
    return -1;
  }

  if (a.label !== undefined && b.label === undefined) {
    return 1;
  }

  if (a.label! < b.label!) {
    return -1;
  }

  if (a.label! > b.label!) {
    return 1;
  }

  return 0;
}

function tokenizeExpression(expression: string): Token[] {
  const tokens: Token[] = [];
  let index = 0;

  while (index < expression.length) {
    const current = expression[index];

    if (/\s/.test(current)) {
      index++;
      continue;
    }

    const twoCharOperator = expression.slice(index, index + 2);
    if (isTwoCharOperator(twoCharOperator)) {
      tokens.push({ type: 'operator', value: twoCharOperator });
      index += 2;
      continue;
    }

    if (current === '$') {
      tokens.push({ type: 'placeholder' });
      index++;
      continue;
    }

    if (current === '(' || current === ')') {
      tokens.push({ type: 'paren', value: current });
      index++;
      continue;
    }

    if (isSingleCharOperator(current)) {
      tokens.push({ type: 'operator', value: current });
      index++;
      continue;
    }

    if (current === '"' || current === "'") {
      const { value, nextIndex } = readStringLiteral(expression, index, current);
      tokens.push({ type: 'literal', value });
      index = nextIndex;
      continue;
    }

    if (isNumberStart(expression, index)) {
      const { value, nextIndex } = readNumberLiteral(expression, index);
      tokens.push({ type: 'literal', value });
      index = nextIndex;
      continue;
    }

    if (/[A-Za-z]/.test(current)) {
      const { value, nextIndex } = readIdentifier(expression, index);
      if (value === 'true' || value === 'false') {
        tokens.push({ type: 'literal', value: value === 'true' });
        index = nextIndex;
        continue;
      }

      throw new Error(`Unsupported identifier "${value}" in expression filter`);
    }

    throw new Error(`Unsupported token "${current}" in expression filter`);
  }

  return tokens;
}

function isTwoCharOperator(value: string): value is '&&' | '||' | '<=' | '>=' | '!=' | '==' {
  return value === '&&' || value === '||' || value === '<=' || value === '>=' || value === '!=' || value === '==';
}

function isSingleCharOperator(value: string): value is '+' | '-' | '*' | '/' | '%' | '!' | '<' | '>' | '=' {
  return value === '+' || value === '-' || value === '*' || value === '/' || value === '%' || value === '!' || value === '<' || value === '>' || value === '=';
}

function isNumberStart(expression: string, index: number): boolean {
  const current = expression[index];
  const next = expression[index + 1];
  return /\d/.test(current) || (current === '.' && next !== undefined && /\d/.test(next));
}

function readStringLiteral(expression: string, startIndex: number, quote: '"' | "'") {
  let result = '';
  let index = startIndex + 1;

  while (index < expression.length) {
    const current = expression[index];
    if (current === '\\') {
      const next = expression[index + 1];
      if (next === undefined) {
        throw new Error('Unterminated escape sequence in expression filter');
      }
      result += next;
      index += 2;
      continue;
    }
    if (current === quote) {
      return { value: result, nextIndex: index + 1 };
    }
    result += current;
    index++;
  }

  throw new Error('Unterminated string literal in expression filter');
}

function readNumberLiteral(expression: string, startIndex: number) {
  let index = startIndex;

  while (index < expression.length && /[\d.]/.test(expression[index])) {
    index++;
  }

  const raw = expression.slice(startIndex, index);
  const value = Number(raw);
  if (Number.isNaN(value)) {
    throw new Error(`Invalid number literal "${raw}" in expression filter`);
  }

  return { value, nextIndex: index };
}

function readIdentifier(expression: string, startIndex: number) {
  let index = startIndex;

  while (index < expression.length && /[A-Za-z]/.test(expression[index])) {
    index++;
  }

  return { value: expression.slice(startIndex, index), nextIndex: index };
}

class ExpressionParser {
  private index = 0;

  constructor(private readonly tokens: Token[]) {}

  parseExpression(): ExpressionNode {
    return this.parseLogicalOr();
  }

  assertFullyConsumed() {
    if (this.index !== this.tokens.length) {
      throw new Error('Unexpected trailing tokens in expression filter');
    }
  }

  private parseLogicalOr(): ExpressionNode {
    let node = this.parseLogicalAnd();

    while (this.matchOperator('||')) {
      node = {
        type: 'binary',
        operator: '||',
        left: node,
        right: this.parseLogicalAnd(),
      };
    }

    return node;
  }

  private parseLogicalAnd(): ExpressionNode {
    let node = this.parseComparison();

    while (this.matchOperator('&&')) {
      node = {
        type: 'binary',
        operator: '&&',
        left: node,
        right: this.parseComparison(),
      };
    }

    return node;
  }

  private parseComparison(): ExpressionNode {
    let node = this.parseAdditive();

    while (true) {
      const operator = this.matchAnyOperator('=', '==', '!=', '<', '<=', '>', '>=');
      if (!operator) {
        return node;
      }

      node = {
        type: 'binary',
        operator,
        left: node,
        right: this.parseAdditive(),
      };
    }
  }

  private parseAdditive(): ExpressionNode {
    let node = this.parseMultiplicative();

    while (true) {
      const operator = this.matchAnyOperator('+', '-');
      if (!operator) {
        return node;
      }

      node = {
        type: 'binary',
        operator,
        left: node,
        right: this.parseMultiplicative(),
      };
    }
  }

  private parseMultiplicative(): ExpressionNode {
    let node = this.parseUnary();

    while (true) {
      const operator = this.matchAnyOperator('*', '/', '%');
      if (!operator) {
        return node;
      }

      node = {
        type: 'binary',
        operator,
        left: node,
        right: this.parseUnary(),
      };
    }
  }

  private parseUnary(): ExpressionNode {
    const operator = this.matchAnyOperator('!', '-');
    if (operator) {
      return {
        type: 'unary',
        operator,
        operand: this.parseUnary(),
      };
    }

    return this.parsePrimary();
  }

  private parsePrimary(): ExpressionNode {
    const token = this.peek();
    if (!token) {
      throw new Error('Unexpected end of expression filter');
    }

    if (token.type === 'literal') {
      this.index++;
      return { type: 'literal', value: token.value };
    }

    if (token.type === 'placeholder') {
      this.index++;
      return { type: 'placeholder' };
    }

    if (token.type === 'paren' && token.value === '(') {
      this.index++;
      const node = this.parseExpression();
      this.expectParen(')');
      return node;
    }

    throw new Error('Unexpected token in expression filter');
  }

  private peek(): Token | undefined {
    return this.tokens[this.index];
  }

  private matchOperator(operator: ExpressionBinaryOperator | ExpressionUnaryOperator): boolean {
    const token = this.peek();
    if (token?.type === 'operator' && token.value === operator) {
      this.index++;
      return true;
    }
    return false;
  }

  private matchAnyOperator<T extends ExpressionBinaryOperator | ExpressionUnaryOperator>(...operators: T[]): T | undefined {
    const token = this.peek();
    if (token?.type !== 'operator') {
      return undefined;
    }

    const matched = operators.find((operator) => operator === token.value);
    if (!matched) {
      return undefined;
    }

    this.index++;
    return matched;
  }

  private expectParen(value: ')') {
    const token = this.peek();
    if (token?.type === 'paren' && token.value === value) {
      this.index++;
      return;
    }

    throw new Error('Expected closing parenthesis in expression filter');
  }
}

function evaluateExpressionNode(node: ExpressionNode, placeholder: ComparableValue): ComparableValue | boolean {
  switch (node.type) {
    case 'literal':
      return node.value;
    case 'placeholder':
      return placeholder;
    case 'unary': {
      const operand = evaluateExpressionNode(node.operand, placeholder);
      if (node.operator === '!') {
        return !Boolean(operand);
      }
      return negateValue(operand);
    }
    case 'binary': {
      const left = evaluateExpressionNode(node.left, placeholder);
      const right = evaluateExpressionNode(node.right, placeholder);
      return evaluateBinaryExpression(node.operator, left, right);
    }
  }
}

function evaluateBinaryExpression(
  operator: ExpressionBinaryOperator,
  left: ComparableValue | boolean,
  right: ComparableValue | boolean
): ComparableValue | boolean {
  switch (operator) {
    case '+':
      return numericValue(left) + numericValue(right);
    case '-':
      return numericValue(left) - numericValue(right);
    case '*':
      return numericValue(left) * numericValue(right);
    case '/':
      return numericValue(left) / numericValue(right);
    case '%':
      return numericValue(left) % numericValue(right);
    case '=':
    case '==':
      return left === right;
    case '!=':
      return left !== right;
    case '<':
      return left < right;
    case '<=':
      return left <= right;
    case '>':
      return left > right;
    case '>=':
      return left >= right;
    case '&&':
      return Boolean(left) && Boolean(right);
    case '||':
      return Boolean(left) || Boolean(right);
  }
}

function negateValue(value: ComparableValue | boolean): number {
  return -numericValue(value);
}

function numericValue(value: ComparableValue | boolean): number {
  const normalized = typeof value === 'boolean' ? Number(value) : Number(value);
  if (Number.isNaN(normalized)) {
    throw new Error('Expected numeric value in expression filter');
  }
  return normalized;
}
