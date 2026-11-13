import { readFileSync } from 'node:fs';
import { join, posix } from 'node:path';
import { sha, json, readJSON, storagePath, disposition, safePath } from './importer.mjs';

export function render(root, source, manifest) {
  const mappings = readJSON(join(root, 'port/mappings.json'));
  const roles = readJSON(join(root, 'port/roles.json'));
  const patches = readJSON(join(root, 'port/patches.json'));
  const policy = readJSON(join(root, 'port/policy.json'));
  const setup = readFileSync(join(source, 'skills/setup-pstack/SKILL.md'), 'utf8');
  const declared = [...setup.matchAll(/^([a-z][a-z ,\-]+): (?:grok|claude).+$/gm)].map(m => m[1]).sort();
  if (json(declared) !== json(roles.map(r => r.name).sort())) throw Error('Missing or stale role registry');
  const allProse = manifest.records.filter(r => r.disposition.kind === 'adapt' && r.sourcePath.endsWith('.md') && !r.sourcePath.includes('/scripts/') && !r.sourcePath.includes('/setup-pstack/')).map(r => readFileSync(join(source, storagePath(r)), 'utf8')).join('\n');
  for (const role of roles) if (!allProse.includes(role.name)) throw Error(`Unreferenced role ${role.name}`);
  for (const match of allProse.matchAll(/`([^`\n]+)`\s+(line|role|model|selector|panel)\b/g)) {
    if (match[1] === 'classDef') continue;
    if (!['line', 'role'].includes(match[2]) && !/^[a-z][a-z0-9 ,_\-]*$/i.test(match[1])) continue;
    if (!roles.some(role => role.name === match[1])) throw Error(`Unregistered role reference: ${match[1]}`);
  }
  const keys = new Set();
  for (const row of mappings) {
    if (!row.instruction || !row.pattern || /[\x00-\x1f\x7f]/.test(row.pattern) || keys.has(row.key)) throw Error(`Invalid mapping ${row.key}`);
    keys.add(row.key);
  }
  const required = readJSON(join(root, 'port/required-terms.json'));
  if (!required || !Array.isArray(required.mappings) || required.mappings.some(key => typeof key !== 'string') || new Set(required.mappings).size !== required.mappings.length) throw Error('Invalid host vocabulary inventory');
  for (const key of required.mappings) if (!keys.has(key)) throw Error(`Unmapped host term ${key}`);
  for (const [name, grammar] of [['protocolFields', /^[a-z][a-z_]*$/], ['cursorPaths', /^[a-z][a-z-]*$/]]) {
    const inventory = required[name];
    if (!inventory || typeof inventory !== 'object' || Array.isArray(inventory) || !Object.keys(inventory).length) throw Error(`Invalid host vocabulary inventory: ${name}`);
    for (const [term, key] of Object.entries(inventory)) {
      if (!grammar.test(term) || !required.mappings.includes(key) || !keys.has(key)) throw Error(`Invalid host vocabulary inventory: ${name}.${term}`);
    }
  }
  const output = new Map(), classifications = [];
  for (const record of manifest.records) {
    const { sourcePath: path, disposition: d } = record;
    if (json(d) !== json(disposition(path, policy))) throw Error(`Unknown disposition policy ${path}`);
    if (d.kind === 'preserve' && d.exposure === 'snapshot-only') continue;
    let bytes = readFileSync(join(source, storagePath(record)));
    if (d.kind === 'adapt' && path.endsWith('.md') && !path.includes('/scripts/')) {
      const text = bytes.toString();
      const fields = [...text.matchAll(/\b([a-z]+(?:_[a-z]+)+)["'`]?\s*[:=]/g)].map(match => match[1]);
      for (const call of text.matchAll(/\bTask\s*\(([\s\S]*?)\)/g)) {
        fields.push(...[...call[1].matchAll(/\b([a-z][a-z_]*)["'`]?\s*[:=]/g)].map(match => match[1]));
      }
      const paths = [...text.matchAll(/\.cursor\/([\w-]+)/g)].map(match => match[1]);
      for (const [inventory, terms] of [[required.protocolFields, fields], [required.cursorPaths, paths]]) {
        for (const term of new Set(terms)) {
          if (!Object.hasOwn(inventory, term)) throw Error(`Unmapped host vocabulary ${term}: ${path}`);
          const mapping = mappings.find(row => row.key === inventory[term]);
          if (!new RegExp(mapping.pattern, 'i').test(text)) throw Error(`Unclassified host vocabulary ${term}: ${path}`);
        }
      }
    }
    const patch = patches[path];
    if (patch) {
      if (sha(bytes) !== patch.sourceHash) throw Error(`Adapter source hash changed: ${path}`);
      if (patch.template) bytes = readFileSync(join(root, 'port/templates', safePath(patch.template)));
      else {
        let text = bytes.toString();
        for (const edit of patch.edits) {
          if (!edit.old || text.split(edit.old).length !== 2) throw Error(`Exact patch mismatch: ${path}`);
          text = text.replace(edit.old, edit.new);
        }
        bytes = Buffer.from(text);
      }
    }
    if (d.kind === 'adapt' && d.adapterId !== 'pi-prose' && !patch) throw Error(`Unknown adapter ${d.adapterId}`);
    if (path.endsWith('.md') && !path.includes('/scripts/')) {
      let text = bytes.toString();
      if (/closest valid slug|nearest slug|family's default|(?:grok-\d|claude-[a-z]+-\d)|omit (?:Task )?`model`|leave `model` unset|left unset for/i.test(text)) throw Error(`Forbidden fallback survives: ${path}`);
      const terms = mappings.filter(row => new RegExp(row.pattern, 'i').test(text)).map(row => row.key);
      classifications.push({ path, terms });
      const link = posix.relative(posix.dirname(path), 'docs/harness/pi.md');
      const preamble = `\n\nRead [the Pi adapter](${link}) before following these instructions. Its native mappings take precedence over host-specific source vocabulary. Mandatory evidence and authority gates remain blocking.\n\n`;
      const fm = text.match(/^---\n[\s\S]*?\n---\n/);
      text = fm ? text.slice(0, fm[0].length) + preamble + text.slice(fm[0].length) : preamble.trimStart() + text;
      bytes = Buffer.from(text);
    }
    output.set(d.outputPath, { bytes, gitMode: record.gitMode, sourceHash: record.sha256, adapterId: patch ? `exact:${path}` : d.adapterId ?? d.kind });
  }
  for (const path of Object.keys(patches)) if (!manifest.records.some(r => r.sourcePath === path)) throw Error(`Stale patch ${path}`);
  for (const name of ['pstack-explorer', 'pstack-explainer']) {
    const bytes = readFileSync(join(root, 'port/templates', name + '.md'));
    output.set(`agents/${name}.md`, { bytes, gitMode: '100644', sourceHash: sha(bytes), adapterId: 'local-grounding-agent' });
  }
  for (const name of ['pstack-local-explorer', 'pstack-local-worker']) {
    const bytes = readFileSync(join(root, 'port/templates', name + '.md'));
    output.set(`agents/${name}.md`, { bytes, gitMode: '100644', sourceHash: sha(bytes), adapterId: 'local-general-agent' });
  }
  const loader = readFileSync(join(root, 'port/templates/statechart-loader.mjs'));
  output.set('skills/statechart/scripts/pi-loader.mjs', { bytes: loader, gitMode: '100644', sourceHash: sha(loader), adapterId: 'statechart-node-loader' });
  const adapter = `# Pi host adapter\n\nThis adapter takes precedence over Cursor-specific vocabulary in generated pstack resources. Read it once per session and again after losing its context. Source instructions in upstream/pstack are preserved history, not native runtime entry points.\n\n## Mandatory gates\n\nA substitute must satisfy the original requirement with retained evidence. Missing independent real-product verification blocks Shipping before merge. Missing control-ui blocks required UI verification until a demonstrated equivalent exists. An unavailable explicit reviewer blocks that review and dependent actions. Do not label placeholders as verdicts. Optional unavailable evidence stays labeled missing and may be skipped only when no mandatory gate depends on it.\n\n## Native mappings\n\n${mappings.map(r => `### ${r.key}\n\n${r.instruction}`).join('\n\n')}\n\n## Role data\n\nRead the separate native pi-mstack role-data section even when mode is off. Invalid configuration is a blocker for affected workflows, not permission to inherit silently. Pass exact effective selectors. Preserve ordered panel entries. Repeated inheritance is multiple samples, not multiple families. Required cross-family review stays blocked without a verified eligible reviewer. Runtime diagnostics distinguish registry validity from native eligibility. Native preflight is authoritative.\n\n${roles.map(r => `- ${r.name}${r.panel ? ' is an ordered panel.' : ' is a scalar role.'}`).join('\n')}\n\n## Native execution\n\nInspect the installed subagent guide before constructing workflow calls. Use awaited runs.run and runs.all inside native workflow scripts. Bind output on each child when downstream work needs a retained report. Read actual attribution and completion status. Tool names alone do not verify agent provenance or package versions.\n\nFor a command monitor, use MonitorCreate with command and onDone, retain monitorId, and stop through MonitorStop when no longer needed. A completion log alone does not prove a provider-visible wake. Keep the host active. Do not start duplicate controllers after restart without inspecting native state.\n`;
  output.set('docs/harness/pi.md', { bytes: Buffer.from(adapter), gitMode: '100644', sourceHash: sha(json(mappings)), adapterId: 'mapping-registry' });
  output.set('host-coverage.json', { bytes: Buffer.from(json(classifications)), gitMode: '100644', sourceHash: sha(json(mappings)), adapterId: 'scanner' });
  const sourcePaths = manifest.records.map(r => r.sourcePath);
  const has = (paths, path) => paths.includes(path) || paths.some(p => p.startsWith(path + '/'));
  const exceptions = readJSON(join(root, 'port/external-links.json'));
  for (const [path, entry] of output) {
    if (!path.endsWith('.md') || path.includes('/scripts/')) continue;
    let fenced = false;
    const lines = entry.bytes.toString().split('\n').map(line => {
      if (/^\s*(```|~~~)/.test(line)) fenced = !fenced;
      if (fenced) return line;
      return line.replace(/\]\(([^)\s]+)\)/g, (match, href) => {
        const [target] = href.split(/[#?]/);
        if (!target || /^[a-z][a-z0-9+.-]*:/i.test(target)) return match;
        const dest = posix.normalize(posix.join(posix.dirname(path), target)).replace(/\/$/, '');
        if (has([...output.keys()], dest)) return match;
        if (has(sourcePaths, dest)) return `](${posix.relative(posix.dirname('generated/' + path), 'upstream/pstack/' + dest)}${href.slice(target.length)})`;
        if (!exceptions.some(e => e.path === path && e.href === href)) throw Error(`Unresolved link ${path} -> ${href}`);
        return `](${manifest.repository}/blob/${manifest.fullCommit}/pstack/${dest}${href.slice(target.length)})`;
      });
    });
    entry.bytes = Buffer.from(lines.join('\n'));
  }
  return new Map([...output].sort(([a], [b]) => a.localeCompare(b, 'en')));
}
