import { closeSync, constants, fstatSync, lstatSync, openSync, readSync, realpathSync, statSync } from 'node:fs';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';
import { CONFIG_DIR_NAME } from '@earendil-works/pi-coding-agent';
import { Type, type Static } from 'typebox';
import { Value } from 'typebox/value';
import { parseRoles, mergeRoles, type Roles } from './context-roles.ts';

const text = Type.String({ minLength: 1, maxLength: 8192, pattern: '^[^\\x00-\\x08\\x0b-\\x1f\\x7f]*$' });
const id = Type.String({ pattern: '^[A-Za-z][A-Za-z0-9_-]{0,63}$' });
const glossary = Type.Array(Type.Object({ term: text, meaning: text, availability: Type.Union([Type.Literal('available'), Type.Literal('conditional'), Type.Literal('unavailable')]) }, { additionalProperties: false }), { maxItems: 32 });
const source = Type.Union([
  Type.Object({ id, kind: Type.Literal('memory'), path: text, delivery: Type.Union([Type.Literal('automatic'), Type.Literal('on-demand')]) }, { additionalProperties: false }),
  Type.Object({ id, kind: Type.Literal('mcp'), tool: Type.String({ maxLength: 256, pattern: '^mcp__[A-Za-z0-9_]+__[A-Za-z0-9_]+$' }), queryArgument: Type.String({ pattern: '^[A-Za-z][A-Za-z0-9_]{0,63}$' }) }, { additionalProperties: false }),
]);
const mappingText = (maxLength: number) => Type.String({ ...text, maxLength });
const question = Type.Object({ tool: mappingText(256) }, { additionalProperties: false });
const reviewBots = Type.Array(Type.Object({ identity: mappingText(128), request: mappingText(2048) }, { additionalProperties: false }), { maxItems: 8 });
const stack = Type.Object({
  membership: mappingText(2048),
  commands: Type.Object({
    create: Type.Optional(mappingText(2048)), link: Type.Optional(mappingText(2048)),
    rebase: Type.Optional(mappingText(2048)), push: Type.Optional(mappingText(2048)), merge: Type.Optional(mappingText(2048)),
  }, { additionalProperties: false }),
}, { additionalProperties: false });
const mappings = Type.Object({
  question: Type.Optional(Type.Union([question, Type.Null()])),
  reviewBots: Type.Optional(reviewBots),
  stack: Type.Optional(Type.Union([stack, Type.Null()])),
}, { additionalProperties: false });
export type HarnessMappings = { question?: Static<typeof question>; reviewBots: Static<typeof reviewBots>; stack?: Static<typeof stack> };
const schema = Type.Object({ mappings: Type.Optional(mappings), version: Type.Literal('pi-mstack/environment/1'), naming: Type.Optional(Type.Union([Type.Literal('task'), Type.Literal('model'), Type.Literal('off')])), glossary: Type.Optional(glossary), sources: Type.Optional(Type.Array(source, { maxItems: 4 })), roles: Type.Optional(Type.Unknown()) }, { additionalProperties: false });
type Config = Omit<Static<typeof schema>, 'roles'> & { roles?: Roles };
export type Source = Static<typeof source> & { projectRoot?: string };
export type Environment = { kind: 'valid'; naming: NonNullable<Config['naming']>; glossary: Static<typeof glossary>; sources: Source[]; mappings: HarnessMappings; roles?: Roles } | { kind: 'invalid'; diagnostic: string };

export function readBoundedFile(path: string, limit: number, projectRoot?: string): string {
  const canonical = realpathSync(path);
  if (projectRoot) {
    const root = realpathSync(projectRoot), part = relative(root, canonical);
    if (part === '..' || part.startsWith('..' + sep) || isAbsolute(part)) throw Error('Outside project');
    const lexical = relative(resolve(projectRoot), resolve(path));
    if (lexical === '..' || lexical.startsWith('..' + sep) || isAbsolute(lexical)) throw Error('Outside project');
    let cursor = root;
    for (const component of lexical.split(sep)) {
      cursor = join(cursor, component);
      if (lstatSync(cursor).isSymbolicLink()) throw Error('Symlink');
    }
  }
  const fd = openSync(path, constants.O_RDONLY | constants.O_NONBLOCK | constants.O_NOFOLLOW);
  try {
    const stat = fstatSync(fd), current = statSync(canonical);
    if (!stat.isFile() || stat.size > limit || stat.dev !== current.dev || stat.ino !== current.ino || realpathSync(path) !== canonical) throw Error('Unsafe file');
    const bytes = Buffer.alloc(limit + 1);
    let length = 0, count = 0;
    do { count = readSync(fd, bytes, length, bytes.length - length, null); length += count; } while (count && length < bytes.length);
    if (length > limit) throw Error('Oversized file');
    return bytes.subarray(0, length).toString('utf8');
  } finally { closeSync(fd); }
}

function readConfig(path: string, projectRoot?: string): Config {
  let raw: string;
  try { raw = readBoundedFile(path, 65536, projectRoot); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      try { lstatSync(path); } catch (missing) { if ((missing as NodeJS.ErrnoException).code === 'ENOENT') return { version: 'pi-mstack/environment/1' }; }
    }
    throw Error('Unreadable configuration');
  }
  const value: unknown = JSON.parse(raw);
  if (!Value.Check(schema, value) || (projectRoot && value.naming !== undefined)) throw Error('Invalid configuration');
  const bots = value.mappings?.reviewBots ?? [];
  if (new Set(bots.map(bot => bot.identity)).size !== bots.length) throw Error('Duplicate review bot');
  const { roles, ...config } = value;
  return { ...config, ...(roles === undefined ? {} : { roles: parseRoles(roles) }) };
}

