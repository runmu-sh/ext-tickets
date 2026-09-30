/**
 * The public types of @runmu.sh/ext-tickets (06-world-modules §2, §3, §6). Import them in another
 * extension with `import type { TicketsApi } from '@runmu.sh/ext-tickets/types'` and get the API with
 * `await ctx.api<TicketsApi>('@runmu.sh/ext-tickets')`.
 */
import type { Dispose } from '@muclient/sdk';

/** A thread message. `origin` (optional) says who wrote it and only picks the look: staff messages take the accent rule. */
export interface Message { text?: string; html?: string; sender?: string; visibility?: 'public' | 'internal'; origin?: 'staff' | 'player' | 'system'; platform?: string; ts?: number | string }
export interface Bug { reporter?: string; location?: string; last_cmd?: string; traceback?: string; char_state?: string }
export interface Ticket {
  id: string; short_id?: string; kind?: string; label?: string;
  status?: 'open' | 'claimed' | 'resolved' | 'closed' | string;
  priority?: 0 | 1 | 2 | 3 | 4; subject?: string; requester_name?: string; account_name?: string; assignee?: string;
  age_mins?: number; preview?: string; context?: Record<string, string>; messages?: Message[]; bug?: Bug;
}
export type Mode = 'off' | 'auto' | 'on';
export type Via = 'command' | 'gmcp' | 'ext' | 'none';
export interface ActionSession { sid: string; worldId: string; character: string; send(cmd: string): Promise<void>; gmcp(pkg: string, data?: unknown): Promise<boolean> }
/** What an action handler gets: the ticket's `id` and `short_id`, and `text` / `internal` for replies. */
export interface ActionArgs { action: string; id: string; short_id: string; text?: string; internal?: string; [k: string]: string | undefined }
/** Return true to mark the action handled (the configured action is skipped). */
export type ActionHandler = (args: ActionArgs, s: ActionSession) => boolean | void | Promise<boolean | void>;
export type RequestHandler = (args: Record<string, unknown>, s: ActionSession) => void | Promise<void>;

export interface ModuleConfig {
  enabled?: Mode;
  source?: 'gmcp' | 'api' | 'both';
  actions?: Record<string, { via?: Via; cmd?: string }>;
  options?: Record<string, unknown>;
}

/** The shared surface of Tickets and My tickets. `sid` defaults to the active session. */
export interface ModuleApi {
  /** 'off' | 'auto' | 'on' for the current world (or `worldId`). */
  enable(mode: Mode, worldId?: string | null): void;
  /** Focus the panel, adding it when missing. */
  open(): void;
  onAction(action: string, fn: ActionHandler): Dispose;
  onRequest(kind: string, fn: RequestHandler): Dispose;
  configure(cfg: ModuleConfig, worldId?: string | null): void;
}

export interface TicketsApi extends ModuleApi {
  setRole(role: 'staff' | 'player', sid?: string): void;
  /** Replace a list, same shape as Client.Tickets.Inbox / .History. */
  set(what: 'inbox' | 'history', data: { tickets: Ticket[] }, sid?: string): void;
  /** Merge into a ticket (inbox, history and open threads); unknown ids are added to the inbox. */
  upsert(what: 'ticket', t: Partial<Ticket> & { id: string }, sid?: string): void;
  remove(what: 'ticket', id: string, sid?: string): void;
  /** Append to a thread, same shape as Client.Tickets.Message. */
  push(what: 'message', m: { id: string; status?: string; message: Message }, sid?: string): void;
  alert(a: { label?: string; who?: string; age_mins?: number }, sid?: string): void;
  get(what: 'inbox' | 'history', sid?: string): readonly Ticket[];
  get(what: 'thread', id: string, sid?: string): Ticket | undefined;
  /** Another panel over the same data, with a kind filter (06 §6 Instances). */
  instance(opts: { id: string; title: string; filter?: { kind?: string | string[] } }): Dispose;
  /** The player's view (My tickets). */
  mine: MyTicketsApi;
}

export interface MyTicketsApi extends ModuleApi {
  /** Same shape as Client.Tickets.Mine. */
  set(what: 'mine', data: { tickets: Ticket[]; closed?: boolean }, sid?: string): void;
  set(what: 'thread', t: Ticket, sid?: string): void;
  push(what: 'message', m: { id: string; status?: string; message: Message }, sid?: string): void;
  /** Show "Could not load tickets." with Try again. */
  error(sid?: string): void;
  get(what: 'mine', closed?: boolean, sid?: string): readonly Ticket[];
}
