import { readFileSync, openSync, closeSync, fstatSync, readSync, constants } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getAgentDir, stripFrontmatter, type ExtensionAPI, type ExtensionContext, type SessionEntry } from '@earendil-works/pi-coding-agent';
import { getSupportedThinkingLevels } from '@earendil-works/pi-ai';
import { configPath, freshImportAvailability, inspectRoles, loadConfig, modelChoices, parseConfig, policyStatus, roleData, roles, saveConfig } from './config.ts';
import { parseImportPath, parseLegacyRoles } from './import.ts';

import { sameFile } from './resources.ts';
import { registerGoal } from './goal.ts';
import { registerNaming } from './naming.ts';
import { loadEnvironment } from './environment-config.ts';

export const modeType = 'pi-mstack/mode';
function branchMode(entries: readonly SessionEntry[]): boolean | undefined {
  let enabled: boolean | undefined;
  for (const entry of entries) {
    if (entry.type !== 'custom' || entry.customType !== modeType) continue;
    const data: unknown = entry.data;
    if (typeof data === 'object' && data !== null && 'version' in data && data.version === 1 && 'enabled' in data && typeof data.enabled === 'boolean') enabled = data.enabled;
  }
  return enabled;
}
export function enabledOnBranch(entries: readonly SessionEntry[], defaultEnabled = false): boolean {
  return branchMode(entries) ?? defaultEnabled;
}
export default function pstack(pi: ExtensionAPI) {
  if (process.env.PI_SUBAGENT_CHILD === '1') return;
  const ownPath = fileURLToPath(import.meta.url);
  const root = resolve(dirname(ownPath), '../..');
  const path = configPath(getAgentDir());
  const skillPath = (name: string) => resolve(root, 'generated/skills', name, 'SKILL.md');
  const report = (ctx: ExtensionContext, text: string, error = false) => {
    if (ctx.hasUI) ctx.ui.notify(text, error ? 'error' : 'info');
    else process.stderr.write(`pi-mstack: ${text}\n`);
  };
  const ownsGoal = registerGoal(pi, ownPath, report);
  const naming = registerNaming(pi);
  let pendingName: { sessionId: string; raw: string; expected: string } | undefined;
  const clearName = () => { pendingName = undefined; naming.clear(); };
  pi.on('session_start', clearName);
  pi.on('agent_settled', clearName);
  pi.on('session_shutdown', clearName);
  pi.on('session_tree', clearName);
  pi.on('before_agent_start', (event, ctx) => {
    const pending = pendingName;
    clearName();
    if (pending && ownsGoal() && event.messageType === 'user' && pending.sessionId === ctx.sessionManager.getSessionId() && event.prompt === pending.expected) {
      naming.accept(ctx, pending.raw, loadEnvironment({ agentDir: getAgentDir(), cwd: ctx.cwd, nativeTrusted: ctx.isProjectTrusted(), sessionId: ctx.sessionManager.getSessionId(), notify: text => {
        if (ctx.hasUI) ctx.ui.notify(text, 'warning');
        else process.stderr.write(`pi-mstack: ${text}\n`);
      } }));
    }
  });
  const defaultMode = () => {
    const state = loadConfig(path);
    return state.kind === 'valid' && state.config.potetoModeDefault === true;
  };
  const isEnabled = (ctx: ExtensionContext) => enabledOnBranch(ctx.sessionManager.getBranch(), defaultMode());
  function collisions() {
    const commands = pi.getCommands(), problems: string[] = [];
    for (const name of ['setup-pstack', 'pstack']) {
      const matches = commands.filter(c => c.source === 'extension' && (c.name === name || c.name.startsWith(name + ':')));
      if (matches.length !== 1 || matches[0].name !== name || !sameFile(matches[0].sourceInfo.path, ownPath)) problems.push(`Command collision ${name}: ${JSON.stringify(matches.map(c => ({ name: c.name, sourceInfo: c.sourceInfo })))}`);
    }
    for (const name of ['poteto-mode']) {
      const promptPath = resolve(root, 'extensions/pstack/prompts', name + '.md');
      const foreign = commands.filter(c => (c.name === name || c.name.startsWith(name + ':')) && (c.source !== 'prompt' || !sameFile(c.sourceInfo.path, promptPath)));
      if (foreign.length) problems.push(`Command collision ${name}: ${JSON.stringify(foreign.map(c => c.sourceInfo))}`);
    }
    for (const name of ['poteto-mode', 'setup-pstack']) {
      const matches = commands.filter(c => c.name === `skill:${name}`);
      if (matches.length !== 1 || matches[0].source !== 'skill' || !sameFile(matches[0].sourceInfo.path, skillPath(name))) problems.push(`Skill collision or missing ${name}: ${JSON.stringify(matches.map(c => c.sourceInfo))}`);
    }
    return problems;
  }
  function ownsResources(ctx: ExtensionContext) {
    const problems = collisions();
    if (problems.length) report(ctx, problems.join('\n') + '\nDisable the conflicting port or resource and reload. State is unchanged.', true);
    return problems.length === 0;
  }
  function canChangeMode(ctx: ExtensionContext) {
    if (!ownsResources(ctx)) return false;
    if (!ctx.isIdle()) {
      report(ctx, 'Poteto Mode request refused while the agent is busy. State is unchanged and the task was not queued. Retry after the agent settles.', true);
      return false;
    }
    return true;
  }
  function setMode(ctx: ExtensionContext, enabled: boolean) {
    if (!canChangeMode(ctx)) return false;
    if (branchMode(ctx.sessionManager.getBranch()) !== enabled) pi.appendEntry(modeType, { version: 1, enabled });
    ctx.ui.setStatus('pi-mstack', enabled ? 'Poteto Mode' : undefined);
    return true;
  }
  // Route prompts through the input pipeline, not a fire-and-forget command
  // handler, so CLI callers await the same run and attachments are preserved.
  pi.on('input', (event, ctx) => {
    pendingName = undefined;
    if (event.source === 'extension') return;
    const capture = (raw: string, expected: string) => {
      if (ctx.isIdle() && ownsGoal()) pendingName = { sessionId: ctx.sessionManager.getSessionId(), raw, expected };
    };
    const match = event.text.match(/^\/(?:skill:poteto-mode|poteto-mode)(?:[ \t\r\n]+([\s\S]*))?$/);
    if (!match || match[0] !== event.text) {
      if (event.text.trim() && !event.text.trimStart().startsWith('/')) capture(event.text, event.text);
      return;
    }
    if (!ownsResources(ctx)) return { action: 'continue' };
    const task = match[1]?.trim() ?? '';
    if (!setMode(ctx, task !== 'off')) return { action: 'handled' };
    if (!task || task === 'off') {
      report(ctx, task === 'off' ? 'Poteto Mode disabled.' : 'Poteto Mode enabled.');
      return { action: 'handled' };
    }
    const path = pi.getCommands().find(c => c.name === 'skill:poteto-mode')!.sourceInfo.path;
    try {
      const body = stripFrontmatter(readFileSync(path, 'utf8')).trim();
      capture(task, `<skill name="poteto-mode" location="${path}">\nReferences are relative to ${dirname(path)}.\n\n${body}\n</skill>\n\n${task}`);
    } catch { clearName(); }
    return { action: 'transform', text: `/skill:poteto-mode ${task}` };
  });
  pi.on('session_start', (_event, ctx) => {
    for (const problem of collisions()) report(ctx, problem, true);
    const state = loadConfig(path);
    if (state.kind === 'invalid') report(ctx, state.diagnostic, true);
    ctx.ui.setStatus('pi-mstack', isEnabled(ctx) ? 'Poteto Mode' : undefined);
  });
  pi.on('session_tree', (_event, ctx) => {
    ctx.ui.setStatus('pi-mstack', isEnabled(ctx) ? 'Poteto Mode' : undefined);
  });
  pi.on('before_agent_start', (event, ctx) => {
    const sections = event.systemPromptOptions.sections;
    delete sections['pi-mstack-mode'];
    if (!collisions().length && isEnabled(ctx)) sections['pi-mstack-mode'] = `Poteto Mode is enabled on this branch. Read ${skillPath('poteto-mode')} in full before work, including the Principles index and Pi adapter. Read applicable leaves. Restore these instructions after compaction. The parent owns the playbook.`;
    const table = roleData(loadConfig(path), ctx);
    sections['pi-mstack-role-data'] = table + '\n' + policyStatus(pi.getSettings(), ctx.isProjectTrusted(), table);
  });
  pi.registerCommand('pstack', {
    description: 'Report diagnostics, or set default mode with default on/off.',
    handler: async (args, ctx) => {
      const arg = args.trim();
      if (/^default(?:\s|$)/.test(arg)) {
        if (arg === 'default') { report(ctx, `Poteto Mode default: ${defaultMode() ? 'on' : 'off'}. Use /pstack default on or /pstack default off.`); return; }
        const match = arg.match(/^default (on|off)$/);
        if (!match) { report(ctx, 'Usage: /pstack default on|off. Configuration unchanged.', true); return; }
        if (!canChangeMode(ctx)) return;
        const state = loadConfig(path);
        if (state.kind === 'invalid') { report(ctx, `Refusing to overwrite ${path}. ${state.diagnostic}`, true); return; }
        try {
          saveConfig(path, { ...state.config, potetoModeDefault: match[1] === 'on' }, state.original);
          ctx.ui.setStatus('pi-mstack', isEnabled(ctx) ? 'Poteto Mode' : undefined);
          report(ctx, `Poteto Mode default saved: ${match[1]}. Explicit branch on/off choices still take precedence.`);
        } catch (error) { report(ctx, String(error), true); }
        return;
      }
      const active = new Set(pi.getActiveTools());
      const tools = pi.getAllTools();
      const capabilities = ['subagents_enable', 'subagent', 'LoopCreate', 'MonitorCreate'].map(name => {
        const tool = tools.find(t => t.name === name);
        return `${name}: ${tool ? active.has(name) ? 'present' : 'inactive' : 'absent'}${tool ? ' ' + JSON.stringify(tool.sourceInfo) : ''}`;
      });
      report(ctx, [`Mode ${isEnabled(ctx) ? 'on' : 'off'}; default ${defaultMode() ? 'on' : 'off'}.`, ...collisions(), ...capabilities, 'Dependency versions and resolved native agent provenance unverified. Inspect native subagent list/get metadata before claiming bundled restrictions.', `Configuration ${path}`, roleData(loadConfig(path), ctx), policyStatus(pi.getSettings(), ctx.isProjectTrusted(), roleData(loadConfig(path), ctx))].join('\n'));
    },
  });
  pi.registerCommand('setup-pstack', {
    description: 'Transactionally configure exact role selectors and ordered panels.',
    handler: async (args, ctx) => {
      if (!ownsResources(ctx)) return;
      let source: string | undefined;
      if (args.trim()) {
        try {
          const input = parseImportPath(args);
          source = resolve(ctx.cwd, input === '~' ? homedir() : input.startsWith('~/') ? resolve(homedir(), input.slice(2)) : input);
        } catch (error) { report(ctx, String(error), true); return; }
      }
      const state = loadConfig(path);
      if (state.kind === 'invalid') { report(ctx, `Refusing to overwrite ${path}. ${state.diagnostic}`, true); return; }
      if (!ctx.hasUI) { report(ctx, `${path}\n${JSON.stringify(state.config, null, 2)}\nUse interactive /setup-pstack to choose authenticated, scoped models. No changes written.`); return; }
      if (source !== undefined) {
        try {
          const fd = openSync(source, constants.O_RDONLY | constants.O_NONBLOCK);
          let text: string;
          try {
            if (!fstatSync(fd).isFile()) throw Error('Import source must be a regular file');
            const bytes = Buffer.alloc(1024 * 1024 + 1);
            let size = 0, count: number;
            while (size < bytes.length && (count = readSync(fd, bytes, size, bytes.length - size, null)) > 0) size += count;
            if (size === bytes.length) throw Error('Import source exceeds 1 MiB');
            text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes.subarray(0, size));
          } finally { closeSync(fd); }
          const draft = parseConfig({ ...state.config, roles: parseLegacyRoles(text) });
          const refreshed = await ctx.modelRegistry.refresh({ allowNetwork: false, signal: AbortSignal.timeout(5000) });
          if (refreshed.aborted || refreshed.errors.size || ctx.modelRegistry.getError()) throw Error('Registry refresh failed. Configuration unchanged. Retry the import.');
          const availability = await freshImportAvailability(draft, ctx);
          if (!ownsResources(ctx)) return;
          const preview = inspectRoles(draft, ctx, availability);
          if (!preview.valid) throw Error(`Import blocked. Configuration unchanged.\n${preview.table}`);
          const message = `Source: ${source}\nDestination: ${path}\nReplace ALL configured role assignments. Omitted roles inherit the parent.\nPreserved potetoModeDefault: ${draft.potetoModeDefault ?? 'absent'}\n\nConfigured roles to save:\n${JSON.stringify(draft.roles, null, 2)}\n\nEffective roles:\n${preview.table}`;
          if (!(await ctx.ui.confirm('Import pstack role configuration?', message))) return;
          const rechecked = await ctx.modelRegistry.refresh({ allowNetwork: false, signal: AbortSignal.timeout(5000) });
          if (rechecked.aborted || rechecked.errors.size || ctx.modelRegistry.getError()) throw Error('Registry refresh failed. Configuration unchanged. Retry the import.');
          const freshAvailability = await freshImportAvailability(draft, ctx);
          if (!ownsResources(ctx)) return;
          const fresh = inspectRoles(draft, ctx, freshAvailability);
          if (!fresh.valid || fresh.table !== preview.table) throw Error('Import preview changed or became invalid. Configuration unchanged. Retry the import.');
          saveConfig(path, draft, state.original);
          report(ctx, 'Role configuration imported. Native preflight still required.');
        } catch (error) { report(ctx, `${source}: ${String(error)}`, true); }
        return;
      }
      const choices = modelChoices(ctx);
      const selectors = ['inherit-parent', ...choices.flatMap(model => getSupportedThinkingLevels(model).map(level => `${model.provider}/${model.id}:${level}`))];
      const draft = structuredClone(state.config);
      for (;;) {
        const name = await ctx.ui.select('Select a role, then save all changes', [...roles.map(r => r.name), 'Save', 'Cancel']);
        if (!name || name === 'Cancel') return;
        if (name === 'Save') break;
        const role = roles.find(r => r.name === name);
        if (!role) return;
        if (role.panel) {
          const text = await ctx.ui.input(`Ordered JSON array for ${name}. Choices: ${selectors.join(', ')}`, JSON.stringify(draft.roles[name] ?? ['inherit-parent', 'inherit-parent']));
          if (text === undefined) return;
          try {
            const next = parseConfig({ ...draft, roles: { ...draft.roles, [name]: JSON.parse(text) } });
            const value = next.roles[name];
            if (!Array.isArray(value) || value.some(v => !selectors.includes(v))) throw Error('Select only offered models');
            draft.roles[name] = value;
          } catch (error) { report(ctx, String(error), true); return; }
        } else {
          const value = await ctx.ui.select(name, selectors);
          if (!value) return;
          if (!selectors.includes(value)) { report(ctx, 'Invalid selection. Configuration unchanged.', true); return; }
          draft.roles[name] = value;
        }
      }
      if (!(await ctx.ui.confirm('Save pstack role configuration?', roleData({ kind: 'valid', config: draft, original: state.original }, ctx)))) return;
      try { saveConfig(path, draft, state.original); report(ctx, 'Role configuration saved. Native preflight still required.'); }
      catch (error) { report(ctx, String(error), true); }
    },
  });
}
