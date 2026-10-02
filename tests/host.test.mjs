/**
 * The extension in the headless μClient host (@runmu.sh/dev/test), with linkedom for the panels' DOM: panels and
 * identity, toasts and badges, the exact commands the buttons send, handlers, GMCP via, the text bridge over a
 * scripted `sessions.request` (interleaved output, a timeout, a session closing mid-request) and clean disposal.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseHTML } from 'linkedom';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const find = () => process.env.MUCLIENT_DEV_TEST ?? createRequire(join(ROOT, 'package.json')).resolve('@runmu.sh/dev/test');
const { createHost } = await import(pathToFileURL(find()).href);
const win = parseHTML('<!doctype html><html><body></body></html>');
globalThis.document = win.document;
globalThis.Event = win.Event;
globalThis.HTMLElement = win.HTMLElement;
const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));

const sessions = [{ id: 's1', worldId: 'w1', character: 'Ada' }, { id: 's2', worldId: 'w1', character: 'Mox' }];
const commands = (host, sid) => host.sends('command', sid).filter((c) => !c.request).map((c) => c.text);
const mount = (host, id, sid = 's1') => {
  const el = document.createElement('div');
  document.body.appendChild(el);
  const off = host.panels.get(id).mount(el, { sid, id });
  return { el, off, q: (s) => el.querySelector(s), qa: (s) => [...el.querySelectorAll(s)] };
};
const click = async (el) => { el.click(); await tick(); await tick(); };
const calls = (host, path) => host.calls.filter((c) => c.path === path).map((c) => c.args);

/** Feed a scripted game into `sessions.request` as the host does: 'skip' shows, 'more' captures, 'done' resolves. */
function scriptRequests(host, answers, opts = {}) {
  const shown = [];
  const pending = new Map();
  host.mu.sessions.request = (text, o) => {
    host.sent.push({ kind: 'command', sid: o.sid, text, request: true });
    const lines = [...(opts.noise?.[text] ?? []), ...(answers[text] ?? [])];
    return new Promise((resolve, reject) => {
      const got = [];
      pending.set(o.sid, reject);
      const feed = (i) => {
        if (!pending.has(o.sid)) return;
        if (opts.stallAt !== undefined && i >= opts.stallAt) { pending.delete(o.sid); reject(Object.assign(new Error('request timed out'), { name: 'RequestTimeout', partial: got })); return; }
        if (i >= lines.length) { pending.delete(o.sid); reject(Object.assign(new Error('request timed out'), { name: 'RequestTimeout', partial: got })); return; }
        const v = o.until({ text: lines[i] });
        if (v === 'skip') shown.push(lines[i]); else got.push({ text: lines[i] });
        if (v === 'done') { pending.delete(o.sid); resolve(got); return; }
        if (opts.pauseAt === i) return; // the game goes quiet; close() rejects
        setTimeout(() => feed(i + 1), 0);
      };
      setTimeout(() => feed(0), 0);
    });
  };
  // The host rejects a closed session's requests.
  const close = host.close;
  host.close = (sid) => { const r = pending.get(sid); pending.delete(sid); r?.(Object.assign(new Error('the session closed'), { name: 'RequestRefused' })); close(sid); };
  return { shown };
}

const INBOX = { tickets: [
  { id: '13', kind: 'request', subject: 'Name change', requester_name: 'Orrin', priority: 0, updated: 1000 },
  { id: '12', kind: 'bug', subject: 'Door', requester_name: 'Maren', priority: 2, updated: 2000, status: 'pending' },
  { id: '14', kind: 'puppet', subject: 'Ferryman', requester_name: 'Kest', assignee: 'Ada', status: 'waiting', updated: 500 },
] };
const MENU = [
  '=== YOUR OPEN REQUESTS [open] ===', '', 'Choose a request to read, reply to, or withdraw.', '',
  '  1: Puppet Request #091e3312 (with staff . 2d . Puppet request: a hulking masked man)',
  '  2: Bug Report #11bd432e (with staff . 6d . surface exits reveal bit name)',
  '  s: Search your requests', '  f: Show finished requests', '  q: Quit',
];

