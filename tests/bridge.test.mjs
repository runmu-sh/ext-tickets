// The text bridge over a fake `mu.sessions.request`: what the host does with each verdict ('more' captures and
// hides, 'skip' leaves the line in the terminal, 'done' resolves), a timeout (RequestTimeout with `partial`) and a
// session that closes mid-request (the host rejects with "the session closed").
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { load } from './load.mjs';

const { readMine, readThread } = await load('src/bridge.ts');

/**
 * A scripted game. `answers[cmd]` is the lines it prints for a command (or a function of the call count). `noise`
 * lines are printed before the answer, as the player's own output racing the request. `stall` stops printing
 * after that many lines of an answer (the request then times out); `close` closes the session after that many.
 */
function game({ answers, noise = {}, stall, close } = {}) {
  const terminal = [], hidden = [], typed = [];
  let printed = 0;
  const run = async (text, { until }) => {
    typed.push(text);
    const lines = [...(noise[text] ?? []), ...(answers[text] ?? [])];
    const got = [];
    for (const t of lines) {
      if (close !== undefined && printed >= close) throw Object.assign(new Error('the session closed'), { name: 'RequestRefused' });
      if (stall !== undefined && printed >= stall) throw Object.assign(new Error('request timed out after 6000 ms'), { name: 'RequestTimeout', partial: got });
      printed++;
      const v = until({ text: t });
      if (v === 'skip') { terminal.push(t); continue; }
      got.push({ text: t }); hidden.push(t);
      if (v === 'done') return got;
    }
    throw Object.assign(new Error('request timed out after 6000 ms'), { name: 'RequestTimeout', partial: got });
  };
  const send = (text) => { typed.push(text); };
  return { run, send, terminal, hidden, typed };
}

const OPEN_MENU = [
  '=== YOUR OPEN REQUESTS [open] ===', '', 'Choose a request to read, reply to, or withdraw.', '',
  '  1: Puppet Request #091e3312 (with staff . 2d . Puppet request: a hulking masked man)',
  '  2: Bug Report #11bd432e (with staff . 6d . surface exits reveal bit name)',
  '  s: Search your requests', '  f: Show finished requests', '  q: Quit',
];
const FINISHED_1 = [
  '=== YOUR FINISHED REQUESTS [including finished] ===', '', 'Choose a finished request to read.', '',
  '  1: Bug Report #de53bf87 (closed . 1d . gather specific virtual resources doesn\'t work)',
  '  4: Puppet Request #091e3312 (with staff . 2d . Puppet request: a hulking masked man)',
  '  n: Next page', '  s: Search your requests', '  f: Show open requests only', '  q: Quit',
];
const FINISHED_2 = [
  '=== YOUR FINISHED REQUESTS [including finished] ===', '',
  '  9: Player Request #27513c19 (closed . 5d . You are fixed.)',
  '  p: Previous page', '  s: Search your requests', '  f: Show open requests only', '  q: Quit',
];
const OPEN_THREAD = [
  '[Bug Report #11bd432e] surface exits reveal bit name', '  Status: with staff . updated 6d ago', '',
  '  [6d] Mox: walking in the rustfields, I saw his bit name', '  [1d] Sol (staff): Looking into it.', '',
  '(Reply with @ticket 11bd432e = <text>.)', '(Withdraw it with @ticket/withdraw 11bd432e.)',
];

test('the open list: rows read, the menu hidden, q leaves it', async () => {
  const g = game({ answers: { '@tickets': OPEN_MENU } });
  const r = await readMine(g.run, g.send, false);
  assert.equal(r.ok, true);
  assert.deepEqual(r.rows.map((t) => [t.short_id, t.kind, t.status]), [['#091e3312', 'puppet', 'pending'], ['#11bd432e', 'bug', 'pending']]);
  assert.deepEqual(g.typed, ['@tickets', 'q']);
  assert.deepEqual(g.terminal, []);
  assert.equal(g.hidden.length, OPEN_MENU.length);
});

test("interleaved player output stays visible ('skip'), before and inside the menu", async () => {
  const menu = [...OPEN_MENU.slice(0, 5), 'Kest says, "over here"', ...OPEN_MENU.slice(5)];
  const g = game({ answers: { '@tickets': menu }, noise: { '@tickets': ['Upstairs cafe', 'A tram rattles past.'] } });
  const r = await readMine(g.run, g.send, false);
  assert.equal(r.ok, true);
  assert.equal(r.rows.length, 2);
  assert.deepEqual(g.terminal, ['Upstairs cafe', 'A tram rattles past.', 'Kest says, "over here"']);
  assert.ok(!g.hidden.includes('Upstairs cafe'));
});

