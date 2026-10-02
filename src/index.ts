/**
 * @runmu.sh/ext-tickets: the staff ticket queue (Tickets) and the player's own tickets (My tickets).
 *
 * GMCP in: Client.Tickets.Role / Inbox / History / Thread / Message / Alert / BugDetail / Mine / MyThread.
 * GMCP out (data requests, or actions whose `via` is gmcp): Client.Tickets.Get / List / BugDetail / Action /
 * Mine / MyGet / Create. The payload contracts are in `schema/` and declared in the manifest, so the host drops
 * a malformed message with one `session.error` line before it reaches this code.
 * Buttons run actions (`mu.actions.define`: per-world "via" and command rows, the palette); the defaults are
 * Underspire's commands. Without GMCP, My tickets reads the game's `@tickets` / `@ticket <id>` text
 * (./bridge.ts over `mu.sessions.request`).
 * The exported API (types in ./types.ts) is what other extensions get with `ctx.api('tickets')`.
 * SDK 1.12; no ext-kit.
 */
import { defineExtension, type Dispose, type Mu, type PanelMountCtx } from '@muclient/sdk';
import { PANEL_CSS } from './css';
import { h, fill, age, stamp, hint, plateCls, replyArea, type Child } from './dom';
import { readMine, readThread, type Runner } from './bridge';
import type { ActionArgs, ActionHandler, ActionSession, Message, ModuleConfig, Mode, MyTicketsApi, RequestHandler, Ticket, TicketsApi, Via } from './types';

const P = 'Client.Tickets';
const DEFAULT_HINT = '`@request subject = what you need`, `@bug` or `@puppetrequest` in the game to open one.';
/** How long a GMCP data request may go unanswered before the text bridge asks the game in words. */
const GMCP_GRACE_MS = 1500;

type Mod = 'tickets' | 'mytickets';
type Source = 'gmcp' | 'api' | 'both';
type Vars = Record<string, string>;
interface ActionDef { label: string; via: Via; cmd: string; gmcp: (v: Vars) => [string, unknown]; args?: Record<string, { label: string }> }

const act = (action: string) => (v: Vars): [string, unknown] => [`${P}.Action`, { action, id: v.id, ...(v.text ? { text: v.text } : {}), ...(v.internal ? { internal: true } : {}) }];
const T_ARGS = { short_id: { label: 'Ticket' } };
const ACTIONS: Record<Mod, Record<string, ActionDef>> = {
  tickets: {
    open: { label: 'Open', via: 'command', cmd: '@ticket {short_id}', gmcp: (v) => [`${P}.Get`, { id: v.id }], args: T_ARGS },
    claim: { label: 'Claim', via: 'command', cmd: '@claim {short_id}', gmcp: act('claim'), args: T_ARGS },
    resolve: { label: 'Resolve', via: 'command', cmd: '@resolve {short_id}', gmcp: act('resolve'), args: T_ARGS },
    approve: { label: 'Approve', via: 'command', cmd: '@approve {short_id}[ = {text}]', gmcp: act('approve'), args: T_ARGS },
    deny: { label: 'Deny', via: 'command', cmd: '@deny {short_id}[ = {text}]', gmcp: act('deny'), args: T_ARGS },
    reply: { label: 'Reply', via: 'command', cmd: '@ticket {short_id} = {text}', gmcp: act('reply'), args: { ...T_ARGS, text: { label: 'Reply' } } },
    reply_note: { label: 'Reply (note)', via: 'command', cmd: '', gmcp: (v) => act('reply')({ ...v, internal: '1' }) },
    reopen: { label: 'Reopen', via: 'gmcp', cmd: '', gmcp: act('reopen'), args: T_ARGS },
  },
  mytickets: {
    myreply: { label: 'Reply', via: 'command', cmd: '@ticket {id} = {text}', gmcp: act('reply'), args: { id: { label: 'Ticket' }, text: { label: 'Reply' } } },
    withdraw: { label: 'Withdraw', via: 'command', cmd: '@ticket/withdraw {id}', gmcp: act('withdraw'), args: { id: { label: 'Ticket' } } },
    create: { label: 'New request', via: 'command', cmd: '@request {subject} = {text}', gmcp: (v) => [`${P}.Create`, { ...(v.subject ? { subject: v.subject } : {}), text: v.text }], args: { subject: { label: 'Subject' }, text: { label: 'What you need' } } },
  },
};
const TITLES: Record<Mod, string> = { tickets: 'Tickets', mytickets: 'My tickets' };

/** `{name}` is replaced; a `[…]` segment is kept only when every placeholder in it is non-empty. No escaping. */
export function fillTemplate(tpl: string, vars: Record<string, string | undefined>): string {
  const sub = (s: string) => s.replace(/\{(\w+)\}/g, (_, k: string) => vars[k] ?? '');
  return sub(tpl.replace(/\[([^\]]*)\]/g, (_, seg: string) => ([...seg.matchAll(/\{(\w+)\}/g)].every((m) => (vars[m[1]] ?? '') !== '') ? seg : ''))).trim();
}

const norm = (t: Ticket): Ticket => ({ ...t, id: String(t.id), short_id: t.short_id ?? `#${t.id}` });
const isClosed = (s?: string) => !!s && /^(closed|resolved|approved|denied|withdrawn)$/i.test(s);
/** Who wrote a message: its `origin`, else the requester (or "you") is the player and anyone else staff. */
const originOf = (m: Message, requester?: string): 'staff' | 'player' | 'system' =>
  m.origin ?? (m.sender && (m.sender === requester || /^you$/i.test(m.sender)) ? 'player' : 'staff');
const epoch = (u?: number | string) => { const n = typeof u === 'number' ? u : u ? (/^\d+(\.\d+)?$/.test(u) ? +u : Date.parse(u) / 1000) : 0; return n > 1e12 ? n / 1000 : n || 0; };
/** Underspire's sort for the queue: priority first, then the longest waiting. Stable, so equal rows keep the game's order. */
const queueOrder = (a: Ticket, b: Ticket) => (b.priority ?? 0) - (a.priority ?? 0) || epoch(a.updated) - epoch(b.updated);
/** The player's words for the two waiting states (the plate keeps the colour of the raw status). */
const MINE_WORDS: Record<string, string> = { pending: 'with staff', waiting: 'waiting on you' };
const matches = (t: Ticket, q: string) => !q || [t.short_id, t.subject, t.requester_name, t.account_name, t.preview, t.label, t.assignee, t.kind]
  .some((v) => String(v ?? '').toLowerCase().includes(q));

type Fb = { ok: boolean; text: string } | null;
const DONE: Record<string, string> = { claim: 'Claimed', resolve: 'Resolved', approve: 'Approved', deny: 'Denied', reply: 'Reply sent', reply_note: 'Note added', myreply: 'Reply sent', reopen: 'Reopened', withdraw: 'Withdrawn', create: 'Request sent' };
const feedback = (r: string, name: string, short: string): Fb => (r === 'none' ? { ok: false, text: 'That did not go through.' } : { ok: true, text: `${DONE[name] ?? name} ${short}.`.replace(/ \.$/, '.') });
const failed = (e: unknown): Fb => ({ ok: false, text: e instanceof Error ? e.message : String(e) });

interface StaffState { role: boolean; inbox: Ticket[]; history: Ticket[] | null; threads: Map<string, Ticket>; fresh: Set<string>; identity: Dispose | null }
interface MineState { open: Ticket[] | null; closed: Ticket[] | null; threads: Map<string, Ticket>; error: boolean; partial: boolean }

