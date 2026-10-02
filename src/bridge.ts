/**
 * The text bridge for My tickets, over `mu.sessions.request` (SDK 1.11+). A game without Client.Tickets GMCP
 * (Underspire's telnet port is one) answers `@tickets` with an interactive menu (`f` toggles the finished list,
 * `n` pages, `q` leaves) and `@ticket <id>` with one thread. These functions drive that through an injected
 * request runner, so the tests can feed lines, time out or close the session without a host.
 *
 * Every line the request sees is classified: a menu or thread line is captured (and hidden by the host); any
 * other line is `'skip'`, so the player's own output that interleaves stays in the terminal.
 */
import type { Ticket } from './types';
import { LIST_HEAD, MENU_END, MENU_NEXT, MENU_NOISE, THREAD_TAIL, feedThread, parseRow, threadParse, type ThreadParse } from './text';

/** What `mu.sessions.request` takes and gives, reduced to what the bridge uses. */
export interface ReqLine { text: string }
export type Verdict = 'more' | 'done' | 'skip';
export type Runner = (text: string, opts: { until: (line: ReqLine) => Verdict; timeoutMs: number }) => Promise<ReqLine[] | null>;
/** Send a line without capturing (the `q` that leaves the menu). */
export type Sender = (text: string) => Promise<unknown> | unknown;

export const TEXT_TIMEOUT_MS = 6000;
const MENU_LINE = /^\s*([a-z]|\d+): /;
export const OPEN_STATUS = /^(pending|waiting|open|claimed)$/;
const MAX_PAGES = 20;

const isTimeout = (e: unknown) => !!e && typeof e === 'object' && (e as { name?: string }).name === 'RequestTimeout';
const why = (e: unknown) => (e instanceof Error ? e.message : String(e));

interface MenuState { rows: Ticket[]; sawList: boolean; phase: 'sent' | 'open' | 'finished'; hasNext: boolean }

/** The `until` of a menu request: rows and menu lines are ours, anything else is skipped. */
export function menuUntil(st: MenuState) {
  return (line: ReqLine): Verdict => {
    const text = line.text.replace(/\s+$/, '');
    if (LIST_HEAD.test(text)) { st.sawList = true; st.phase = /FINISHED/.test(text) ? 'finished' : 'open'; return 'more'; }
    if (!st.sawList) return MENU_NOISE.test(text) ? 'more' : 'skip';
    if (text === '' || MENU_NOISE.test(text)) return 'more';
    const row = parseRow(text);
    if (row) { if (!st.rows.some((t) => t.id === row.id)) st.rows.push(row); return 'more'; }
    if (MENU_NEXT.test(text)) { st.hasNext = true; return 'more'; }
    if (MENU_END.test(text)) return 'done';
    if (MENU_LINE.test(text)) return 'more'; // s:, f:, p:, c: and any other key we do not press
    return 'skip';
  };
}

export interface MineResult {
  /** The list was read to its end. */
  ok: boolean;
  /** The rows read, also after a timeout (`partial`: the menu showed but did not end). */
  rows: Ticket[];
  sawList: boolean;
  partial?: boolean;
  /** Why it stopped early: 'timeout', 'the session closed', 'the command was not sent', … */
  reason?: string;
}

/**
 * `@tickets`, then (closed) `f` and `n` for every further page, then `q`. `closed` keeps only finished rows (the
 * finished list holds the open ones too).
 */
export async function readMine(run: Runner, send: Sender, closed: boolean, timeoutMs = TEXT_TIMEOUT_MS): Promise<MineResult> {
  const st: MenuState = { rows: [], sawList: false, phase: 'sent', hasNext: false };
  const until = menuUntil(st);
  const keep = (rows: Ticket[]) => (closed ? rows.filter((t) => !OPEN_STATUS.test(t.status ?? '')) : rows);
  const step = async (cmd: string): Promise<MineResult | null> => {
    try {
      const got = await run(cmd, { until, timeoutMs });
      if (got === null) return { ok: false, rows: [], sawList: false, reason: 'another client asked' };
      return null;
    } catch (e) {
      if (isTimeout(e)) {
        if (st.sawList) await send('q');
        return { ok: false, rows: keep(st.rows), sawList: st.sawList, partial: st.sawList, reason: 'timeout' };
      }
      return { ok: false, rows: keep(st.rows), sawList: st.sawList, reason: why(e) };
    }
  };
  let r = await step('@tickets');
  if (r) return r;
  if (!st.sawList) return { ok: false, rows: [], sawList: false, reason: 'no menu' };
  if (closed && st.phase === 'open') {
    st.rows = []; st.hasNext = false;
    if ((r = await step('f'))) return r;
  }
  for (let i = 0; closed && st.hasNext && i < MAX_PAGES; i++) {
    st.hasNext = false;
    if ((r = await step('n'))) return r;
  }
  await send('q');
  return { ok: true, rows: keep(st.rows), sawList: true };
}

/**
 * The `until` of a thread request. A finished ticket ends at its `(Reply with …)` line; an open one prints a
 * `(Withdraw it with …)` tail after it, which is captured too. A game that leaves the tail out costs the timeout,
 * and {@link readThread} still returns the whole thread.
 */
export function threadUntil(p: ThreadParse, me: () => string) {
  return (line: ReqLine): Verdict => {
    const text = line.text.replace(/\s+$/, '');
    if (!feedThread(p, text, me())) return 'skip';
    if (p.error) return 'done';
    if (!p.done) return 'more';
    if (THREAD_TAIL.test(text)) return 'done';
    return OPEN_STATUS.test(p.t?.status ?? '') ? 'more' : 'done';
  };
}

export interface ThreadResult { ok: boolean; t: Ticket | null; notFound: boolean; partial?: boolean; reason?: string }

/** `@ticket <id>` (the bare id: Underspire rejects `#id`). A timeout keeps what was read. */
export async function readThread(run: Runner, id: string, me: () => string, timeoutMs = TEXT_TIMEOUT_MS): Promise<ThreadResult> {
  const p = threadParse();
  try {
    const got = await run(`@ticket ${id}`, { until: threadUntil(p, me), timeoutMs });
    if (got === null) return { ok: false, t: null, notFound: false, reason: 'another client asked' };
  } catch (e) {
    const timeout = isTimeout(e);
    // The thread ended but the optional tail never came: it is whole.
    if (timeout && p.done && p.t && !p.error) return { ok: true, t: p.t, notFound: false };
    return { ok: false, t: p.t && !p.error ? p.t : null, notFound: p.error, partial: timeout && !!p.t, reason: timeout ? 'timeout' : why(e) };
  }
  return { ok: !p.error && !!p.t, t: p.error ? null : p.t, notFound: p.error };
}
