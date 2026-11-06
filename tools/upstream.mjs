import { resolve } from 'node:path';
import { readJSON, propose, accept, generate, repairLock, exportSource } from './importer.mjs';

const commands = {
  propose: { required: ['repo', 'commit'], optional: [] },
  accept: { required: ['proposal', 'reviewed'], optional: [] },
  export: { required: ['destination'], optional: [] },
  generate: { required: [], optional: ['check'] },
  check: { required: [], optional: [] },
  'repair lock': { required: [], optional: ['acknowledge'] },
  'repair generated': { required: [], optional: [] },
};
let usage = `Usage: node tools/upstream.mjs <${Object.keys(commands).join(' | ')}> [options] [--root PATH]`;
try {
  const args = process.argv.slice(2);
  const command = args.shift();
  const key = command === 'repair' ? `repair ${args.shift()}` : command;
  if (!Object.hasOwn(commands, key)) throw Error('Unknown or missing command');
  const spec = commands[key];
  usage = `Usage: node tools/upstream.mjs ${key}${spec.required.map(name => ` --${name} VALUE`).join('')}${spec.optional.map(name => ` [--${name}${name === 'check' ? '' : ' VALUE'}]`).join('')} [--root PATH]`;
  const flags = {};
  for (let i = 0; i < args.length; i++) {
    const option = args[i];
    const name = option.slice(2);
    if (!option.startsWith('--') || ![...spec.required, ...spec.optional, 'root'].includes(name)) throw Error(`Unknown option or argument: ${option}`);
    if (Object.hasOwn(flags, name)) throw Error(`Duplicate option: ${option}`);
    if (name === 'check') { flags[name] = true; continue; }
    const value = args[++i];
    if (!value || value.startsWith('--')) throw Error(`Missing value for ${option}`);
    flags[name] = value;
  }
  for (const name of spec.required) if (!flags[name]) throw Error(`Missing required option --${name}`);
  const root = resolve(flags.root ?? '.');
  switch (key) {
    case 'propose': {
      const proposal = propose(root, { repo: flags.repo, commit: flags.commit });
      process.stdout.write(JSON.stringify({ proposal, ...readJSON(proposal + '/review.json') }, null, 2) + '\n');
      break;
    }
    case 'accept': accept(root, { proposal: resolve(flags.proposal), reviewed: flags.reviewed }); break;
    case 'export': exportSource(root, resolve(flags.destination)); break;
    case 'generate': generate(root, { check: flags.check === true }); break;
    case 'check': generate(root, { check: true }); break;
    case 'repair lock': repairLock(root, flags.acknowledge); break;
    case 'repair generated': generate(root, { repair: true }); break;
  }
} catch (error) {
  process.stderr.write(`${error.message}\n${usage}\n`);
  process.exitCode = 1;
}
