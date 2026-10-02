# Changelog

## 2.0.1

- The read marks (`seen.tickets`, `seen.mine`) are declared in `contributes.storage.world`. The host now loads the synced world tier before activating, so after a reload a ticket that was already seen is not toasted again, and old tickets are not counted as unread.

## 2.0.0

Needs μClient with extension API 1.12 or later.

**Breaking**
- The panels use μClient's own Show panel row and staff gate. Tickets appears for sessions whose character is staff, and in `auto` mode once the game has sent tickets. My tickets is always offered. The Show panel setting is the same key as before, so what you chose carries over. What changes is where the panel is listed: it no longer appears in Views for sessions that are not staff.
- The game's `Client.Tickets.*` packages are now checked by μClient against the published schemas (`schema/`) before the extension sees them. A package that does not match is dropped with one line in the session, as before.
- `ActionSession.gmcp()` in action handlers can resolve to `'reserved'` (another client is already asking).

**Tickets (staff)**
- The queue is ordered by priority, then by the longest-waiting ticket, and ages count from the ticket's last activity when the game sends it (`updated`).
- A **Show** row above the list offers All / Needs reply / On player / Unclaimed, each with a count. It is one Tab stop; the arrow keys move the choice.
- A search box for the open queue (it filters as you type) and for the record. History searches go to the game.
- **Deny** with an empty reply now asks for the reason first ("Reason (the player sees it)"), and Escape cancels. Deny with text in the reply box still sends at once.
- Tickets the game marks `approvable` show Approve / Deny. Ones marked not approvable show Resolve. A closed ticket offers **Reopen**.
- The bug report shows the character, the traceback's command and time, and the character state. When there is none it says "No detailed bug report attached."
- Toasts for a new ticket ("New bug #31", with who and what) and for a player replying on a ticket you claimed ("Player replied: …"). None fire for the thread you have open. Each toast has an Open button.
- The tab shows a badge with the number of tickets you have not opened yet.
- When the game shows you a ticket, the Tickets panel opens on it. New setting **Open the panel when the game shows a ticket** (on).
- Message times are shown on every message.

**My tickets**
- Status reads as words: "with staff", "waiting on you". The handler is named in the thread, and the thread shows Staff / You plates.
- **New** opens a form (Subject, Details) that files a request. An empty request says "Say what you need help with."
- **Withdraw** an open ticket; it needs a second press ("Confirm withdraw").
- A "Staff replied" toast, a mark on tickets with news, and a badge with how many there are. Opening a ticket clears its mark.
- On a longer list: search, "Waiting on you" with a count, and Newest / Oldest order.
- Without GMCP, when the game stops answering partway through `@tickets`, the rows read so far stay, with a note that the list may be incomplete. Your own output during the read stays in the terminal.

## 1.2.1

- Fix: 1.2.0 failed to activate ("Cannot access 'settle' before initialization") in a session where `Client.Tickets.Mine` had already arrived, because the replay of stored packages ran before the text bridge was set up. Do not install 1.2.0.

## 1.2.0

- **My tickets works on games without `Client.Tickets` GMCP** (Underspire's telnet port is one: it never sends the package, so the panel sat on "Loading" and, in `auto` mode, never appeared in Views). A text bridge asks `@tickets` / `@ticket <id>` when a GMCP request goes unanswered for 1.5 s or GMCP cannot be sent, walks the menu, parses the rows and threads (`src/text.ts`) and gags what it caused. New My tickets setting **Read @tickets output** (default on). Unit tests over the captured output in `tests/`.
- **My tickets defaults to `on`**, so it is in Views as soon as the extension is enabled for a world, as Underspire lists My Tickets for every player. Tickets (the staff queue) keeps `auto` and the staff gate.
- The player reply command is `@ticket {id} = {text}` (was `{short_id}`: Underspire rejects `#id`). After a reply sent as a command the thread is re-read.

## 1.1.1

- Its own repository, [runmu-sh/ext-tickets](https://github.com/runmu-sh/ext-tickets), made with `npm create @runmu.sh/extension` and published to the marketplace from its version tags. The package is `@runmu.sh/ext-tickets`, built against `@runmu.sh/sdk` from npm. Nothing changes in the extension itself.

## 1.1.0

- Published to the marketplace as `tickets`; no longer bundled with μClient (install it from Extensions → Discover).

## 1.0.0

- Tickets and My tickets as a first-party extension (06-world-modules §2–§3), with the exported `TicketsApi`.
