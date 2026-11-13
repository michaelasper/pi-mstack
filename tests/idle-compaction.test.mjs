import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ModelRuntime } from '@earendil-works/pi-coding-agent';
import { createIdleCompaction, idleCompactRearm, idleCompactTrigger } from '../extensions/pstack/idle-compaction.ts';

function harness({ enabled = true, ...overrides } = {}) {
  const calls = [];
  let observation = { percent: 90, idle: true, pending: false, model: { provider: 'p', id: 'm' }, session: 's1', ...overrides };
  const ctx = {
    isIdle: () => observation.idle,
    hasPendingMessages: () => observation.pending,
    getContextUsage: () => observation.model === undefined || observation.percent === undefined ? undefined : { percent: observation.percent },
    model: undefined,
    sessionManager: { getSessionId: () => observation.session },
    compact(options) { calls.push(options); },
  };
  ctx.model = observation.model;
  const observe = next => { observation = { ...observation, ...next }; ctx.model = observation.model; };
  return { ctx, calls, observe, helper: createIdleCompaction(() => enabled) };
}

test('idle compaction is off by default and policy thresholds are explicit', () => {
  assert.equal(idleCompactTrigger, 80);
  assert.equal(idleCompactRearm, 70);
  const disabled = harness({ enabled: false });
  assert.equal(disabled.helper.settled(disabled.ctx, false), undefined);
  assert.equal(disabled.calls.length, 0);
  assert.equal(disabled.helper.state(), 'armed');
});

test('idle compaction skips aborted, busy, pending, model-less, and unknown usage settlements', () => {
  for (const shape of [{ idle: false }, { pending: true }, { model: undefined }, { percent: null }, { percent: undefined }, { percent: Number.NaN }, { percent: Number.POSITIVE_INFINITY }]) {
    const { helper, ctx, calls } = harness(shape);
    assert.equal(helper.settled(ctx, false), undefined, JSON.stringify(shape));
    assert.equal(calls.length, 0, JSON.stringify(shape));
  }
  const aborted = harness();
  assert.equal(aborted.helper.settled(aborted.ctx, true), undefined);
  assert.equal(aborted.calls.length, 0);
});

test('idle compaction triggers at the threshold and waits for the native callbacks', async () => {
  const below = harness({ percent: idleCompactTrigger - 0.1 });
  assert.equal(below.helper.settled(below.ctx, false), undefined);
  assert.equal(below.calls.length, 0);
  const at = harness({ percent: idleCompactTrigger });
  const running = at.helper.settled(at.ctx, false);
  assert.ok(running instanceof Promise);
  assert.equal(at.helper.state(), 'running');
  assert.equal(at.calls.length, 1);
  assert.equal(at.helper.settled(at.ctx, false), undefined);
  assert.equal(at.calls.length, 1, 'single flight');
  at.calls[0].onComplete({});
  await running;
  assert.equal(at.helper.state(), 'disarmed');
});

test('idle compaction disarms after one attempt and rearms only at the rearm threshold', async () => {
  const { helper, ctx, calls, observe } = harness({ percent: 95 });
  const first = helper.settled(ctx, false);
  calls[0].onComplete({});
  await first;
  assert.equal(helper.state(), 'disarmed');
  observe({ percent: 99 });
  assert.equal(helper.settled(ctx, false), undefined);
  observe({ percent: idleCompactRearm + 1 });
  assert.equal(helper.settled(ctx, false), undefined);
  observe({ percent: idleCompactRearm });
  assert.equal(helper.settled(ctx, false), undefined, 'rearm alone does not compact');
  observe({ percent: 88 });
  const second = helper.settled(ctx, false);
  assert.ok(second instanceof Promise);
  assert.equal(calls.length, 2);
  calls[1].onError(Error('Compaction cancelled'));
  await second;
  assert.equal(helper.state(), 'disarmed');
  observe({ percent: 20 });
  helper.settled(ctx, false);
  assert.equal(helper.state(), 'armed');
  observe({ percent: 81 });
  const third = helper.settled(ctx, false);
  assert.ok(third instanceof Promise);
  assert.equal(calls.length, 3);
  calls[2].onComplete({});
  await third;
});