test('registers both panels with show/role, the settings, actions, and declares Client.Tickets 1', async () => {
  const host = createHost({ root: ROOT, sessions });
  await host.load('src/index.ts');
  assert.deepEqual([...host.panels.keys()], ['tickets', 'mytickets']);
  assert.equal(host.panels.get('tickets').show, 'auto');
  assert.equal(host.panels.get('tickets').role, 'staff');
  assert.equal(host.panels.get('mytickets').show, 'always');
  assert.deepEqual(calls(host, 'gmcp.supports'), [[['Client.Tickets 1']]]);
  assert.deepEqual(host.settingsSchema.items.map((i) => i.key), ['tickets.source', 'tickets.rich', 'tickets.autoOpen', 'mytickets.source', 'mytickets.emptyHint', 'mytickets.text']);
  const ids = calls(host, 'actions.define').map(([a]) => a.id);
  assert.deepEqual(ids, ['tickets.open', 'tickets.claim', 'tickets.resolve', 'tickets.approve', 'tickets.deny', 'tickets.reply', 'tickets.reply_note', 'tickets.reopen', 'mytickets.myreply', 'mytickets.withdraw', 'mytickets.create']);
  assert.equal(calls(host, 'actions.define')[1][0].command, '@claim {short_id}');
  await host.unload();
  assert.deepEqual(host.live(), []);
});

test('staff: role is identity, new tickets toast once (kind tickets) and badge; the queue sorts priority, then oldest', async () => {
  const host = createHost({ root: ROOT, sessions });
  const { api } = await host.load('src/index.ts');
  host.gmcp('s1', 'Client.Tickets.Role', { staff: true });
  assert.deepEqual(host.sessions[0].roles, ['staff']);
  host.gmcp('s1', 'Client.Tickets.Inbox', INBOX);
  assert.deepEqual(host.toasts.map((t) => [t.title, t.kind]), [['New request #13', 'tickets'], ['New bug #12', 'tickets'], ['New puppet #14', 'tickets']]);
  host.gmcp('s1', 'Client.Tickets.Inbox', INBOX);
  assert.equal(host.toasts.length, 3, 'seen ids do not toast again');
  assert.deepEqual(calls(host, 'panels.badge').filter(([id]) => id === 'tickets').at(-1), ['tickets', { count: 3 }, 's1']);
  assert.ok(calls(host, 'panels.touch').some(([id, sid]) => id === 'tickets' && sid === 's1'));
  assert.deepEqual(api.get('inbox', 's1').map((t) => t.short_id), ['#13', '#12', '#14']);
  const p = mount(host, 'tickets');
  assert.deepEqual(p.qa('[data-testid=tickets-list] .row').map((r) => r.dataset.id), ['12', '14', '13'], 'priority first, then the longest waiting');
  assert.equal(p.q('[data-testid=tickets-count]').textContent, '3');
  // Show: Needs reply (pending, open), On player (waiting), Unclaimed
  const counts = p.qa('[data-testid=tickets-show] [role=radio]').map((b) => [b.dataset.show, b.querySelector('.count')?.textContent ?? '']);
  assert.deepEqual(counts, [['all', ''], ['reply', '2'], ['player', '1'], ['unclaimed', '2']]);
  await click(p.q('[data-show=player]'));
  assert.deepEqual(p.qa('[data-testid=tickets-list] .row').map((r) => r.dataset.id), ['14']);
  await click(p.q('[data-show=all]'));
  const s = p.q('[data-testid=tickets-search]');
  s.value = 'orrin'; s.dispatchEvent(new Event('input'));
  assert.deepEqual(p.qa('[data-testid=tickets-list] .row').map((r) => r.dataset.id), ['13']);
  p.off();
  await host.unload();
});

