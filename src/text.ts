/**
 * The text bridge for My tickets: games without Client.Tickets GMCP (Underspire's telnet port is one)
 * still answer `@tickets` (an interactive menu: rows, `f` toggles finished, `n`/`p` page, `q` quits)
 * and `@ticket <id>` (one thread). These are the pure parsers over that output; `index.ts` drives the
 * menu and gags what it asked for. Captured 2026-09-30 from underspire.net:4000.
 */
import type { Message, Ticket } from './types';

/** `  1: Puppet Request #091e3312 (with staff . 2d . Puppet request: a hulking masked man)` */
const ROW = /^\s*\d+: (.+?) #([0-9a-zA-Z]+) \((.+?) \. (\S+) \. (.*)\)\s*$/;
/** `=== YOUR OPEN REQUESTS [open] ===`, `=== YOUR FINISHED REQUESTS [including finished] ===`, `=== YOUR REQUESTS MATCHING "x" […] ===` */
export const LIST_HEAD = /^=== YOUR (OPEN|FINISHED|REQUESTS MATCHING)\b.* ===$/;
/** `[Bug Report #11bd432e] surface exits reveal bit name` (the subject is absent on a puppet request) */
const THREAD_HEAD = /^\[(.+?) #([0-9a-zA-Z]+)\](?: (.*))?$/;
/** `  Status: with staff . updated 6d ago` */
const THREAD_STATUS = /^\s*Status: (.+?) \. (?:updated|last activity) (\S+) ago\s*$/;
/** `  [6d] Mox (you): text`, `  [1d] Sol (staff): text` */
const MSG = /^\s*\[(\S+?)\] (.+?): (.*)$/;
/** `  [1d] -- Closed by Sol.` */
const SYS = /^\s*\[(\S+?)\] -- (.*)$/;
/** The last line of a thread: `(Reply with @ticket 11bd432e = <text>.)`, `(… to reopen it.)` */
export const THREAD_END = /^\(Reply with @ticket /;
export const THREAD_TAIL = /^\(Withdraw it with /;
export const MENU_END = /^\s*q: Quit\s*$/;
export const MENU_NEXT = /^\s*n: Next page\s*$/;
export const MENU_NOISE = /^(Invalid option\. Try again\.|Choose a (finished )?request .*|Nothing of yours matches .*|Search your requests: .*)$/;
export const NO_TICKET = /^(No ticket with that id\.|Usage: @ticket .*)$/;

/** Underspire's kind labels → the `kind` keys the panels colour (`bug`, `puppet`, `report`). */
export function kindOf(label: string): string {
  const l = label.toLowerCase();
  if (/\bbug\b/.test(l)) return 'bug';
  if (/\bpuppet\b/.test(l)) return 'puppet';
  if (/\bconduct\b|\breport\b/.test(l)) return 'report';
  if (/\bchargen\b|\bapplication\b/.test(l)) return 'chargen';
  return 'request';
}

/** The game's status words → the status keys the plates know (`plateOf`), Underspire's own map reversed. */
export function statusOf(text: string): string {
  const s = text.trim().toLowerCase();
  if (s === 'with staff' || s === 'pending' || s === 'open') return 'pending';
  if (s.startsWith('waiting')) return 'waiting';
  if (s === 'resolved') return 'closed';
  return s.replace(/\s+/g, '_');
}

/** `2d` → 2880, `3h` → 180, `12m` → 12; anything else → undefined. */
export function ageMins(s: string): number | undefined {
  const m = /^(\d+)([mhd])$/.exec(s.trim());
  if (!m) return s.trim() === 'now' ? 0 : undefined;
  const n = +m[1];
  return m[2] === 'd' ? n * 1440 : m[2] === 'h' ? n * 60 : n;
}

/** One menu row, or null for any other line. */
export function parseRow(line: string): Ticket | null {
  const m = ROW.exec(line);
  if (!m) return null;
  const [, label, id, status, age, subject] = m;
  const t: Ticket = { id, short_id: `#${id}`, kind: kindOf(label), label, status: statusOf(status), age_mins: ageMins(age) };
  if (subject) t.subject = subject;
  return t;
}

/** A thread being read line by line. `done` flips on the `(Reply with …)` line. */
export interface ThreadParse { t: Ticket | null; me: string; done: boolean; error: boolean }
export const threadParse = (): ThreadParse => ({ t: null, me: '', done: false, error: false });

/**
 * Feed one line of `@ticket <id>` output. Returns true when the line belonged to the thread (and is ours
 * to gag). Continuation lines (a puppet request's "Said so far:" block) join the previous message.
 */
export function feedThread(p: ThreadParse, line: string, me: string): boolean {
  if (p.done) return THREAD_TAIL.test(line);
  if (!p.t) {
    if (NO_TICKET.test(line)) { p.error = true; p.done = true; return true; }
    const h = THREAD_HEAD.exec(line);
    if (!h) return false;
    p.t = { id: h[2], short_id: `#${h[2]}`, kind: kindOf(h[1]), label: h[1], messages: [] };
    if (h[3]) p.t.subject = h[3];
    return true;
  }
  const t = p.t, msgs = t.messages!;
  if (THREAD_END.test(line)) { p.done = true; finish(t, p.me || me); return true; }
  const st = THREAD_STATUS.exec(line);
  if (st && !msgs.length) { t.status = statusOf(st[1]); t.age_mins = ageMins(st[2]); return true; }
  const sys = SYS.exec(line);
  if (sys) { msgs.push({ origin: 'system', text: sys[2], sender: '' }); return true; }
  const m = MSG.exec(line);
  if (m) {
    let sender = m[2], origin: Message['origin'] | undefined;
    const tag = /^(.*?) \((you|staff)\)$/.exec(sender);
    if (tag) { sender = tag[1]; origin = tag[2] === 'you' ? 'player' : 'staff'; if (tag[2] === 'you') p.me = sender; }
    if (!origin) origin = sender === (p.me || me) ? 'player' : undefined;
    const msg: Message = { sender, text: m[3] };
    if (origin) msg.origin = origin;
    msgs.push(msg);
    return true;
  }
  // Blank lines and unindented text inside the thread continue the last message.
  const last = msgs[msgs.length - 1];
  if (last && last.origin !== 'system') last.text = `${last.text ?? ''}\n${line}`;
  return true;
}

/**
 * Close a parsed thread: trim the message bodies and settle who wrote what. The first message is the
 * requester's; a `(you)`/`(staff)` tag wins, then the character name, then "first sender = player".
 */
function finish(t: Ticket, me: string) {
  const msgs = t.messages ?? [];
  const requester = msgs.find((m) => m.origin === 'player')?.sender || me || msgs.find((m) => m.origin !== 'system')?.sender || '';
  for (const m of msgs) {
    if (m.text) m.text = m.text.replace(/\n+$/, '');
    if (!m.origin) m.origin = requester && m.sender === requester ? 'player' : 'staff';
  }
  if (requester && !t.requester_name) t.requester_name = requester;
}