test('idle compaction resets its local state on a model or session change', async () => {
  const { helper, ctx, calls, observe } = harness({ percent: 95 });
  const first = helper.settled(ctx, false);
  calls[0].onError(Error('summary failed'));
  await first;
  assert.equal(helper.state(), 'disarmed');
  observe({ model: { provider: 'p', id: 'other' }, percent: 99 });
  const second = helper.settled(ctx, false);
  assert.ok(second instanceof Promise, 'model change re-arms');
  calls[1].onError(Error('another failure'));
  await second;
  observe({ session: 's2', percent: 99 });
  const third = helper.settled(ctx, false);
  assert.ok(third instanceof Promise, 'session change re-arms');
  calls[2].onComplete({});
  await third;
});

test('idle compaction retries after a colliding native model change but not an unchanged identity', async t => {
  const dir = mkdtempSync(join(tmpdir(), 'mstack-model-identity-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const authPath = join(dir, 'auth.json');
  const modelsPath = join(dir, 'models.json');
  writeFileSync(authPath, '{}');
  writeFileSync(modelsPath, '{}');
  const runtime = await ModelRuntime.create({ authPath, modelsPath, refreshOnCreate: false, allowModelNetwork: false });
  const config = id => ({
    api: 'mstack-local-probe', baseUrl: 'http://127.0.0.1:1', apiKey: 'not-a-credential',
    models: [{ id, name: id, reasoning: false, input: ['text'], cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, contextWindow: 200000, maxTokens: 4096 }],
    streamSimple() { throw Error('No provider request permitted'); },
  });
  runtime.registerProvider('team/custom', config('script/model'));
  runtime.registerProvider('team', config('custom/script/model'));
  const firstModel = runtime.getModel('team/custom', 'script/model');
  const secondModel = runtime.getModel('team', 'custom/script/model');
  assert.ok(firstModel);
  assert.ok(secondModel);
  const { helper, ctx, calls, observe } = harness({ percent: 95, model: firstModel });
  const first = helper.settled(ctx, false);
  assert.equal(calls.length, 1);
  calls[0].onError(Error('summary failed'));
  await first;
  observe({ model: { ...firstModel } });
  assert.equal(helper.settled(ctx, false), undefined);
  assert.equal(calls.length, 1, 'unchanged identity stays disarmed after failure');
  observe({ model: secondModel });
  const second = helper.settled(ctx, false);
  assert.equal(calls.length, 2, 'distinct native model identity permits a new attempt at high usage');
  calls[1].onError(Error('second summary failed'));
  await second;
  assert.equal(helper.settled(ctx, false), undefined);
  assert.equal(calls.length, 2, 'second unchanged identity also stays disarmed');
});

test('idle compaction distinguishes an absent model from string model names', async () => {
  const { helper, ctx, calls, observe } = harness({ percent: 95, model: { provider: '', id: '' } });
  const first = helper.settled(ctx, false);
  calls[0].onError(Error('summary failed'));
  await first;
  observe({ model: undefined });
  assert.equal(helper.settled(ctx, false), undefined);
  assert.equal(calls.length, 1, 'absent model never compacts');
  observe({ model: { provider: '', id: '' } });
  const second = helper.settled(ctx, false);
  assert.equal(calls.length, 2, 'returning from absent model resets identity');
  calls[1].onComplete({});
  await second;
});

test('idle compaction settles once and ignores late callbacks after close', async () => {
  const { helper, ctx, calls } = harness({ percent: 95 });
  const running = helper.settled(ctx, false);
  helper.close();
  assert.equal(helper.state(), 'closed');
  await running;
  calls[0].onComplete({});
  assert.equal(helper.state(), 'closed');
  assert.equal(helper.settled(ctx, false), undefined);
  assert.equal(calls.length, 1);
  helper.reset();
  assert.equal(helper.state(), 'closed', 'reset cannot revive a closed helper');
});

test('idle compaction rechecks idle and identity before invoking native compaction', () => {
  const { helper, ctx, calls, observe } = harness({ percent: 95 });
  observe({ pending: true });
  assert.equal(helper.settled(ctx, false), undefined);
  assert.equal(calls.length, 0);
  observe({ pending: false, session: 's9' });
  const running = helper.settled(ctx, false);
  assert.ok(running instanceof Promise);
  calls[0].onError(Error('stop'));
});