test('staff buttons send the 1.x commands; Deny asks for a reason; a handler returning true suppresses; via gmcp', async () => {
  const host = createHost({ root: ROOT, sessions });
  const { api } = await host.load('src/index.ts');
  host.gmcp('s1', 'Client.Tickets.Role', { staff: true });
  host.gmcp('s1', 'Client.Tickets.Inbox', { tickets: [{ id: '12', kind: 'bug', subject: 'Door' }] });
  const p = mount(host, 'tickets');
  await click(p.q('[data-id="12"]'));
  await click(p.q('[data-action=claim]'));
  await click(p.q('[data-action=resolve]'));
  await click(p.q('[data-action=approve]'));
  p.q('[data-testid=tickets-reply]').value = 'not reproducible';
  await click(p.q('[data-action=deny]'));
  const reply = p.q('[data-testid=tickets-reply]');
  reply.value = 'on it';
  reply.closest('form').dispatchEvent(new Event('submit', { cancelable: true }));
  await tick(); await tick();
  assert.deepEqual(commands(host, 's1'), ['@ticket #12', '@claim #12', '@resolve #12', '@approve #12', '@deny #12 = not reproducible', '@ticket #12 = on it']);
  // Deny with no text opens the decide row and sends nothing until it is confirmed
  await click(p.q('[data-action=deny]'));
  assert.ok(p.q('[data-testid=tickets-decide]'));
  assert.equal(p.q('[data-testid=tickets-reason]').getAttribute('placeholder'), 'Reason (the player sees it)');
  assert.equal(commands(host, 's1').length, 6);
  p.q('[data-testid=tickets-reason]').value = 'duplicate';
  p.q('[data-testid=tickets-decide]').dispatchEvent(new Event('submit', { cancelable: true }));
  await tick(); await tick();
  assert.equal(commands(host, 's1').at(-1), '@deny #12 = duplicate');
  assert.equal(p.q('[data-testid=tickets-fb]').textContent, 'Denied #12.');
  // a handler returning true takes the action
  const seen = [];
  const off = api.onAction('claim', (a) => { seen.push(a.short_id); return true; });
  await click(p.q('[data-action=claim]'));
  assert.deepEqual(seen, ['#12']);
  assert.equal(commands(host, 's1').length, 7);
  off();
  // via gmcp, via none
  api.configure({ actions: { resolve: { via: 'gmcp' }, approve: { via: 'none' } } });
  await click(p.q('[data-action=resolve]'));
  assert.deepEqual(host.sends('gmcp', 's1').filter((g) => g.pkg === 'Client.Tickets.Action').map((g) => g.data), [{ action: 'resolve', id: '12' }]);
  assert.equal(p.q('[data-action=approve]'), null);
  // GMCP refused: the command
  host.mu.gmcp.send = async (pkg, data, o) => { host.sent.push({ kind: 'gmcp', sid: o, pkg, data, refused: true }); return false; };
  await click(p.q('[data-action=resolve]'));
  assert.equal(commands(host, 's1').at(-1), '@resolve #12');
  assert.throws(() => api.configure({ actions: { nope: { via: 'gmcp' } } }), /Tickets: no action "nope"/);
  p.off();
  await host.unload();
});

test('approvable gates Approve/Deny vs Resolve; a closed ticket offers Reopen; bug detail in both dialects', async () => {
  const host = createHost({ root: ROOT, sessions });
  await host.load('src/index.ts');
  host.gmcp('s1', 'Client.Tickets.Role', { staff: true });
  host.gmcp('s1', 'Client.Tickets.Inbox', { tickets: [{ id: '1', kind: 'request', approvable: true }, { id: '2', kind: 'bug', approvable: false }, { id: '3', kind: 'bug', status: 'resolved' }] });
  const p = mount(host, 'tickets');
  const acts = () => p.qa('.act').map((b) => b.dataset.action);
  await click(p.q('[data-id="1"]'));
  assert.deepEqual(acts(), ['claim', 'approve', 'deny']);
  await click(p.q('[data-testid=tickets-back]'));
  await click(p.q('[data-id="2"]'));
  assert.deepEqual(acts(), ['claim', 'resolve']);
  await click(p.q('[data-testid=tickets-loadbug]'));
  assert.deepEqual(host.sends('gmcp', 's1').filter((g) => g.pkg === 'Client.Tickets.BugDetail').map((g) => g.data), [{ id: '2' }]);
  host.gmcp('s1', 'Client.Tickets.Thread', { id: '2', kind: 'bug' });
  host.gmcp('s1', 'Client.Tickets.BugDetail', { id: '2', bug: { reporter: 'Maren', character: 'Maren Vey', location: 'Ossuary', traceback_command: 'unlock door', traceback: 'E_PERM', character_state: { hp: '30/40' } } });
  const bug = p.q('[data-testid=tickets-bug]').textContent;
  for (const s of ['Maren / Maren Vey', 'Ossuary', 'unlock door', 'E_PERM', 'hp: 30/40']) assert.ok(bug.includes(s), s);
  host.gmcp('s1', 'Client.Tickets.BugDetail', { id: '2', bug: { available: false } });
  assert.ok(p.q('[data-testid=tickets-bug]').textContent.includes('No detailed bug report attached.'));
  await click(p.q('[data-testid=tickets-back]'));
  await click(p.q('[data-tab], [data-testid=tickets-tab-open]'));
  await click(p.q('[data-id="3"]'));
  assert.deepEqual(acts(), ['reopen']);
  p.off();
  await host.unload();
});

