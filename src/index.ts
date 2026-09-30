/**
 * @runmu.sh/ext-tickets: the Tickets staff queue (R-MOD-TICKETS) and the player's My tickets
 * (R-MOD-MYTICKETS), after Underspire's templates 5544–5568 and 6994–7007 (06-world-modules §2–§3).
 *
 * GMCP in: Client.Tickets.Role / Inbox / History / Thread / Message / Alert / BugDetail / Mine / MyThread.
 * GMCP out (data requests, or actions whose `via` is gmcp): Client.Tickets.Get / List / BugDetail /
 * Action / Mine / MyGet. Buttons run the configured actions (default: the Underspire commands).
 * Without GMCP, My tickets reads the game's `@tickets` / `@ticket <id>` text instead (./text.ts and the
 * text bridge below).
 * The value `activate` returns is the TicketsApi (types in ./types.ts) other extensions get with
 * `ctx.api('@runmu.sh/ext-tickets')`.
 */
import { defineExtension, type Dispose, type Mu, type PanelMountCtx } from '@muclient/sdk';
import { WorldModule, replay } from '@runmu.sh/ext-kit/module';
import { MODULE_CSS } from '@runmu.sh/ext-kit/css';
import { h, fill, age, clock, body, hint, plateCls, replyArea } from '@runmu.sh/ext-kit/dom';
import type { Schema } from '@runmu.sh/ext-kit/schema';
import type { Message, Ticket, TicketsApi, MyTicketsApi } from './types';
import { LIST_HEAD, MENU_END, MENU_NEXT, MENU_NOISE, feedThread, parseRow, threadParse, type ThreadParse } from './text';

const P = 'Client.Tickets';
const DEFAULT_HINT = '`@request subject = what you need`, `@bug` or `@puppetrequest` in the game to open one.';
/** How long a GMCP data request may go unanswered before the text bridge asks the game in words. */
const GMCP_GRACE_MS = 1500;
/** The text bridge gives up on a menu (and sends its quit key) after this long. */
const TEXT_TIMEOUT_MS = 6000;
const MENU_LINE = /^\s*([a-z]|\d+): /;
const OPEN_STATUS = /^(pending|waiting|open|claimed)$/;

// ─── payload schemas (06 §2 Types) ───────────────────────────────────────────────────────────────
const msgS: Schema = { type: 'object', properties: { text: { type: 'string' }, html: { type: 'string' }, sender: { type: 'string' }, visibility: { type: 'string' }, origin: { type: 'string' }, ts: { type: ['number', 'string'] } } };
const ticketS: Schema = {
  type: 'object', required: ['id'],
  properties: {
    id: { type: ['string', 'integer'] }, short_id: { type: 'string' }, kind: { type: 'string' }, status: { type: 'string' },
    priority: { type: 'integer' }, subject: { type: 'string' }, requester_name: { type: 'string' }, account_name: { type: 'string' },
    assignee: { type: 'string' }, age_mins: { type: 'number' }, preview: { type: 'string' },
    context: { type: 'object', additionalProperties: { type: ['string', 'number', 'boolean'] } }, messages: { type: 'array', items: msgS }, bug: { type: 'object' },
  },
};
const listS: Schema = { type: 'object', required: ['tickets'], properties: { tickets: { type: 'array', items: ticketS }, closed: { type: 'boolean' } } };
const SCHEMAS: Record<string, Schema> = {
  Role: { type: 'object', required: ['staff'], properties: { staff: { type: 'boolean' } } },
  Inbox: listS, History: listS, Mine: listS, Thread: ticketS, MyThread: ticketS,
  Message: { type: 'object', required: ['id', 'message'], properties: { id: { type: ['string', 'integer'] }, status: { type: 'string' }, message: msgS } },
  Alert: { type: 'object', properties: { label: { type: 'string' }, who: { type: 'string' }, age_mins: { type: 'number' } } },
  BugDetail: { type: 'object', required: ['id', 'bug'], properties: { id: { type: ['string', 'integer'] }, bug: { type: 'object' } } },
};

const norm = (t: Ticket): Ticket => ({ ...t, id: String(t.id), short_id: t.short_id ?? `#${t.id}` });
const isClosed = (s?: string) => !!s && /^(closed|resolved|approved|denied)$/i.test(s);
/** Who wrote a message: its `origin`, else the requester (or "you") is the player and anyone else staff (06 §2). */
const originOf = (m: Message, requester?: string): 'staff' | 'player' | 'system' =>
  m.origin ?? (m.sender && (m.sender === requester || /^you$/i.test(m.sender)) ? 'player' : 'staff');
type Fb = { ok: boolean; text: string } | null;
const DONE: Record<string, string> = { claim: 'Claimed', resolve: 'Resolved', approve: 'Approved', deny: 'Denied', reply: 'Reply sent', reply_note: 'Note added', myreply: 'Reply sent' };
const feedback = (r: string, name: string, short: string): Fb => (r === 'none' ? null : { ok: true, text: `${DONE[name] ?? name} ${short}.` });
const failed = (e: unknown): Fb => ({ ok: false, text: e instanceof Error ? e.message : String(e) });

interface StaffState { role: boolean; inbox: Ticket[]; history: Ticket[] | null; threads: Map<string, Ticket>; fresh: Set<string> }
interface MineState { open: Ticket[] | null; closed: Ticket[] | null; threads: Map<string, Ticket>; error: boolean }

