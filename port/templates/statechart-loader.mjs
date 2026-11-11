import { readFileSync } from 'node:fs';
import { registerHooks, stripTypeScriptTypes } from 'node:module';

// Node's default type stripping rejects npm-installed TypeScript. Limit this
// loader to the statechart tree; unrelated dependencies keep Node's defaults.
const root = new URL('./', import.meta.url).href;
registerHooks({
  load(url, context, nextLoad) {
    if (!url.startsWith(root) || !url.endsWith('.ts')) return nextLoad(url, context);
    return {
      format: 'module',
      source: stripTypeScriptTypes(readFileSync(new URL(url), 'utf8'), { mode: 'strip', sourceUrl: url }),
      shortCircuit: true,
    };
  },
});