test('replies toast: Staff replied to the requester, Player replied to the assignee, none when the thread is on screen', async () => {
  const host = createHost({ root: ROOT, sessions });
  await host.load('src/index.ts');
  host.gmcp('s2', 'Client.Tickets.Mine', { tickets: [{ id: '9', subject: 'Lost my lantern', requester_name: 'Mox', status: 'pending' }], closed: false });
  host.gmcp('s2', 'Client.Tickets.Message', { id: '9', status: 'waiting', message: { sender: 'Vessa', origin: 'staff', text: 'Which stair?' } });
  assert.deepEqual(host.toasts.map((t) => [t.title, t.body]), [['Staff replied: #9 Lost my lantern', 'Vessa: Which stair?']]);
  host.gmcp('s1', 'Client.Tickets.Role', { staff: true });
  host.gmcp('s1', 'Client.Tickets.Inbox', { tickets: [{ id: '14', kind: 'puppet', subject: 'Ferryman', requester_name: 'Kest', assignee: 'Ada' }] });
  host.toasts.length = 0;
  host.gmcp('s1', 'Client.Tickets.Message', { id: '14', message: { sender: 'Kest', origin: 'player', text: 'Tomorrow?' } });
  assert.deepEqual(host.toasts.map((t) => t.title), ['Player replied: #14 Ferryman']);
  const p = mount(host, 'tickets');
  await click(p.q('[data-id="14"]'));
  host.toasts.length = 0;
  host.gmcp('s1', 'Client.Tickets.Message', { id: '14', message: { sender: 'Kest', origin: 'player', text: 'Hello?' } });
  assert.deepEqual(host.toasts, []);
  host.gmcp('s1', 'Client.Tickets.Message', { id: '14', message: { sender: 'Ada', origin: 'staff', text: 'note', visibility: 'internal' } });
  assert.deepEqual(host.toasts, []);
  p.off();
  await host.unload();
});

test('the game showing a ticket opens its panel on that thread', async () => {
  const host = createHost({ root: ROOT, sessions });
  await host.load('src/index.ts');
  host.gmcp('s1', 'Client.Tickets.Role', { staff: true });
  host.gmcp('s1', 'Client.Tickets.Thread', { id: '12', kind: 'bug', subject: 'Door' });
  assert.deepEqual(calls(host, 'panels.open').at(-1), ['tickets', undefined, { sid: 's1' }]);
  host.gmcp('s2', 'Client.Tickets.MyThread', { id: '9', subject: 'Lost' });
  assert.deepEqual(calls(host, 'panels.open').at(-1), ['mytickets', undefined, { sid: 's2' }]);
  const p = mount(host, 'mytickets', 's2');
  assert.ok(p.q('[data-testid=mytickets-thread]'));
  p.off();
  await host.unload();
});

