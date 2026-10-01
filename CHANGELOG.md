# Changelog

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
