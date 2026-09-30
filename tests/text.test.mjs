// The text bridge's parsers over output captured from underspire.net:4000 on 2026-09-30.
//   node --experimental-strip-types --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseRow, feedThread, threadParse, LIST_HEAD, MENU_END, MENU_NEXT, MENU_NOISE, kindOf, statusOf, ageMins } from '../src/text.ts';

const MENU = `=== YOUR OPEN REQUESTS [open] ===

Choose a request to read, reply to, or withdraw.

  1: Puppet Request #091e3312 (with staff . 2d . Puppet request: a hulking masked man wearing a Sunwalker hel)
  2: Bug Report #11bd432e (with staff . 6d . surface exits reveal bit name)
  3: Bug Report #e012d129 (with staff . 6d . Exits for cargo lift -level 04 is bugged. Multiple in exits:)
  s: Search your requests
  f: Show finished requests
  q: Quit`.split('\n');

const FINISHED = `=== YOUR FINISHED REQUESTS [including finished] ===

Choose a finished request to read.

  1: Bug Report #de53bf87 (closed . 1d . gather specific virtual resources doesn't work)
  4: Puppet Request #091e3312 (with staff . 2d . Puppet request: a hulking masked man wearing a Sunwalker hel)
  8: Player Request #27513c19 (closed . 5d . You are fixed.)
  n: Next page
  s: Search your requests
  f: Show open requests only
  q: Quit`.split('\n');

const THREAD = `[Bug Report #de53bf87] gather specific virtual resources doesn't work
  Status: closed . updated 1d ago

  [4d] Mox: 'gather vent' etc doesn't work, it just goes "Huh?", gather doesn't appear to accept targets.
  [1d] Sol (staff): This should be fixed with partial names etc
  [1d] -- Closed by Sol.

(Reply with @ticket de53bf87 = <text> to reopen it.)`.split('\n');

const PUPPET = `[Puppet Request #091e3312]
  Status: with staff . updated 2d ago

  [2d] Mox (you): Puppet request: a hulking masked man wearing a Sunwalker helm
Said so far: I told a hulking masked man that I wanted to join the outriders.
Goal: I want a paid job!
Urgency: Low

(Reply with @ticket 091e3312 = <text>.)
(Withdraw it with @ticket/withdraw 091e3312.)`.split('\n');

test('menu rows become tickets; the other menu lines are recognised', () => {
  assert.ok(LIST_HEAD.test(MENU[0]));
  assert.ok(LIST_HEAD.test(FINISHED[0]));
  assert.ok(LIST_HEAD.test('=== YOUR REQUESTS MATCHING "exits" [open and finished] ==='));
  assert.ok(MENU_NOISE.test(MENU[2]));
  assert.ok(MENU_NOISE.test('Invalid option. Try again.'));
  assert.ok(MENU_END.test(MENU.at(-1)));
  assert.ok(MENU_NEXT.test('  n: Next page'));
  const rows = MENU.map(parseRow).filter(Boolean);
  assert.equal(rows.length, 3);
  assert.deepEqual(rows[0], { id: '091e3312', short_id: '#091e3312', kind: 'puppet', label: 'Puppet Request', status: 'pending', age_mins: 2880, subject: 'Puppet request: a hulking masked man wearing a Sunwalker hel' });
  assert.equal(rows[1].kind, 'bug');
  assert.equal(rows[2].subject, 'Exits for cargo lift -level 04 is bugged. Multiple in exits:');
  assert.equal(parseRow('  s: Search your requests'), null);
  assert.equal(parseRow('Upstairs cafe'), null);
  const fin = FINISHED.map(parseRow).filter(Boolean);
  assert.deepEqual(fin.map((t) => t.status), ['closed', 'pending', 'closed']);
  assert.equal(fin[2].kind, 'request');
});

test('kind, status and age mapping', () => {
  assert.equal(kindOf('Chargen Application'), 'chargen');
  assert.equal(kindOf('Conduct Report'), 'report');
  assert.equal(statusOf('with staff'), 'pending');
  assert.equal(statusOf('waiting on you'), 'waiting');
  assert.equal(statusOf('approved'), 'approved');
  assert.equal(ageMins('3h'), 180);
  assert.equal(ageMins('12m'), 12);
  assert.equal(ageMins('?'), undefined);
});

test('a thread: head, status, messages, a system line, the end marker', () => {
  const p = threadParse();
  const taken = THREAD.map((l) => feedThread(p, l, 'Mox'));
  assert.ok(taken.every(Boolean), 'every line of the thread is ours');
  assert.ok(p.done);
  assert.equal(p.error, false);
  const t = p.t;
  assert.equal(t.id, 'de53bf87');
  assert.equal(t.kind, 'bug');
  assert.equal(t.subject, "gather specific virtual resources doesn't work");
  assert.equal(t.status, 'closed');
  assert.equal(t.age_mins, 1440);
  assert.equal(t.requester_name, 'Mox');
  assert.deepEqual(t.messages.map((m) => [m.sender, m.origin]), [['Mox', 'player'], ['Sol', 'staff'], ['', 'system']]);
  assert.equal(t.messages[2].text, 'Closed by Sol.');
});

test('a puppet request: no subject, (you) tag, continuation lines join the message, the tail line is ours', () => {
  const p = threadParse();
  const taken = PUPPET.map((l) => feedThread(p, l, ''));
  assert.ok(taken.every(Boolean));
  assert.equal(p.t.subject, undefined);
  assert.equal(p.t.status, 'pending');
  assert.equal(p.t.messages.length, 1);
  assert.equal(p.t.messages[0].origin, 'player');
  assert.equal(p.t.messages[0].text, 'Puppet request: a hulking masked man wearing a Sunwalker helm\nSaid so far: I told a hulking masked man that I wanted to join the outriders.\nGoal: I want a paid job!\nUrgency: Low');
  assert.equal(p.t.requester_name, 'Mox');
});

test('lines before the head are not ours; "No ticket with that id." is an error', () => {
  const p = threadParse();
  assert.equal(feedThread(p, 'You are standing here.', 'Mox'), false);
  assert.equal(feedThread(p, 'No ticket with that id.', 'Mox'), true);
  assert.ok(p.done && p.error);
});