export default defineExtension({
  activate(ctx) {
    const mu: Mu = ctx.mu;
    const staffOf = new Map<string, StaffState>();
    const mineOf = new Map<string, MineState>();
    const S = (sid: string) => staffOf.get(sid) ?? staffOf.set(sid, { role: false, inbox: [], history: null, threads: new Map(), fresh: new Set() }).get(sid)!;
    const M = (sid: string) => mineOf.get(sid) ?? mineOf.set(sid, { open: null, closed: null, threads: new Map(), error: false }).get(sid)!;
    const active = () => mu.sessions.active()?.id ?? null;
    const need = (sid?: string) => { const s = sid ?? active(); if (!s) throw new Error('no active session'); return s; };

    const tickets = new WorldModule(mu, {
      key: 'tickets', title: 'Tickets', panels: ['tickets'], pkg: P, staff: true,
      actions: {
        open: { label: 'Open', via: 'command', cmd: '@ticket {short_id}' },
        claim: { label: 'Claim', via: 'command', cmd: '@claim {short_id}' },
        resolve: { label: 'Resolve', via: 'command', cmd: '@resolve {short_id}' },
        approve: { label: 'Approve', via: 'command', cmd: '@approve {short_id}[ = {text}]' },
        deny: { label: 'Deny', via: 'command', cmd: '@deny {short_id}[ = {text}]' },
        reply: { label: 'Reply', via: 'command', cmd: '@ticket {short_id} = {text}' },
        reply_note: { label: 'Reply (note)', via: 'command', cmd: '' },
      },
      gmcpAction: (a, v) => (a === 'open' ? [`${P}.Get`, { id: v.id }] : [`${P}.Action`, { action: a === 'reply_note' ? 'reply' : a, id: v.id, ...(v.text ? { text: v.text } : {}), ...(v.internal ? { internal: true } : {}) }]),
      options: [{ key: 'rich', label: 'Rich text in messages', default: false, kind: 'toggle', scope: 'both' }],
    });
    // Underspire lists My Tickets in Views for everyone (only the staff queue is gated), so it is `on`.
    const mine = new WorldModule(mu, {
      key: 'mytickets', title: 'My tickets', panels: ['mytickets'], pkg: P, defaultMode: 'on',
      actions: { myreply: { label: 'Reply', via: 'command', cmd: '@ticket {id} = {text}' } },
      gmcpAction: (_a, v) => [`${P}.Action`, { action: 'reply', id: v.id, text: v.text }],
      options: [
        { key: 'emptyHint', label: 'Empty-list hint', default: DEFAULT_HINT, kind: 'text', hint: 'wrap commands in `backticks`', scope: 'both' },
        { key: 'text', label: 'Read @tickets output', default: true, kind: 'toggle', hint: 'when the game has no Client.Tickets GMCP: ask with @tickets / @ticket <id>, parse the text and hide it', scope: 'both' },
      ],
    });

    mu.ui.style(MODULE_CSS);
    mu.settings.define({ title: 'Tickets', items: [...tickets.settingItems(), ...mine.settingItems()] });

    // ─── data ────────────────────────────────────────────────────────────────────────────────
    const redraws = new Set<() => void>();
    const redraw = () => redraws.forEach((f) => f());
    const upsertIn = (list: Ticket[] | null, t: Partial<Ticket> & { id: string }) => {
      if (!list) return false;
      const i = list.findIndex((x) => x.id === t.id);
      if (i >= 0) list[i] = { ...list[i], ...t };
      return i >= 0;
    };
    const setRole = (sid: string, staff: boolean) => { S(sid).role = staff; tickets.setStaff(sid, staff); redraw(); };
    const setInbox = (sid: string, list: Ticket[]) => {
      const st = S(sid);
      st.inbox = list.map(norm);
      const fresh = tickets.fresh(sid, st.inbox.map((t) => t.id));
      for (const id of fresh) st.fresh.add(id);
      for (const id of [...st.fresh]) if (!st.inbox.some((t) => t.id === id)) st.fresh.delete(id);
      tickets.announce(st.inbox.filter((t) => fresh.includes(t.id)).map((t) => ({ title: `New ${t.kind ?? 'ticket'} ${t.short_id}`, body: [t.requester_name, t.subject].filter(Boolean).join(': ') })));
      tickets.touched(sid);
      redraw();
    };
    const setThread = (sid: string, t: Ticket) => {
      const n = norm(t), st = S(sid);
      st.threads.set(n.id, { ...st.threads.get(n.id), ...n });
      const { messages: _m, bug: _b, ...row } = n;
      upsertIn(st.inbox, row); upsertIn(st.history, row);
      redraw();
    };
    const pushMessage = (sid: string, d: { id: string | number; status?: string; message: Message }) => {
      const id = String(d.id);
      for (const map of [S(sid).threads, M(sid).threads]) {
        const t = map.get(id);
        if (!t) continue;
        t.messages = [...(t.messages ?? []), d.message];
        if (d.status) t.status = d.status;
      }
      if (d.status) { upsertIn(S(sid).inbox, { id, status: d.status }); upsertIn(M(sid).open, { id, status: d.status }); }
      redraw();
    };
    const setMine = (sid: string, list: Ticket[], closed: boolean) => {
      const m = M(sid);
      m.error = false;
      if (closed) m.closed = list.map(norm); else m.open = list.map(norm);
      mine.touched(sid);
      redraw();
    };
    const setMyThread = (sid: string, t: Ticket) => { const n = norm(t), m = M(sid); m.threads.set(n.id, { ...m.threads.get(n.id), ...n }); m.error = false; redraw(); };
    const alert = (a: { label?: string; who?: string; age_mins?: number }) =>
      mu.ui.toast(`Unclaimed ${a.label ?? 'ticket'}`, [a.who, a.age_mins !== undefined ? `waiting ${age(a.age_mins)}` : ''].filter(Boolean).join(' · '), { kind: 'tickets' });

    const handle = (pkg: string, data: unknown, sid: string) => {
      const sub = pkg.slice(P.length + 1);
      const schema = SCHEMAS[sub];
      if (!schema) return;
      const forMine = sub === 'Mine' || sub === 'MyThread';
      const mod = forMine ? mine : tickets;
      if (!mod.acceptsGmcp(sid) && !(sub === 'Message' && mine.acceptsGmcp(sid))) return;
      if (!mod.check(sid, pkg, schema, data)) return;
      const d = data as any;
      switch (sub) {
        case 'Role': setRole(sid, !!d.staff); break;
        case 'Inbox': setInbox(sid, d.tickets); break;
        case 'History': S(sid).history = d.tickets.map(norm); redraw(); break;
        case 'Thread': setThread(sid, d); tickets.touched(sid); break;
        case 'Message': pushMessage(sid, d); break;
        case 'Alert': if (S(sid).role) alert(d); break;
        case 'BugDetail': { const t = S(sid).threads.get(String(d.id)); if (t) { t.bug = d.bug; redraw(); } break; }
        case 'Mine': settle(sid, 'mine', !!d.closed); setMine(sid, d.tickets, !!d.closed); break;
        case 'MyThread': settle(sid, 'thread', false, String(d.id)); setMyThread(sid, d); break;
      }
    };
    mu.gmcp.on(P, (data, { sid, pkg }) => handle(pkg, data, sid));
    // Role and the lists are state: replay what arrived before this extension was enabled.
    replay(mu, ['Role', 'Inbox', 'Mine'].map((s) => `${P}.${s}`), (pkg, data, sid) => handle(pkg, data, sid));

    // My tickets view state (per session), used by the panel and the text bridge below.
    const myViews = new Map<string, { closed: boolean; open: string | null; draft: string; fb: Fb }>();
    const myViewOf = (sid: string) => myViews.get(sid) ?? myViews.set(sid, { closed: false, open: null, draft: '', fb: null }).get(sid)!;

    // ─── text bridge (My tickets without GMCP) ───────────────────────────────────────────────
    // A game that never answers Client.Tickets.Mine / MyGet (Underspire's telnet port is one) still has
    // `@tickets` (an interactive menu) and `@ticket <id>`. When a GMCP request goes unanswered for
    // GMCP_GRACE_MS, or GMCP cannot be sent at all, the bridge sends the command, walks the menu
    // (`f` for the finished list, `n` for its next pages, `q` to leave), parses the rows or the thread
    // (./text.ts) and gags every line it caused, including its own echoes. A line it does not
    // recognise is left alone, so a game with another format shows its text as before.
    // Off with the setting `mytickets.text`.
    type Phase = 'sent' | 'open' | 'finished' | 'done';
    interface TextJob { kind: 'mine' | 'thread'; closed: boolean; id?: string; rows: Ticket[]; phase: Phase; hasNext: boolean; sawList: boolean; th: ThreadParse; timer: ReturnType<typeof setTimeout> }
    const textJobs = new Map<string, TextJob>();
    const textQueue = new Map<string, Array<() => void>>();
    /** Commands the bridge typed whose echo has not shown yet (per session; it outlives the job: `q` echoes after it closed). */
    const echoes = new Map<string, Set<string>>();
    const pending = new Map<string, ReturnType<typeof setTimeout>>();
    const textOn = (sid: string) => mine.option<boolean>('text', sid) !== false && mine.source(mine.worldOf(sid)) !== 'api';
    const pendKey = (sid: string, kind: TextJob['kind'], closed: boolean, id?: string) => `${sid}\u0000${kind}\u0000${kind === 'mine' ? closed : id}`;
    const settle = (sid: string, kind: TextJob['kind'], closed: boolean, id?: string) => { const k = pendKey(sid, kind, closed, id); const t = pending.get(k); if (t) { clearTimeout(t); pending.delete(k); } };
    const say = (sid: string, cmd: string) => { (echoes.get(sid) ?? echoes.set(sid, new Set()).get(sid)!).add(cmd); void mu.sessions.send(cmd, sid); };
    const finishJob = (sid: string, ok: boolean) => {
      const j = textJobs.get(sid);
      if (!j) return;
      clearTimeout(j.timer);
      textJobs.delete(sid);
      if (j.phase === 'open' || j.phase === 'finished') say(sid, 'q');
      if (j.kind === 'mine') {
        if (ok || j.sawList) {
          // The finished list holds the open ones too; the panel's Closed tab wants only the closed.
          setMine(sid, j.closed ? j.rows.filter((t) => !OPEN_STATUS.test(t.status ?? '')) : j.rows, j.closed);
        } else { M(sid).error = true; redraw(); }
      } else if (j.th.t && !j.th.error) setMyThread(sid, j.th.t);
      else if (!ok || j.th.error) { const v = myViewOf(sid); if (v.open === j.id) v.fb = { ok: false, text: j.th.error ? `No ticket ${j.id}.` : 'The game did not answer.' }; redraw(); }
      textQueue.get(sid)?.shift()?.();
    };
    const startJob = (sid: string, kind: TextJob['kind'], closed: boolean, id?: string) => {
      if (textJobs.has(sid)) { (textQueue.get(sid) ?? textQueue.set(sid, []).get(sid)!).push(() => startJob(sid, kind, closed, id)); return; }
      const j: TextJob = { kind, closed, id, rows: [], phase: 'sent', hasNext: false, sawList: false, th: threadParse(), timer: setTimeout(() => finishJob(sid, false), TEXT_TIMEOUT_MS) };
      textJobs.set(sid, j);
      say(sid, kind === 'mine' ? '@tickets' : `@ticket ${id}`);
    };
    /** After a GMCP data request: ask in text unless an answer arrives in time. */
    const requestData = (a: Record<string, unknown>, sid: string, kind: TextJob['kind'], closed: boolean, id?: string) => {
      const pkg = kind === 'mine' ? `${P}.Mine` : `${P}.MyGet`;
      void mu.gmcp.send(pkg, a, sid).then((sent) => {
        if (!textOn(sid)) return;
        if (!sent) { startJob(sid, kind, closed, id); return; }
        const k = pendKey(sid, kind, closed, id);
        settle(sid, kind, closed, id);
        pending.set(k, setTimeout(() => { pending.delete(k); startJob(sid, kind, closed, id); }, GMCP_GRACE_MS));
      });
    };
    mine.onRequest('mine', (a, s) => requestData(a, s.sid, 'mine', !!a.closed));
    mine.onRequest('myget', (a, s) => requestData(a, s.sid, 'thread', false, String(a.id)));
    const charName = (sid: string) => String((mu.gmcp.state('Char.Name', sid) as any)?.name ?? (mu.gmcp.state('Player.Context', sid) as any)?.character ?? '');
    const menuStage = (j: TextJob, sid: string, text: string, gag: () => void) => {
      if (LIST_HEAD.test(text)) {
        j.sawList = true; gag();
        j.phase = /FINISHED/.test(text) ? 'finished' : 'open';
        return;
      }
      if (j.phase === 'sent') { if (text === '' || MENU_NOISE.test(text)) gag(); return; }
      if (text === '' || MENU_NOISE.test(text)) { gag(); return; }
      const row = parseRow(text);
      if (row) { if (!j.rows.some((t) => t.id === row.id)) j.rows.push(row); gag(); return; }
      if (MENU_NEXT.test(text)) { j.hasNext = true; gag(); return; }
      if (MENU_END.test(text)) {
        gag();
        if (j.closed && j.phase === 'open') { j.rows = []; j.hasNext = false; say(sid, 'f'); return; }
        if (j.closed && j.hasNext) { j.hasNext = false; say(sid, 'n'); return; }
        say(sid, 'q'); j.phase = 'done';
        finishJob(sid, true);
        return;
      }
      if (MENU_LINE.test(text)) gag(); // s:, f:, p:, c: and any other key we do not press
    };
    ctx.subscriptions.push(mu.lines.stage({
      id: 'mytickets-text', order: 300,
      run(line, c) {
        const text = line.text.replace(/\s+$/, '');
        if (line.kind === 'echo') { const e = echoes.get(c.sid); if (e?.has(text)) { e.delete(text); c.gag(); } return; }
        const j = textJobs.get(c.sid);
        if (!j || line.kind !== 'output') return;
        if (j.kind === 'mine') { menuStage(j, c.sid, text, c.gag); return; }
        if (!feedThread(j.th, text, charName(c.sid))) return;
        c.gag();
        if (!j.th.done) return;
        // The `(Withdraw it with …)` tail may still follow; give it a moment.
        clearTimeout(j.timer);
        j.timer = setTimeout(() => finishJob(c.sid, !j.th.error), 150);
      },
    }));
    ctx.subscriptions.push(() => {
      for (const t of pending.values()) clearTimeout(t);
      pending.clear();
      for (const j of textJobs.values()) clearTimeout(j.timer);
      textJobs.clear(); textQueue.clear(); echoes.clear();
    });

    // ─── Tickets panel ───────────────────────────────────────────────────────────────────────
    const views = new Map<string, { tab: 'open' | 'history'; kinds: Set<string>; open: string | null; bug: boolean; draft: string; note: boolean; fb: Fb }>();
    const viewOf = (key: string) => views.get(key) ?? views.set(key, { tab: 'open', kinds: new Set(), open: null, bug: false, draft: '', note: false, fb: null }).get(key)!;

    function mountTickets(el: HTMLElement, pc: PanelMountCtx, panelId: string, fixedKinds?: string[]): Dispose {
      const sidOf = () => pc.sid ?? active();
      el.classList.add('mx', 'tickets');
      el.dataset.testid = 'tickets';
      const draw = () => {
        const sid = sidOf();
        const v = viewOf(`${panelId}\u0000${sid}`);
        const focused = el.contains(document.activeElement) ? (document.activeElement as HTMLElement).dataset.focus : undefined;
        if (!sid) { fill(el, h('p', { class: 'empty' }, 'No session')); return; }
        const st = S(sid);
        if (v.open) drawThread(sid, st, v); else drawList(sid, st, v);
        if (focused) (el.querySelector(`[data-focus="${focused}"]`) as HTMLElement | null)?.focus();
      };
      const back = (testid: string, onclick: () => void, label = 'Back') =>
        h('button', { class: 'sh-cmd back', type: 'button', 'data-testid': testid, 'data-focus': 'back', onclick }, label);
      const fbLine = (v: { fb: Fb }) => (v.fb ? h('p', { class: `fb${v.fb.ok ? '' : ' err'}`, role: 'status', 'data-testid': 'tickets-fb' }, v.fb.text) : null);
      const drawList = (sid: string, st: StaffState, v: ReturnType<typeof viewOf>) => {
        const all = v.tab === 'open' ? st.inbox : st.history ?? [];
        const scoped = fixedKinds ? all.filter((t) => fixedKinds.includes(t.kind ?? '')) : all;
        const kinds = [...new Set(scoped.map((t) => t.kind).filter((k): k is string => !!k))];
        for (const k of [...v.kinds]) if (!kinds.includes(k)) v.kinds.delete(k);
        const rows = v.kinds.size ? scoped.filter((t) => v.kinds.has(t.kind ?? '')) : scoped;
        const tab = (id: 'open' | 'history', label: string) => h('button', {
          class: 'sh-toggle', type: 'button', 'aria-pressed': String(v.tab === id), 'data-testid': `tickets-tab-${id}`, 'data-focus': `tab-${id}`,
          onclick: () => { v.tab = id; v.fb = null; if (id === 'history' && st.history === null) void tickets.request('history', `${P}.List`, { history: true }, sid); draw(); },
        }, label);
        fill(el,
          h('div', { class: 'hd' }, h('span', { class: 'tag glow-text' }, 'Tickets'), tab('open', 'Open'), tab('history', 'History'),
            h('span', { class: 'count', 'data-testid': 'tickets-count' }, String(rows.length))),
          fbLine(v),
          kinds.length > 1 ? h('div', { class: 'filters' }, h('div', { class: 'fl', role: 'group', 'aria-label': 'filter by kind' }, kinds.map((k) => h('button', {
            class: 'sh-toggle fchip', type: 'button', 'aria-pressed': String(v.kinds.has(k)), 'data-kind': k, 'data-focus': `k-${k}`,
            onclick: () => { if (v.kinds.has(k)) v.kinds.delete(k); else v.kinds.add(k); draw(); },
          }, k)))) : null,
          h('div', { class: 'list', 'data-testid': 'tickets-list' },
            rows.length ? rows.map((t) => h('button', {
              class: `sh-row row${st.fresh.has(t.id) ? ' hot' : ''}`, type: 'button', 'data-kind': t.kind ?? '', 'data-id': t.id, 'data-focus': `row-${t.id}`,
              title: t.account_name ? `account: ${t.account_name}` : undefined,
              onclick: () => { v.open = t.id; v.bug = false; v.fb = null; st.fresh.delete(t.id); draw(); void tickets.run('open', { id: t.id, short_id: t.short_id! }, sid); },
            },
              h('span', { class: 'r1' }, h('span', { class: 'kind' }, `${t.kind ?? t.label ?? 'ticket'} `, h('span', { class: 'sid' }, t.short_id)),
                h('span', { class: 'meta' },
                  t.priority ? h('span', { class: 'pri', title: 'priority' }, '!'.repeat(Math.min(4, t.priority))) : null,
                  t.assignee ? h('span', { class: 'asg', title: `claimed by ${t.assignee}` }, t.assignee) : null,
                  t.status ? h('span', { class: plateCls(t.status, 'status') }, t.status) : null,
                  h('span', { class: 'age' }, age(t.age_mins)))),
              t.requester_name ? h('span', { class: 'who' }, t.requester_name) : null,
              t.subject ? h('span', { class: 'subject' }, t.subject) : null,
              t.preview ? h('span', { class: 'prev' }, t.preview) : null,
            )) : h('p', { class: 'empty', 'data-testid': 'tickets-empty' }, v.tab === 'open' ? 'No open tickets.' : st.history === null ? 'Loading' : 'No closed tickets.'),
          ),
        );
      };
      const drawThread = (sid: string, st: StaffState, v: ReturnType<typeof viewOf>) => {
        const id = v.open!;
        const row = st.inbox.find((t) => t.id === id) ?? st.history?.find((t) => t.id === id);
        const t: Ticket = { ...row, ...st.threads.get(id), id } as Ticket;
        const vars = { id, short_id: t.short_id ?? `#${id}` };
        const rich = tickets.option<boolean>('rich', sid);
        const reply = () => el.querySelector<HTMLTextAreaElement>('[data-testid=tickets-reply]');
        const act = (name: string, label: string, cls = '') => (tickets.shows(name, sid) ? h('button', {
          class: `sh-cmd act ${cls}`.trim(), type: 'button', 'data-action': name, 'data-focus': `act-${name}`,
          onclick: async () => {
            const input = reply();
            const text = (name === 'approve' || name === 'deny') && input?.value.trim() ? input.value.trim() : '';
            try { v.fb = feedback(await tickets.run(name, { ...vars, text }, sid), name, vars.short_id); } catch (e) { v.fb = failed(e); }
            if (text && input) { input.value = ''; v.draft = ''; }
            draw();
          },
        }, label) : null);
        const closed = isClosed(t.status);
        const ctxRows = Object.entries(t.context ?? {});
        const isBug = (t.kind ?? '').toLowerCase() === 'bug';
        fill(el,
          h('div', { class: 'hd' }, h('span', { class: 'tag glow-text' }, 'Tickets'), h('span', { class: 'sub' }, `${t.kind ?? 'ticket'} ${vars.short_id}`),
            back('tickets-back', () => { v.open = null; v.fb = null; draw(); })),
          fbLine(v),
          h('div', { class: 'convo', 'data-testid': 'tickets-thread' },
            h('div', { class: 'head' },
              h('span', { class: 'petitioner' }, t.requester_name ?? 'unknown',
                h('span', { class: 'sub' }, t.account_name ? h('span', { class: 'acct' }, t.account_name) : null,
                  t.status ? h('span', { class: plateCls(t.status), 'data-testid': 'tickets-status' }, t.status) : null,
                  t.assignee ? h('span', { class: 'asg' }, t.assignee) : null)),
              closed ? null : h('span', { class: 'actions' }, act('claim', 'Claim'), act('approve', 'Approve', 'primary'), act('deny', 'Deny', 'warn'), act('resolve', 'Resolve'))),
            h('div', { class: 'body' },
              t.subject || ctxRows.length || isBug ? h('div', { class: 'ctx' },
                t.subject ? h('div', { class: 'cx' }, h('span', { class: 'ck' }, 'subject'), h('span', { class: 'cv' }, t.subject)) : null,
                ctxRows.map(([k, val]) => h('div', { class: 'cx' }, h('span', { class: 'ck' }, k), h('span', { class: 'cv' }, String(val)))),
                isBug && !v.bug ? h('button', { class: 'sh-cmd loadbug', type: 'button', 'data-testid': 'tickets-loadbug', 'data-focus': 'loadbug', 'aria-expanded': 'false', onclick: () => { v.bug = true; if (!t.bug) void tickets.request('bugdetail', `${P}.BugDetail`, { id }, sid); draw(); } }, 'Report detail') : null,
              ) : null,
              isBug && v.bug ? h('div', { class: 'bug', 'data-testid': 'tickets-bug' },
                t.bug && Object.keys(t.bug).length ? [
                  h('div', { class: 'bl' }, h('span', { class: 'ck' }, 'reporter'), t.bug.reporter ?? '—'),
                  h('div', { class: 'bl' }, h('span', { class: 'ck' }, 'location'), t.bug.location ?? '—'),
                  h('div', { class: 'bl' }, h('span', { class: 'ck' }, 'last cmd'), h('span', { class: 'dim' }, t.bug.last_cmd ?? '—')),
                  t.bug.traceback ? [h('div', { class: 'ck' }, 'traceback'), h('pre', { class: 'tb' }, t.bug.traceback)] : null,
                  t.bug.char_state ? [h('div', { class: 'ck' }, 'character state'), h('pre', { class: 'tb' }, t.bug.char_state)] : null,
                ] : h('span', { class: 'dim' }, t.bug ? 'No detailed bug report attached.' : 'Loading'),
              ) : null,
              h('div', { class: 'msgs', role: 'log', 'aria-label': 'Conversation', 'data-testid': 'tickets-msgs' },
                t.messages?.length ? t.messages.map((m) => {
                  const o = originOf(m, t.requester_name);
                  if (o === 'system') return h('div', { class: 'sys' }, m.ts !== undefined ? h('span', { class: 'mts' }, clock(m.ts)) : null, ` ${m.text ?? ''}`);
                  return h('div', { class: `m${m.visibility === 'internal' ? ' note' : ''}${o === 'staff' ? ' staffmsg' : ''}` },
                    h('span', { class: 's' }, m.sender ?? '?'),
                    o === 'player' ? h('span', { class: 'sh-plate gold' }, 'Player') : null,
                    m.ts !== undefined ? h('span', { class: 'mts' }, clock(m.ts)) : null,
                    h('span', { class: 't' }, body(m, rich)));
                }) : h('p', { class: 'empty' }, 'No messages yet.')),
            ),
            tickets.shows('reply', sid) ? h('form', {
              class: 'reply', onsubmit: async (e: Event) => {
                e.preventDefault();
                const input = (e.currentTarget as HTMLFormElement).querySelector('textarea')!;
                const text = input.value.trim();
                if (!text) return;
                const note = v.note;
                const useNote = note && tickets.action('reply_note', tickets.worldOf(sid)).cmd;
                const name = useNote ? 'reply_note' : 'reply';
                try { v.fb = feedback(await tickets.run(name, { ...vars, text, internal: note ? '1' : '' }, sid), note ? 'reply_note' : 'reply', vars.short_id); } catch (err) { v.fb = failed(err); }
                input.value = ''; v.draft = '';
                draw();
              },
            },
              h('label', { class: 'int' }, h('input', { type: 'checkbox', checked: v.note, 'data-testid': 'tickets-note', 'data-focus': 'note', onchange: (e: Event) => { v.note = (e.target as HTMLInputElement).checked; const r = reply(); if (r) r.placeholder = v.note ? 'Staff note' : 'Reply to player'; } }), 'note'),
              replyArea({ class: 'sh-field', 'aria-label': 'ticket reply', 'aria-describedby': `${panelId}-reply-keys`, placeholder: v.note ? 'Staff note' : 'Reply to player', value: v.draft, 'data-testid': 'tickets-reply', 'data-focus': 'reply', oninput: (e: Event) => { v.draft = (e.target as HTMLTextAreaElement).value; } }),
              h('span', { id: `${panelId}-reply-keys`, class: 'sr-only' }, 'Enter sends. Shift+Enter starts a new line.'),
            ) : null,
          ),
        );
      };
      redraws.add(draw);
      const off = mu.sessions.on('switch', () => draw());
      draw();
      return () => { redraws.delete(draw); off(); el.replaceChildren(); };
    }

    // ─── My tickets panel ────────────────────────────────────────────────────────────────────
    const loadMine = (sid: string, closed: boolean) => {
      M(sid).error = false;
      void mine.request('mine', `${P}.Mine`, { closed }, sid);
    };

    function mountMine(el: HTMLElement, pc: PanelMountCtx): Dispose {
      const sidOf = () => pc.sid ?? active();
      el.classList.add('mx', 'mine');
      el.dataset.testid = 'mytickets';
      const draw = () => {
        const sid = sidOf();
        const focused = el.contains(document.activeElement) ? (document.activeElement as HTMLElement).dataset.focus : undefined;
        if (!sid) { fill(el, h('p', { class: 'empty' }, 'No session')); return; }
        const m = M(sid), v = myViewOf(sid);
        const back = h('button', { class: 'sh-cmd back', type: 'button', 'data-testid': 'mytickets-back', 'data-focus': 'back', onclick: () => { v.open = null; v.fb = null; draw(); } }, 'Back');
        const fbLine = v.fb ? h('p', { class: `fb${v.fb.ok ? '' : ' err'}`, role: 'status', 'data-testid': 'mytickets-fb' }, v.fb.text) : null;
        if (v.open) {
          const id = v.open;
          const row = [...(m.open ?? []), ...(m.closed ?? [])].find((t) => t.id === id);
          const t: Ticket = { ...row, ...m.threads.get(id), id } as Ticket;
          const closed = isClosed(t.status);
          const short = t.short_id ?? `#${id}`;
          fill(el,
            h('div', { class: 'hd' }, h('span', { class: 'tag glow-text' }, 'My tickets'), back),
            fbLine,
            h('div', { class: 'convo', 'data-testid': 'mytickets-thread' },
              h('div', { class: 'chead' }, h('span', { class: 'ctitle' }, t.subject ?? short),
                h('span', { class: 'cmeta' }, h('span', { class: 'ckind' }, `${t.kind ?? 'ticket'} ${short}`),
                  t.status ? h('span', { class: plateCls(t.status), 'data-testid': 'mytickets-status' }, t.status) : null)),
              h('div', { class: 'msgs', role: 'log', 'aria-label': 'Conversation', 'data-testid': 'mytickets-msgs' },
                t.messages?.length ? t.messages.filter((x) => x.visibility !== 'internal').map((x) => {
                  const o = originOf(x, t.requester_name);
                  if (o === 'system') return h('div', { class: 'sys' }, x.ts !== undefined ? h('span', { class: 'mts' }, clock(x.ts)) : null, ` ${x.text ?? ''}`);
                  return h('div', { class: `m${o === 'player' ? ' me' : ' staffmsg'}` },
                    h('span', { class: 'who' }, h('span', { class: 's' }, x.sender ?? '?'),
                      o === 'staff' ? h('span', { class: 'sh-plate hot' }, 'Staff') : h('span', { class: 'sh-plate dim' }, 'You'),
                      x.ts !== undefined ? h('span', { class: 'mts' }, clock(x.ts)) : null),
                    h('span', { class: 't' }, body(x, false)));
                })
                  : h('p', { class: 'empty' }, closed ? 'No messages.' : 'No messages yet. Add one below.')),
              closed ? h('div', { class: 'closed-note', 'data-testid': 'mytickets-closed' }, 'This ticket is closed. Open a new one if you still need help.')
                : mine.shows('myreply', sid) ? h('form', {
                  class: 'reply', onsubmit: async (e: Event) => {
                    e.preventDefault();
                    const input = (e.currentTarget as HTMLFormElement).querySelector('textarea')!;
                    const text = input.value.trim();
                    if (!text) return;
                    try {
                      const r = await mine.run('myreply', { id, short_id: short, text }, sid);
                      v.fb = feedback(r, 'myreply', short);
                      // A game without Client.Tickets.Message pushes nothing back: re-read the thread.
                      if (r === 'command' && textOn(sid)) setTimeout(() => { if (v.open === id) void mine.request('myget', `${P}.MyGet`, { id }, sid); }, 600);
                    } catch (err) { v.fb = failed(err); }
                    input.value = ''; v.draft = '';
                    draw();
                  },
                },
                  replyArea({ class: 'sh-field', 'aria-label': 'reply to staff', 'aria-describedby': 'mine-reply-keys', placeholder: 'Reply to staff', value: v.draft, 'data-testid': 'mytickets-reply', 'data-focus': 'reply', oninput: (e: Event) => { v.draft = (e.target as HTMLTextAreaElement).value; } }),
                  h('span', { id: 'mine-reply-keys', class: 'sr-only' }, 'Enter sends. Shift+Enter starts a new line.'),
                  h('div', { class: 'rkeys' }, h('button', { class: 'sh-cmd primary send', type: 'submit', 'data-testid': 'mytickets-send', 'data-focus': 'send' }, 'Reply'))) : null,
            ),
          );
        } else {
          const list = v.closed ? m.closed : m.open;
          const tab = (closed: boolean, label: string) => h('button', {
            class: 'sh-toggle', type: 'button', 'aria-pressed': String(v.closed === closed), 'data-testid': `mytickets-tab-${closed ? 'closed' : 'open'}`, 'data-focus': `tab-${closed}`,
            onclick: () => { v.closed = closed; v.fb = null; if ((closed ? m.closed : m.open) === null) loadMine(sid, closed); draw(); },
          }, label);
          fill(el,
            h('div', { class: 'hd' }, h('span', { class: 'tag glow-text' }, 'My tickets'), tab(false, 'Open'), tab(true, 'Closed'),
              list?.length ? h('span', { class: 'count' }, String(list.length)) : null),
            fbLine,
            h('div', { class: 'list', 'data-testid': 'mytickets-list' },
              m.error ? h('p', { class: 'empty err', role: 'alert', 'data-testid': 'mytickets-error' }, 'Could not load tickets.',
                h('button', { class: 'sh-cmd retry', type: 'button', 'data-focus': 'retry', onclick: () => { loadMine(sid, v.closed); draw(); } }, 'Try again'))
              : list === null ? h('p', { class: 'empty' }, 'Loading')
              : list.length ? list.map((t) => h('button', {
                class: 'sh-row row', type: 'button', 'data-id': t.id, 'data-kind': t.kind ?? '', 'data-focus': `row-${t.id}`,
                onclick: () => { v.open = t.id; v.fb = null; draw(); void mine.request('myget', `${P}.MyGet`, { id: t.id }, sid); },
              }, h('span', { class: 'r1' }, h('span', { class: 'kind' }, t.kind ?? 'ticket'), h('span', { class: 'id' }, t.short_id ?? ''),
                t.status ? h('span', { class: plateCls(t.status) }, t.status) : null, h('span', { class: 'age' }, age(t.age_mins))),
                t.subject ? h('span', { class: 'subject' }, t.subject) : null,
                t.preview ? h('span', { class: 'prev' }, t.preview) : null))
              : h('p', { class: 'empty', 'data-testid': 'mytickets-empty' }, ...hint(mine.option<string>('emptyHint', sid) || DEFAULT_HINT)),
            ),
          );
        }
        if (focused) (el.querySelector(`[data-focus="${focused}"]`) as HTMLElement | null)?.focus();
      };
      redraws.add(draw);
      const off = mu.sessions.on('switch', () => draw());
      const sid = sidOf();
      if (sid && M(sid).open === null) loadMine(sid, false);
      draw();
      return () => { redraws.delete(draw); off(); el.replaceChildren(); };
    }

    mu.panels.register({ id: 'tickets', title: 'Tickets', singleton: true, defaultPosition: 'right-bottom', inViewsMenu: false, mount: (el, pc) => mountTickets(el, pc, 'tickets') });
    mu.panels.register({ id: 'mytickets', title: 'My tickets', singleton: true, defaultPosition: 'right-bottom', inViewsMenu: false, mount: (el, pc) => mountMine(el, pc) });
    // Views visibility, Core.Supports and redraws follow the mode and role once the panels exist.
    ctx.subscriptions.push(...tickets.bind(), ...mine.bind(), tickets.onChange(redraw), mine.onChange(redraw));

    // ─── the API (06 §6) ─────────────────────────────────────────────────────────────────────
    const mineApi: MyTicketsApi = {
      enable: (mode, w) => mine.configure({ enabled: mode }, w),
      open: () => mu.panels.open('mytickets'),
      onAction: (a, fn) => mine.onAction(a, fn as never),
      onRequest: (k, fn) => mine.onRequest(k, fn as never),
      configure: (cfg, w) => mine.configure(cfg, w),
      set(what: 'mine' | 'thread', data: any, sid?: string) {
        const s = need(sid);
        if (!mine.acceptsApi(s)) return;
        if (what === 'mine') setMine(s, data.tickets ?? [], !!data.closed); else setMyThread(s, data);
      },
      push: (_w, m, sid) => pushMessage(need(sid), m),
      error: (sid) => { const s = need(sid); M(s).error = true; redraw(); },
      get: (_w, closed, sid) => [...((closed ? M(need(sid)).closed : M(need(sid)).open) ?? [])],
    };
    const api: TicketsApi = {
      enable: (mode, w) => tickets.configure({ enabled: mode }, w),
      open: () => mu.panels.open('tickets'),
      onAction: (a, fn) => tickets.onAction(a, fn as never),
      onRequest: (k, fn) => tickets.onRequest(k, fn as never),
      configure: (cfg, w) => tickets.configure(cfg, w),
      setRole: (role, sid) => setRole(need(sid), role === 'staff'),
      set(what, data, sid) {
        const s = need(sid);
        if (!tickets.acceptsApi(s)) return;
        if (what === 'inbox') setInbox(s, data.tickets ?? []);
        else { S(s).history = (data.tickets ?? []).map(norm); redraw(); }
      },
      upsert(_w, t, sid) {
        const s = need(sid), st = S(s), id = String(t.id);
        const n = { ...t, id };
        if (!upsertIn(st.inbox, n) && !upsertIn(st.history, n)) st.inbox.push(norm(n as Ticket));
        const th = st.threads.get(id);
        if (th) Object.assign(th, n);
        tickets.touched(s);
        redraw();
      },
      remove(_w, id, sid) { const st = S(need(sid)); st.inbox = st.inbox.filter((t) => t.id !== String(id)); if (st.history) st.history = st.history.filter((t) => t.id !== String(id)); redraw(); },
      push: (_w, m, sid) => pushMessage(need(sid), m),
      alert: (a) => alert(a),
      get(what: 'inbox' | 'history' | 'thread', a?: string, b?: string): any {
        if (what === 'thread') return S(need(b)).threads.get(String(a));
        const st = S(need(a));
        return [...(what === 'inbox' ? st.inbox : st.history ?? [])];
      },
      instance(opts) {
        const kinds = opts.filter?.kind === undefined ? undefined : ([] as string[]).concat(opts.filter.kind);
        return mu.panels.register({ id: opts.id, title: opts.title, singleton: true, defaultPosition: 'right-bottom', mount: (el, pc) => mountTickets(el, pc, opts.id, kinds) });
      },
      mine: mineApi,
    };
    return api;
  },
});
