# Tickets + My tickets (`@runmu.sh/ext-tickets`, id `tickets`)

First-party extension on the **marketplace** (`tickets`): install it from Extensions → Discover, then turn it on per world under Installed. It is not bundled with μClient since 2026-09-30. It carries two modules (06-world-modules §2–§3, R-MOD-TICKETS, R-MOD-MYTICKETS):

- **Tickets** (`tickets` panel): the staff queue.
- **My tickets** (`mytickets` panel): a player's own tickets.

## Enabling and settings
The Extensions view lists **Tickets**; use *this world* to switch it on. Its **Settings** button opens *Settings → Extensions → Tickets*, a sub-page with no hub tile of its own. It has these settings per module:

- **Show panel**: `off`, `auto` (the panel appears in Views when the game first sends data or when the role is staff), or `on`. Tickets defaults to `auto` (and stays out of Views until `Client.Tickets.Role {staff:true}`); My tickets defaults to `on`, as Underspire lists My Tickets for every player.
- **Driven by**: `gmcp`, `api` or `both`.
- One *via* and one *command* row per action. `via` is `command`, `gmcp`, `ext` or `none`. Commands are templates such as `@ticket {short_id}`, where a `[… {text}]` segment is dropped when its placeholder is empty.
- The world-scoped **empty hint** for My tickets.
- **Read @tickets output** (My tickets, on by default): the text bridge below.

While a module is on, `Core.Supports.Add ["Client.Tickets 1"]` goes to every connected session of the world, and `Remove` follows once both modules are off.

## GMCP contract
Server → client:
| Package | Payload |
|---|---|
| `Client.Tickets.Role` | `{ "staff": true }` |
| `Client.Tickets.Inbox` | `{ "tickets": [Ticket] }`: the whole open list. Ids not seen before toast once, and the seen marks survive a reload. |
| `Client.Tickets.History` | `{ "tickets": [Ticket] }` |
| `Client.Tickets.Thread` | `Ticket` with `messages` (and optionally `bug`) |
| `Client.Tickets.Message` | `{ "id", "status"?, "message": Message }` |
| `Client.Tickets.Alert` | `{ "label", "who", "age_mins" }`: a toast |
| `Client.Tickets.BugDetail` | `{ "id", "bug": Bug }` |
| `Client.Tickets.Mine` | `{ "tickets": [Ticket], "closed": bool }` (My tickets) |
| `Client.Tickets.MyThread` | `Ticket` (My tickets) |

Client → server (data requests, and actions whose `via` is `gmcp`): `Client.Tickets.Get {id}`, `.List {history:true}`, `.BugDetail {id}`, `.Mine {closed}`, `.MyGet {id}`, `.Action {action,id,text?,internal?}`.

A malformed package is dropped with one line in the session, `session.error: Client.Tickets.Inbox rejected by Tickets: $.tickets: expected array, got string`, and the extension keeps running. Types are in `src/types.ts` (`Ticket`, `Message`, `Bug`). `html` is sanitised with an allow-list.

Default actions:
| Action | Command |
|---|---|
| open | `@ticket {short_id}` |
| claim | `@claim {short_id}` |
| resolve | `@resolve {short_id}` |
| approve | `@approve {short_id}[ = {text}]` |
| deny | `@deny {short_id}[ = {text}]` |
| reply | `@ticket {short_id} = {text}` |
| myreply | `@ticket {short_id} = {text}` |

## Without GMCP: the text bridge (1.2)
Underspire's telnet port (and any game built the same way) sends no `Client.Tickets.*` at all; its tickets live in text: `@tickets` opens an interactive menu (`N:` rows, `f` toggles the finished list, `n`/`p` page, `q` quits) and `@ticket <id>` prints one thread. My tickets covers that itself. When `Client.Tickets.Mine` or `.MyGet` goes unanswered for 1.5 s (or GMCP cannot be sent at all) it types the command, walks the menu, parses the rows or the thread, and gags every line it caused, its own echoes included. A line it does not recognise is left in the terminal, so a game with another format loses nothing. It maps `Bug Report`/`Puppet Request`/`Player Request`/`Chargen Application` to the kinds `bug`/`puppet`/`request`/`chargen`, `with staff` to `pending`, `waiting on you` to `waiting`, and `2d`/`3h`/`12m` ages to minutes. The player reply is `@ticket {id} = {text}` (the bare id; Underspire rejects `#id`), and after a reply sent as a command the thread is re-read. Switch it off with **Read @tickets output**. The parsers are in `src/text.ts`, with tests over captured output in `tests/`.

The staff queue has no text bridge: Underspire's staff commands were not captured. Drive it through the API instead (§ below), or ask the game for GMCP.

## API (`ctx.api('tickets')`, types `@runmu.sh/ext-tickets/types`)
```ts
const t = await ctx.api<TicketsApi>('tickets');
t.enable('on');                                   // this world; enable(mode, null) for all worlds
t.set('inbox', { tickets: [...] });               // drive it without GMCP (source api|both)
t.onAction('claim', (a) => { log(a.short_id); return true; }); // true = the command is not sent
t.onRequest('history', (a, s) => s.send('@tickets/history')); // replaces the Client.Tickets.List request
t.get('thread', '12');  t.instance({ id: 'builds', title: 'Build requests', filter: { kind: 'build' } });
t.mine.set('mine', { tickets: [...] });  t.mine.error();   // My tickets
```
Every registration returns a disposer and is also released when the calling extension is disabled.

## What it looks like (screenshots by description)
Drawn with the host's terminal primitives from `mu.ui.css` (SDK 1.5; 06-world-modules §1a). Needs SDK ^1.5.
- **Tickets inbox.** TICKETS over an accent rule, then OPEN and HISTORY toggles and a gold count on the right. Below that, a kind toggle for each kind. Ticket rows are flat `.sh-row` lines with a ▸ marker that lights on hover, on focus and on a ticket not seen before. Each row has the kind label in the kind's colour (bug alert, puppet gold, report fg) with the short id faint, priority pips, assignee, a status plate (open hot, claimed gold, resolved dim) and the age. The requester is in gold, above the subject and a dim one-line preview. An empty inbox shows NO OPEN TICKETS., faint and uppercase.
- **Ticket thread.** `[ BACK ]` at the top right. Next comes the petitioner, with a sub-line of account, status plate and assignee, then `[ CLAIM ] [ APPROVE ] [ DENY ] [ RESOLVE ]`. After that are the context keys and `[ REPORT DETAIL ]`, which expands to reporter, location, last cmd and the traceback/state `<pre>`. Each message has a left rule: accent for staff, dashed with a `(NOTE)` tag for an internal note, and a gold PLAYER plate on the player's lines. The reply is a textarea with a NOTE switch (Enter sends, Shift+Enter starts a new line). A feedback line such as `Claimed #12.` appears under the header after an action.
- **My tickets.** OPEN and CLOSED toggles over the rows. When there are none, it shows the per-world hint as an uppercase label, with `@request …` kept in gold as command references. A thread shows STAFF and YOU plates and ends in a boxed "Reply to staff" textarea with `[ REPLY ]`. When the ticket is closed it reads THIS TICKET IS CLOSED… instead.