type EnvironmentRequest = {
  agentDir: string;
  cwd: string;
  nativeTrusted: boolean;
  sessionId: string;
  notify: (message: string) => void;
};
type ProjectAccess =
  | { kind: 'allowed'; root: string; file: string }
  | { kind: 'ignored'; file: string; reason: 'native-denial' | 'missing-grant' | 'invalid-grants' | 'unsafe-path' };
const grantsSchema = Type.Object({
  version: Type.Literal('pi-mstack/environment-grants/1'),
  projects: Type.Array(Type.String({ minLength: 1, maxLength: 4096 }), { maxItems: 256 }),
}, { additionalProperties: false });
const warningKey = Symbol.for('pi-mstack/environment-warnings/1');
const shared = globalThis as typeof globalThis & { [warningKey]?: Set<string> };
const warned = shared[warningKey] ??= new Set<string>();

function projectAccess({ agentDir, cwd, nativeTrusted }: EnvironmentRequest): ProjectAccess {
  const file = resolve(cwd, CONFIG_DIR_NAME, 'pstack/environment.json');
  if (!nativeTrusted) return { kind: 'ignored', file, reason: 'native-denial' };
  try {
    const root = realpathSync(cwd);
    const userRoot = realpathSync(agentDir);
    const authority = join(userRoot, 'pstack/environment-grants.json');
    const part = relative(root, authority);
    if (part !== '..' && !part.startsWith('..' + sep) && !isAbsolute(part)) return { kind: 'ignored', file, reason: 'unsafe-path' };
    const value: unknown = JSON.parse(readBoundedFile(authority, 65536, userRoot));
    if (!Value.Check(grantsSchema, value) || value.projects.some(path => !isAbsolute(path) || realpathSync(path) !== path || !statSync(path).isDirectory())) {
      return { kind: 'ignored', file, reason: 'invalid-grants' };
    }
    return value.projects.includes(root)
      ? { kind: 'allowed', root, file: join(root, CONFIG_DIR_NAME, 'pstack/environment.json') }
      : { kind: 'ignored', file, reason: 'missing-grant' };
  } catch { return { kind: 'ignored', file, reason: 'invalid-grants' }; }
}

function hasProjectConfig(cwd: string): boolean {
  let cursor = resolve(cwd);
  for (const component of [CONFIG_DIR_NAME, 'pstack', 'environment.json']) {
    cursor = join(cursor, component);
    try {
      const stat = lstatSync(cursor);
      if (stat.isSymbolicLink() || !stat.isDirectory()) return true;
    } catch (error) { return (error as NodeJS.ErrnoException).code !== 'ENOENT'; }
  }
  return true;
}

export function loadEnvironment(request: EnvironmentRequest): Environment {
  const { agentDir, cwd, sessionId, notify } = request;
  const access = projectAccess(request);
  if (access.kind === 'ignored' && hasProjectConfig(cwd)) {
    const key = JSON.stringify([resolve(agentDir), sessionId, access.file]);
    if (!warned.has(key)) {
      warned.add(key);
      notify(`Ignored project environment configuration ${JSON.stringify(access.file)}. Explicit user authorization and native project trust are required.`);
    }
  }
  try {
    const user = readConfig(join(agentDir, 'pstack/environment.json'));
    const project = access.kind === 'allowed' ? readConfig(access.file, access.root) : undefined;
    const terms = new Map<string, Static<typeof glossary>[number]>();
    for (const entry of [...user.glossary ?? [], ...project?.glossary ?? []]) terms.set(entry.term, entry);
    const entries = [...terms.values()];
    const sources: Source[] = [...(user.sources ?? []).map(s => {
      if (s.kind === 'memory' && !isAbsolute(s.path)) throw Error('User memory requires an absolute path');
      return s;
    }), ...(access.kind === 'allowed' ? (project?.sources ?? []).map(s => s.kind === 'memory' ? { ...s, path: resolve(access.root, s.path), projectRoot: access.root } : s) : [])];
    if (entries.length > 32 || Buffer.byteLength(JSON.stringify(entries)) > 8192 || sources.length > 4 || new Set(sources.map(s => s.id)).size !== sources.length) throw Error('Environment limits');
    const merged = { ...user.mappings, ...project?.mappings };
    const effective: HarnessMappings = { reviewBots: merged.reviewBots ?? [] };
    if (merged.question) effective.question = merged.question;
    if (merged.stack) effective.stack = merged.stack;
    if (Buffer.byteLength(JSON.stringify(effective)) > 16384) throw Error('Mapping limits');
    const roles = mergeRoles(user.roles, project?.roles);
    return { kind: 'valid', naming: user.naming ?? 'task', glossary: entries, sources, mappings: effective, ...(Object.keys(roles).length ? { roles } : {}) };
  } catch { return { kind: 'invalid', diagnostic: 'Environment configuration invalid or unreadable. Naming, glossary, context sources and harness mappings are disabled. Check pstack/environment.json in user and authorized project configuration.' }; }
}
