import { resolve } from 'node:path';
import { readJSON, propose, accept, generate, repairLock, exportSource } from './importer.mjs';
const [command, ...args] = process.argv.slice(2);
const flag = name => { const i = args.indexOf('--' + name); return i < 0 ? undefined : args[i + 1]; };
const root = resolve(flag('root') ?? '.');
try {
  switch (command) {
    case 'propose': {
      const proposal = propose(root, { repo: flag('repo'), commit: flag('commit') });
      process.stdout.write(JSON.stringify({ proposal, ...readJSON(proposal + '/review.json') }, null, 2) + '\n');
      break;
    }
    case 'accept': accept(root, { proposal: resolve(flag('proposal')), reviewed: flag('reviewed') }); break;
    case 'export': exportSource(root, resolve(flag('destination'))); break;
    case 'generate': generate(root); break;
    case 'check': generate(root, { check: true }); break;
    case 'repair':
      if (args[0] === 'lock') repairLock(root, flag('acknowledge'));
      else if (args[0] === 'generated') generate(root, { repair: true });
      else throw Error('Use repair lock or repair generated');
      break;
    default: throw Error('Use propose, accept, generate, check, or repair');
  }
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
}