test('my tickets: status words, unseen marks and badge, waiting filter, sort, withdraw needs a second press, compose', async () => {
  const host = createHost({ root: ROOT, sessions });
  await host.load('src/index.ts');
  const now = Math.floor(Date.now() / 1000);
  host.gmcp('s2', 'Client.Tickets.Mine', { closed: false, tickets: [
    { id: 'a', kind: 'bug', subject: 'Old', status: 'pending', updated: now - 900 },
    { id: 'c', kind: 'bug', subject: 'Older', status: 'pending', updated: now - 5000 },
    { id: 'd', kind: 'bug', subject: 'Oldest', status: 'pending', updated: now - 9000 },
    { id: 'b', kind: 'request', subject: 'New', status: 'waiting', updated: now - 60, assignee: 'Vessa' },
  ] });
  assert.deepEqual(calls(host, 'panels.badge').filter(([id]) => id === 'mytickets').at(-1), ['mytickets', { count: 1 }, 's2']);
  const p = mount(host, 'mytickets', 's2');
  assert.deepEqual(p.qa('[data-testid=mytickets-list] .row').map((r) => [r.dataset.id, r.querySelector('.plate').textContent, r.classList.contains('hot')]), [['b', 'waiting on you', true], ['a', 'with staff', false], ['c', 'with staff', false], ['d', 'with staff', false]]);
  await click(p.q('[data-testid=mytickets-sort]'));
  assert.equal(p.q('[data-testid=mytickets-sort]').textContent, 'Oldest');
  assert.deepEqual(p.qa('[data-testid=mytickets-list] .row').map((r) => r.dataset.id), ['d', 'c', 'a', 'b']);
  await click(p.q('[data-testid=mytickets-waiting]'));
  assert.deepEqual(p.qa('[data-testid=mytickets-list] .row').map((r) => r.dataset.id), ['b']);
  await click(p.q('[data-id="b"]'));
  assert.deepEqual(calls(host, 'panels.badge').filter(([id]) => id === 'mytickets').at(-1), ['mytickets', null, 's2'], 'read: the badge clears');
  assert.ok(p.q('.handler').textContent.includes('Vessa'));
  await click(p.q('[data-testid=mytickets-withdraw]'));
  assert.equal(p.q('[data-testid=mytickets-withdraw]').textContent, 'Confirm withdraw');
  assert.ok(!commands(host, 's2').includes('@ticket/withdraw b'));
  await click(p.q('[data-testid=mytickets-withdraw]'));
  assert.equal(commands(host, 's2').at(-1), '@ticket/withdraw b');
  await click(p.q('[data-testid=mytickets-back]'));
  await click(p.q('[data-testid=mytickets-new]'));
  p.q('[data-testid=mytickets-compose]').dispatchEvent(new Event('submit', { cancelable: true }));
  await tick();
  assert.equal(p.q('[data-testid=mytickets-compose-error]').textContent, 'Say what you need help with.');
  p.q('[data-testid=mytickets-subject]').value = 'Stuck'; p.q('[data-testid=mytickets-subject]').dispatchEvent(new Event('input'));
  p.q('[data-testid=mytickets-details]').value = 'In the stair'; p.q('[data-testid=mytickets-details]').dispatchEvent(new Event('input'));
  p.q('[data-testid=mytickets-compose]').dispatchEvent(new Event('submit', { cancelable: true }));
  await tick(); await tick();
  assert.equal(commands(host, 's2').at(-1), '@request Stuck = In the stair');
  p.off();
  await host.unload();
});

test('text bridge: no GMCP → @tickets parsed and hidden, interleaved output stays, q leaves; then @ticket <id>', async () => {
  const host = createHost({ root: ROOT, sessions });
  await host.load('src/index.ts');
  host.mu.gmcp.send = async () => false;
  const game = scriptRequests(host, {
    '@tickets': [...MENU.slice(0, 4), 'Kest says, "over here"', ...MENU.slice(4)],
    '@ticket 11bd432e': ['[Bug Report #11bd432e] surface exits reveal bit name', '  Status: with staff . updated 6d ago', '',
      '  [6d] Mox: walking in the rustfields', '  [1d] Sol (staff): Looking into it.', '', '(Reply with @ticket 11bd432e = <text>.)', '(Withdraw it with @ticket/withdraw 11bd432e.)'],
  }, { noise: { '@tickets': ['Upstairs cafe'] } });
  const p = mount(host, 'mytickets', 's2');
  await tick(20);
  assert.deepEqual(game.shown, ['Upstairs cafe', 'Kest says, "over here"']);
  assert.deepEqual(p.qa('[data-testid=mytickets-list] .row').map((r) => r.dataset.id), ['091e3312', '11bd432e']);
  const q = host.sends('command', 's2').at(-1);
  assert.equal(q.text, 'q');
  await click(p.q('[data-id="11bd432e"]'));
  await tick(20);
  assert.deepEqual(p.qa('[data-testid=mytickets-msgs] .m').map((m) => m.className), ['m me', 'm staffmsg']);
  p.off();
  await host.unload();
});