test('the closed list: f, every next page, then q; open rows are dropped', async () => {
  const g = game({ answers: { '@tickets': OPEN_MENU, f: FINISHED_1, n: FINISHED_2 } });
  const r = await readMine(g.run, g.send, true);
  assert.equal(r.ok, true);
  assert.deepEqual(g.typed, ['@tickets', 'f', 'n', 'q']);
  assert.deepEqual(r.rows.map((t) => t.id), ['de53bf87', '27513c19']);
});

test('a timeout keeps the rows read so far and leaves the menu', async () => {
  const g = game({ answers: { '@tickets': OPEN_MENU }, stall: 5 }); // header, blank, noise, blank, row 1
  const r = await readMine(g.run, g.send, false);
  assert.equal(r.ok, false);
  assert.equal(r.partial, true);
  assert.equal(r.reason, 'timeout');
  assert.deepEqual(r.rows.map((t) => t.id), ['091e3312']);
  assert.equal(g.typed.at(-1), 'q');
});

test('a timeout on a later page keeps the earlier pages', async () => {
  const g = game({ answers: { '@tickets': OPEN_MENU, f: FINISHED_1, n: FINISHED_2 }, stall: OPEN_MENU.length + FINISHED_1.length + 1 });
  const r = await readMine(g.run, g.send, true);
  assert.equal(r.partial, true);
  assert.deepEqual(r.rows.map((t) => t.id), ['de53bf87']);
});

test('no menu at all (a game without @tickets): not ok, nothing hidden, no q', async () => {
  const g = game({ answers: { '@tickets': ['Huh? (Type "help" for help.)'] } });
  const r = await readMine(g.run, g.send, false);
  assert.equal(r.ok, false);
  assert.equal(r.sawList, false);
  assert.deepEqual(g.terminal, ['Huh? (Type "help" for help.)']);
  assert.deepEqual(g.typed, ['@tickets']);
});

test('the session closing mid-request: the error is reported, the rows so far kept, no q typed', async () => {
  const g = game({ answers: { '@tickets': OPEN_MENU }, close: 5 });
  const r = await readMine(g.run, g.send, false);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'the session closed');
  assert.deepEqual(r.rows.map((t) => t.id), ['091e3312']);
  assert.deepEqual(g.typed, ['@tickets']);
});

test('another client asked (a keyed request resolves null): nothing to show', async () => {
  const r = await readMine(async () => null, () => {}, false);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'another client asked');
});

// Inside a thread an unindented line continues the last message (a puppet request's "Said so far:" block), so only
// output before the thread's head can be told apart; that is the format's limit.
test('a thread: read to its withdraw tail, all of it hidden, output before it shown', async () => {
  const g = game({ answers: { '@ticket 11bd432e': OPEN_THREAD }, noise: { '@ticket 11bd432e': ['Upstairs cafe'] } });
  const r = await readThread(g.run, '11bd432e', () => 'Mox');
  assert.equal(r.ok, true);
  assert.deepEqual(r.t.messages.map((m) => [m.sender, m.origin]), [['Mox', 'player'], ['Sol', 'staff']]);
  assert.deepEqual(g.terminal, ['Upstairs cafe']);
  assert.equal(g.hidden.length, OPEN_THREAD.length);
});

test('a thread whose tail never comes is still whole after the timeout', async () => {
  const g = game({ answers: { '@ticket 11bd432e': OPEN_THREAD.slice(0, -1) } });
  const r = await readThread(g.run, '11bd432e', () => 'Mox');
  assert.equal(r.ok, true);
  assert.equal(r.t.messages.length, 2);
});

test('a thread cut short by a timeout keeps what was read (partial)', async () => {
  const g = game({ answers: { '@ticket 11bd432e': OPEN_THREAD }, stall: 4 });
  const r = await readThread(g.run, '11bd432e', () => 'Mox');
  assert.equal(r.ok, false);
  assert.equal(r.partial, true);
  assert.equal(r.t.messages.length, 1);
});

test('a thread when the session closes: rejected, not found is false', async () => {
  const g = game({ answers: { '@ticket 11bd432e': OPEN_THREAD }, close: 2 });
  const r = await readThread(g.run, '11bd432e', () => 'Mox');
  assert.equal(r.ok, false);
  assert.equal(r.notFound, false);
  assert.equal(r.reason, 'the session closed');
});

test('no such ticket', async () => {
  const g = game({ answers: { '@ticket zz': ['No ticket with that id.'] } });
  const r = await readThread(g.run, 'zz', () => 'Mox');
  assert.equal(r.notFound, true);
  assert.equal(r.t, null);
});
