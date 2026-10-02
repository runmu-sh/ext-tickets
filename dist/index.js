// src/index.ts
import { defineExtension } from "@muclient/sdk";

// src/css.ts
var R = '.ext-panel[data-ext="tickets"] .mx';
var PANEL_CSS = `
${R} { display: flex; flex-direction: column; height: 100%; min-height: 0; background: var(--bg-elev); color: var(--fg); font-size: 1rem; }
${R} button { font-family: inherit; cursor: pointer; }
${R} button:focus-visible, ${R} input:focus-visible, ${R} select:focus-visible, ${R} textarea:focus-visible { outline: 2px solid var(--accent-bright); outline-offset: -2px; }

${R} .hd { display: flex; align-items: center; gap: .6ch; padding: 5px 8px 5px 10px; border-bottom: 1px solid var(--accent); flex: 0 0 auto; min-height: 24px; }
${R} .tag { color: var(--accent-bright); text-transform: uppercase; letter-spacing: .2em; font-size: .74rem; margin-right: 1ch; }
${R} .hd .sub { color: var(--fg-dim); text-transform: uppercase; letter-spacing: .18em; font-size: .62rem; }
${R} .count { margin-left: auto; color: var(--gold); font-size: .66rem; letter-spacing: .1em; }
${R} .back, ${R} .hd .new { margin-left: auto; }
${R} .hd .count + .new { margin-left: 0; }

${R} .fb { margin: 0; padding: 4px 10px; font-size: .72rem; letter-spacing: .04em; color: var(--ok); border-bottom: 1px solid var(--border); flex: 0 0 auto; }
${R} .fb.err { color: var(--alert); }

${R} .filters { display: flex; flex-direction: column; align-items: stretch; gap: 4px; padding: 6px 10px; border-bottom: 1px solid var(--border); flex: 0 0 auto; }
${R} .fl { display: flex; flex-wrap: wrap; gap: 2px 6px; align-items: baseline; }
${R} .search { width: 100%; min-width: 0; font: inherit; font-size: .78rem; }
${R} .fl .sh-count { margin-left: .5ch; }
${R} .fl .sort { margin-left: auto; }

${R} .list { flex: 1; min-height: 0; overflow-y: auto; display: flex; flex-direction: column; }
${R} .r1 { display: flex; justify-content: space-between; align-items: baseline; gap: 1ch; min-width: 0; }
${R}.mine .r1 { justify-content: flex-start; }
${R} .kind { color: var(--accent-bright); text-transform: uppercase; letter-spacing: .12em; font-size: .68rem; }
${R} .row[data-kind=bug] .kind { color: var(--alert); }
${R} .row[data-kind=puppet] .kind { color: var(--gold); }
${R} .row[data-kind=report] .kind { color: var(--fg); }
${R} .sid, ${R} .id { color: var(--fg-faint); font-size: .62rem; letter-spacing: 0; }
${R}.mine .id { font-size: .64rem; }
${R} .meta { display: flex; align-items: baseline; gap: .8ch; flex: 0 0 auto; }
${R} .pri { color: var(--alert); font-size: .62rem; }
${R} .asg { color: var(--fg-dim); font-size: .6rem; letter-spacing: .1em; text-transform: uppercase; }
${R} .age { color: var(--fg-faint); font-size: .64rem; }
${R}.mine .age { margin-left: auto; }
${R} .row .who { color: var(--gold); font-size: .78rem; }
${R} .subject { color: var(--fg); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
${R}.mine .row.hot .subject { color: var(--gold); }
${R} .prev { color: var(--fg-dim); font-size: .74rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
${R}.mine .prev { font-size: .76rem; }

${R} .empty { color: var(--fg-faint); font-style: normal; padding: 12px 10px; margin: 0; font-size: .68rem; letter-spacing: .14em; text-transform: uppercase; line-height: 1.5; }
${R} .empty .cmdref { color: var(--gold); text-transform: none; letter-spacing: .04em; }
${R} .empty.err { color: var(--alert); }
${R} .empty .sh-cmd { margin-left: 1ch; }

${R} .convo { display: flex; flex-direction: column; min-height: 0; flex: 1; }
${R} .head { display: flex; align-items: flex-start; gap: 1ch; padding: 7px 10px; border-bottom: 1px solid var(--border); flex: 0 0 auto; }
${R} .petitioner { color: var(--gold); letter-spacing: .04em; font-size: .86rem; }
${R} .petitioner .sub { display: flex; flex-wrap: wrap; align-items: center; gap: .8ch; margin-top: 3px; color: var(--fg-dim); font-size: .7rem; letter-spacing: 0; }
${R} .acct { color: var(--fg-faint); }
${R} .actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 2px; margin-left: auto; }
${R} .ctx { padding: 6px 10px; border-bottom: 1px solid var(--border); display: flex; flex-direction: column; gap: 2px; flex: 0 0 auto; }
${R} .cx { font-size: .74rem; }
${R} .ck { color: var(--fg-faint); text-transform: uppercase; font-size: .6rem; letter-spacing: .14em; margin-right: .6ch; }
${R} .cv { color: var(--fg); }
${R} .dim { color: var(--fg-faint); }
${R} .loadbug { align-self: flex-start; margin: 3px 0 0 -.5ch; }
${R} .bug { padding: 6px 10px; border-bottom: 1px solid var(--border); display: flex; flex-direction: column; gap: 3px; }
${R} .bl { font-size: .74rem; color: var(--fg); }
${R} .tb { margin: 2px 0 4px; padding: 6px; background: var(--bg-deep); border: 0; border-left: 1px solid var(--border-bright); color: var(--fg-dim); font-size: .7rem; max-height: 180px; overflow: auto; white-space: pre-wrap; font-family: inherit; }
${R} .body { flex: 1; min-height: 0; overflow-y: auto; }

${R} .msgs { padding: 8px 10px; line-height: 1.5; display: flex; flex-direction: column; gap: 8px; flex: 1; min-height: 0; overflow-y: auto; }
${R}.mine .msgs { gap: 10px; }
${R} .body .msgs { overflow: visible; flex: none; }
${R} .m { padding-left: 1.5ch; border-left: 1px solid var(--border-bright); font-size: .85rem; }
${R}.mine .m { display: flex; flex-direction: column; gap: 2px; }
${R} .m.staffmsg { border-left-color: var(--accent); }
${R} .m.note { border-left-style: dashed; }
${R} .m .s { color: var(--accent-bright); margin-right: .6ch; text-decoration: none; }
${R}.mine .m .s { margin-right: 0; }
${R}.mine .m.me .s { color: var(--fg-dim); }
${R} .m .who { display: flex; align-items: baseline; gap: .8ch; }
${R} .m .sh-plate { margin-right: .6ch; }
${R}.mine .m .sh-plate { margin-right: 0; }
${R} .m .mts { color: var(--fg-faint); font-size: .64rem; margin-right: .6ch; }
${R} .m .t { display: block; color: var(--fg); white-space: pre-wrap; }
${R} .sys { color: var(--fg-faint); font-size: .64rem; letter-spacing: .12em; text-transform: uppercase; padding: 2px 0; }
${R} .sys::before { content: "-- " / ""; }
${R} .m.note .s::after { content: " (note)" / ""; color: var(--alert); font-size: .7em; letter-spacing: .1em; text-transform: uppercase; }

${R} .reply { display: flex; align-items: center; gap: .8rem; padding: 7px 10px; border-top: 1px solid var(--accent); flex: 0 0 auto; }
${R}.mine .reply { flex-direction: column; align-items: stretch; gap: 4px; }
${R} .int { color: var(--fg-dim); font-size: .6rem; letter-spacing: .14em; text-transform: uppercase; display: flex; align-items: center; gap: 4px; }
${R} .reply textarea, ${R} .compose textarea, ${R} .compose input { flex: 1; min-width: 0; color: var(--fg); font-family: inherit; font-size: .85rem; caret-color: var(--accent-bright); resize: vertical; }
${R}.tickets .reply textarea { background: transparent; border: 0; outline: none; padding: 0; min-height: 0; }
${R} .rkeys { display: flex; gap: 6px; align-items: center; }
${R} .rkeys .send { margin-left: auto; }
${R} .closed-note { padding: 7px 10px; border-top: 1px solid var(--border); color: var(--fg-faint); font-size: .64rem; letter-spacing: .14em; text-transform: uppercase; flex: 0 0 auto; }
${R} .chead { display: flex; flex-direction: column; gap: 4px; padding: 7px 10px; border-bottom: 1px solid var(--border); flex: 0 0 auto; }
${R} .ctitle { color: var(--gold); letter-spacing: .04em; font-size: .88rem; }
${R} .cmeta { display: flex; flex-wrap: wrap; align-items: center; gap: 1ch; }
${R} .ckind { color: var(--accent-bright); text-transform: uppercase; letter-spacing: .12em; font-size: .66rem; }
${R} .handler { color: var(--fg-dim); font-size: .7rem; }
${R} .handler b { color: var(--fg); font-weight: 500; }
${R} .sh-cmd.armed, ${R} .sh-cmd.armed:is(:hover, :focus-visible) { background: var(--alert); color: var(--bg-deep); }

${R} .compose { display: flex; flex-direction: column; gap: 6px; padding: 8px 10px; border-bottom: 1px solid var(--border); flex: 0 0 auto; }
${R} .compose label { display: flex; flex-direction: column; gap: 2px; color: var(--fg-faint); font-size: .6rem; letter-spacing: .14em; text-transform: uppercase; }
${R} .compose .rkeys .send { margin-left: auto; }
${R} .decide { display: flex; flex-wrap: wrap; align-items: center; justify-content: flex-end; gap: 4px .8ch; padding: 6px 10px; border-bottom: 1px solid var(--border); flex: 0 0 auto; }
${R} .decide input { flex: 1 1 100%; width: 100%; min-width: 0; box-sizing: border-box; font: inherit; font-size: .78rem; }
${R} .tools { display: flex; flex-direction: column; gap: 4px; padding: 6px 10px; border-bottom: 1px solid var(--border); flex: 0 0 auto; }
${R} .err-line { color: var(--alert); font-size: .72rem; }
${R} .chint { color: var(--fg-faint); font-size: .66rem; }
${R} .chint .cmdref { color: var(--gold); }
@media (max-width: 420px) { ${R} button, ${R} .sh-cmd, ${R} .sh-toggle { min-height: 32px; } }
`;