export default defineExtension({
  activate(ctx) {
    const mu: Mu = ctx.mu;
    const css = mu.ui.css;
    const staffOf = new Map<string, StaffState>();
    const mineOf = new Map<string, MineState>();
    const S = (sid: string) => staffOf.get(sid) ?? staffOf.set(sid, { role: false, inbox: [], history: null, threads: new Map(), fresh: new Set(), identity: null }).get(sid)!;
    const M = (sid: string) => mineOf.get(sid) ?? mineOf.set(sid, { open: null, closed: null, threads: new Map(), error: false, partial: false }).get(sid)!;
    const active = () => mu.sessions.active()?.id ?? null;
    const need = (sid?: string) => { const s = sid ?? active(); if (!s) throw new Error('no active session'); return s; };
    const refOf = (sid: string | null | undefined) => (sid ? mu.sessions.list().find((s) => s.id === sid) ?? null : null);
    const worldOf = (sid: string | null | undefined) => refOf(sid)?.worldId ?? null;
    const activeWorld = () => mu.sessions.active()?.worldId ?? null;

    // ─── settings: the Show panel rows are the host's (PanelSpec.show), the action rows mu.actions' ───────
    mu.ui.style(PANEL_CSS);
    const SOURCE_OPTS = [{ value: 'both', label: 'gmcp + api' }, { value: 'gmcp', label: 'gmcp' }, { value: 'api', label: 'api' }];
    mu.settings.define({
      title: 'Tickets',
      items: [
        { key: 'tickets.source', label: 'Driven by', default: 'both', kind: 'select', options: SOURCE_OPTS, group: 'Tickets', scope: 'world' },
        { key: 'tickets.rich', label: 'Rich text in messages', default: false, kind: 'toggle', group: 'Tickets', scope: 'both' },
        { key: 'tickets.autoOpen', label: 'Open the panel when the game shows a ticket', default: true, kind: 'toggle', group: 'Tickets', scope: 'both', hint: 'as when you type @ticket <id>' },
        { key: 'mytickets.source', label: 'Driven by', default: 'both', kind: 'select', options: SOURCE_OPTS, group: 'My tickets', scope: 'world' },
        { key: 'mytickets.emptyHint', label: 'Empty-list hint', default: DEFAULT_HINT, kind: 'text', hint: 'wrap commands in `backticks`', group: 'My tickets', scope: 'both' },
        { key: 'mytickets.text', label: 'Read @tickets output', default: true, kind: 'toggle', hint: 'when the game has no Client.Tickets GMCP: ask with @tickets / @ticket <id>, parse the text and hide it', group: 'My tickets', scope: 'both' },
      ],
    });
    /** A setting, or `fallback` when the host does not know the key (an older host, the test host). */
    const get = <T>(key: string, worldId: string | null, fallback: T): T => {
      try { const v = mu.settings.get<T>(key, worldId); return v === undefined || v === null ? fallback : v; } catch { return fallback; }
    };
    const DEFAULT_MODE: Record<Mod, Mode> = { tickets: 'auto', mytickets: 'on' };
    const modeOf = (k: Mod, w: string | null = activeWorld()): Mode => { const v = get<string>(`${k}.enabled`, w, DEFAULT_MODE[k]); return v === 'off' || v === 'auto' ? v : 'on'; };
    const sourceOf = (k: Mod, w: string | null): Source => get<Source>(`${k}.source`, w, 'both');
    const acceptsGmcp = (k: Mod, sid: string) => { const w = worldOf(sid); return modeOf(k, w) !== 'off' && sourceOf(k, w) !== 'api'; };
    const acceptsApi = (k: Mod, sid: string) => { const w = worldOf(sid); return modeOf(k, w) !== 'off' && sourceOf(k, w) !== 'gmcp'; };
    const option = <T>(k: Mod, key: string, sid: string | null, fallback: T) => get<T>(`${k}.${key}`, sid ? worldOf(sid) : activeWorld(), fallback);
    const textOn = (sid: string) => option<boolean>('mytickets', 'text', sid, true) !== false && sourceOf('mytickets', worldOf(sid)) !== 'api';

    // ─── actions (mu.actions: the via / command rows, the palette); API handlers run first ────────────────
    const handlers = new Map<string, Set<ActionHandler>>();
    const requests = new Map<string, Set<RequestHandler>>();
    const session = (sid: string): ActionSession => ({
      sid, worldId: worldOf(sid) ?? '', character: refOf(sid)?.character ?? '',
      send: async (c) => { await mu.sessions.send(c, sid); }, gmcp: (p, d) => mu.gmcp.send(p, d, sid),
    });
    const actionId = (k: Mod, name: string) => `${k}.${name}`;
    for (const k of ['tickets', 'mytickets'] as Mod[]) {
      for (const [name, a] of Object.entries(ACTIONS[k])) {
        const id = actionId(k, name);
        mu.actions.define({ id, label: a.label, group: TITLES[k], via: a.via, command: a.cmd, gmcp: a.gmcp, ...(a.args ? { args: a.args } : {}), when: 'session' });
        // The palette runs it through mu.actions.run; this sends it our way (the input pipeline, with an echo).
        mu.actions.handle(id, async (args, s) => { await run(k, name, args, s.sid); return true; });
      }
    }
    const viaOf = (k: Mod, name: string, sid: string): Via => {
      const v = get<string>(`${k}.action.${name}.via`, worldOf(sid), ACTIONS[k][name]?.via ?? 'command');
      return (['command', 'gmcp', 'ext', 'none'] as const).find((x) => x === v) ?? ACTIONS[k][name]?.via ?? 'command';
    };
    const cmdOf = (k: Mod, name: string, sid: string) => get<string>(`${k}.action.${name}.cmd`, worldOf(sid), ACTIONS[k][name]?.cmd ?? '');
    /**
     * Run an action: API handlers first (true = handled), then the world's `via`. GMCP falls back to the command
     * when it cannot be sent; a command goes through the input pipeline like a typed one. Resolves 'ext' (a
     * handler took it), 'gmcp', 'command' or 'none' (hidden, or nothing to send).
     */
    const run = async (k: Mod, name: string, vars: Vars, sid: string): Promise<'ext' | 'gmcp' | 'command' | 'none'> => {
      const id = actionId(k, name);
      const args = { action: name, ...vars } as ActionArgs;
      for (const fn of [...(handlers.get(id) ?? [])]) {
        try { if ((await fn(args, session(sid))) === true) return 'ext'; } catch (e) { mu.log.error(`action ${name} handler failed:`, e); }
      }
      const via = viaOf(k, name, sid);
      if (via === 'none' || via === 'ext') return 'none';
      const def = ACTIONS[k][name];
      if (via === 'gmcp' && def) {
        const [pkg, data] = def.gmcp(vars);
        if ((await mu.gmcp.send(pkg, data, sid)) === true) return 'gmcp';
      }
      const line = fillTemplate(cmdOf(k, name, sid), vars);
      if (!line) return 'none';
      await mu.sessions.send(line, sid);
      return 'command';
    };
    /** A button shows unless its via is none (ext shows only with a handler), or it has nothing to send. */
    const shows = (k: Mod, name: string, sid: string | null) => {
      if (!sid) return true;
      const via = viaOf(k, name, sid);
      if (via === 'none') return false;
      if (via === 'ext') return !!handlers.get(actionId(k, name))?.size;
      if (cmdOf(k, name, sid) || handlers.get(actionId(k, name))?.size) return true;
      // GMCP with no command to fall back on: only where the game speaks Client.Tickets.
      return via === 'gmcp' && mu.gmcp.seen(P, sid);
    };
    const addTo = <T>(m: Map<string, Set<T>>, key: string, fn: T): Dispose => { const set = m.get(key) ?? m.set(key, new Set()).get(key)!; set.add(fn); return () => { set.delete(fn); }; };
    /** A data request: API handlers replace the default GMCP message. Resolves false when nothing was asked. */
    const dataRequest = async (k: Mod, kind: string, pkg: string, data: Record<string, unknown>, sid: string): Promise<boolean> => {
      const hs = [...(requests.get(`${k}\u0000${kind}`) ?? [])];
      if (hs.length) {
        for (const fn of hs) { try { await fn(data, session(sid)); } catch (e) { mu.log.error(`request ${kind} handler failed:`, e); } }
        return true;
      }
      if (sourceOf(k, worldOf(sid)) === 'api') return true;
      return (await mu.gmcp.send(pkg, data, sid)) === true;
    };
    const hasRequestHandler = (k: Mod, kind: string) => !!requests.get(`${k}\u0000${kind}`)?.size;

    // ─── data ────────────────────────────────────────────────────────────────────────────────
    const redraws = new Set<() => void>();
    const redraw = () => redraws.forEach((f) => f());
    const upsertIn = (list: Ticket[] | null, t: Partial<Ticket> & { id: string }) => {
      if (!list) return false;
      const i = list.findIndex((x) => x.id === t.id);
      if (i >= 0) list[i] = { ...list[i], ...t };
      return i >= 0;
    };
    const isStaff = (sid: string) => S(sid).role || !!refOf(sid)?.roles?.includes('staff');
    const setRole = (sid: string, staff: boolean) => {
      const st = S(sid);
      st.role = staff;
      // The role is session identity: the Tickets panel (role 'staff') is listed only where it holds.
      if (staff && !st.identity) st.identity = mu.sessions.provideIdentity(sid, { roles: ['staff'] });
      if (!staff && st.identity) { st.identity(); st.identity = null; }
      redraw();
    };

    // Read marks, per world and synced across the player's devices: staff "new" ids, the player's last-read times.
    const seenStore = (sid: string) => mu.storage.world(worldOf(sid), { sync: true });
    /** Ids in `ids` not seen before in the session's world; marks them seen. */
    const freshIds = (sid: string, ids: string[]): string[] => {
      const store = seenStore(sid);
      const seen = new Set(store.get<string[]>('seen.tickets', []));
      const out = ids.filter((id) => !seen.has(id));
      if (out.length) store.set('seen.tickets', [...seen, ...out].slice(-1000));
      return out;
    };
    const readAt = (sid: string): Record<string, number> => seenStore(sid).get<Record<string, number>>('seen.mine', {}) ?? {};
    /** A ticket of the player's has news: it moved since they last read it, and it is not simply waiting on staff. */
    const unseen = (sid: string, t: Ticket) => {
      const u = epoch(t.updated);
      if (!u || /^pending$/i.test(t.status ?? '')) return false;
      return u > (readAt(sid)[t.id] ?? 0);
    };
    const markRead = (sid: string, t: Ticket) => {
      const u = epoch(t.updated) || Date.now() / 1000;
      const all = readAt(sid);
      if ((all[t.id] ?? 0) >= u) return;
      const next = Object.fromEntries([...Object.entries(all), [t.id, u]].slice(-1000));
      seenStore(sid).set('seen.mine', next);
      badges(sid);
    };
    const badges = (sid: string) => {
      const st = staffOf.get(sid);
      mu.panels.badge('tickets', st?.fresh.size ? { count: st.fresh.size } : null, sid);
      const n = (mineOf.get(sid)?.open ?? []).filter((t) => unseen(sid, t)).length;
      mu.panels.badge('mytickets', n ? { count: n } : null, sid);
    };
    const toast = (title: string, body: string, run?: () => void) =>
      mu.ui.toast(title, body, { kind: 'tickets', group: 'tickets', ...(run ? { action: { label: 'Open', run } } : {}) });

    const setInbox = (sid: string, list: Ticket[], replay = false) => {
      const st = S(sid);
      st.inbox = list.map(norm);
      const fresh = freshIds(sid, st.inbox.map((t) => t.id));
      for (const id of fresh) st.fresh.add(id);
      for (const id of [...st.fresh]) if (!st.inbox.some((t) => t.id === id)) st.fresh.delete(id);
      // Three or more within 2 s collapse into one "N new tickets" toast (the host's grouping).
      if (!replay) for (const t of st.inbox.filter((x) => fresh.includes(x.id))) {
        toast(`New ${t.kind ?? t.label ?? 'ticket'} ${t.short_id}`, [t.requester_name, t.subject].filter(Boolean).join(': '), () => openStaff(sid, t.id));
      }
      mu.panels.touch('tickets', sid);
      badges(sid);
      redraw();
    };
    const setHistory = (sid: string, list: Ticket[]) => { S(sid).history = list.map(norm); redraw(); };
    const setThread = (sid: string, t: Ticket) => {
      const n = norm(t), st = S(sid);
      st.threads.set(n.id, { ...st.threads.get(n.id), ...n });
      const { messages: _m, bug: _b, ...row } = n;
      upsertIn(st.inbox, row); upsertIn(st.history, row);
      redraw();
    };
    const setMine = (sid: string, list: Ticket[], closed: boolean) => {
      const m = M(sid);
      m.error = false; m.partial = false;
      if (closed) m.closed = list.map(norm); else m.open = list.map(norm);
      mu.panels.touch('mytickets', sid);
      badges(sid);
      redraw();
    };
    const setMyThread = (sid: string, t: Ticket) => {
      const n = norm(t), m = M(sid);
      m.threads.set(n.id, { ...m.threads.get(n.id), ...n });
      const { messages: _m, bug: _b, ...row } = n;
      upsertIn(m.open, row); upsertIn(m.closed, row);
      m.error = false;
      if (myViewOf(sid).open === n.id) markRead(sid, m.threads.get(n.id)!);
      redraw();
    };
    const alert = (a: { label?: string; who?: string; age_mins?: number }) =>
      toast(`Unclaimed ${a.label ?? 'ticket'}`, [a.who, a.age_mins !== undefined ? `waiting ${age(a.age_mins)}` : ''].filter(Boolean).join(' · '));

    /** Is a thread on screen in a mounted panel (then a reply needs no toast)? */
    const shown = new Map<string, Set<string>>(); // `${kind}\0${sid}` → ids open in a mounted panel
    const isShown = (kind: 'staff' | 'mine', sid: string, id: string) => !!shown.get(`${kind}\u0000${sid}`)?.has(id);
    const pushMessage = (sid: string, d: { id: string | number; status?: string; updated?: number | string; message: Message }, replay = false) => {
      const id = String(d.id);
      const patch: Partial<Ticket> & { id: string } = { id, ...(d.status ? { status: d.status } : {}), ...(d.updated !== undefined ? { updated: d.updated } : {}) };
      for (const map of [S(sid).threads, M(sid).threads]) {
        const t = map.get(id);
        if (!t) continue;
        t.messages = [...(t.messages ?? []), d.message];
        Object.assign(t, patch);
      }
      upsertIn(S(sid).inbox, patch); upsertIn(S(sid).history, patch); upsertIn(M(sid).open, patch); upsertIn(M(sid).closed, patch);
      if (!replay) replied(sid, id, d.message);
      if (isShown('mine', sid, id)) { const t = M(sid).threads.get(id); if (t) markRead(sid, t); }
      badges(sid);
      redraw();
    };
    /** "Staff replied" to the requester, "Player replied" to the claiming staff, "Ticket update" for the game's own notes. */
    const replied = (sid: string, id: string, m: Message) => {
      if (m.visibility === 'internal') return;
      const mine = [...(M(sid).open ?? []), ...(M(sid).closed ?? [])].find((t) => t.id === id) ?? M(sid).threads.get(id);
      const staffT = S(sid).threads.get(id) ?? S(sid).inbox.find((t) => t.id === id);
      const o = m.origin ?? (mine ? originOf(m, mine.requester_name) : staffT ? originOf(m, staffT.requester_name) : 'staff');
      const body = `${m.sender ? `${m.sender}: ` : ''}${(m.text ?? '').slice(0, 140)}`;
      const toOwner = m.audience ? m.audience === 'owner' : !!mine;
      if (toOwner && mine && o !== 'player' && !isShown('mine', sid, id)) {
        const what = `${mine.short_id ?? `#${id}`}${mine.subject ? ` ${mine.subject}` : ''}`;
        toast(o === 'system' ? `Ticket update: ${what}` : `Staff replied: ${what}`, body, () => openMine(sid, id));
        return;
      }
      const me = refOf(sid)?.character ?? '';
      const toAssignee = m.audience ? m.audience === 'assignee' : !!staffT && !!me && staffT.assignee === me;
      if (toAssignee && staffT && o === 'player' && !isShown('staff', sid, id)) {
        toast(`Player replied: ${staffT.short_id ?? `#${id}`}${staffT.subject ? ` ${staffT.subject}` : ''}`, body, () => openStaff(sid, id));
      }
    };

    // Panel view state, per session (and per panel id for the staff queue's instances).
    type StaffView = { tab: 'open' | 'history'; kinds: Set<string>; show: 'all' | 'reply' | 'player' | 'unclaimed'; q: string; hq: string; open: string | null; bug: boolean; draft: string; note: boolean; busy: boolean; fb: Fb };
    const views = new Map<string, StaffView>();
    const viewOf = (key: string) => views.get(key) ?? views.set(key, { tab: 'open', kinds: new Set(), show: 'all', q: '', hq: '', open: null, bug: false, draft: '', note: false, busy: false, fb: null }).get(key)!;
    type MineView = { closed: boolean; open: string | null; draft: string; fb: Fb; q: string; waiting: boolean; newest: boolean; compose: boolean; subject: string; details: string; cerr: string; armed: boolean; busy: boolean };
    const myViews = new Map<string, MineView>();
    const myViewOf = (sid: string) => myViews.get(sid) ?? myViews.set(sid, { closed: false, open: null, draft: '', fb: null, q: '', waiting: false, newest: true, compose: false, subject: '', details: '', cerr: '', armed: false, busy: false }).get(sid)!;

    /** The game showed a ticket (`@ticket <id>`, or a toast's Open): show it in its panel. */
    const openStaff = (sid: string, id: string) => {
      const v = viewOf(`tickets\u0000${sid}`);
      if (v.open !== id) { v.open = id; v.bug = false; v.fb = null; }
      S(sid).fresh.delete(id); badges(sid);
      mu.panels.open('tickets', undefined, { sid });
      redraw();
    };
    const openMine = (sid: string, id: string) => {
      const v = myViewOf(sid);
      if (v.open !== id) { v.open = id; v.fb = null; v.armed = false; v.compose = false; }
      mu.panels.open('mytickets', undefined, { sid });
      if (!M(sid).threads.get(id)?.messages) void requestThread(sid, id);
      const t = M(sid).threads.get(id) ?? [...(M(sid).open ?? []), ...(M(sid).closed ?? [])].find((x) => x.id === id);
      if (t) markRead(sid, t);
      redraw();
    };
    const autoOpen = (k: Mod, sid: string, id: string) => {
      if (option<boolean>('tickets', 'autoOpen', sid, true) === false) return;
      if (isShown(k === 'tickets' ? 'staff' : 'mine', sid, id)) return;
      if (k === 'tickets') openStaff(sid, id); else openMine(sid, id);
    };

    const handle = (pkg: string, data: unknown, sid: string, replay: boolean) => {
      const sub = pkg.slice(P.length + 1);
      const forMine = sub === 'Mine' || sub === 'MyThread';
      const k: Mod = forMine ? 'mytickets' : 'tickets';
      if (!acceptsGmcp(k, sid) && !(sub === 'Message' && acceptsGmcp('mytickets', sid))) return;
      const d = data as any;
      switch (sub) {
        case 'Role': setRole(sid, !!d.staff); break;
        case 'Inbox': setInbox(sid, d.tickets, replay); break;
        case 'History': setHistory(sid, d.tickets); break;
        case 'Thread': setThread(sid, d); mu.panels.touch('tickets', sid); if (!replay) autoOpen('tickets', sid, String(d.id)); break;
        case 'Message': pushMessage(sid, d, replay); break;
        case 'Alert': if (!replay && isStaff(sid)) alert(d); break;
        case 'BugDetail': { const t = S(sid).threads.get(String(d.id)); if (t) { t.bug = d.bug ?? { available: false }; redraw(); } break; }
        case 'Mine': setMine(sid, d.tickets, !!d.closed); break;
        case 'MyThread': setMyThread(sid, d); if (!replay) autoOpen('mytickets', sid, String(d.id)); break;
      }
    };
    // The payloads are checked against schema/ by the host before they get here. Role and the lists are state:
    // the host replays them when this extension activates after they arrived (`replay`: no toasts).
    mu.gmcp.on(P, (data, meta) => handle(meta.pkg, data, meta.sid, !!meta.replay));

    // Client.Tickets is supported while either module is not off in a world with a session.
    let supported: Dispose | null = null;
    const syncSupports = () => {
      const worlds = new Set(mu.sessions.list().map((s) => s.worldId));
      if (!worlds.size) worlds.add(activeWorld() ?? '');
      const want = [...worlds].some((w) => modeOf('tickets', w || null) !== 'off' || modeOf('mytickets', w || null) !== 'off');
      if (want && !supported) supported = mu.gmcp.supports([`${P} 1`]);
      if (!want && supported) { supported(); supported = null; }
    };
    ctx.subscriptions.push(
      mu.sessions.on('open', () => syncSupports()),
      () => { supported?.(); supported = null; },
    );
    syncSupports();

    // ─── data requests and the text bridge (My tickets without GMCP) ─────────────────────────
    // A game that never answers Client.Tickets.Mine / MyGet (Underspire's telnet port is one) still answers
    // `@tickets` (an interactive menu) and `@ticket <id>`. When GMCP cannot be sent, or the game has sent no
    // Client.Tickets message within GMCP_GRACE_MS, the bridge asks in words through mu.sessions.request, which
    // captures and hides the answer; unrelated lines stay in the terminal. Off with the setting `mytickets.text`.
    const runner = (sid: string): Runner => (text, o) => mu.sessions.request(text, { sid, raw: true, until: o.until, timeoutMs: o.timeoutMs });
    const sender = (sid: string) => (text: string) => mu.sessions.send(text, { sid, raw: true, echo: false });
    const me = (sid: string) => () => refOf(sid)?.character ?? '';
    const gmcpAnswers = async (sid: string, asked: boolean) => asked && (mu.gmcp.seen(P, sid) || await mu.gmcp.whenSeen(P, { sid, timeoutMs: GMCP_GRACE_MS }));
    const textJobs = new Map<string, Promise<void>>();
    const once = (key: string, job: () => Promise<void>) => {
      const had = textJobs.get(key);
      if (had) return had;
      const p = job().finally(() => textJobs.delete(key));
      textJobs.set(key, p);
      return p;
    };
    const requestMine = async (sid: string, closed: boolean) => {
      M(sid).error = false;
      const asked = await dataRequest('mytickets', 'mine', `${P}.Mine`, { closed }, sid);
      if (hasRequestHandler('mytickets', 'mine') || !textOn(sid) || await gmcpAnswers(sid, asked)) return;
      const state = M(sid);
      await once(`${sid}\u0000mine\u0000${closed}`, async () => {
        const r = await readMine(runner(sid), sender(sid), closed);
        if (mineOf.get(sid) !== state || !refOf(sid)) return; // the session closed meanwhile
        if (r.ok || r.sawList) { setMine(sid, r.rows, closed); M(sid).partial = !r.ok; }
        else if (r.reason !== 'another client asked') M(sid).error = true;
        if (!r.ok) mu.log.warn(`@tickets: ${r.reason ?? 'no answer'}${r.partial ? ` (kept ${r.rows.length} rows)` : ''}`);
        redraw();
      });
    };
    const requestThread = async (sid: string, id: string) => {
      const asked = await dataRequest('mytickets', 'myget', `${P}.MyGet`, { id }, sid);
      if (hasRequestHandler('mytickets', 'myget') || !textOn(sid) || await gmcpAnswers(sid, asked)) return;
      const state = M(sid);
      await once(`${sid}\u0000thread\u0000${id}`, async () => {
        const r = await readThread(runner(sid), id, me(sid));
        if (mineOf.get(sid) !== state || !refOf(sid)) return;
        if (r.t) setMyThread(sid, r.t);
        if (!r.ok) {
          const v = myViewOf(sid);
          if (v.open === id) v.fb = r.notFound ? { ok: false, text: `No ticket ${id}.` } : r.t ? null : { ok: false, text: 'The game did not answer.' };
          redraw();
        }
      });
    };

    // Per-session state goes when the session closes or leaves this extension's scope.
    ctx.subscriptions.push(mu.sessions.each((s) => () => {
      const st = staffOf.get(s.id);
      st?.identity?.();
      staffOf.delete(s.id); mineOf.delete(s.id); myViews.delete(s.id);
      for (const key of [...views.keys()]) if (key.endsWith(`\u0000${s.id}`)) views.delete(key);
      for (const key of [...textJobs.keys()]) if (key.startsWith(`${s.id}\u0000`)) textJobs.delete(key);
      redraw();
    }));

    // ─── Tickets panel (the staff queue) ─────────────────────────────────────────────────────
    const rich = (sid: string) => option<boolean>('tickets', 'rich', sid, false) === true;
    /** A message body: plain text, or (`tickets.rich`) the game's HTML through the host's inline sanitizer. */
    const body = (m: Message, html: boolean): Child => {
      if (html && m.html) { try { return mu.ui.sanitize(m.html, 'inline') as unknown as Node; } catch { /* plain below */ } }
      return m.text ?? '';
    };
    const SHOW: Array<[StaffView['show'], string, (t: Ticket) => boolean]> = [
      ['all', 'All', () => true],
      ['reply', 'Needs reply', (t) => /^(pending|open)$/i.test(t.status ?? 'open')],
      ['player', 'On player', (t) => /^waiting$/i.test(t.status ?? '')],
      ['unclaimed', 'Unclaimed', (t) => !t.assignee],
    ];
    let searchTimer: ReturnType<typeof setTimeout> | null = null;
    ctx.subscriptions.push(() => { if (searchTimer) clearTimeout(searchTimer); });

    function mountTickets(el: HTMLElement, pc: PanelMountCtx, panelId: string, fixedKinds?: string[]): Dispose {
      const sidOf = () => pc.sid ?? active();
      el.classList.add('mx', 'tickets');
      el.dataset.testid = 'tickets';
      let shownId: string | null = null;
      const track = (sid: string | null, id: string | null) => {
        const key = (s: string) => `staff\u0000${s}`;
        if (shownId) for (const set of shown.values()) set.delete(shownId);
        shownId = id;
        if (sid && id) (shown.get(key(sid)) ?? shown.set(key(sid), new Set()).get(key(sid))!).add(id);
      };
      const draw = () => {
        const sid = sidOf();
        const focused = el.contains(document.activeElement) ? (document.activeElement as HTMLElement).dataset.focus : undefined;
        if (!sid) { track(null, null); fill(el, h('p', { class: 'empty' }, 'No session')); return; }
        const v = viewOf(`${panelId}\u0000${sid}`);
        const st = S(sid);
        track(sid, v.open);
        if (v.open) drawThread(sid, st, v); else drawList(sid, st, v);
        if (focused) (el.querySelector(`[data-focus="${focused}"]`) as HTMLElement | null)?.focus();
      };
      const back = (onclick: () => void) =>
        h('button', { class: `${css.cmd} back`, type: 'button', 'data-testid': 'tickets-back', 'data-focus': 'back', onclick }, 'Back');
      const fbLine = (v: { fb: Fb }) => (v.fb ? h('p', { class: `fb${v.fb.ok ? '' : ' err'}`, role: 'status', 'data-testid': 'tickets-fb' }, v.fb.text) : null);
      const askHistory = (sid: string, search: string) =>
        void dataRequest('tickets', 'history', `${P}.List`, { history: true, ...(search ? { search } : {}) }, sid);

      const drawList = (sid: string, st: StaffState, v: StaffView) => {
        const history = v.tab === 'history';
        const all = history ? st.history ?? [] : st.inbox;
        const scoped = fixedKinds ? all.filter((t) => fixedKinds.includes(t.kind ?? '')) : all;
        const kinds = [...new Set(scoped.map((t) => t.kind).filter((k): k is string => !!k))];
        for (const k of [...v.kinds]) if (!kinds.includes(k)) v.kinds.delete(k);
        const q = (history ? '' : v.q).trim().toLowerCase(); // history is searched by the game
        const byKind = v.kinds.size ? scoped.filter((t) => v.kinds.has(t.kind ?? '')) : scoped;
        const show = SHOW.find((s) => s[0] === v.show) ?? SHOW[0];
        const rows = byKind.filter((t) => matches(t, q) && (history || show[2](t)));
        if (!history) rows.sort(queueOrder);
        const labelOf = (k: string) => scoped.find((t) => t.kind === k && t.label)?.label ?? k;
        const tab = (id: 'open' | 'history', label: string) => h('button', {
          class: css.toggle, type: 'button', 'aria-pressed': String(v.tab === id), 'data-testid': `tickets-tab-${id}`, 'data-focus': `tab-${id}`,
          onclick: () => { v.tab = id; v.fb = null; if (id === 'history' && st.history === null) askHistory(sid, v.hq.trim()); draw(); },
        }, label);
        const searchVal = history ? v.hq : v.q;
        fill(el,
          h('div', { class: 'hd' }, h('span', { class: 'tag glow-text' }, 'Tickets'), tab('open', 'Open'), tab('history', 'History'),
            h('span', { class: 'count', 'data-testid': 'tickets-count' }, String(rows.length))),
          fbLine(v),
          h('div', { class: 'filters' },
            kinds.length > 1 ? h('div', { class: 'fl', role: 'group', 'aria-label': 'filter by kind' }, kinds.map((k) => h('button', {
              class: `${css.toggle} fchip`, type: 'button', 'aria-pressed': String(v.kinds.has(k)), 'data-kind': k, 'data-focus': `k-${k}`,
              onclick: () => { if (v.kinds.has(k)) v.kinds.delete(k); else v.kinds.add(k); draw(); },
            }, labelOf(k)))) : null,
            history ? null : h('div', { class: 'fl', role: 'radiogroup', 'aria-label': 'Show', 'data-testid': 'tickets-show' }, SHOW.map(([id, label, f]) => {
              const n = id === 'all' ? 0 : byKind.filter(f).length;
              return h('button', {
                class: `${css.toggle} show`, type: 'button', role: 'radio', 'aria-checked': String(v.show === id), 'data-show': id, 'data-focus': `show-${id}`,
                // One tab stop for the group; the arrows move the choice (the radiogroup pattern).
                tabindex: v.show === id ? 0 : -1,
                onclick: () => { v.show = id; draw(); },
                onkeydown: (e: KeyboardEvent) => {
                  const step = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
                  if (!step) return;
                  e.preventDefault();
                  const i = SHOW.findIndex((x) => x[0] === v.show);
                  v.show = SHOW[(i + step + SHOW.length) % SHOW.length][0];
                  draw();
                  el.querySelector<HTMLElement>(`[data-focus="show-${v.show}"]`)?.focus();
                },
              }, label, n ? h('span', { class: css.count }, String(n)) : null);
            })),
            h('input', {
              class: `${css.field} search`, type: 'search', 'data-testid': 'tickets-search', 'data-focus': `search-${v.tab}`, value: searchVal,
              placeholder: history ? 'Search record' : 'Search queue', 'aria-label': history ? 'Search closed tickets' : 'Search open tickets',
              oninput: (e: Event) => {
                const val = (e.target as HTMLInputElement).value;
                if (!history) { v.q = val; draw(); return; }
                v.hq = val;
                if (searchTimer) clearTimeout(searchTimer);
                searchTimer = setTimeout(() => { searchTimer = null; askHistory(sid, v.hq.trim()); }, 300);
              },
            }),
          ),
          h('div', { class: 'list', 'data-testid': 'tickets-list' },
            rows.length ? rows.map((t) => h('button', {
              class: `${css.row} row${st.fresh.has(t.id) ? ` ${css.hot}` : ''}`, type: 'button', 'data-kind': t.kind ?? '', 'data-id': t.id, 'data-focus': `row-${t.id}`,
              title: t.account_name ? `account: ${t.account_name}` : undefined,
              onclick: () => { v.open = t.id; v.bug = false; v.fb = null; st.fresh.delete(t.id); badges(sid); draw(); void run('tickets', 'open', { id: t.id, short_id: t.short_id! }, sid); },
            },
              h('span', { class: 'r1' }, h('span', { class: 'kind' }, `${t.label ?? t.kind ?? 'ticket'} `, h('span', { class: 'sid' }, t.short_id)),
                h('span', { class: 'meta' },
                  t.priority ? h('span', { class: 'pri', title: `priority ${t.priority}` }, '!'.repeat(Math.min(4, t.priority))) : null,
                  t.assignee ? h('span', { class: 'asg', title: `claimed by ${t.assignee}` }, t.assignee) : null,
                  t.status ? h('span', { class: plateCls(css.plate, t.status, 'status') }, t.status) : null,
                  h('span', { class: 'age' }, age(t.age_mins, t.updated)))),
              t.requester_name ? h('span', { class: 'who' }, t.requester_name) : null,
              t.subject ? h('span', { class: 'subject' }, t.subject) : null,
              t.preview ? h('span', { class: 'prev' }, t.preview) : null,
            )) : h('p', { class: 'empty', 'data-testid': 'tickets-empty' },
              history ? (st.history === null ? 'Loading' : v.hq.trim() ? 'No closed tickets match.' : 'No closed tickets.')
                : all.length ? 'No tickets match.' : 'No open tickets.'),
          ),
        );
      };

      // The decide row: Deny with no text asks for the reason first.
      let deciding: 'deny' | null = null;
      const drawThread = (sid: string, st: StaffState, v: StaffView) => {
        const id = v.open!;
        const row = st.inbox.find((t) => t.id === id) ?? st.history?.find((t) => t.id === id);
        const t: Ticket = { ...row, ...st.threads.get(id), id } as Ticket;
        const vars = { id, short_id: t.short_id ?? `#${id}` };
        const html = rich(sid);
        const reply = () => el.querySelector<HTMLTextAreaElement>('[data-testid=tickets-reply]');
        const go = async (name: string, text = '') => {
          v.busy = true; draw();
          try { v.fb = feedback(await run('tickets', name, { ...vars, text }, sid), name, vars.short_id); } catch (e) { v.fb = failed(e); }
          v.busy = false;
        };
        const act = (name: string, label: string, cls = '') => (shows('tickets', name, sid) ? h('button', {
          class: `${css.cmd} act ${cls}`.trim(), type: 'button', 'data-action': name, 'data-focus': `act-${name}`, disabled: v.busy,
          onclick: async () => {
            if (name === 'approve' || name === 'deny') {
              // Text in the reply box goes with it at once (1.x behaviour). Approve without one is one click (the
              // note is optional); Deny without one asks for the reason the player will read.
              const input = reply();
              const text = input?.value.trim() ?? '';
              if (!text && name === 'deny' && deciding !== 'deny') { deciding = 'deny'; draw(); el.querySelector<HTMLInputElement>('[data-testid=tickets-reason]')?.focus(); return; }
              if (text && input) { input.value = ''; v.draft = ''; }
              deciding = null;
              await go(name, text);
            } else await go(name);
            draw();
          },
        }, label) : null);
        const closed = isClosed(t.status);
        const ctxRows = Object.entries(t.context ?? {});
        const isBug = (t.kind ?? '').toLowerCase() === 'bug';
        const bug = t.bug;
        const decidable = t.approvable !== false;
        const resolvable = t.approvable !== true;
        if (closed) deciding = null;
        fill(el,
          h('div', { class: 'hd' }, h('span', { class: 'tag glow-text' }, 'Tickets'), h('span', { class: 'sub' }, `${t.label ?? t.kind ?? 'ticket'} ${vars.short_id}`),
            back(() => { v.open = null; v.fb = null; deciding = null; draw(); })),
          fbLine(v),
          h('div', { class: 'convo', 'data-testid': 'tickets-thread' },
            h('div', { class: 'head' },
              h('span', { class: 'petitioner' }, t.requester_name ?? 'unknown',
                h('span', { class: 'sub' },
                  t.account_name && t.account_name !== t.requester_name ? h('span', { class: 'acct' }, t.account_name) : null,
                  t.status ? h('span', { class: plateCls(css.plate, t.status), 'data-testid': 'tickets-status' }, t.status) : null,
                  t.assignee ? h('span', { class: 'asg' }, t.assignee) : null)),
              h('span', { class: 'actions' }, closed
                ? act('reopen', 'Reopen')
                : [act('claim', 'Claim'), decidable ? [act('approve', 'Approve', 'primary'), act('deny', 'Deny', 'warn')] : null, resolvable ? act('resolve', 'Resolve') : null])),
            deciding ? h('form', {
              class: 'decide', 'data-testid': 'tickets-decide',
              onkeydown: (e: KeyboardEvent) => {
                if (e.key !== 'Escape') return;
                e.preventDefault(); e.stopPropagation();
                deciding = null; draw();
                el.querySelector<HTMLElement>('[data-action=deny]')?.focus();
              },
              onsubmit: async (e: Event) => {
                e.preventDefault();
                const name = deciding!;
                const text = el.querySelector<HTMLInputElement>('[data-testid=tickets-reason]')?.value.trim() ?? '';
                deciding = null;
                await go(name, text);
                draw();
              },
            },
              h('input', { class: `${css.field}`, type: 'text', 'aria-label': 'Reason', 'data-testid': 'tickets-reason', 'data-focus': 'reason', placeholder: 'Reason (the player sees it)' }),
              h('button', { class: `${css.cmd} warn`, type: 'submit', 'data-testid': 'tickets-decide-go', 'data-focus': 'decide-go', disabled: v.busy }, 'Confirm deny'),
              h('button', { class: css.cmd, type: 'button', 'data-focus': 'decide-cancel', onclick: () => { deciding = null; draw(); el.querySelector<HTMLElement>('[data-action=deny]')?.focus(); } }, 'Cancel'),
            ) : null,
            h('div', { class: 'body' },
              t.subject || ctxRows.length || isBug ? h('div', { class: 'ctx' },
                t.subject ? h('div', { class: 'cx' }, h('span', { class: 'ck' }, 'subject'), h('span', { class: 'cv' }, t.subject)) : null,
                ctxRows.map(([k, val]) => h('div', { class: 'cx' }, h('span', { class: 'ck' }, k), h('span', { class: 'cv' }, String(val)))),
                isBug && !v.bug ? h('button', { class: `${css.cmd} loadbug`, type: 'button', 'data-testid': 'tickets-loadbug', 'data-focus': 'loadbug', 'aria-expanded': 'false', onclick: () => { v.bug = true; if (!t.bug) void dataRequest('tickets', 'bugdetail', `${P}.BugDetail`, { id }, sid); draw(); } }, 'Report detail') : null,
              ) : null,
              isBug && v.bug ? h('div', { class: 'bug', 'data-testid': 'tickets-bug' },
                bug && bug.available !== false && Object.keys(bug).length ? [
                  h('div', { class: 'bl' }, h('span', { class: 'ck' }, 'reporter'), [bug.reporter, bug.character].filter(Boolean).join(' / ') || '—'),
                  h('div', { class: 'bl' }, h('span', { class: 'ck' }, 'location'), bug.location ?? '—'),
                  h('div', { class: 'bl' }, h('span', { class: 'ck' }, 'last cmd'), h('span', { class: 'dim' }, bug.last_cmd ?? bug.traceback_command ?? '—'), bug.traceback_time ? h('span', { class: 'dim' }, ` (${bug.traceback_time})`) : null),
                  bug.traceback ? [h('div', { class: 'ck' }, 'traceback'), h('pre', { class: 'tb' }, bug.traceback)] : null,
                  bug.char_state || (bug.character_state && Object.keys(bug.character_state).length) ? [h('div', { class: 'ck' }, 'character state'),
                    h('pre', { class: 'tb' }, bug.char_state ?? Object.entries(bug.character_state ?? {}).map(([k, x]) => `${k}: ${typeof x === 'string' ? x : JSON.stringify(x)}`).join('\n'))] : null,
                ] : h('span', { class: 'dim' }, bug ? 'No detailed bug report attached.' : 'Loading'),
              ) : null,
              h('div', { class: 'msgs', role: 'log', 'aria-label': 'Conversation', 'data-testid': 'tickets-msgs' },
                t.messages?.length ? t.messages.map((m) => {
                  const o = originOf(m, t.requester_name);
                  if (o === 'system') return h('div', { class: 'sys' }, m.ts !== undefined ? h('span', { class: 'mts' }, stamp(m.ts, true)) : null, ` ${m.text ?? ''}`);
                  return h('div', { class: `m${m.visibility === 'internal' ? ' note' : ''}${o === 'staff' ? ' staffmsg' : ''}` },
                    h('span', { class: 's' }, m.sender ?? '?'),
                    o === 'player' ? h('span', { class: `${css.plate} ${css.gold}` }, 'Player') : null,
                    m.ts !== undefined ? h('span', { class: 'mts' }, stamp(m.ts, true)) : null,
                    h('span', { class: 't' }, body(m, html)));
                }) : h('p', { class: 'empty' }, 'No messages yet.')),
            ),
            shows('tickets', 'reply', sid) ? h('form', {
              class: 'reply', onsubmit: async (e: Event) => {
                e.preventDefault();
                const input = (e.currentTarget as HTMLFormElement).querySelector('textarea')!;
                const text = input.value.trim();
                if (!text) return;
                const note = v.note;
                const name = note && cmdOf('tickets', 'reply_note', sid) ? 'reply_note' : 'reply';
                try { v.fb = feedback(await run('tickets', name, { ...vars, text, internal: note ? '1' : '' }, sid), note ? 'reply_note' : 'reply', vars.short_id); } catch (err) { v.fb = failed(err); }
                input.value = ''; v.draft = '';
                draw();
              },
            },
              h('label', { class: 'int' }, h('input', { type: 'checkbox', checked: v.note, 'data-testid': 'tickets-note', 'data-focus': 'note', onchange: (e: Event) => { v.note = (e.target as HTMLInputElement).checked; const r = reply(); if (r) r.placeholder = v.note ? 'Staff note' : 'Reply to player'; } }), 'note'),
              replyArea({ class: css.field, 'aria-label': 'ticket reply', 'aria-describedby': `${panelId}-reply-keys`, placeholder: v.note ? 'Staff note' : 'Reply to player', value: v.draft, 'data-testid': 'tickets-reply', 'data-focus': 'reply', oninput: (e: Event) => { v.draft = (e.target as HTMLTextAreaElement).value; } }),
              h('span', { id: `${panelId}-reply-keys`, class: 'sr-only' }, 'Enter sends. Shift+Enter starts a new line.'),
            ) : null,
          ),
        );
      };
      redraws.add(draw);
      const off = mu.sessions.on('switch', () => draw());
      draw();
      return () => { redraws.delete(draw); off(); track(null, null); el.replaceChildren(); };
    }

    // ─── My tickets panel ────────────────────────────────────────────────────────────────────
    let mineSearchTimer: ReturnType<typeof setTimeout> | null = null;
    ctx.subscriptions.push(() => { if (mineSearchTimer) clearTimeout(mineSearchTimer); });

    function mountMine(el: HTMLElement, pc: PanelMountCtx): Dispose {
      const sidOf = () => pc.sid ?? active();
      el.classList.add('mx', 'mine');
      el.dataset.testid = 'mytickets';
      let shownKey: string | null = null, shownId: string | null = null;
      const track = (sid: string | null, id: string | null) => {
        if (shownKey && shownId) shown.get(shownKey)?.delete(shownId);
        shownKey = sid ? `mine\u0000${sid}` : null; shownId = id;
        if (shownKey && id) (shown.get(shownKey) ?? shown.set(shownKey, new Set()).get(shownKey)!).add(id);
      };
      const draw = () => {
        const sid = sidOf();
        const focused = el.contains(document.activeElement) ? (document.activeElement as HTMLElement).dataset.focus : undefined;
        if (!sid) { track(null, null); fill(el, h('p', { class: 'empty' }, 'No session')); return; }
        const m = M(sid), v = myViewOf(sid);
        track(sid, v.open);
        const fbLine = v.fb ? h('p', { class: `fb${v.fb.ok ? '' : ' err'}`, role: 'status', 'data-testid': 'mytickets-fb' }, v.fb.text) : null;
        if (v.open) drawThread(sid, m, v, fbLine); else drawList(sid, m, v, fbLine);
        if (focused) (el.querySelector(`[data-focus="${focused}"]`) as HTMLElement | null)?.focus();
      };
      const statusWord = (s?: string) => (s ? MINE_WORDS[s.toLowerCase()] ?? s : '');

      const drawThread = (sid: string, m: MineState, v: MineView, fbLine: Child) => {
        const id = v.open!;
        const row = [...(m.open ?? []), ...(m.closed ?? [])].find((t) => t.id === id);
        const t: Ticket = { ...row, ...m.threads.get(id), id } as Ticket;
        const closed = isClosed(t.status);
        const short = t.short_id ?? `#${id}`;
        const go = async (name: 'myreply' | 'withdraw', text = '') => {
          v.busy = true; draw();
          let r: string = 'none';
          try { r = await run('mytickets', name, { id, short_id: short, text }, sid); v.fb = feedback(r, name, short); } catch (err) { v.fb = failed(err); }
          v.busy = false;
          // A game without Client.Tickets.Message pushes nothing back: read the thread again.
          if (r === 'command' && textOn(sid) && !mu.gmcp.seen(P, sid)) setTimeout(() => { if (myViewOf(sid).open === id) void requestThread(sid, id); }, 600);
          return r;
        };
        const back = h('button', { class: `${css.cmd} back`, type: 'button', 'data-testid': 'mytickets-back', 'data-focus': 'back', onclick: () => { v.open = null; v.fb = null; v.armed = false; draw(); } }, 'Back');
        fill(el,
          h('div', { class: 'hd' }, h('span', { class: 'tag glow-text' }, 'My tickets'), back),
          fbLine,
          h('div', { class: 'convo', 'data-testid': 'mytickets-thread' },
            h('div', { class: 'chead' }, h('span', { class: 'ctitle' }, t.subject || t.label || short),
              h('span', { class: 'cmeta' }, h('span', { class: 'ckind' }, `${t.label ?? t.kind ?? 'ticket'} ${short}`),
                t.status ? h('span', { class: plateCls(css.plate, t.status), 'data-testid': 'mytickets-status' }, statusWord(t.status)) : null,
                t.assignee ? h('span', { class: 'handler' }, 'Handler ', h('b', null, t.assignee)) : null,
                !closed && shows('mytickets', 'withdraw', sid) ? h('button', {
                  class: `${css.cmd} withdraw${v.armed ? ' armed' : ''}`, type: 'button', 'data-testid': 'mytickets-withdraw', 'data-focus': 'withdraw', disabled: v.busy,
                  onclick: async () => {
                    if (!v.armed) { v.armed = true; draw(); return; }
                    v.armed = false;
                    await go('withdraw');
                    draw();
                  },
                }, v.armed ? 'Confirm withdraw' : 'Withdraw') : null)),
            h('div', { class: 'msgs', role: 'log', 'aria-label': 'Conversation', 'data-testid': 'mytickets-msgs' },
              t.messages?.length ? t.messages.filter((x) => x.visibility !== 'internal').map((x) => {
                const o = originOf(x, t.requester_name);
                if (o === 'system') return h('div', { class: 'sys' }, x.ts !== undefined ? h('span', { class: 'mts' }, stamp(x.ts)) : null, ` ${x.text ?? ''}`);
                return h('div', { class: `m${o === 'player' ? ' me' : ' staffmsg'}` },
                  h('span', { class: 'who' }, h('span', { class: 's' }, x.sender ?? '?'),
                    o === 'staff' ? h('span', { class: `${css.plate} ${css.hot}` }, 'Staff') : h('span', { class: `${css.plate} ${css.dim}` }, 'You'),
                    x.ts !== undefined ? h('span', { class: 'mts' }, stamp(x.ts)) : null),
                  h('span', { class: 't' }, body(x, false)));
              })
                : h('p', { class: 'empty' }, closed ? 'No messages.' : 'No messages yet. Add one below.')),
            closed ? h('div', { class: 'closed-note', 'data-testid': 'mytickets-closed' }, 'This ticket is closed. Open a new one if you still need help.')
              : shows('mytickets', 'myreply', sid) ? h('form', {
                class: 'reply', onsubmit: async (e: Event) => {
                  e.preventDefault();
                  const input = (e.currentTarget as HTMLFormElement).querySelector('textarea')!;
                  const text = input.value.trim();
                  if (!text || v.busy) return;
                  input.value = ''; v.draft = '';
                  await go('myreply', text);
                  draw();
                },
              },
                replyArea({ class: css.field, 'aria-label': 'reply to staff', 'aria-describedby': 'mine-reply-keys', placeholder: 'Reply to staff', value: v.draft, 'data-testid': 'mytickets-reply', 'data-focus': 'reply', oninput: (e: Event) => { v.draft = (e.target as HTMLTextAreaElement).value; } }),
                h('span', { id: 'mine-reply-keys', class: 'sr-only' }, 'Enter sends. Shift+Enter starts a new line.'),
                h('div', { class: 'rkeys' }, h('button', { class: `${css.cmd} primary send`, type: 'submit', 'data-testid': 'mytickets-send', 'data-focus': 'send', disabled: v.busy }, 'Reply'))) : null,
          ),
        );
      };

      const drawList = (sid: string, m: MineState, v: MineView, fbLine: Child) => {
        const q = v.q.trim().toLowerCase();
        const list = v.closed ? m.closed : m.open;
        const waiting = (m.open ?? []).filter((t) => /^waiting$/i.test(t.status ?? '')).length;
        const rows = list === null ? null : list
          .filter((t) => matches(t, q) && (!v.waiting || v.closed || /^waiting$/i.test(t.status ?? '')))
          .map((t, i) => [t, i] as const)
          // Newest first by default; rows without a time keep the game's order.
          .sort(([a, i], [b, j]) => (v.newest ? epoch(b.updated) - epoch(a.updated) : epoch(a.updated) - epoch(b.updated)) || i - j)
          .map(([t]) => t);
        const tab = (closed: boolean, label: string) => h('button', {
          class: css.toggle, type: 'button', 'aria-pressed': String(v.closed === closed && !(closed === false && v.waiting)), 'data-testid': `mytickets-tab-${closed ? 'closed' : 'open'}`, 'data-focus': `tab-${closed}`,
          onclick: () => { v.closed = closed; v.waiting = false; v.fb = null; if ((closed ? m.closed : m.open) === null) void requestMine(sid, closed); draw(); },
        }, label);
        const compose = v.compose ? h('form', {
          class: 'compose', 'data-testid': 'mytickets-compose',
          onsubmit: async (e: Event) => {
            e.preventDefault();
            const subject = v.subject.trim(), text = v.details.trim();
            if (!text) { v.cerr = 'Say what you need help with.'; draw(); el.querySelector<HTMLTextAreaElement>('[data-testid=mytickets-details]')?.focus(); return; }
            v.busy = true; draw();
            try {
              const r = await run('mytickets', 'create', { subject: subject || text.slice(0, 60), text }, sid);
              v.fb = feedback(r, 'create', '');
              if (r !== 'none') { v.compose = false; v.subject = ''; v.details = ''; v.cerr = ''; setTimeout(() => void requestMine(sid, false), 600); }
            } catch (err) { v.fb = failed(err); }
            v.busy = false;
            draw();
          },
        },
          h('label', null, 'Subject', h('input', { class: css.field, type: 'text', maxlength: 120, value: v.subject, 'data-testid': 'mytickets-subject', 'data-focus': 'subject', oninput: (e: Event) => { v.subject = (e.target as HTMLInputElement).value; } })),
          h('label', null, 'Details', h('textarea', { class: css.field, rows: 5, value: v.details, 'data-testid': 'mytickets-details', 'data-focus': 'details', oninput: (e: Event) => { v.details = (e.target as HTMLTextAreaElement).value; if (v.cerr) { v.cerr = ''; } } })),
          v.cerr ? h('p', { class: 'err-line', role: 'alert', 'data-testid': 'mytickets-compose-error' }, v.cerr) : null,
          h('p', { class: 'chint' }, ...hint('Bugs: `@bug`. Harassment: `@report`.')),
          h('div', { class: 'rkeys' },
            h('button', { class: css.cmd, type: 'button', 'data-focus': 'compose-cancel', onclick: () => { v.compose = false; v.cerr = ''; draw(); } }, 'Cancel'),
            h('button', { class: `${css.cmd} primary send`, type: 'submit', 'data-testid': 'mytickets-create', 'data-focus': 'create', disabled: v.busy }, 'Send')),
        ) : null;
        fill(el,
          h('div', { class: 'hd' }, h('span', { class: 'tag glow-text' }, 'My tickets'), tab(false, 'Open'), tab(true, 'Closed'),
            rows?.length ? h('span', { class: 'count' }, String(rows.length)) : null,
            shows('mytickets', 'create', sid) ? h('button', { class: `${css.cmd} new`, type: 'button', 'aria-expanded': String(v.compose), 'data-testid': 'mytickets-new', 'data-focus': 'new', onclick: () => { v.compose = !v.compose; draw(); if (v.compose) el.querySelector<HTMLInputElement>('[data-testid=mytickets-subject]')?.focus(); } }, 'New') : null),
          fbLine,
          compose,
          // Search, Waiting and sort earn their place on a longer list (a short one stays one Tab from its rows).
          list && (list.length > 3 || q || v.waiting || !v.newest) ? h('div', { class: 'tools' },
            h('input', {
              class: `${css.field} search`, type: 'search', placeholder: 'Search', 'aria-label': 'Search your tickets', value: v.q, 'data-testid': 'mytickets-search', 'data-focus': 'search',
              oninput: (e: Event) => {
                v.q = (e.target as HTMLInputElement).value;
                if (mineSearchTimer) clearTimeout(mineSearchTimer);
                mineSearchTimer = setTimeout(() => { mineSearchTimer = null; draw(); }, 250);
              },
            }),
            h('div', { class: 'fl' },
              v.closed ? null : h('button', {
                class: `${css.toggle} waiting`, type: 'button', 'aria-pressed': String(v.waiting), 'data-testid': 'mytickets-waiting', 'data-focus': 'waiting',
                onclick: () => { v.waiting = !v.waiting; draw(); },
              }, 'Waiting on you', waiting ? h('span', { class: css.count }, String(waiting)) : null),
              h('button', {
                class: `${css.cmd} sort`, type: 'button', title: v.newest ? 'Sort: newest first' : 'Sort: oldest first', 'data-testid': 'mytickets-sort', 'data-focus': 'sort',
                onclick: () => { v.newest = !v.newest; draw(); },
              }, v.newest ? 'Newest' : 'Oldest'))) : null,
          h('div', { class: 'list', 'data-testid': 'mytickets-list' },
            m.error ? h('p', { class: 'empty err', role: 'alert', 'data-testid': 'mytickets-error' }, 'Could not load tickets.',
              h('button', { class: `${css.cmd} retry`, type: 'button', 'data-focus': 'retry', onclick: () => { void requestMine(sid, v.closed); draw(); } }, 'Try again'))
            : rows === null ? h('p', { class: 'empty' }, 'Loading')
            : rows.length ? rows.map((t) => {
              const fresh = unseen(sid, t);
              return h('button', {
                class: `${css.row} row${fresh ? ` ${css.hot}` : ''}`, type: 'button', 'data-id': t.id, 'data-kind': t.kind ?? '', 'data-focus': `row-${t.id}`,
                onclick: () => { v.open = t.id; v.fb = null; v.armed = false; v.compose = false; markRead(sid, t); draw(); void requestThread(sid, t.id); },
              }, h('span', { class: 'r1' }, h('span', { class: 'kind' }, t.label ?? t.kind ?? 'ticket'), h('span', { class: 'id' }, t.short_id ?? ''),
                t.status ? h('span', { class: plateCls(css.plate, t.status) }, statusWord(t.status)) : null,
                fresh ? h('span', { class: 'sr-only' }, 'New.') : null,
                h('span', { class: 'age' }, age(t.age_mins, t.updated))),
                t.subject ? h('span', { class: 'subject' }, t.subject) : null,
                t.preview ? h('span', { class: 'prev' }, t.preview) : null);
            })
            : q || v.waiting ? h('p', { class: 'empty', 'data-testid': 'mytickets-empty' }, 'Nothing matches.')
            : h('p', { class: 'empty', 'data-testid': 'mytickets-empty' }, ...hint(option('mytickets', 'emptyHint', sid, '') || DEFAULT_HINT)),
            m.partial && rows?.length ? h('p', { class: 'empty', 'data-testid': 'mytickets-partial' }, 'The game stopped answering; the list may be incomplete.') : null,
          ),
        );
      };
      redraws.add(draw);
      const off = mu.sessions.on('switch', () => draw());
      const sid = sidOf();
      if (sid && M(sid).open === null) void requestMine(sid, false);
      draw();
      return () => { redraws.delete(draw); off(); track(null, null); el.replaceChildren(); };
    }

    mu.panels.register({ id: 'tickets', title: 'Tickets', singleton: true, defaultPosition: 'right-bottom', show: 'auto', role: 'staff', mount: (el, pc) => mountTickets(el, pc, 'tickets') });
    mu.panels.register({ id: 'mytickets', title: 'My tickets', singleton: true, defaultPosition: 'right-bottom', show: 'always', mount: (el, pc) => mountMine(el, pc) });
    ctx.subscriptions.push(mu.settings.watch('tickets.rich', () => redraw()), mu.settings.watch('mytickets.emptyHint', () => redraw()));
    // The Show panel rows (`<panel>.enabled`) are the host's, defined by panels.register: watch them only now.
    for (const k of ['tickets', 'mytickets'] as const) {
      try { ctx.subscriptions.push(mu.settings.watch(`${k}.enabled`, () => { syncSupports(); redraw(); })); } catch { /* a host without the row */ }
    }
    syncSupports();

    // ─── the API ─────────────────────────────────────────────────────────────────────────────
    const configure = (k: Mod, cfg: ModuleConfig, worldId?: string | null) => {
      const set = (key: string, val: unknown) => mu.settings.set(`${k}.${key}`, val, worldId);
      for (const a of Object.keys(cfg.actions ?? {})) if (!ACTIONS[k][a]) throw new Error(`${TITLES[k]}: no action "${a}"`);
      if (cfg.enabled) set('enabled', cfg.enabled);
      if (cfg.source) set('source', cfg.source);
      for (const [a, c] of Object.entries(cfg.actions ?? {})) {
        if (c.via) set(`action.${a}.via`, c.via);
        if (c.cmd !== undefined) set(`action.${a}.cmd`, c.cmd);
      }
      for (const [o, val] of Object.entries(cfg.options ?? {})) set(o, val);
      syncSupports();
      redraw();
    };
    const onAction = (k: Mod, a: string, fn: ActionHandler, track: (d: Dispose) => Dispose) => {
      if (!ACTIONS[k][a]) throw new Error(`${TITLES[k]}: no action "${a}"`);
      const off = addTo(handlers, actionId(k, a), fn);
      redraw();
      return track(() => { off(); redraw(); });
    };
    const onRequest = (k: Mod, kind: string, fn: RequestHandler, track: (d: Dispose) => Dispose) => track(addTo(requests, `${k}\u0000${kind.toLowerCase()}`, fn));
    const enable = (k: Mod, mode: Mode, w?: string | null) => configure(k, { enabled: mode }, w);

    const makeApi = (track: (d: Dispose) => Dispose): TicketsApi => {
      const mineApi: MyTicketsApi = {
        enable: (mode, w) => enable('mytickets', mode, w),
        open: () => mu.panels.open('mytickets'),
        onAction: (a, fn) => onAction('mytickets', a, fn, track),
        onRequest: (kind, fn) => onRequest('mytickets', kind, fn, track),
        configure: (cfg, w) => configure('mytickets', cfg, w),
        set(what: 'mine' | 'thread', data: any, sid?: string) {
          const s = need(sid);
          if (!acceptsApi('mytickets', s)) return;
          if (what === 'mine') setMine(s, data.tickets ?? [], !!data.closed); else setMyThread(s, data);
        },
        push: (_w, m, sid) => pushMessage(need(sid), m),
        error: (sid) => { const s = need(sid); M(s).error = true; redraw(); },
        get: (_w, closed, sid) => [...((closed ? M(need(sid)).closed : M(need(sid)).open) ?? [])],
      };
      return {
        enable: (mode, w) => enable('tickets', mode, w),
        open: () => mu.panels.open('tickets'),
        onAction: (a, fn) => onAction('tickets', a, fn, track),
        onRequest: (kind, fn) => onRequest('tickets', kind, fn, track),
        configure: (cfg, w) => configure('tickets', cfg, w),
        setRole: (role, sid) => setRole(need(sid), role === 'staff'),
        set(what, data, sid) {
          const s = need(sid);
          if (!acceptsApi('tickets', s)) return;
          if (what === 'inbox') setInbox(s, data.tickets ?? []); else setHistory(s, data.tickets ?? []);
        },
        upsert(_w, t, sid) {
          const s = need(sid), st = S(s), id = String(t.id);
          const n = { ...t, id };
          if (!upsertIn(st.inbox, n) && !upsertIn(st.history, n)) st.inbox.push(norm(n as Ticket));
          const th = st.threads.get(id);
          if (th) Object.assign(th, n);
          mu.panels.touch('tickets', s);
          redraw();
        },
        remove(_w, id, sid) { const st = S(need(sid)); st.inbox = st.inbox.filter((t) => t.id !== String(id)); if (st.history) st.history = st.history.filter((t) => t.id !== String(id)); st.fresh.delete(String(id)); badges(need(sid)); redraw(); },
        push: (_w, m, sid) => pushMessage(need(sid), m),
        alert: (a) => alert(a),
        get(what: 'inbox' | 'history' | 'thread', a?: string, b?: string): any {
          if (what === 'thread') return S(need(b)).threads.get(String(a));
          const st = S(need(a));
          return [...(what === 'inbox' ? st.inbox : st.history ?? [])];
        },
        instance(opts) {
          const kinds = opts.filter?.kind === undefined ? undefined : ([] as string[]).concat(opts.filter.kind);
          return track(mu.panels.register({ id: opts.id, title: opts.title, singleton: true, defaultPosition: 'right-bottom', show: 'auto', role: 'staff', mount: (el, pc) => mountTickets(el, pc, opts.id, kinds) }));
        },
        mine: mineApi,
      };
    };
    // Each consuming extension gets an API whose handlers and panels go when it is disabled.
    ctx.exports((caller) => makeApi((d) => caller.track(d)));
    // For hosts that read activate's return value.
    return makeApi((d) => d);
  },
});
