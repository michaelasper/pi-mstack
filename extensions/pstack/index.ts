import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getAgentDir, type ExtensionAPI, type ExtensionContext, type SessionEntry } from '@earendil-works/pi-coding-agent';
import { getSupportedThinkingLevels } from '@earendil-works/pi-ai';
import { configPath, loadConfig, modelChoices, parseConfig, policyStatus, roleData, roles, saveConfig } from './config.ts';

export const modeType = 'pi-mstack/mode';
export function enabledOnBranch(entries: readonly SessionEntry[]): boolean {
  let enabled = false;
  for (const entry of entries) {
    if (entry.type !== 'custom' || entry.customType !== modeType) continue;
    const data: unknown = entry.data;
    if (typeof data === 'object' && data !== null && 'version' in data && data.version === 1 && 'enabled' in data && typeof data.enabled === 'boolean') enabled = data.enabled;
  }
  return enabled;
}
export default function pstack(pi: ExtensionAPI) {
  const ownPath = fileURLToPath(import.meta.url);
  const root = resolve(dirname(ownPath), '../..');
  const path = configPath(getAgentDir());
  const skillPath = (name: string) => resolve(root, 'generated/skills', name, 'SKILL.md');
  const report = (ctx: ExtensionContext, text: string, error = false) => {
    if (ctx.hasUI) ctx.ui.notify(text, error ? 'error' : 'info');
    else process.stderr.write(`pi-mstack: ${text}\n`);
  };
  function collisions() {
    const commands = pi.getCommands(), problems: string[] = [];
    for (const name of ['poteto-mode', 'setup-pstack', 'pstack']) {
      const matches = commands.filter(c => c.source === 'extension' && (c.name === name || c.name.startsWith(name + ':')));
      if (matches.length !== 1 || matches[0].name !== name || resolve(matches[0].sourceInfo.path) !== ownPath) problems.push(`Command collision ${name}: ${JSON.stringify(matches.map(c => ({ name: c.name, sourceInfo: c.sourceInfo })))}`);
    }
    for (const name of ['poteto-mode', 'setup-pstack']) {
      const matches = commands.filter(c => c.name === `skill:${name}`);
      if (matches.length !== 1 || matches[0].source !== 'skill' || resolve(matches[0].sourceInfo.path) !== skillPath(name)) problems.push(`Skill collision or missing ${name}: ${JSON.stringify(matches.map(c => c.sourceInfo))}`);
    }
    return problems;
  }
  function ownsResources(ctx: ExtensionContext) {
    const problems = collisions();
    if (problems.length) report(ctx, problems.join('\n') + '\nDisable the conflicting port or resource and reload. State is unchanged.', true);
    return problems.length === 0;
  }
  function setMode(ctx: ExtensionContext, enabled: boolean) {
    if (!ownsResources(ctx)) return false;
    if (!ctx.isIdle()) {
      report(ctx, 'Poteto Mode request refused while the agent is busy. State is unchanged and the task was not queued. Retry after the agent settles.', true);
      return false;
    }
    if (enabledOnBranch(ctx.sessionManager.getBranch()) !== enabled) pi.appendEntry(modeType, { version: 1, enabled });
    ctx.ui.setStatus('pi-mstack', enabled ? 'Poteto Mode' : undefined);
    return true;
  }
  pi.registerCommand('poteto-mode', {
    description: 'Enable Poteto Mode, or off. Tasks use /skill:poteto-mode.',
    handler: async (args, ctx) => {
      if (!ownsResources(ctx)) return;
      const arg = args.trim();
      if (arg && arg !== 'off') { report(ctx, 'Task-bearing short commands are unsupported. Use /skill:poteto-mode ' + arg, true); return; }
      if (setMode(ctx, arg !== 'off')) report(ctx, arg === 'off' ? 'Poteto Mode disabled.' : 'Poteto Mode enabled.');
    },
  });
  pi.on('input', (event, ctx) => {
    if (event.source === 'extension') return;
    const match = event.text.match(/^\/skill:poteto-mode(?: (.*))?$/s);
    if (!match || match[0] !== event.text) return;
    if (!ownsResources(ctx)) return { action: 'continue' };
    const task = match[1]?.trim() ?? '';
    if (!setMode(ctx, task !== 'off')) return { action: 'handled' };
    if (!task || task === 'off') return { action: 'handled' };
    return { action: 'continue' };
  });
  pi.on('session_start', (_event, ctx) => {
    for (const problem of collisions()) report(ctx, problem, true);
    const state = loadConfig(path);
    if (state.kind === 'invalid') report(ctx, state.diagnostic, true);
    ctx.ui.setStatus('pi-mstack', enabledOnBranch(ctx.sessionManager.getBranch()) ? 'Poteto Mode' : undefined);
  });
  pi.on('session_tree', (_event, ctx) => {
    ctx.ui.setStatus('pi-mstack', enabledOnBranch(ctx.sessionManager.getBranch()) ? 'Poteto Mode' : undefined);
  });
  pi.on('before_agent_start', (event, ctx) => {
    const sections = event.systemPromptOptions.sections;
    delete sections['pi-mstack-mode'];
    if (!collisions().length && enabledOnBranch(ctx.sessionManager.getBranch())) sections['pi-mstack-mode'] = `Poteto Mode is enabled on this branch. Read ${skillPath('poteto-mode')} in full before work, including the Principles index and Pi adapter. Read applicable leaves. Restore these instructions after compaction. The parent owns the playbook.`;
    const table = roleData(loadConfig(path), ctx);
    sections['pi-mstack-role-data'] = table + '\n' + policyStatus(pi.getSettings(), ctx.isProjectTrusted(), table);
  });
  pi.registerCommand('pstack', {
    description: 'Report resource provenance, mode, roles, and native capability status.',
    handler: async (_args, ctx) => {
      const active = new Set(pi.getActiveTools());
      const tools = pi.getAllTools();
      const capabilities = ['subagents_enable', 'subagent', 'LoopCreate', 'MonitorCreate'].map(name => {
        const tool = tools.find(t => t.name === name);
        return `${name}: ${tool ? active.has(name) ? 'present' : 'inactive' : 'absent'}${tool ? ' ' + JSON.stringify(tool.sourceInfo) : ''}`;
      });
      report(ctx, [`Mode ${enabledOnBranch(ctx.sessionManager.getBranch()) ? 'on' : 'off'}.`, ...collisions(), ...capabilities, 'Dependency versions and resolved native agent provenance unverified. Inspect native subagent list/get metadata before claiming bundled restrictions.', `Configuration ${path}`, roleData(loadConfig(path), ctx), policyStatus(pi.getSettings(), ctx.isProjectTrusted(), roleData(loadConfig(path), ctx))].join('\n'));
    },
  });
  pi.registerCommand('setup-pstack', {
    description: 'Transactionally configure exact role selectors and ordered panels.',
    handler: async (_args, ctx) => {
      if (!ownsResources(ctx)) return;
      const state = loadConfig(path);
      if (state.kind === 'invalid') { report(ctx, `Refusing to overwrite ${path}. ${state.diagnostic}`, true); return; }
      if (!ctx.hasUI) { report(ctx, `${path}\n${JSON.stringify(state.config, null, 2)}\nUse interactive /setup-pstack to choose authenticated, scoped models. No changes written.`); return; }
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