// src/dom.ts
function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props ?? {})) {
    if (v === void 0 || v === null || v === false) continue;
    if (k === "class") el.className = String(v);
    else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === "value") el.value = String(v);
    else if (k === "checked") el.checked = !!v;
    else if (k === "disabled") el.disabled = !!v;
    else el.setAttribute(k, v === true ? "" : String(v));
  }
  append(el, kids);
  return el;
}
function append(el, kids) {
  for (const c of kids) {
    if (c === null || c === void 0 || c === false) continue;
    if (Array.isArray(c)) append(el, c);
    else el.appendChild(typeof c === "string" || typeof c === "number" ? document.createTextNode(String(c)) : c);
  }
}
function fill(el, ...kids) {
  el.replaceChildren();
  append(el, kids);
}
var epochS = (ts) => {
  if (ts === void 0 || ts === null || ts === "") return NaN;
  const n = typeof ts === "number" ? ts : /^\d+(\.\d+)?$/.test(ts) ? +ts : Date.parse(ts) / 1e3;
  return n > 1e12 ? n / 1e3 : n;
};
function age(mins, updated) {
  const u = epochS(updated);
  const m = Number.isFinite(u) ? (Date.now() / 1e3 - u) / 60 : mins;
  if (m === void 0 || m === null || !Number.isFinite(+m)) return "";
  const n = Math.max(0, Math.floor(+m));
  if (Number.isFinite(u) && n < 1) return "now";
  if (n < 60) return `${n}m`;
  if (n < 60 * 24) return `${Math.floor(n / 60)}h`;
  return `${Math.floor(n / 1440)}d`;
}
var pad = (n) => String(n).padStart(2, "0");
function stamp(ts, always = false) {
  const s = epochS(ts);
  if (!Number.isFinite(s)) return "";
  const d = new Date(s * 1e3);
  const hm = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  return !always && d.toDateString() === (/* @__PURE__ */ new Date()).toDateString() ? hm : `${d.getMonth() + 1}/${d.getDate()} ${hm}`;
}
function plateOf(status) {
  const s = (status ?? "").toLowerCase();
  if (s === "open" || s === "pending") return "hot";
  if (s === "claimed" || s === "waiting") return "gold";
  if (s === "approved") return "ok";
  if (/^(resolved|closed|denied|withdrawn)$/.test(s)) return "dim";
  return "";
}
var plateCls = (base, status, ...extra) => [base, plateOf(status), ...extra].filter(Boolean).join(" ");
function hint(text) {
  return text.split(/(`[^`]+`)/).filter(Boolean).map((p) => p.startsWith("`") ? h("span", { class: "cmdref" }, p.slice(1, -1)) : h("span", null, p));
}
function replyArea(props) {
  const ta = h("textarea", { rows: 2, ...props });
  ta.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" || e.shiftKey || e.isComposing) return;
    e.preventDefault();
    (ta.form ?? ta.closest("form"))?.dispatchEvent(new Event("submit", { cancelable: true }));
  });
  return ta;
}