test('text bridge: a timeout keeps the partial rows and says so', async () => {
  const host = createHost({ root: ROOT, sessions });
  const { api } = await host.load('src/index.ts');
  host.mu.gmcp.send = async () => false;
  scriptRequests(host, { '@tickets': MENU }, { stallAt: 5 });
  const p = mount(host, 'mytickets', 's2');
  await tick(20);
  assert.deepEqual(api.mine.get('mine', false, 's2').map((t) => t.id), ['091e3312']);
  assert.ok(p.q('[data-testid=mytickets-partial]'));
  assert.equal(host.sends('command', 's2').at(-1).text, 'q', 'the menu is left');
  assert.ok(host.logs.some((l) => l.level === 'warn' && /timeout \(kept 1 rows\)/.test(String(l.args[0]))));
  p.off();
  await host.unload();
});

test('text bridge: the session closing mid-request rejects quietly and its state goes', async () => {
  const host = createHost({ root: ROOT, sessions });
  const { api } = await host.load('src/index.ts');
  host.mu.gmcp.send = async () => false;
  scriptRequests(host, { '@tickets': MENU }, { pauseAt: 4 });
  const p = mount(host, 'mytickets', 's2');
  await tick(10);
  host.close('s2');
  await tick(10);
  assert.deepEqual(host.errors, []);
  assert.ok(!host.sends('command', 's2').some((c) => c.text === 'q'), 'no q to a closed session');
  host.open({ id: 's2', worldId: 'w1', character: 'Mox' });
  assert.deepEqual(api.mine.get('mine', false, 's2'), [], 'the old rows did not survive');
  p.off();
  await host.unload();
  assert.deepEqual(host.live(), []);
});

test('the API: per caller, instance panels tracked, set/get and Alert only for staff', async () => {
  const host = createHost({ root: ROOT, sessions });
  const { api } = await host.load('src/index.ts');
  api.set('inbox', { tickets: [{ id: '5', kind: 'bug' }, { id: '6', kind: 'request' }] }, 's1');
  assert.deepEqual(api.get('inbox', 's1').map((t) => t.short_id), ['#5', '#6']);
  api.upsert('ticket', { id: '5', status: 'claimed' }, 's1');
  assert.equal(api.get('inbox', 's1')[0].status, 'claimed');
  api.remove('ticket', '6', 's1');
  assert.equal(api.get('inbox', 's1').length, 1);
  const off = api.instance({ id: 'bugs', title: 'Bugs', filter: { kind: 'bug' } });
  assert.ok(host.panels.has('bugs'));
  off();
  assert.ok(!host.panels.has('bugs'));
  host.toasts.length = 0;
  host.gmcp('s2', 'Client.Tickets.Alert', { label: 'bug', who: 'Maren', age_mins: 12 });
  assert.deepEqual(host.toasts, []);
  host.gmcp('s1', 'Client.Tickets.Role', { staff: true });
  host.gmcp('s1', 'Client.Tickets.Alert', { label: 'bug', who: 'Maren', age_mins: 12 });
  assert.deepEqual(host.toasts.map((t) => [t.title, t.body]), [['Unclaimed bug', 'Maren · waiting 12m']]);
  api.mine.set('mine', { tickets: [{ id: 'x' }] }, 's2');
  assert.deepEqual(api.mine.get('mine', false, 's2').map((t) => t.id), ['x']);
  await host.unload();
  assert.deepEqual(host.live(), []);
});
