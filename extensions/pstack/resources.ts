import { realpathSync } from 'node:fs';

export function sameFile(left: string, right: string): boolean {
  try { return realpathSync(left) === realpathSync(right); }
  catch { return false; }
}
