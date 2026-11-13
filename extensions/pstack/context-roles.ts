export type Role = 'docs' | 'memory' | 'tracker' | 'wiki';
type Scalar = string | number | boolean | null;
type Json = Scalar | Json[] | { [key: string]: Json };
type Input = { type: 'string' | 'number' | 'boolean' };
export type Operation = {
  effect: 'read' | 'write';
  target: { tool: string; selector?: string };
  inputs: Record<string, Input>;
  template: Record<string, Json>;
};
export type Roles = Partial<Record<Role, Record<string, Operation>>>;
export type RoleRequest = { role: Role; operation: string; args: Record<string, Scalar> };
type Prepared = { role: Role; operation: string; target: Operation['target']; arguments: Record<string, Json> };
export type PreparedRead = Prepared & { effect: 'read' };
export type PreparedWrite = Prepared & { effect: 'write' };
const roles: Role[] = ['docs', 'memory', 'tracker', 'wiki'];
const unsafe = new Set(['__proto__', 'prototype', 'constructor']);
const identifier = /^[A-Za-z][A-Za-z0-9_-]{0,63}$/;
const bytes = (value: unknown) => Buffer.byteLength(JSON.stringify(value));
function object(value: unknown): asserts value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => unsafe.has(key))) throw Error('Invalid object');
}
function closed(value: Record<string, unknown>, required: string[], optional: string[] = []) {
  if (required.some(key => !Object.hasOwn(value, key)) || Object.keys(value).some(key => !required.includes(key) && !optional.includes(key))) throw Error('Invalid fields');
}
function name(value: unknown): asserts value is string {
  if (typeof value !== 'string' || !identifier.test(value) || unsafe.has(value)) throw Error('Invalid name');
}
function scalar(value: unknown): asserts value is Scalar {
  if (value === null || typeof value === 'boolean') return;
  if (typeof value === 'string' && Buffer.byteLength(value) <= 8192) return;
  if (typeof value === 'number' && Number.isFinite(value)) return;
  throw Error('Invalid scalar');
}

export function parseRoles(value: unknown): Roles {
  object(value);
  const result: Roles = {};
  for (const [role, operations] of Object.entries(value)) {
    if (!roles.includes(role as Role)) throw Error('Invalid role');
    object(operations);
    if (Object.keys(operations).length > 8) throw Error('Too many operations');
    const parsed: Record<string, Operation> = {};
    for (const [key, raw] of Object.entries(operations)) {
      name(key); object(raw); closed(raw, ['effect', 'target', 'inputs', 'template']);
      if (raw.effect !== 'read' && raw.effect !== 'write') throw Error('Invalid effect');
      object(raw.target); closed(raw.target, ['tool'], ['selector']);
      if (typeof raw.target.tool !== 'string' || Buffer.byteLength(raw.target.tool) > 256 || !/^mcp__[A-Za-z0-9_]+__[A-Za-z0-9_]+$/.test(raw.target.tool)) throw Error('Invalid native target');
      if (raw.target.selector !== undefined && (typeof raw.target.selector !== 'string' || Buffer.byteLength(raw.target.selector) > 256 || !/^[A-Za-z0-9_-]+\/[A-Za-z0-9_][A-Za-z0-9_.-]*$/.test(raw.target.selector))) throw Error('Invalid selector');
      object(raw.inputs);
      if (Object.keys(raw.inputs).length > 16) throw Error('Too many inputs');
      const inputs: Record<string, Input> = {};
      for (const [arg, spec] of Object.entries(raw.inputs)) {
        name(arg); object(spec); closed(spec, ['type']);
        if (spec.type !== 'string' && spec.type !== 'number' && spec.type !== 'boolean') throw Error('Invalid input type');
        inputs[arg] = { type: spec.type };
      }
      object(raw.template);
      const used = new Set<string>(); let nodes = 0;
      const template = (node: unknown, depth: number): Json => {
        if (++nodes > 256 || depth > 4) throw Error('Template limits');
        if (node === null || typeof node !== 'object') { scalar(node); return node; }
        if (Array.isArray(node)) {
          if (node.length > 16) throw Error('Array limit');
          return node.map(item => template(item, depth + 1));
        }
        object(node);
        if (Object.hasOwn(node, '$arg')) {
          closed(node, ['$arg']); name(node.$arg);
          if (!Object.hasOwn(inputs, node.$arg)) throw Error('Undeclared argument');
          used.add(node.$arg); return { $arg: node.$arg };
        }
        if (Object.keys(node).length > 16) throw Error('Object limit');
        return Object.fromEntries(Object.entries(node).map(([field, item]) => [field, template(item, depth + 1)]));
      };
      const rendered = template(raw.template, 0);
      if (Object.hasOwn(raw.template, '$arg') || Object.keys(inputs).some(arg => !used.has(arg))) throw Error('Unused input or non-object template');
      parsed[key] = { effect: raw.effect, target: { tool: raw.target.tool, ...(raw.target.selector === undefined ? {} : { selector: raw.target.selector as string }) }, inputs, template: rendered as Record<string, Json> };
    }
    result[role as Role] = parsed;
  }
  return result;
}

export function mergeRoles(user: Roles = {}, project: Roles = {}): Roles {
  const result: Roles = {};
  for (const role of roles) {
    const first = user[role] ?? {}, second = project[role] ?? {};
    if (Object.keys(second).some(key => Object.hasOwn(first, key))) throw Error('Duplicate role operation');
    const operations = { ...first, ...second };
    if (Object.keys(operations).length > 8) throw Error('Too many operations');
    if (Object.keys(operations).length) result[role] = operations;
  }
  return result;
}

export function parseRoleRequest(value: unknown): RoleRequest {
  object(value); closed(value, ['role', 'operation', 'args']);
  if (!roles.includes(value.role as Role)) throw Error('Invalid role');
  name(value.operation); object(value.args);
  if (Object.keys(value.args).length > 16 || bytes(value.args) > 8192) throw Error('Argument limit');
  for (const [key, item] of Object.entries(value.args)) { name(key); scalar(item); }
  return value as RoleRequest;
}

export function prepareOperation(registry: Roles, request: RoleRequest): PreparedRead | PreparedWrite {
  const operation = registry[request.role]?.[request.operation];
  if (!operation) throw Error('Operation unavailable');
  closed(request.args, Object.keys(operation.inputs));
  for (const [key, spec] of Object.entries(operation.inputs)) if (typeof request.args[key] !== spec.type) throw Error('Argument type');
  const render = (node: Json): Json => {
    if (node === null || typeof node !== 'object') return node;
    if (Array.isArray(node)) return node.map(render);
    if (Object.hasOwn(node, '$arg')) return request.args[node.$arg as string];
    return Object.fromEntries(Object.entries(node).map(([key, item]) => [key, render(item)]));
  };
  const args = render(operation.template) as Record<string, Json>;
  if (bytes(args) > 8192) throw Error('Rendered argument limit');
  return { effect: operation.effect, role: request.role, operation: request.operation, target: operation.target, arguments: args };
}

export function operationStatus(target: string, tools: readonly { name: string; exposure?: string }[], active: ReadonlySet<string>): string {
  const tool = tools.find(tool => tool.name === target);
  if (!tool) return 'unregistered';
  if (tool.exposure === 'hidden' || tool.exposure === 'model-only') return tool.exposure;
  if ((!tool.exposure || tool.exposure === 'direct') && !active.has(target)) return 'inactive-direct';
  return 'callable-snapshot';
}
