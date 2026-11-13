import { parseConfig, roles, splitSelector, type Config } from './config.ts';

const trim = (value: string) => value.replace(/^[ \t]+|[ \t]+$/g, '');

export function parseImportPath(args: string): string {
  const usage = 'Usage: /setup-pstack import <path>. Use one path with optional matching outer quotes. No shell expansion.';
  if (/[\0\r\n]/.test(args)) throw Error(usage);
  const match = trim(args).match(/^import[ \t]+(.+)$/);
  if (!match) throw Error(usage);
  let path = trim(match[1]);
  if (path[0] === '"' || path[0] === "'") {
    const quote = path[0];
    if (path.at(-1) !== quote || path.slice(1, -1).includes(quote)) throw Error(usage);
    path = path.slice(1, -1);
  } else if (/["']/.test(path)) throw Error(usage);
  if (!path || (path.startsWith('~') && path !== '~' && !path.startsWith('~/'))) throw Error(usage);
  return path;
}

export function parseLegacyRoles(text: string): Config['roles'] {
  const lines = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').split('\n');
  const fail = (line: number, reason: string): never => { throw Error(`source:${line}: ${reason}`); };
  const bareCR = lines.findIndex(line => line.includes('\r'));
  if (bareCR !== -1) fail(bareCR + 1, 'Standalone CR is not supported');
  let start = 0;
  if (lines[0] === '---') {
    const end = lines.indexOf('---', 1);
    if (end === -1) fail(1, 'Unclosed frontmatter');
    start = end + 1;
  }
  const imported: Config['roles'] = {};
  for (let i = start; i < lines.length; i++) {
    const line = trim(lines[i]);
    if (!line || line.startsWith('#')) continue;
    const colon = line.indexOf(':');
    if (colon === -1) fail(i + 1, 'Expected a role: selector assignment. Markdown wrappers are not supported');
    const name = trim(line.slice(0, colon));
    const role = roles.find(role => role.name === name);
    if (!role) return fail(i + 1, `Unknown role ${JSON.stringify(name)}. Remove retired roles manually`);
    if (Object.hasOwn(imported, name)) fail(i + 1, `Duplicate role ${name}`);
    const value = trim(line.slice(colon + 1));
    const seats = role.panel ? value.split(',').map(trim) : [value];
    for (const seat of seats) {
      try { splitSelector(seat); }
      catch { fail(i + 1, `${name}: Invalid selector ${JSON.stringify(seat)}. Rewrite manually as exact provider/model[:thinking], auto, or inherit-parent. No model translation happens`); }
    }
    imported[name] = role.panel ? seats : value;
  }
  if (!Object.keys(imported).length) fail(Math.max(1, start + 1), 'No role assignments');
  return parseConfig({ version: 'pi-mstack/1', roles: imported }).roles;
}