// src/text.ts
var ROW = /^\s*\d+: (.+?) #([0-9a-zA-Z]+) \((.+?) \. (\S+) \. (.*)\)\s*$/;
var LIST_HEAD = /^=== YOUR (OPEN|FINISHED|REQUESTS MATCHING)\b.* ===$/;
var THREAD_HEAD = /^\[(.+?) #([0-9a-zA-Z]+)\](?: (.*))?$/;
var THREAD_STATUS = /^\s*Status: (.+?) \. (?:updated|last activity) (\S+) ago\s*$/;
var MSG = /^\s*\[(\S+?)\] (.+?): (.*)$/;
var SYS = /^\s*\[(\S+?)\] -- (.*)$/;
var THREAD_END = /^\(Reply with @ticket /;
var THREAD_TAIL = /^\(Withdraw it with /;
var MENU_END = /^\s*q: Quit\s*$/;
var MENU_NEXT = /^\s*n: Next page\s*$/;
var MENU_NOISE = /^(Invalid option\. Try again\.|Choose a (finished )?request .*|Nothing of yours matches .*|Search your requests: .*)$/;
var NO_TICKET = /^(No ticket with that id\.|Usage: @ticket .*)$/;
function kindOf(label) {
  const l = label.toLowerCase();
  if (/\bbug\b/.test(l)) return "bug";
  if (/\bpuppet\b/.test(l)) return "puppet";
  if (/\bconduct\b|\breport\b/.test(l)) return "report";
  if (/\bchargen\b|\bapplication\b/.test(l)) return "chargen";
  return "request";
}
function statusOf(text) {
  const s = text.trim().toLowerCase();
  if (s === "with staff" || s === "pending" || s === "open") return "pending";
  if (s.startsWith("waiting")) return "waiting";
  if (s === "resolved") return "closed";
  return s.replace(/\s+/g, "_");
}
function ageMins(s) {
  const m = /^(\d+)([mhd])$/.exec(s.trim());
  if (!m) return s.trim() === "now" ? 0 : void 0;
  const n = +m[1];
  return m[2] === "d" ? n * 1440 : m[2] === "h" ? n * 60 : n;
}
function parseRow(line) {
  const m = ROW.exec(line);
  if (!m) return null;
  const [, label, id, status, age2, subject] = m;
  const t = { id, short_id: `#${id}`, kind: kindOf(label), label, status: statusOf(status), age_mins: ageMins(age2) };
  if (subject) t.subject = subject;
  return t;
}
var threadParse = () => ({ t: null, me: "", done: false, error: false });
function feedThread(p, line, me) {
  if (p.done) return THREAD_TAIL.test(line);
  if (!p.t) {
    if (NO_TICKET.test(line)) {
      p.error = true;
      p.done = true;
      return true;
    }
    const h2 = THREAD_HEAD.exec(line);
    if (!h2) return false;
    p.t = { id: h2[2], short_id: `#${h2[2]}`, kind: kindOf(h2[1]), label: h2[1], messages: [] };
    if (h2[3]) p.t.subject = h2[3];
    return true;
  }
  const t = p.t, msgs = t.messages;
  if (THREAD_END.test(line)) {
    p.done = true;
    finish(t, p.me || me);
    return true;
  }
  const st = THREAD_STATUS.exec(line);
  if (st && !msgs.length) {
    t.status = statusOf(st[1]);
    t.age_mins = ageMins(st[2]);
    return true;
  }
  const sys = SYS.exec(line);
  if (sys) {
    msgs.push({ origin: "system", text: sys[2], sender: "" });
    return true;
  }
  const m = MSG.exec(line);
  if (m) {
    let sender = m[2], origin;
    const tag = /^(.*?) \((you|staff)\)$/.exec(sender);
    if (tag) {
      sender = tag[1];
      origin = tag[2] === "you" ? "player" : "staff";
      if (tag[2] === "you") p.me = sender;
    }
    if (!origin) origin = sender === (p.me || me) ? "player" : void 0;
    const msg = { sender, text: m[3] };
    if (origin) msg.origin = origin;
    msgs.push(msg);
    return true;
  }
  const last = msgs[msgs.length - 1];
  if (last && last.origin !== "system") last.text = `${last.text ?? ""}
${line}`;
  return true;
}
function finish(t, me) {
  const msgs = t.messages ?? [];
  const requester = msgs.find((m) => m.origin === "player")?.sender || me || msgs.find((m) => m.origin !== "system")?.sender || "";
  for (const m of msgs) {
    if (m.text) m.text = m.text.replace(/\n+$/, "");
    if (!m.origin) m.origin = requester && m.sender === requester ? "player" : "staff";
  }
  if (requester && !t.requester_name) t.requester_name = requester;
}

// src/bridge.ts
var TEXT_TIMEOUT_MS = 6e3;
var MENU_LINE = /^\s*([a-z]|\d+): /;
var OPEN_STATUS = /^(pending|waiting|open|claimed)$/;
var MAX_PAGES = 20;
var isTimeout = (e) => !!e && typeof e === "object" && e.name === "RequestTimeout";
var why = (e) => e instanceof Error ? e.message : String(e);
function menuUntil(st) {
  return (line) => {
    const text = line.text.replace(/\s+$/, "");
    if (LIST_HEAD.test(text)) {
      st.sawList = true;
      st.phase = /FINISHED/.test(text) ? "finished" : "open";
      return "more";
    }
    if (!st.sawList) return MENU_NOISE.test(text) ? "more" : "skip";
    if (text === "" || MENU_NOISE.test(text)) return "more";
    const row = parseRow(text);
    if (row) {
      if (!st.rows.some((t) => t.id === row.id)) st.rows.push(row);
      return "more";
    }
    if (MENU_NEXT.test(text)) {
      st.hasNext = true;
      return "more";
    }
    if (MENU_END.test(text)) return "done";
    if (MENU_LINE.test(text)) return "more";
    return "skip";
  };
}
async function readMine(run, send, closed, timeoutMs = TEXT_TIMEOUT_MS) {
  const st = { rows: [], sawList: false, phase: "sent", hasNext: false };
  const until = menuUntil(st);
  const keep = (rows) => closed ? rows.filter((t) => !OPEN_STATUS.test(t.status ?? "")) : rows;
  const step = async (cmd) => {
    try {
      const got = await run(cmd, { until, timeoutMs });
      if (got === null) return { ok: false, rows: [], sawList: false, reason: "another client asked" };
      return null;
    } catch (e) {
      if (isTimeout(e)) {
        if (st.sawList) await send("q");
        return { ok: false, rows: keep(st.rows), sawList: st.sawList, partial: st.sawList, reason: "timeout" };
      }
      return { ok: false, rows: keep(st.rows), sawList: st.sawList, reason: why(e) };
    }
  };
  let r = await step("@tickets");
  if (r) return r;
  if (!st.sawList) return { ok: false, rows: [], sawList: false, reason: "no menu" };
  if (closed && st.phase === "open") {
    st.rows = [];
    st.hasNext = false;
    if (r = await step("f")) return r;
  }
  for (let i = 0; closed && st.hasNext && i < MAX_PAGES; i++) {
    st.hasNext = false;
    if (r = await step("n")) return r;
  }
  await send("q");
  return { ok: true, rows: keep(st.rows), sawList: true };
}
function threadUntil(p, me) {
  return (line) => {
    const text = line.text.replace(/\s+$/, "");
    if (!feedThread(p, text, me())) return "skip";
    if (p.error) return "done";
    if (!p.done) return "more";
    if (THREAD_TAIL.test(text)) return "done";
    return OPEN_STATUS.test(p.t?.status ?? "") ? "more" : "done";
  };
}
async function readThread(run, id, me, timeoutMs = TEXT_TIMEOUT_MS) {
  const p = threadParse();
  try {
    const got = await run(`@ticket ${id}`, { until: threadUntil(p, me), timeoutMs });
    if (got === null) return { ok: false, t: null, notFound: false, reason: "another client asked" };
  } catch (e) {
    const timeout = isTimeout(e);
    if (timeout && p.done && p.t && !p.error) return { ok: true, t: p.t, notFound: false };
    return { ok: false, t: p.t && !p.error ? p.t : null, notFound: p.error, partial: timeout && !!p.t, reason: timeout ? "timeout" : why(e) };
  }
  return { ok: !p.error && !!p.t, t: p.error ? null : p.t, notFound: p.error };
}

// src/index.ts
var P = "Client.Tickets";
var DEFAULT_HINT = "`@request subject = what you need`, `@bug` or `@puppetrequest` in the game to open one.";
var GMCP_GRACE_MS = 1500;
var act = (action) => (v) => [`${P}.Action`, { action, id: v.id, ...v.text ? { text: v.text } : {}, ...v.internal ? { internal: true } : {} }];
var T_ARGS = { short_id: { label: "Ticket" } };
var ACTIONS = {
  tickets: {
    open: { label: "Open", via: "command", cmd: "@ticket {short_id}", gmcp: (v) => [`${P}.Get`, { id: v.id }], args: T_ARGS },
    claim: { label: "Claim", via: "command", cmd: "@claim {short_id}", gmcp: act("claim"), args: T_ARGS },
    resolve: { label: "Resolve", via: "command", cmd: "@resolve {short_id}", gmcp: act("resolve"), args: T_ARGS },
    approve: { label: "Approve", via: "command", cmd: "@approve {short_id}[ = {text}]", gmcp: act("approve"), args: T_ARGS },
    deny: { label: "Deny", via: "command", cmd: "@deny {short_id}[ = {text}]", gmcp: act("deny"), args: T_ARGS },
    reply: { label: "Reply", via: "command", cmd: "@ticket {short_id} = {text}", gmcp: act("reply"), args: { ...T_ARGS, text: { label: "Reply" } } },
    reply_note: { label: "Reply (note)", via: "command", cmd: "", gmcp: (v) => act("reply")({ ...v, internal: "1" }) },
    reopen: { label: "Reopen", via: "gmcp", cmd: "", gmcp: act("reopen"), args: T_ARGS }
  },
  mytickets: {
    myreply: { label: "Reply", via: "command", cmd: "@ticket {id} = {text}", gmcp: act("reply"), args: { id: { label: "Ticket" }, text: { label: "Reply" } } },
    withdraw: { label: "Withdraw", via: "command", cmd: "@ticket/withdraw {id}", gmcp: act("withdraw"), args: { id: { label: "Ticket" } } },
    create: { label: "New request", via: "command", cmd: "@request {subject} = {text}", gmcp: (v) => [`${P}.Create`, { ...v.subject ? { subject: v.subject } : {}, text: v.text }], args: { subject: { label: "Subject" }, text: { label: "What you need" } } }
  }
};
var TITLES = { tickets: "Tickets", mytickets: "My tickets" };
function fillTemplate(tpl, vars) {
  const sub = (s) => s.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? "");
  return sub(tpl.replace(/\[([^\]]*)\]/g, (_, seg) => [...seg.matchAll(/\{(\w+)\}/g)].every((m) => (vars[m[1]] ?? "") !== "") ? seg : "")).trim();
}
var norm = (t) => ({ ...t, id: String(t.id), short_id: t.short_id ?? `#${t.id}` });
var isClosed = (s) => !!s && /^(closed|resolved|approved|denied|withdrawn)$/i.test(s);
var originOf = (m, requester) => m.origin ?? (m.sender && (m.sender === requester || /^you$/i.test(m.sender)) ? "player" : "staff");
var epoch = (u) => {
  const n = typeof u === "number" ? u : u ? /^\d+(\.\d+)?$/.test(u) ? +u : Date.parse(u) / 1e3 : 0;
  return n > 1e12 ? n / 1e3 : n || 0;
};
var queueOrder = (a, b) => (b.priority ?? 0) - (a.priority ?? 0) || epoch(a.updated) - epoch(b.updated);
var MINE_WORDS = { pending: "with staff", waiting: "waiting on you" };
var matches = (t, q) => !q || [t.short_id, t.subject, t.requester_name, t.account_name, t.preview, t.label, t.assignee, t.kind].some((v) => String(v ?? "").toLowerCase().includes(q));
var DONE = { claim: "Claimed", resolve: "Resolved", approve: "Approved", deny: "Denied", reply: "Reply sent", reply_note: "Note added", myreply: "Reply sent", reopen: "Reopened", withdraw: "Withdrawn", create: "Request sent" };
var feedback = (r, name, short) => r === "none" ? { ok: false, text: "That did not go through." } : { ok: true, text: `${DONE[name] ?? name} ${short}.`.replace(/ \.$/, ".") };
var failed = (e) => ({ ok: false, text: e instanceof Error ? e.message : String(e) });
var index_default = defineExtension({
  activate(ctx) {
    const mu = ctx.mu;
    const css = mu.ui.css;
    const staffOf = /* @__PURE__ */ new Map();
    const mineOf = /* @__PURE__ */ new Map();
    const S = (sid) => staffOf.get(sid) ?? staffOf.set(sid, { role: false, inbox: [], history: null, threads: /* @__PURE__ */ new Map(), fresh: /* @__PURE__ */ new Set(), identity: null }).get(sid);
    const M = (sid) => mineOf.get(sid) ?? mineOf.set(sid, { open: null, closed: null, threads: /* @__PURE__ */ new Map(), error: false, partial: false }).get(sid);
    const active = () => mu.sessions.active()?.id ?? null;
    const need = (sid) => {
      const s = sid ?? active();
      if (!s) throw new Error("no active session");
      return s;
    };
    const refOf = (sid) => sid ? mu.sessions.list().find((s) => s.id === sid) ?? null : null;
    const worldOf = (sid) => refOf(sid)?.worldId ?? null;
    const activeWorld = () => mu.sessions.active()?.worldId ?? null;
    mu.ui.style(PANEL_CSS);
    const SOURCE_OPTS = [{ value: "both", label: "gmcp + api" }, { value: "gmcp", label: "gmcp" }, { value: "api", label: "api" }];
    mu.settings.define({
      title: "Tickets",
      items: [
        { key: "tickets.source", label: "Driven by", default: "both", kind: "select", options: SOURCE_OPTS, group: "Tickets", scope: "world" },
        { key: "tickets.rich", label: "Rich text in messages", default: false, kind: "toggle", group: "Tickets", scope: "both" },
        { key: "tickets.autoOpen", label: "Open the panel when the game shows a ticket", default: true, kind: "toggle", group: "Tickets", scope: "both", hint: "as when you type @ticket <id>" },
        { key: "mytickets.source", label: "Driven by", default: "both", kind: "select", options: SOURCE_OPTS, group: "My tickets", scope: "world" },
        { key: "mytickets.emptyHint", label: "Empty-list hint", default: DEFAULT_HINT, kind: "text", hint: "wrap commands in `backticks`", group: "My tickets", scope: "both" },
        { key: "mytickets.text", label: "Read @tickets output", default: true, kind: "toggle", hint: "when the game has no Client.Tickets GMCP: ask with @tickets / @ticket <id>, parse the text and hide it", group: "My tickets", scope: "both" }
      ]
    });
    const get = (key, worldId, fallback) => {
      try {
        const v = mu.settings.get(key, worldId);
        return v === void 0 || v === null ? fallback : v;
      } catch {
        return fallback;
      }
    };
    const DEFAULT_MODE = { tickets: "auto", mytickets: "on" };
    const modeOf = (k, w = activeWorld()) => {
      const v = get(`${k}.enabled`, w, DEFAULT_MODE[k]);
      return v === "off" || v === "auto" ? v : "on";
    };
    const sourceOf = (k, w) => get(`${k}.source`, w, "both");
    const acceptsGmcp = (k, sid) => {
      const w = worldOf(sid);
      return modeOf(k, w) !== "off" && sourceOf(k, w) !== "api";
    };
    const acceptsApi = (k, sid) => {
      const w = worldOf(sid);
      return modeOf(k, w) !== "off" && sourceOf(k, w) !== "gmcp";
    };
    const option = (k, key, sid, fallback) => get(`${k}.${key}`, sid ? worldOf(sid) : activeWorld(), fallback);
    const textOn = (sid) => option("mytickets", "text", sid, true) !== false && sourceOf("mytickets", worldOf(sid)) !== "api";
    const handlers = /* @__PURE__ */ new Map();
    const requests = /* @__PURE__ */ new Map();
    const session = (sid) => ({
      sid,
      worldId: worldOf(sid) ?? "",
      character: refOf(sid)?.character ?? "",
      send: async (c) => {
        await mu.sessions.send(c, sid);
      },
      gmcp: (p, d) => mu.gmcp.send(p, d, sid)
    });
    const actionId = (k, name) => `${k}.${name}`;
    for (const k of ["tickets", "mytickets"]) {
      for (const [name, a] of Object.entries(ACTIONS[k])) {
        const id = actionId(k, name);
        mu.actions.define({ id, label: a.label, group: TITLES[k], via: a.via, command: a.cmd, gmcp: a.gmcp, ...a.args ? { args: a.args } : {}, when: "session" });
        mu.actions.handle(id, async (args, s) => {
          await run(k, name, args, s.sid);
          return true;
        });
      }
    }
    const viaOf = (k, name, sid) => {
      const v = get(`${k}.action.${name}.via`, worldOf(sid), ACTIONS[k][name]?.via ?? "command");
      return ["command", "gmcp", "ext", "none"].find((x) => x === v) ?? ACTIONS[k][name]?.via ?? "command";
    };
    const cmdOf = (k, name, sid) => get(`${k}.action.${name}.cmd`, worldOf(sid), ACTIONS[k][name]?.cmd ?? "");
    const run = async (k, name, vars, sid) => {
      const id = actionId(k, name);
      const args = { action: name, ...vars };
      for (const fn of [...handlers.get(id) ?? []]) {
        try {
          if (await fn(args, session(sid)) === true) return "ext";
        } catch (e) {
          mu.log.error(`action ${name} handler failed:`, e);
        }
      }
      const via = viaOf(k, name, sid);
      if (via === "none" || via === "ext") return "none";
      const def = ACTIONS[k][name];
      if (via === "gmcp" && def) {
        const [pkg, data] = def.gmcp(vars);
        if (await mu.gmcp.send(pkg, data, sid) === true) return "gmcp";
      }
      const line = fillTemplate(cmdOf(k, name, sid), vars);
      if (!line) return "none";
      await mu.sessions.send(line, sid);
      return "command";
    };
    const shows = (k, name, sid) => {
      if (!sid) return true;
      const via = viaOf(k, name, sid);
      if (via === "none") return false;
      if (via === "ext") return !!handlers.get(actionId(k, name))?.size;
      if (cmdOf(k, name, sid) || handlers.get(actionId(k, name))?.size) return true;
      return via === "gmcp" && mu.gmcp.seen(P, sid);
    };
    const addTo = (m, key, fn) => {
      const set = m.get(key) ?? m.set(key, /* @__PURE__ */ new Set()).get(key);
      set.add(fn);
      return () => {
        set.delete(fn);
      };
    };
    const dataRequest = async (k, kind, pkg, data, sid) => {
      const hs = [...requests.get(`${k}\0${kind}`) ?? []];
      if (hs.length) {
        for (const fn of hs) {
          try {
            await fn(data, session(sid));
          } catch (e) {
            mu.log.error(`request ${kind} handler failed:`, e);
          }
        }
        return true;
      }
      if (sourceOf(k, worldOf(sid)) === "api") return true;
      return await mu.gmcp.send(pkg, data, sid) === true;
    };
    const hasRequestHandler = (k, kind) => !!requests.get(`${k}\0${kind}`)?.size;
    const redraws = /* @__PURE__ */ new Set();
    const redraw = () => redraws.forEach((f) => f());
    const upsertIn = (list, t) => {
      if (!list) return false;
      const i = list.findIndex((x) => x.id === t.id);
      if (i >= 0) list[i] = { ...list[i], ...t };
      return i >= 0;
    };
    const isStaff = (sid) => S(sid).role || !!refOf(sid)?.roles?.includes("staff");
    const setRole = (sid, staff) => {
      const st = S(sid);
      st.role = staff;
      if (staff && !st.identity) st.identity = mu.sessions.provideIdentity(sid, { roles: ["staff"] });
      if (!staff && st.identity) {
        st.identity();
        st.identity = null;
      }
      redraw();
    };
    const seenStore = (sid) => mu.storage.world(worldOf(sid), { sync: true });
    const freshIds = (sid, ids) => {
      const store = seenStore(sid);
      const seen = new Set(store.get("seen.tickets", []));
      const out = ids.filter((id) => !seen.has(id));
      if (out.length) store.set("seen.tickets", [...seen, ...out].slice(-1e3));
      return out;
    };
    const readAt = (sid) => seenStore(sid).get("seen.mine", {}) ?? {};
    const unseen = (sid, t) => {
      const u = epoch(t.updated);
      if (!u || /^pending$/i.test(t.status ?? "")) return false;
      return u > (readAt(sid)[t.id] ?? 0);
    };
    const markRead = (sid, t) => {
      const u = epoch(t.updated) || Date.now() / 1e3;
      const all = readAt(sid);
      if ((all[t.id] ?? 0) >= u) return;
      const next = Object.fromEntries([...Object.entries(all), [t.id, u]].slice(-1e3));
      seenStore(sid).set("seen.mine", next);
      badges(sid);
    };
    const badges = (sid) => {
      const st = staffOf.get(sid);
      mu.panels.badge("tickets", st?.fresh.size ? { count: st.fresh.size } : null, sid);
      const n = (mineOf.get(sid)?.open ?? []).filter((t) => unseen(sid, t)).length;
      mu.panels.badge("mytickets", n ? { count: n } : null, sid);
    };
    const toast = (title, body2, run2) => mu.ui.toast(title, body2, { kind: "tickets", group: "tickets", ...run2 ? { action: { label: "Open", run: run2 } } : {} });
    const setInbox = (sid, list, replay = false) => {
      const st = S(sid);
      st.inbox = list.map(norm);
      const fresh = freshIds(sid, st.inbox.map((t) => t.id));
      for (const id of fresh) st.fresh.add(id);
      for (const id of [...st.fresh]) if (!st.inbox.some((t) => t.id === id)) st.fresh.delete(id);
      if (!replay) for (const t of st.inbox.filter((x) => fresh.includes(x.id))) {
        toast(`New ${t.kind ?? t.label ?? "ticket"} ${t.short_id}`, [t.requester_name, t.subject].filter(Boolean).join(": "), () => openStaff(sid, t.id));
      }
      mu.panels.touch("tickets", sid);
      badges(sid);
      redraw();
    };
    const setHistory = (sid, list) => {
      S(sid).history = list.map(norm);
      redraw();
    };
    const setThread = (sid, t) => {
      const n = norm(t), st = S(sid);
      st.threads.set(n.id, { ...st.threads.get(n.id), ...n });
      const { messages: _m, bug: _b, ...row } = n;
      upsertIn(st.inbox, row);
      upsertIn(st.history, row);
      redraw();
    };
    const setMine = (sid, list, closed) => {
      const m = M(sid);
      m.error = false;
      m.partial = false;
      if (closed) m.closed = list.map(norm);
      else m.open = list.map(norm);
      mu.panels.touch("mytickets", sid);
      badges(sid);
      redraw();
    };
    const setMyThread = (sid, t) => {
      const n = norm(t), m = M(sid);
      m.threads.set(n.id, { ...m.threads.get(n.id), ...n });
      const { messages: _m, bug: _b, ...row } = n;
      upsertIn(m.open, row);
      upsertIn(m.closed, row);
      m.error = false;
      if (myViewOf(sid).open === n.id) markRead(sid, m.threads.get(n.id));
      redraw();
    };
    const alert = (a) => toast(`Unclaimed ${a.label ?? "ticket"}`, [a.who, a.age_mins !== void 0 ? `waiting ${age(a.age_mins)}` : ""].filter(Boolean).join(" \xB7 "));
    const shown = /* @__PURE__ */ new Map();
    const isShown = (kind, sid, id) => !!shown.get(`${kind}\0${sid}`)?.has(id);
    const pushMessage = (sid, d, replay = false) => {
      const id = String(d.id);
      const patch = { id, ...d.status ? { status: d.status } : {}, ...d.updated !== void 0 ? { updated: d.updated } : {} };
      for (const map of [S(sid).threads, M(sid).threads]) {
        const t = map.get(id);
        if (!t) continue;
        t.messages = [...t.messages ?? [], d.message];
        Object.assign(t, patch);
      }
      upsertIn(S(sid).inbox, patch);
      upsertIn(S(sid).history, patch);
      upsertIn(M(sid).open, patch);
      upsertIn(M(sid).closed, patch);
      if (!replay) replied(sid, id, d.message);
      if (isShown("mine", sid, id)) {
        const t = M(sid).threads.get(id);
        if (t) markRead(sid, t);
      }
      badges(sid);
      redraw();
    };
    const replied = (sid, id, m) => {
      if (m.visibility === "internal") return;
      const mine = [...M(sid).open ?? [], ...M(sid).closed ?? []].find((t) => t.id === id) ?? M(sid).threads.get(id);
      const staffT = S(sid).threads.get(id) ?? S(sid).inbox.find((t) => t.id === id);
      const o = m.origin ?? (mine ? originOf(m, mine.requester_name) : staffT ? originOf(m, staffT.requester_name) : "staff");
      const body2 = `${m.sender ? `${m.sender}: ` : ""}${(m.text ?? "").slice(0, 140)}`;
      const toOwner = m.audience ? m.audience === "owner" : !!mine;
      if (toOwner && mine && o !== "player" && !isShown("mine", sid, id)) {
        const what = `${mine.short_id ?? `#${id}`}${mine.subject ? ` ${mine.subject}` : ""}`;
        toast(o === "system" ? `Ticket update: ${what}` : `Staff replied: ${what}`, body2, () => openMine(sid, id));
        return;
      }
      const me2 = refOf(sid)?.character ?? "";
      const toAssignee = m.audience ? m.audience === "assignee" : !!staffT && !!me2 && staffT.assignee === me2;
      if (toAssignee && staffT && o === "player" && !isShown("staff", sid, id)) {
        toast(`Player replied: ${staffT.short_id ?? `#${id}`}${staffT.subject ? ` ${staffT.subject}` : ""}`, body2, () => openStaff(sid, id));
      }
    };
    const views = /* @__PURE__ */ new Map();
    const viewOf = (key) => views.get(key) ?? views.set(key, { tab: "open", kinds: /* @__PURE__ */ new Set(), show: "all", q: "", hq: "", open: null, bug: false, draft: "", note: false, busy: false, fb: null }).get(key);
    const myViews = /* @__PURE__ */ new Map();
    const myViewOf = (sid) => myViews.get(sid) ?? myViews.set(sid, { closed: false, open: null, draft: "", fb: null, q: "", waiting: false, newest: true, compose: false, subject: "", details: "", cerr: "", armed: false, busy: false }).get(sid);
    const openStaff = (sid, id) => {
      const v = viewOf(`tickets\0${sid}`);
      if (v.open !== id) {
        v.open = id;
        v.bug = false;
        v.fb = null;
      }
      S(sid).fresh.delete(id);
      badges(sid);
      mu.panels.open("tickets", void 0, { sid });
      redraw();
    };
    const openMine = (sid, id) => {
      const v = myViewOf(sid);
      if (v.open !== id) {
        v.open = id;
        v.fb = null;
        v.armed = false;
        v.compose = false;
      }
      mu.panels.open("mytickets", void 0, { sid });
      if (!M(sid).threads.get(id)?.messages) void requestThread(sid, id);
      const t = M(sid).threads.get(id) ?? [...M(sid).open ?? [], ...M(sid).closed ?? []].find((x) => x.id === id);
      if (t) markRead(sid, t);
      redraw();
    };
    const autoOpen = (k, sid, id) => {
      if (option("tickets", "autoOpen", sid, true) === false) return;
      if (isShown(k === "tickets" ? "staff" : "mine", sid, id)) return;
      if (k === "tickets") openStaff(sid, id);
      else openMine(sid, id);
    };
    const handle = (pkg, data, sid, replay) => {
      const sub = pkg.slice(P.length + 1);
      const forMine = sub === "Mine" || sub === "MyThread";
      const k = forMine ? "mytickets" : "tickets";
      if (!acceptsGmcp(k, sid) && !(sub === "Message" && acceptsGmcp("mytickets", sid))) return;
      const d = data;
      switch (sub) {
        case "Role":
          setRole(sid, !!d.staff);
          break;
        case "Inbox":
          setInbox(sid, d.tickets, replay);
          break;
        case "History":
          setHistory(sid, d.tickets);
          break;
        case "Thread":
          setThread(sid, d);
          mu.panels.touch("tickets", sid);
          if (!replay) autoOpen("tickets", sid, String(d.id));
          break;
        case "Message":
          pushMessage(sid, d, replay);
          break;
        case "Alert":
          if (!replay && isStaff(sid)) alert(d);
          break;
        case "BugDetail": {
          const t = S(sid).threads.get(String(d.id));
          if (t) {
            t.bug = d.bug ?? { available: false };
            redraw();
          }
          break;
        }
        case "Mine":
          setMine(sid, d.tickets, !!d.closed);
          break;
        case "MyThread":
          setMyThread(sid, d);
          if (!replay) autoOpen("mytickets", sid, String(d.id));
          break;
      }
    };
    mu.gmcp.on(P, (data, meta) => handle(meta.pkg, data, meta.sid, !!meta.replay));
    let supported = null;
    const syncSupports = () => {
      const worlds = new Set(mu.sessions.list().map((s) => s.worldId));
      if (!worlds.size) worlds.add(activeWorld() ?? "");
      const want = [...worlds].some((w) => modeOf("tickets", w || null) !== "off" || modeOf("mytickets", w || null) !== "off");
      if (want && !supported) supported = mu.gmcp.supports([`${P} 1`]);
      if (!want && supported) {
        supported();
        supported = null;
      }
    };
    ctx.subscriptions.push(
      mu.sessions.on("open", () => syncSupports()),
      () => {
        supported?.();
        supported = null;
      }
    );
    syncSupports();
    const runner = (sid) => (text, o) => mu.sessions.request(text, { sid, raw: true, until: o.until, timeoutMs: o.timeoutMs });
    const sender = (sid) => (text) => mu.sessions.send(text, { sid, raw: true, echo: false });
    const me = (sid) => () => refOf(sid)?.character ?? "";
    const gmcpAnswers = async (sid, asked) => asked && (mu.gmcp.seen(P, sid) || await mu.gmcp.whenSeen(P, { sid, timeoutMs: GMCP_GRACE_MS }));
    const textJobs = /* @__PURE__ */ new Map();
    const once = (key, job) => {
      const had = textJobs.get(key);
      if (had) return had;
      const p = job().finally(() => textJobs.delete(key));
      textJobs.set(key, p);
      return p;
    };
    const requestMine = async (sid, closed) => {
      M(sid).error = false;
      const asked = await dataRequest("mytickets", "mine", `${P}.Mine`, { closed }, sid);
      if (hasRequestHandler("mytickets", "mine") || !textOn(sid) || await gmcpAnswers(sid, asked)) return;
      const state = M(sid);
      await once(`${sid}\0mine\0${closed}`, async () => {
        const r = await readMine(runner(sid), sender(sid), closed);
        if (mineOf.get(sid) !== state || !refOf(sid)) return;
        if (r.ok || r.sawList) {
          setMine(sid, r.rows, closed);
          M(sid).partial = !r.ok;
        } else if (r.reason !== "another client asked") M(sid).error = true;
        if (!r.ok) mu.log.warn(`@tickets: ${r.reason ?? "no answer"}${r.partial ? ` (kept ${r.rows.length} rows)` : ""}`);
        redraw();
      });
    };
    const requestThread = async (sid, id) => {
      const asked = await dataRequest("mytickets", "myget", `${P}.MyGet`, { id }, sid);
      if (hasRequestHandler("mytickets", "myget") || !textOn(sid) || await gmcpAnswers(sid, asked)) return;
      const state = M(sid);
      await once(`${sid}\0thread\0${id}`, async () => {
        const r = await readThread(runner(sid), id, me(sid));
        if (mineOf.get(sid) !== state || !refOf(sid)) return;
        if (r.t) setMyThread(sid, r.t);
        if (!r.ok) {
          const v = myViewOf(sid);
          if (v.open === id) v.fb = r.notFound ? { ok: false, text: `No ticket ${id}.` } : r.t ? null : { ok: false, text: "The game did not answer." };
          redraw();
        }
      });
    };
    ctx.subscriptions.push(mu.sessions.each((s) => () => {
      const st = staffOf.get(s.id);
      st?.identity?.();
      staffOf.delete(s.id);
      mineOf.delete(s.id);
      myViews.delete(s.id);
      for (const key of [...views.keys()]) if (key.endsWith(`\0${s.id}`)) views.delete(key);
      for (const key of [...textJobs.keys()]) if (key.startsWith(`${s.id}\0`)) textJobs.delete(key);
      redraw();
    }));
    const rich = (sid) => option("tickets", "rich", sid, false) === true;
    const body = (m, html) => {
      if (html && m.html) {
        try {
          return mu.ui.sanitize(m.html, "inline");
        } catch {
        }
      }
      return m.text ?? "";
    };
    const SHOW = [
      ["all", "All", () => true],
      ["reply", "Needs reply", (t) => /^(pending|open)$/i.test(t.status ?? "open")],
      ["player", "On player", (t) => /^waiting$/i.test(t.status ?? "")],
      ["unclaimed", "Unclaimed", (t) => !t.assignee]
    ];
    let searchTimer = null;
    ctx.subscriptions.push(() => {
      if (searchTimer) clearTimeout(searchTimer);
    });
    function mountTickets(el, pc, panelId, fixedKinds) {
      const sidOf = () => pc.sid ?? active();
      el.classList.add("mx", "tickets");
      el.dataset.testid = "tickets";
      let shownId = null;
      const track = (sid, id) => {
        const key = (s) => `staff\0${s}`;
        if (shownId) for (const set of shown.values()) set.delete(shownId);
        shownId = id;
        if (sid && id) (shown.get(key(sid)) ?? shown.set(key(sid), /* @__PURE__ */ new Set()).get(key(sid))).add(id);
      };
      const draw = () => {
        const sid = sidOf();
        const focused = el.contains(document.activeElement) ? document.activeElement.dataset.focus : void 0;
        if (!sid) {
          track(null, null);
          fill(el, h("p", { class: "empty" }, "No session"));
          return;
        }
        const v = viewOf(`${panelId}\0${sid}`);
        const st = S(sid);
        track(sid, v.open);
        if (v.open) drawThread(sid, st, v);
        else drawList(sid, st, v);
        if (focused) el.querySelector(`[data-focus="${focused}"]`)?.focus();
      };
      const back = (onclick) => h("button", { class: `${css.cmd} back`, type: "button", "data-testid": "tickets-back", "data-focus": "back", onclick }, "Back");
      const fbLine = (v) => v.fb ? h("p", { class: `fb${v.fb.ok ? "" : " err"}`, role: "status", "data-testid": "tickets-fb" }, v.fb.text) : null;
      const askHistory = (sid, search) => void dataRequest("tickets", "history", `${P}.List`, { history: true, ...search ? { search } : {} }, sid);
      const drawList = (sid, st, v) => {
        const history = v.tab === "history";
        const all = history ? st.history ?? [] : st.inbox;
        const scoped = fixedKinds ? all.filter((t) => fixedKinds.includes(t.kind ?? "")) : all;
        const kinds = [...new Set(scoped.map((t) => t.kind).filter((k) => !!k))];
        for (const k of [...v.kinds]) if (!kinds.includes(k)) v.kinds.delete(k);
        const q = (history ? "" : v.q).trim().toLowerCase();
        const byKind = v.kinds.size ? scoped.filter((t) => v.kinds.has(t.kind ?? "")) : scoped;
        const show = SHOW.find((s) => s[0] === v.show) ?? SHOW[0];
        const rows = byKind.filter((t) => matches(t, q) && (history || show[2](t)));
        if (!history) rows.sort(queueOrder);
        const labelOf = (k) => scoped.find((t) => t.kind === k && t.label)?.label ?? k;
        const tab = (id, label) => h("button", {
          class: css.toggle,
          type: "button",
          "aria-pressed": String(v.tab === id),
          "data-testid": `tickets-tab-${id}`,
          "data-focus": `tab-${id}`,
          onclick: () => {
            v.tab = id;
            v.fb = null;
            if (id === "history" && st.history === null) askHistory(sid, v.hq.trim());
            draw();
          }
        }, label);
        const searchVal = history ? v.hq : v.q;
        fill(
          el,
          h(
            "div",
            { class: "hd" },
            h("span", { class: "tag glow-text" }, "Tickets"),
            tab("open", "Open"),
            tab("history", "History"),
            h("span", { class: "count", "data-testid": "tickets-count" }, String(rows.length))
          ),
          fbLine(v),
          h(
            "div",
            { class: "filters" },
            kinds.length > 1 ? h("div", { class: "fl", role: "group", "aria-label": "filter by kind" }, kinds.map((k) => h("button", {
              class: `${css.toggle} fchip`,
              type: "button",
              "aria-pressed": String(v.kinds.has(k)),
              "data-kind": k,
              "data-focus": `k-${k}`,
              onclick: () => {
                if (v.kinds.has(k)) v.kinds.delete(k);
                else v.kinds.add(k);
                draw();
              }
            }, labelOf(k)))) : null,
            history ? null : h("div", { class: "fl", role: "radiogroup", "aria-label": "Show", "data-testid": "tickets-show" }, SHOW.map(([id, label, f]) => {
              const n = id === "all" ? 0 : byKind.filter(f).length;
              return h("button", {
                class: `${css.toggle} show`,
                type: "button",
                role: "radio",
                "aria-checked": String(v.show === id),
                "data-show": id,
                "data-focus": `show-${id}`,
                // One tab stop for the group; the arrows move the choice (the radiogroup pattern).
                tabindex: v.show === id ? 0 : -1,
                onclick: () => {
                  v.show = id;
                  draw();
                },
                onkeydown: (e) => {
                  const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
                  if (!step) return;
                  e.preventDefault();
                  const i = SHOW.findIndex((x) => x[0] === v.show);
                  v.show = SHOW[(i + step + SHOW.length) % SHOW.length][0];
                  draw();
                  el.querySelector(`[data-focus="show-${v.show}"]`)?.focus();
                }
              }, label, n ? h("span", { class: css.count }, String(n)) : null);
            })),
            h("input", {
              class: `${css.field} search`,
              type: "search",
              "data-testid": "tickets-search",
              "data-focus": `search-${v.tab}`,
              value: searchVal,
              placeholder: history ? "Search record" : "Search queue",
              "aria-label": history ? "Search closed tickets" : "Search open tickets",
              oninput: (e) => {
                const val = e.target.value;
                if (!history) {
                  v.q = val;
                  draw();
                  return;
                }
                v.hq = val;
                if (searchTimer) clearTimeout(searchTimer);
                searchTimer = setTimeout(() => {
                  searchTimer = null;
                  askHistory(sid, v.hq.trim());
                }, 300);
              }
            })
          ),
          h(
            "div",
            { class: "list", "data-testid": "tickets-list" },
            rows.length ? rows.map((t) => h(
              "button",
              {
                class: `${css.row} row${st.fresh.has(t.id) ? ` ${css.hot}` : ""}`,
                type: "button",
                "data-kind": t.kind ?? "",
                "data-id": t.id,
                "data-focus": `row-${t.id}`,
                title: t.account_name ? `account: ${t.account_name}` : void 0,
                onclick: () => {
                  v.open = t.id;
                  v.bug = false;
                  v.fb = null;
                  st.fresh.delete(t.id);
                  badges(sid);
                  draw();
                  void run("tickets", "open", { id: t.id, short_id: t.short_id }, sid);
                }
              },
              h(
                "span",
                { class: "r1" },
                h("span", { class: "kind" }, `${t.label ?? t.kind ?? "ticket"} `, h("span", { class: "sid" }, t.short_id)),
                h(
                  "span",
                  { class: "meta" },
                  t.priority ? h("span", { class: "pri", title: `priority ${t.priority}` }, "!".repeat(Math.min(4, t.priority))) : null,
                  t.assignee ? h("span", { class: "asg", title: `claimed by ${t.assignee}` }, t.assignee) : null,
                  t.status ? h("span", { class: plateCls(css.plate, t.status, "status") }, t.status) : null,
                  h("span", { class: "age" }, age(t.age_mins, t.updated))
                )
              ),
              t.requester_name ? h("span", { class: "who" }, t.requester_name) : null,
              t.subject ? h("span", { class: "subject" }, t.subject) : null,
              t.preview ? h("span", { class: "prev" }, t.preview) : null
            )) : h(
              "p",
              { class: "empty", "data-testid": "tickets-empty" },
              history ? st.history === null ? "Loading" : v.hq.trim() ? "No closed tickets match." : "No closed tickets." : all.length ? "No tickets match." : "No open tickets."
            )
          )
        );
      };
      let deciding = null;
      const drawThread = (sid, st, v) => {
        const id = v.open;
        const row = st.inbox.find((t2) => t2.id === id) ?? st.history?.find((t2) => t2.id === id);
        const t = { ...row, ...st.threads.get(id), id };
        const vars = { id, short_id: t.short_id ?? `#${id}` };
        const html = rich(sid);
        const reply = () => el.querySelector("[data-testid=tickets-reply]");
        const go = async (name, text = "") => {
          v.busy = true;
          draw();
          try {
            v.fb = feedback(await run("tickets", name, { ...vars, text }, sid), name, vars.short_id);
          } catch (e) {
            v.fb = failed(e);
          }
          v.busy = false;
        };
        const act2 = (name, label, cls = "") => shows("tickets", name, sid) ? h("button", {
          class: `${css.cmd} act ${cls}`.trim(),
          type: "button",
          "data-action": name,
          "data-focus": `act-${name}`,
          disabled: v.busy,
          onclick: async () => {
            if (name === "approve" || name === "deny") {
              const input = reply();
              const text = input?.value.trim() ?? "";
              if (!text && name === "deny" && deciding !== "deny") {
                deciding = "deny";
                draw();
                el.querySelector("[data-testid=tickets-reason]")?.focus();
                return;
              }
              if (text && input) {
                input.value = "";
                v.draft = "";
              }
              deciding = null;
              await go(name, text);
            } else await go(name);
            draw();
          }
        }, label) : null;
        const closed = isClosed(t.status);
        const ctxRows = Object.entries(t.context ?? {});
        const isBug = (t.kind ?? "").toLowerCase() === "bug";
        const bug = t.bug;
        const decidable = t.approvable !== false;
        const resolvable = t.approvable !== true;
        if (closed) deciding = null;
        fill(
          el,
          h(
            "div",
            { class: "hd" },
            h("span", { class: "tag glow-text" }, "Tickets"),
            h("span", { class: "sub" }, `${t.label ?? t.kind ?? "ticket"} ${vars.short_id}`),
            back(() => {
              v.open = null;
              v.fb = null;
              deciding = null;
              draw();
            })
          ),
          fbLine(v),
          h(
            "div",
            { class: "convo", "data-testid": "tickets-thread" },
            h(
              "div",
              { class: "head" },
              h(
                "span",
                { class: "petitioner" },
                t.requester_name ?? "unknown",
                h(
                  "span",
                  { class: "sub" },
                  t.account_name && t.account_name !== t.requester_name ? h("span", { class: "acct" }, t.account_name) : null,
                  t.status ? h("span", { class: plateCls(css.plate, t.status), "data-testid": "tickets-status" }, t.status) : null,
                  t.assignee ? h("span", { class: "asg" }, t.assignee) : null
                )
              ),
              h("span", { class: "actions" }, closed ? act2("reopen", "Reopen") : [act2("claim", "Claim"), decidable ? [act2("approve", "Approve", "primary"), act2("deny", "Deny", "warn")] : null, resolvable ? act2("resolve", "Resolve") : null])
            ),
            deciding ? h(
              "form",
              {
                class: "decide",
                "data-testid": "tickets-decide",
                onkeydown: (e) => {
                  if (e.key !== "Escape") return;
                  e.preventDefault();
                  e.stopPropagation();
                  deciding = null;
                  draw();
                  el.querySelector("[data-action=deny]")?.focus();
                },
                onsubmit: async (e) => {
                  e.preventDefault();
                  const name = deciding;
                  const text = el.querySelector("[data-testid=tickets-reason]")?.value.trim() ?? "";
                  deciding = null;
                  await go(name, text);
                  draw();
                }
              },
              h("input", { class: `${css.field}`, type: "text", "aria-label": "Reason", "data-testid": "tickets-reason", "data-focus": "reason", placeholder: "Reason (the player sees it)" }),
              h("button", { class: `${css.cmd} warn`, type: "submit", "data-testid": "tickets-decide-go", "data-focus": "decide-go", disabled: v.busy }, "Confirm deny"),
              h("button", { class: css.cmd, type: "button", "data-focus": "decide-cancel", onclick: () => {
                deciding = null;
                draw();
                el.querySelector("[data-action=deny]")?.focus();
              } }, "Cancel")
            ) : null,
            h(
              "div",
              { class: "body" },
              t.subject || ctxRows.length || isBug ? h(
                "div",
                { class: "ctx" },
                t.subject ? h("div", { class: "cx" }, h("span", { class: "ck" }, "subject"), h("span", { class: "cv" }, t.subject)) : null,
                ctxRows.map(([k, val]) => h("div", { class: "cx" }, h("span", { class: "ck" }, k), h("span", { class: "cv" }, String(val)))),
                isBug && !v.bug ? h("button", { class: `${css.cmd} loadbug`, type: "button", "data-testid": "tickets-loadbug", "data-focus": "loadbug", "aria-expanded": "false", onclick: () => {
                  v.bug = true;
                  if (!t.bug) void dataRequest("tickets", "bugdetail", `${P}.BugDetail`, { id }, sid);
                  draw();
                } }, "Report detail") : null
              ) : null,
              isBug && v.bug ? h(
                "div",
                { class: "bug", "data-testid": "tickets-bug" },
                bug && bug.available !== false && Object.keys(bug).length ? [
                  h("div", { class: "bl" }, h("span", { class: "ck" }, "reporter"), [bug.reporter, bug.character].filter(Boolean).join(" / ") || "\u2014"),
                  h("div", { class: "bl" }, h("span", { class: "ck" }, "location"), bug.location ?? "\u2014"),
                  h("div", { class: "bl" }, h("span", { class: "ck" }, "last cmd"), h("span", { class: "dim" }, bug.last_cmd ?? bug.traceback_command ?? "\u2014"), bug.traceback_time ? h("span", { class: "dim" }, ` (${bug.traceback_time})`) : null),
                  bug.traceback ? [h("div", { class: "ck" }, "traceback"), h("pre", { class: "tb" }, bug.traceback)] : null,
                  bug.char_state || bug.character_state && Object.keys(bug.character_state).length ? [
                    h("div", { class: "ck" }, "character state"),
                    h("pre", { class: "tb" }, bug.char_state ?? Object.entries(bug.character_state ?? {}).map(([k, x]) => `${k}: ${typeof x === "string" ? x : JSON.stringify(x)}`).join("\n"))
                  ] : null
                ] : h("span", { class: "dim" }, bug ? "No detailed bug report attached." : "Loading")
              ) : null,
              h(
                "div",
                { class: "msgs", role: "log", "aria-label": "Conversation", "data-testid": "tickets-msgs" },
                t.messages?.length ? t.messages.map((m) => {
                  const o = originOf(m, t.requester_name);
                  if (o === "system") return h("div", { class: "sys" }, m.ts !== void 0 ? h("span", { class: "mts" }, stamp(m.ts, true)) : null, ` ${m.text ?? ""}`);
                  return h(
                    "div",
                    { class: `m${m.visibility === "internal" ? " note" : ""}${o === "staff" ? " staffmsg" : ""}` },
                    h("span", { class: "s" }, m.sender ?? "?"),
                    o === "player" ? h("span", { class: `${css.plate} ${css.gold}` }, "Player") : null,
                    m.ts !== void 0 ? h("span", { class: "mts" }, stamp(m.ts, true)) : null,
                    h("span", { class: "t" }, body(m, html))
                  );
                }) : h("p", { class: "empty" }, "No messages yet.")
              )
            ),
            shows("tickets", "reply", sid) ? h(
              "form",
              {
                class: "reply",
                onsubmit: async (e) => {
                  e.preventDefault();
                  const input = e.currentTarget.querySelector("textarea");
                  const text = input.value.trim();
                  if (!text) return;
                  const note = v.note;
                  const name = note && cmdOf("tickets", "reply_note", sid) ? "reply_note" : "reply";
                  try {
                    v.fb = feedback(await run("tickets", name, { ...vars, text, internal: note ? "1" : "" }, sid), note ? "reply_note" : "reply", vars.short_id);
                  } catch (err) {
                    v.fb = failed(err);
                  }
                  input.value = "";
                  v.draft = "";
                  draw();
                }
              },
              h("label", { class: "int" }, h("input", { type: "checkbox", checked: v.note, "data-testid": "tickets-note", "data-focus": "note", onchange: (e) => {
                v.note = e.target.checked;
                const r = reply();
                if (r) r.placeholder = v.note ? "Staff note" : "Reply to player";
              } }), "note"),
              replyArea({ class: css.field, "aria-label": "ticket reply", "aria-describedby": `${panelId}-reply-keys`, placeholder: v.note ? "Staff note" : "Reply to player", value: v.draft, "data-testid": "tickets-reply", "data-focus": "reply", oninput: (e) => {
                v.draft = e.target.value;
              } }),
              h("span", { id: `${panelId}-reply-keys`, class: "sr-only" }, "Enter sends. Shift+Enter starts a new line.")
            ) : null
          )
        );
      };
      redraws.add(draw);
      const off = mu.sessions.on("switch", () => draw());
      draw();
      return () => {
        redraws.delete(draw);
        off();
        track(null, null);
        el.replaceChildren();
      };
    }
    let mineSearchTimer = null;
    ctx.subscriptions.push(() => {
      if (mineSearchTimer) clearTimeout(mineSearchTimer);
    });
    function mountMine(el, pc) {
      const sidOf = () => pc.sid ?? active();
      el.classList.add("mx", "mine");
      el.dataset.testid = "mytickets";
      let shownKey = null, shownId = null;
      const track = (sid2, id) => {
        if (shownKey && shownId) shown.get(shownKey)?.delete(shownId);
        shownKey = sid2 ? `mine\0${sid2}` : null;
        shownId = id;
        if (shownKey && id) (shown.get(shownKey) ?? shown.set(shownKey, /* @__PURE__ */ new Set()).get(shownKey)).add(id);
      };
      const draw = () => {
        const sid2 = sidOf();
        const focused = el.contains(document.activeElement) ? document.activeElement.dataset.focus : void 0;
        if (!sid2) {
          track(null, null);
          fill(el, h("p", { class: "empty" }, "No session"));
          return;
        }
        const m = M(sid2), v = myViewOf(sid2);
        track(sid2, v.open);
        const fbLine = v.fb ? h("p", { class: `fb${v.fb.ok ? "" : " err"}`, role: "status", "data-testid": "mytickets-fb" }, v.fb.text) : null;
        if (v.open) drawThread(sid2, m, v, fbLine);
        else drawList(sid2, m, v, fbLine);
        if (focused) el.querySelector(`[data-focus="${focused}"]`)?.focus();
      };
      const statusWord = (s) => s ? MINE_WORDS[s.toLowerCase()] ?? s : "";
      const drawThread = (sid2, m, v, fbLine) => {
        const id = v.open;
        const row = [...m.open ?? [], ...m.closed ?? []].find((t2) => t2.id === id);
        const t = { ...row, ...m.threads.get(id), id };
        const closed = isClosed(t.status);
        const short = t.short_id ?? `#${id}`;
        const go = async (name, text = "") => {
          v.busy = true;
          draw();
          let r = "none";
          try {
            r = await run("mytickets", name, { id, short_id: short, text }, sid2);
            v.fb = feedback(r, name, short);
          } catch (err) {
            v.fb = failed(err);
          }
          v.busy = false;
          if (r === "command" && textOn(sid2) && !mu.gmcp.seen(P, sid2)) setTimeout(() => {
            if (myViewOf(sid2).open === id) void requestThread(sid2, id);
          }, 600);
          return r;
        };
        const back = h("button", { class: `${css.cmd} back`, type: "button", "data-testid": "mytickets-back", "data-focus": "back", onclick: () => {
          v.open = null;
          v.fb = null;
          v.armed = false;
          draw();
        } }, "Back");
        fill(
          el,
          h("div", { class: "hd" }, h("span", { class: "tag glow-text" }, "My tickets"), back),
          fbLine,
          h(
            "div",
            { class: "convo", "data-testid": "mytickets-thread" },
            h(
              "div",
              { class: "chead" },
              h("span", { class: "ctitle" }, t.subject || t.label || short),
              h(
                "span",
                { class: "cmeta" },
                h("span", { class: "ckind" }, `${t.label ?? t.kind ?? "ticket"} ${short}`),
                t.status ? h("span", { class: plateCls(css.plate, t.status), "data-testid": "mytickets-status" }, statusWord(t.status)) : null,
                t.assignee ? h("span", { class: "handler" }, "Handler ", h("b", null, t.assignee)) : null,
                !closed && shows("mytickets", "withdraw", sid2) ? h("button", {
                  class: `${css.cmd} withdraw${v.armed ? " armed" : ""}`,
                  type: "button",
                  "data-testid": "mytickets-withdraw",
                  "data-focus": "withdraw",
                  disabled: v.busy,
                  onclick: async () => {
                    if (!v.armed) {
                      v.armed = true;
                      draw();
                      return;
                    }
                    v.armed = false;
                    await go("withdraw");
                    draw();
                  }
                }, v.armed ? "Confirm withdraw" : "Withdraw") : null
              )
            ),
            h(
              "div",
              { class: "msgs", role: "log", "aria-label": "Conversation", "data-testid": "mytickets-msgs" },
              t.messages?.length ? t.messages.filter((x) => x.visibility !== "internal").map((x) => {
                const o = originOf(x, t.requester_name);
                if (o === "system") return h("div", { class: "sys" }, x.ts !== void 0 ? h("span", { class: "mts" }, stamp(x.ts)) : null, ` ${x.text ?? ""}`);
                return h(
                  "div",
                  { class: `m${o === "player" ? " me" : " staffmsg"}` },
                  h(
                    "span",
                    { class: "who" },
                    h("span", { class: "s" }, x.sender ?? "?"),
                    o === "staff" ? h("span", { class: `${css.plate} ${css.hot}` }, "Staff") : h("span", { class: `${css.plate} ${css.dim}` }, "You"),
                    x.ts !== void 0 ? h("span", { class: "mts" }, stamp(x.ts)) : null
                  ),
                  h("span", { class: "t" }, body(x, false))
                );
              }) : h("p", { class: "empty" }, closed ? "No messages." : "No messages yet. Add one below.")
            ),
            closed ? h("div", { class: "closed-note", "data-testid": "mytickets-closed" }, "This ticket is closed. Open a new one if you still need help.") : shows("mytickets", "myreply", sid2) ? h(
              "form",
              {
                class: "reply",
                onsubmit: async (e) => {
                  e.preventDefault();
                  const input = e.currentTarget.querySelector("textarea");
                  const text = input.value.trim();
                  if (!text || v.busy) return;
                  input.value = "";
                  v.draft = "";
                  await go("myreply", text);
                  draw();
                }
              },
              replyArea({ class: css.field, "aria-label": "reply to staff", "aria-describedby": "mine-reply-keys", placeholder: "Reply to staff", value: v.draft, "data-testid": "mytickets-reply", "data-focus": "reply", oninput: (e) => {
                v.draft = e.target.value;
              } }),
              h("span", { id: "mine-reply-keys", class: "sr-only" }, "Enter sends. Shift+Enter starts a new line."),
              h("div", { class: "rkeys" }, h("button", { class: `${css.cmd} primary send`, type: "submit", "data-testid": "mytickets-send", "data-focus": "send", disabled: v.busy }, "Reply"))
            ) : null
          )
        );
      };
      const drawList = (sid2, m, v, fbLine) => {
        const q = v.q.trim().toLowerCase();
        const list = v.closed ? m.closed : m.open;
        const waiting = (m.open ?? []).filter((t) => /^waiting$/i.test(t.status ?? "")).length;
        const rows = list === null ? null : list.filter((t) => matches(t, q) && (!v.waiting || v.closed || /^waiting$/i.test(t.status ?? ""))).map((t, i) => [t, i]).sort(([a, i], [b, j]) => (v.newest ? epoch(b.updated) - epoch(a.updated) : epoch(a.updated) - epoch(b.updated)) || i - j).map(([t]) => t);
        const tab = (closed, label) => h("button", {
          class: css.toggle,
          type: "button",
          "aria-pressed": String(v.closed === closed && !(closed === false && v.waiting)),
          "data-testid": `mytickets-tab-${closed ? "closed" : "open"}`,
          "data-focus": `tab-${closed}`,
          onclick: () => {
            v.closed = closed;
            v.waiting = false;
            v.fb = null;
            if ((closed ? m.closed : m.open) === null) void requestMine(sid2, closed);
            draw();
          }
        }, label);
        const compose = v.compose ? h(
          "form",
          {
            class: "compose",
            "data-testid": "mytickets-compose",
            onsubmit: async (e) => {
              e.preventDefault();
              const subject = v.subject.trim(), text = v.details.trim();
              if (!text) {
                v.cerr = "Say what you need help with.";
                draw();
                el.querySelector("[data-testid=mytickets-details]")?.focus();
                return;
              }
              v.busy = true;
              draw();
              try {
                const r = await run("mytickets", "create", { subject: subject || text.slice(0, 60), text }, sid2);
                v.fb = feedback(r, "create", "");
                if (r !== "none") {
                  v.compose = false;
                  v.subject = "";
                  v.details = "";
                  v.cerr = "";
                  setTimeout(() => void requestMine(sid2, false), 600);
                }
              } catch (err) {
                v.fb = failed(err);
              }
              v.busy = false;
              draw();
            }
          },
          h("label", null, "Subject", h("input", { class: css.field, type: "text", maxlength: 120, value: v.subject, "data-testid": "mytickets-subject", "data-focus": "subject", oninput: (e) => {
            v.subject = e.target.value;
          } })),
          h("label", null, "Details", h("textarea", { class: css.field, rows: 5, value: v.details, "data-testid": "mytickets-details", "data-focus": "details", oninput: (e) => {
            v.details = e.target.value;
            if (v.cerr) {
              v.cerr = "";
            }
          } })),
          v.cerr ? h("p", { class: "err-line", role: "alert", "data-testid": "mytickets-compose-error" }, v.cerr) : null,
          h("p", { class: "chint" }, ...hint("Bugs: `@bug`. Harassment: `@report`.")),
          h(
            "div",
            { class: "rkeys" },
            h("button", { class: css.cmd, type: "button", "data-focus": "compose-cancel", onclick: () => {
              v.compose = false;
              v.cerr = "";
              draw();
            } }, "Cancel"),
            h("button", { class: `${css.cmd} primary send`, type: "submit", "data-testid": "mytickets-create", "data-focus": "create", disabled: v.busy }, "Send")
          )
        ) : null;
        fill(
          el,
          h(
            "div",
            { class: "hd" },
            h("span", { class: "tag glow-text" }, "My tickets"),
            tab(false, "Open"),
            tab(true, "Closed"),
            rows?.length ? h("span", { class: "count" }, String(rows.length)) : null,
            shows("mytickets", "create", sid2) ? h("button", { class: `${css.cmd} new`, type: "button", "aria-expanded": String(v.compose), "data-testid": "mytickets-new", "data-focus": "new", onclick: () => {
              v.compose = !v.compose;
              draw();
              if (v.compose) el.querySelector("[data-testid=mytickets-subject]")?.focus();
            } }, "New") : null
          ),
          fbLine,
          compose,
          // Search, Waiting and sort earn their place on a longer list (a short one stays one Tab from its rows).
          list && (list.length > 3 || q || v.waiting || !v.newest) ? h(
            "div",
            { class: "tools" },
            h("input", {
              class: `${css.field} search`,
              type: "search",
              placeholder: "Search",
              "aria-label": "Search your tickets",
              value: v.q,
              "data-testid": "mytickets-search",
              "data-focus": "search",
              oninput: (e) => {
                v.q = e.target.value;
                if (mineSearchTimer) clearTimeout(mineSearchTimer);
                mineSearchTimer = setTimeout(() => {
                  mineSearchTimer = null;
                  draw();
                }, 250);
              }
            }),
            h(
              "div",
              { class: "fl" },
              v.closed ? null : h("button", {
                class: `${css.toggle} waiting`,
                type: "button",
                "aria-pressed": String(v.waiting),
                "data-testid": "mytickets-waiting",
                "data-focus": "waiting",
                onclick: () => {
                  v.waiting = !v.waiting;
                  draw();
                }
              }, "Waiting on you", waiting ? h("span", { class: css.count }, String(waiting)) : null),
              h("button", {
                class: `${css.cmd} sort`,
                type: "button",
                title: v.newest ? "Sort: newest first" : "Sort: oldest first",
                "data-testid": "mytickets-sort",
                "data-focus": "sort",
                onclick: () => {
                  v.newest = !v.newest;
                  draw();
                }
              }, v.newest ? "Newest" : "Oldest")
            )
          ) : null,
          h(
            "div",
            { class: "list", "data-testid": "mytickets-list" },
            m.error ? h(
              "p",
              { class: "empty err", role: "alert", "data-testid": "mytickets-error" },
              "Could not load tickets.",
              h("button", { class: `${css.cmd} retry`, type: "button", "data-focus": "retry", onclick: () => {
                void requestMine(sid2, v.closed);
                draw();
              } }, "Try again")
            ) : rows === null ? h("p", { class: "empty" }, "Loading") : rows.length ? rows.map((t) => {
              const fresh = unseen(sid2, t);
              return h(
                "button",
                {
                  class: `${css.row} row${fresh ? ` ${css.hot}` : ""}`,
                  type: "button",
                  "data-id": t.id,
                  "data-kind": t.kind ?? "",
                  "data-focus": `row-${t.id}`,
                  onclick: () => {
                    v.open = t.id;
                    v.fb = null;
                    v.armed = false;
                    v.compose = false;
                    markRead(sid2, t);
                    draw();
                    void requestThread(sid2, t.id);
                  }
                },
                h(
                  "span",
                  { class: "r1" },
                  h("span", { class: "kind" }, t.label ?? t.kind ?? "ticket"),
                  h("span", { class: "id" }, t.short_id ?? ""),
                  t.status ? h("span", { class: plateCls(css.plate, t.status) }, statusWord(t.status)) : null,
                  fresh ? h("span", { class: "sr-only" }, "New.") : null,
                  h("span", { class: "age" }, age(t.age_mins, t.updated))
                ),
                t.subject ? h("span", { class: "subject" }, t.subject) : null,
                t.preview ? h("span", { class: "prev" }, t.preview) : null
              );
            }) : q || v.waiting ? h("p", { class: "empty", "data-testid": "mytickets-empty" }, "Nothing matches.") : h("p", { class: "empty", "data-testid": "mytickets-empty" }, ...hint(option("mytickets", "emptyHint", sid2, "") || DEFAULT_HINT)),
            m.partial && rows?.length ? h("p", { class: "empty", "data-testid": "mytickets-partial" }, "The game stopped answering; the list may be incomplete.") : null
          )
        );
      };
      redraws.add(draw);
      const off = mu.sessions.on("switch", () => draw());
      const sid = sidOf();
      if (sid && M(sid).open === null) void requestMine(sid, false);
      draw();
      return () => {
        redraws.delete(draw);
        off();
        track(null, null);
        el.replaceChildren();
      };
    }
    mu.panels.register({ id: "tickets", title: "Tickets", singleton: true, defaultPosition: "right-bottom", show: "auto", role: "staff", mount: (el, pc) => mountTickets(el, pc, "tickets") });
    mu.panels.register({ id: "mytickets", title: "My tickets", singleton: true, defaultPosition: "right-bottom", show: "always", mount: (el, pc) => mountMine(el, pc) });
    ctx.subscriptions.push(mu.settings.watch("tickets.rich", () => redraw()), mu.settings.watch("mytickets.emptyHint", () => redraw()));
    for (const k of ["tickets", "mytickets"]) {
      try {
        ctx.subscriptions.push(mu.settings.watch(`${k}.enabled`, () => {
          syncSupports();
          redraw();
        }));
      } catch {
      }
    }
    syncSupports();
    const configure = (k, cfg, worldId) => {
      const set = (key, val) => mu.settings.set(`${k}.${key}`, val, worldId);
      for (const a of Object.keys(cfg.actions ?? {})) if (!ACTIONS[k][a]) throw new Error(`${TITLES[k]}: no action "${a}"`);
      if (cfg.enabled) set("enabled", cfg.enabled);
      if (cfg.source) set("source", cfg.source);
      for (const [a, c] of Object.entries(cfg.actions ?? {})) {
        if (c.via) set(`action.${a}.via`, c.via);
        if (c.cmd !== void 0) set(`action.${a}.cmd`, c.cmd);
      }
      for (const [o, val] of Object.entries(cfg.options ?? {})) set(o, val);
      syncSupports();
      redraw();
    };
    const onAction = (k, a, fn, track) => {
      if (!ACTIONS[k][a]) throw new Error(`${TITLES[k]}: no action "${a}"`);
      const off = addTo(handlers, actionId(k, a), fn);
      redraw();
      return track(() => {
        off();
        redraw();
      });
    };
    const onRequest = (k, kind, fn, track) => track(addTo(requests, `${k}\0${kind.toLowerCase()}`, fn));
    const enable = (k, mode, w) => configure(k, { enabled: mode }, w);
    const makeApi = (track) => {
      const mineApi = {
        enable: (mode, w) => enable("mytickets", mode, w),
        open: () => mu.panels.open("mytickets"),
        onAction: (a, fn) => onAction("mytickets", a, fn, track),
        onRequest: (kind, fn) => onRequest("mytickets", kind, fn, track),
        configure: (cfg, w) => configure("mytickets", cfg, w),
        set(what, data, sid) {
          const s = need(sid);
          if (!acceptsApi("mytickets", s)) return;
          if (what === "mine") setMine(s, data.tickets ?? [], !!data.closed);
          else setMyThread(s, data);
        },
        push: (_w, m, sid) => pushMessage(need(sid), m),
        error: (sid) => {
          const s = need(sid);
          M(s).error = true;
          redraw();
        },
        get: (_w, closed, sid) => [...(closed ? M(need(sid)).closed : M(need(sid)).open) ?? []]
      };
      return {
        enable: (mode, w) => enable("tickets", mode, w),
        open: () => mu.panels.open("tickets"),
        onAction: (a, fn) => onAction("tickets", a, fn, track),
        onRequest: (kind, fn) => onRequest("tickets", kind, fn, track),
        configure: (cfg, w) => configure("tickets", cfg, w),
        setRole: (role, sid) => setRole(need(sid), role === "staff"),
        set(what, data, sid) {
          const s = need(sid);
          if (!acceptsApi("tickets", s)) return;
          if (what === "inbox") setInbox(s, data.tickets ?? []);
          else setHistory(s, data.tickets ?? []);
        },
        upsert(_w, t, sid) {
          const s = need(sid), st = S(s), id = String(t.id);
          const n = { ...t, id };
          if (!upsertIn(st.inbox, n) && !upsertIn(st.history, n)) st.inbox.push(norm(n));
          const th = st.threads.get(id);
          if (th) Object.assign(th, n);
          mu.panels.touch("tickets", s);
          redraw();
        },
        remove(_w, id, sid) {
          const st = S(need(sid));
          st.inbox = st.inbox.filter((t) => t.id !== String(id));
          if (st.history) st.history = st.history.filter((t) => t.id !== String(id));
          st.fresh.delete(String(id));
          badges(need(sid));
          redraw();
        },
        push: (_w, m, sid) => pushMessage(need(sid), m),
        alert: (a) => alert(a),
        get(what, a, b) {
          if (what === "thread") return S(need(b)).threads.get(String(a));
          const st = S(need(a));
          return [...what === "inbox" ? st.inbox : st.history ?? []];
        },
        instance(opts) {
          const kinds = opts.filter?.kind === void 0 ? void 0 : [].concat(opts.filter.kind);
          return track(mu.panels.register({ id: opts.id, title: opts.title, singleton: true, defaultPosition: "right-bottom", show: "auto", role: "staff", mount: (el, pc) => mountTickets(el, pc, opts.id, kinds) }));
        },
        mine: mineApi
      };
    };
    ctx.exports((caller) => makeApi((d) => caller.track(d)));
    return makeApi((d) => d);
  }
});
export {
  index_default as default,
  fillTemplate
};
