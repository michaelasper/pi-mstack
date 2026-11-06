import { readFileSync, existsSync, mkdirSync, writeFileSync, renameSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { Type, type Static } from 'typebox';
import { Value } from 'typebox/value';
import { getSupportedThinkingLevels } from '@earendil-works/pi-ai';
import type { ExtensionContext } from '@earendil-works/pi-coding-agent';

const RoleSchema = Type.Array(Type.Object({ name: Type.String(), panel: Type.Boolean() }, { additionalProperties: false }));
const roleInput: unknown = JSON.parse(readFileSync(new URL('../../port/roles.json', import.meta.url), 'utf8'));
if (!Value.Check(RoleSchema, roleInput)) throw Error('Invalid bundled role registry');
export const roles = roleInput;
const SelectionSchema = Type.String({ pattern: '^(inherit-parent|auto|[^\\s/:]+/[^\\s]+)$' });
const ConfigSchema = Type.Object({
  version: Type.Literal('pi-mstack/1'),
  roles: Type.Record(Type.String(), Type.Union([SelectionSchema, Type.Array(SelectionSchema, { minItems: 1 })])),
}, { additionalProperties: false });
export type Config = Static<typeof ConfigSchema>;
export type ConfigState = { kind: 'valid'; config: Config; original: string | undefined } | { kind: 'invalid'; diagnostic: string };
export function parseConfig(input: unknown): Config {
  if (!Value.Check(ConfigSchema, input)) throw Error('Invalid pi-mstack/1 configuration');
  for (const [name, selection] of Object.entries(input.roles)) {
    const role = roles.find(r => r.name === name);
    if (!role || role.panel !== Array.isArray(selection)) throw Error(`Unknown role or wrong panel shape: ${name}`);
    for (const value of Array.isArray(selection) ? selection : [selection]) splitSelector(value);
  }
  return input;
}
export function splitSelector(value: string) {
  if (value === 'inherit-parent' || value === 'auto') return { kind: 'inherit' } as const;
  const suffix = value.match(/:(off|minimal|low|medium|high|xhigh|max)$/);
  const base = suffix ? value.slice(0, suffix.index) : value;
  const match = base.match(/^([^\s/:]+)\/([^\s]+)$/);
  if (!match) throw Error(`Invalid exact model selector: ${value}`);
  return { kind: 'exact', provider: match[1], id: match[2], thinking: suffix?.[1] } as const;
}
export function loadConfig(path: string): ConfigState {
  try {
    const original = existsSync(path) ? readFileSync(path, 'utf8') : undefined;
    return { kind: 'valid', original, config: original !== undefined ? parseConfig(JSON.parse(original)) : { version: 'pi-mstack/1', roles: {} } };
  } catch (error) { return { kind: 'invalid', diagnostic: String(error) }; }
}
export function saveConfig(path: string, config: Config, original: string | undefined) {
  parseConfig(config);
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const lock = path + '.lock';
  try { mkdirSync(lock, { mode: 0o700 }); }
  catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'EEXIST') {
      throw Error(`Configuration lock exists at ${lock}. Another setup may be active, or the lock may be stale. Ownership is ambiguous; it will not be removed automatically. Retry after the active setup finishes. If it persists, confirm no setup writer is running, then manually remove only this lock directory and retry.`, { cause: error });
    }
    throw error;
  }
  const temp = path + '.' + randomUUID();
  try {
    const current = existsSync(path) ? readFileSync(path, 'utf8') : undefined;
    if (current !== original) throw Error('Configuration changed during setup; retry without overwriting it');
    writeFileSync(temp, JSON.stringify(config, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
    renameSync(temp, path);
  } finally {
    rmSync(temp, { force: true });
    rmSync(lock, { recursive: true });
  }
}
export function modelChoices(ctx: Pick<ExtensionContext, 'scopedModels' | 'modelRegistry'>) {
  const available = ctx.modelRegistry.getAvailable();
  const scoped = ctx.scopedModels.length ? ctx.scopedModels.map(s => s.model) : available;
  return scoped.filter(m => available.some(a => a.provider === m.provider && a.id === m.id));
}
export function roleData(state: ConfigState, ctx: Pick<ExtensionContext, 'model' | 'thinkingLevel' | 'modelRegistry' | 'scopedModels'>) {
  if (state.kind === 'invalid') return `Configuration blocked. ${state.diagnostic}. Do not substitute defaults.`;
  const parent = ctx.model ? `${ctx.model.provider}/${ctx.model.id}:${ctx.thinkingLevel}` : undefined;
  const available = ctx.modelRegistry.getAvailable();
  return 'Pass exact effective selectors to native subagent. Native preflight required. Do not retry rejected selections by omission or substitution.\n' + roles.map(role => {
    const configured = state.config.roles[role.name] ?? (role.panel ? ['inherit-parent', 'inherit-parent'] : 'inherit-parent');
    const selections = Array.isArray(configured) ? configured : [configured];
    const result = selections.map(value => {
      const parsed = splitSelector(value);
      const effective = parsed.kind === 'inherit' ? parent : value;
      if (!effective) return 'BLOCKED, parent model unavailable';
      const exact = splitSelector(effective);
      if (exact.kind !== 'exact') throw Error('Effective model must be exact');
      const model = available.find(m => m.provider === exact.provider && m.id === exact.id);
      if (!model) return `${effective} [BLOCKED, unavailable or unauthenticated]`;
      if (exact.thinking && !getSupportedThinkingLevels(model).some(level => level === exact.thinking)) return `${effective} [BLOCKED, unsupported thinking]`;
      const outside = ctx.scopedModels.length && !ctx.scopedModels.some(s => s.model.provider === exact.provider && s.model.id === exact.id);
      return `${effective} [registry-valid; ${outside ? 'outside session picker scope; ' : ''}native preflight required]`;
    });
    return `${role.name}: ${result.join(' | ')}${role.panel && new Set(result).size === 1 ? ' [repeated samples, not multi-model diversity]' : ''}`;
  }).join('\n');
}
const PolicySchema = Type.Object({ subagents: Type.Optional(Type.Object({
  maxThinking: Type.Optional(Type.String()),
  modelScope: Type.Optional(Type.Object({ enforce: Type.Optional(Type.Boolean()), strict: Type.Optional(Type.Boolean()), allow: Type.Optional(Type.Array(Type.String())), agents: Type.Optional(Type.Record(Type.String(), Type.Unknown())) })),
})) });
export function policyStatus(settings: unknown, trusted: boolean, effectiveTable = '') {
  if (!Value.Check(PolicySchema, settings)) return 'Native policy metadata invalid or unavailable. Native preflight required.';
  const policy = settings.subagents;
  const notes = [`Project trusted: ${trusted}. Public merged settings observations only; native precedence unverified. Native pi-subagents can replace whole project policy objects rather than recursively merge them. These observations do not establish effective enforcement or launch eligibility. Native preflight required.`];
  const levels = ['off', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'];
  const ceiling = policy?.maxThinking;
  if (ceiling) {
    notes.push(`Observed merged maxThinking is ${ceiling}; effective native ceiling unverified.`);
    for (const line of effectiveTable.split('\n')) {
      const requests = [...line.matchAll(/:(off|minimal|low|medium|high|xhigh|max) \[/g)];
      if (levels.includes(ceiling) && requests.some(match => levels.indexOf(match[1]) > levels.indexOf(ceiling))) notes.push(`Potential thinking-ceiling conflict with observed merged settings; native precedence unverified. ${line}`);
    }
  }
  if (policy?.modelScope) {
    const scope = policy.modelScope;
    notes.push(`Observed merged modelScope ${JSON.stringify(scope)}. Effective native scope, strict inheritance, and per-agent restrictions are unverified.`);
    notes.push('Scope matching is unverified here. Native preflight can reject an exact parent selector. Do not retry by omission.');
  }
  return notes.join('\n');
}
export function configPath(agentDir: string) { return join(agentDir, 'pstack/models.json'); }
