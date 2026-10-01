// src/index.ts
import { defineExtension } from "@muclient/sdk";

// node_modules/@runmu.sh/ext-kit/dist/schema.js
var typeOf = (v) => v === null ? "null" : Array.isArray(v) ? "array" : Number.isInteger(v) ? "integer" : typeof v;
function validate(schema, data, root = schema, path = "$") {
  if (schema.$ref) {
    const m = /^#\/\$defs\/(.+)$/.exec(schema.$ref);
    const target = m ? root.$defs?.[m[1]] : void 0;
    if (!target)
      return `${path}: unknown $ref ${schema.$ref}`;
    return validate(target, data, root, path);
  }
  if (schema.type) {
    const want = Array.isArray(schema.type) ? schema.type : [schema.type];
    const got = typeOf(data);
    const ok = want.some((t) => t === got || t === "number" && got === "integer");
    if (!ok)
      return `${path}: expected ${want.join(" or ")}, got ${got}`;
  }
  if (schema.enum && !schema.enum.some((e) => e === data))
    return `${path}: not one of ${schema.enum.map(String).join(", ")}`;
  if (typeOf(data) === "object") {
    const o = data;
    for (const r of schema.required ?? [])
      if (!(r in o) || o[r] === void 0)
        return `${path}.${r}: required`;
    for (const [k, v] of Object.entries(o)) {
      if (v === void 0)
        continue;
      const ps = schema.properties?.[k];
      if (ps) {
        const e = validate(ps, v, root, `${path}.${k}`);
        if (e)
          return e;
      } else if (schema.additionalProperties && typeof schema.additionalProperties === "object") {
        const e = validate(schema.additionalProperties, v, root, `${path}.${k}`);
        if (e)
          return e;
      }
    }
  }
  if (typeOf(data) === "array" && schema.items) {
    const a = data;
    for (let i = 0; i < a.length; i++) {
      const e = validate(schema.items, a[i], root, `${path}[${i}]`);
      if (e)
        return e;
    }
  }
  return null;
}

// node_modules/@runmu.sh/ext-kit/dist/module.js
var VIA_OPTS = [{ value: "command", label: "command" }, { value: "gmcp", label: "gmcp" }, { value: "ext", label: "extension" }, { value: "none", label: "hidden" }];
var MODE_OPTS = [{ value: "off", label: "off" }, { value: "auto", label: "auto" }, { value: "on", label: "on" }];
var SOURCE_OPTS = [{ value: "both", label: "gmcp + api" }, { value: "gmcp", label: "gmcp" }, { value: "api", label: "api" }];
function fillTemplate(tpl, vars) {
  const sub = (s) => s.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? "");
  return sub(tpl.replace(/\[([^\]]*)\]/g, (_, seg) => [...seg.matchAll(/\{(\w+)\}/g)].every((m) => (vars[m[1]] ?? "") !== "") ? seg : "")).trim();
}
var supportsByMu = /* @__PURE__ */ new WeakMap();
function holdSupports(mu, pkg) {
  let supportsRefs = supportsByMu.get(mu);
  if (!supportsRefs)
    supportsByMu.set(mu, supportsRefs = /* @__PURE__ */ new Map());
  let r = supportsRefs.get(pkg);
  if (!r) {
    r = { n: 0, off: mu.gmcp.supports([`${pkg} 1`]) };
    supportsRefs.set(pkg, r);
  }
  r.n++;
  let done = false;
  return () => {
    if (done)
      return;
    done = true;
    if (--r.n === 0) {
      supportsRefs.delete(pkg);
      r.off();
    }
  };
}
var WorldModule = class {
  def;
  mu;
  handlers = /* @__PURE__ */ new Map();
  requests = /* @__PURE__ */ new Map();
  /** Sessions where data has arrived (auto mode) and where the role is staff. */
  seenData = /* @__PURE__ */ new Set();
  staffIn = /* @__PURE__ */ new Set();
  listeners = /* @__PURE__ */ new Set();
  supportsOff = null;
  constructor(mu, def) {
    this.mu = mu;
    this.def = def;
  }
  /** Setting rows for this module (the extension defines all its modules' rows in one page). */
  settingItems() {
    const k = this.def.key, g = this.def.title;
    const rows = [
      { key: `${k}.enabled`, label: "Show panel", default: this.def.defaultMode ?? "auto", kind: "select", options: MODE_OPTS, group: g, hint: "auto: appears when the game first sends it", scope: "world" },
      { key: `${k}.source`, label: "Driven by", default: "both", kind: "select", options: SOURCE_OPTS, group: g, scope: "world" },
      ...(this.def.options ?? []).map((o) => ({ ...o, key: `${k}.${o.key}`, group: o.group ?? g }))
    ];
    for (const [a, d] of Object.entries(this.def.actions)) {
      rows.push({ key: `${k}.action.${a}.via`, label: `${d.label}: via`, default: d.via, kind: "select", options: VIA_OPTS, group: `${g} actions`, scope: "both" });
      rows.push({ key: `${k}.action.${a}.cmd`, label: `${d.label}: command`, default: d.cmd, kind: "text", group: `${g} actions`, scope: "both" });
    }
    return rows;
  }
  worldOf(sid) {
    if (!sid)
      return null;
    return this.mu.sessions.list().find((s) => s.id === sid)?.worldId ?? null;
  }
  get(key, worldId) {
    return this.mu.settings.get(`${this.def.key}.${key}`, worldId);
  }
  mode(worldId = this.mu.sessions.active()?.worldId ?? null) {
    return this.get("enabled", worldId);
  }
  source(worldId) {
    return this.get("source", worldId);
  }
  option(key, sid) {
    return this.get(key, sid ? this.worldOf(sid) : this.mu.sessions.active()?.worldId ?? null);
  }
  action(name, worldId) {
    const d = this.def.actions[name];
    if (!d)
      return { label: name, via: "none", cmd: "" };
    return { label: d.label, via: this.get(`action.${name}.via`, worldId) ?? d.via, cmd: this.get(`action.${name}.cmd`, worldId) ?? d.cmd };
  }
  /** A button is hidden when its action's via is `none`. */
  shows(name, sid) {
    return this.action(name, this.worldOf(sid)).via !== "none";
  }
  /** GMCP for this module on `sid` is taken (not off, not api-only). */
  acceptsGmcp(sid) {
    const w = this.worldOf(sid);
    return this.mode(w) !== "off" && this.source(w) !== "api";
  }
  acceptsApi(sid) {
    const w = this.worldOf(sid);
    return this.mode(w) !== "off" && this.source(w) !== "gmcp";
  }
  isStaff(sid) {
    return !this.def.staff || !!sid && this.staffIn.has(sid);
  }
  setStaff(sid, on) {
    if (on)
      this.staffIn.add(sid);
    else
      this.staffIn.delete(sid);
    this.changed();
  }
  /** Data arrived for `sid`: auto mode shows the panel and R-AUTO-PANELS adds it once. */
  touched(sid) {
    const first = !this.seenData.has(sid);
    this.seenData.add(sid);
    if (first)
      this.changed();
    const m = this.mode(this.worldOf(sid));
    if (m !== "off" && this.isStaff(sid))
      this.mu.panels.autoAdd(this.def.panels[0], sid);
  }
  /** Whether the main panel belongs in Views for the active session. */
  visible(sid) {
    const m = this.mode(this.worldOf(sid));
    if (m === "off" || !this.isStaff(sid))
      return false;
    return m === "on" || !!sid && this.seenData.has(sid);
  }
  onChange(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  changed() {
    for (const f of [...this.listeners]) {
      try {
        f();
      } catch (e) {
        this.mu.log.error(e);
      }
    }
  }
  /** Keep Views, Core.Supports and open panels in line with the mode and role. Call once from activate. */
  bind() {
    const sync = () => {
      const sid = this.mu.sessions.active()?.id ?? null;
      const vis = this.visible(sid);
      for (const id of this.def.panels)
        this.mu.panels.update(id, { inViewsMenu: vis });
      const off = this.mode() === "off";
      if (off)
        for (const id of this.def.panels)
          this.mu.panels.close(id);
      if (!off && !this.supportsOff)
        this.supportsOff = holdSupports(this.mu, this.def.pkg);
      if (off && this.supportsOff) {
        this.supportsOff();
        this.supportsOff = null;
      }
    };
    const subs = [
      this.onChange(sync),
      this.mu.settings.watch(`${this.def.key}.enabled`, () => {
        sync();
        this.changed();
      }),
      this.mu.sessions.on("switch", () => sync()),
      () => {
        if (this.supportsOff) {
          this.supportsOff();
          this.supportsOff = null;
        }
      }
    ];
    sync();
    return subs;
  }
  /** `api.onAction(name, fn)`: runs before the configured action; returning true skips it. */
  onAction(name, fn) {
    const set = this.handlers.get(name) ?? this.handlers.set(name, /* @__PURE__ */ new Set()).get(name);
    set.add(fn);
    return () => set.delete(fn);
  }
  /** `api.onRequest(kind, fn)`: replaces the default GMCP data request for `kind`. */
  onRequest(kind, fn) {
    const set = this.requests.get(kind) ?? this.requests.set(kind, /* @__PURE__ */ new Set()).get(kind);
    set.add(fn);
    return () => set.delete(fn);
  }
  session(sid) {
    const name = this.mu.gmcp.state("Char.Name", sid)?.name ?? this.mu.gmcp.state("Char.Status", sid)?.name ?? "";
    return { sid, worldId: this.worldOf(sid) ?? "", character: String(name), send: (c) => this.mu.sessions.send(c, sid), gmcp: (p, d) => this.mu.gmcp.send(p, d, sid) };
  }
  /**
   * Press a button (06 §1 Actions): extension handlers first (true = handled), then the configured
   * `via`. A `gmcp` action falls back to the command template when the transport cannot send GMCP.
   * Returns what was done, for tests: 'ext' | 'gmcp' | 'command' | 'none'.
   */
  async run(name, vars, sid) {
    const s = this.session(sid);
    for (const fn of [...this.handlers.get(name) ?? []]) {
      try {
        if (await fn({ action: name, ...vars }, s) === true)
          return "ext";
      } catch (e) {
        this.mu.log.error(`action ${name} handler failed:`, e);
      }
    }
    const a = this.action(name, this.worldOf(sid));
    if (a.via === "none" || a.via === "ext")
      return "none";
    if (a.via === "gmcp") {
      const [pkg, data] = this.def.gmcpAction(name, vars);
      if (await this.mu.gmcp.send(pkg, data, sid))
        return "gmcp";
      if (!a.cmd)
        return "none";
    }
    const cmd = fillTemplate(a.cmd, vars);
    if (!cmd)
      return "none";
    await this.mu.sessions.send(cmd, sid);
    return "command";
  }
  /** A data request (History, bug detail, Resync…): handlers replace the default GMCP request. */
  async request(kind, pkg, data, sid) {
    const hs = [...this.requests.get(kind) ?? []];
    if (hs.length) {
      for (const fn of hs) {
        try {
          await fn(data, this.session(sid));
        } catch (e) {
          this.mu.log.error(`request ${kind} handler failed:`, e);
        }
      }
      return;
    }
    if (this.source(this.worldOf(sid)) !== "api")
      await this.mu.gmcp.send(pkg, data, sid);
  }
  /**
   * Check a payload. A malformed one is dropped with one `session.error` line in the session (shown in
   * Session info) and no crash (06 §8).
   */
  check(sid, pkg, schema, data) {
    const err = validate(schema, data);
    if (!err)
      return true;
    this.mu.sessions.echo(`session.error: ${pkg} rejected by ${this.def.title}: ${err}`, sid);
    this.mu.log.warn(`${pkg} rejected: ${err}`);
    return false;
  }
  // ─── read marks ("new" = an id not seen before on this device, per world) ──────────────────
  seenKey = () => `seen.${this.def.key}`;
  /** Ids in `ids` not seen before in the session's world; marks them seen. */
  fresh(sid, ids) {
    const store = this.mu.storage.world(this.worldOf(sid));
    const seen = new Set(store.get(this.seenKey(), []));
    const out = ids.filter((id) => !seen.has(id));
    if (out.length)
      store.set(this.seenKey(), [...seen, ...out].slice(-1e3));
    return out;
  }
  /** New-item toast (style bible §7, kind label = module). Several new at once become one toast. */
  announce(items) {
    if (!items.length)
      return;
    if (items.length > 3) {
      this.mu.ui.toast(`${items.length} new`, items.slice(0, 3).map((i) => i.title).join(" \xB7 "), { kind: this.def.key });
      return;
    }
    for (const i of items)
      this.mu.ui.toast(i.title, i.body, { kind: this.def.key });
  }
  /** `api.configure(...)`: write actions, options, source, enabled for the active world (or all worlds). */
  configure(cfg, worldId) {
    const k = this.def.key;
    const set = (key, v) => this.mu.settings.set(`${k}.${key}`, v, worldId);
    if (cfg.enabled)
      set("enabled", cfg.enabled);
    if (cfg.source)
      set("source", cfg.source);
    for (const [a, c] of Object.entries(cfg.actions ?? {})) {
      if (!this.def.actions[a])
        throw new Error(`${this.def.title}: no action "${a}"`);
      if (c.via)
        set(`action.${a}.via`, c.via);
      if (c.cmd !== void 0)
        set(`action.${a}.cmd`, c.cmd);
    }
    for (const [o, v] of Object.entries(cfg.options ?? {}))
      set(o, v);
    this.changed();
  }
};
function replay(mu, pkgs, fn) {
  for (const s of mu.sessions.list())
    for (const p of pkgs) {
      const d = mu.gmcp.state(p, s.id);
      if (d !== void 0)
        fn(p, d, s.id);
    }
}

// node_modules/@runmu.sh/ext-kit/dist/css.js
var MODULE_CSS = `
.mx { display: flex; flex-direction: column; height: 100%; min-height: 0; background: var(--bg-elev); color: var(--fg); font-size: 1rem; }
.mx button { font-family: inherit; cursor: pointer; }
.mx button:focus-visible, .mx input:focus-visible, .mx select:focus-visible, .mx textarea:focus-visible { outline: 2px solid var(--accent-bright); outline-offset: -2px; }

/* Header: TITLE, the view toggles, a count or [ BACK ] at the right. */
.mx .hd { display: flex; align-items: center; gap: .6ch; padding: 5px 8px 5px 10px; border-bottom: 1px solid var(--accent); flex: 0 0 auto; min-height: 24px; }
.mx .tag { color: var(--accent-bright); text-transform: uppercase; letter-spacing: .2em; font-size: .74rem; margin-right: 1ch; }
.mx.assist .hd { align-items: baseline; gap: 1ch; padding: 6px 10px; }
.mx.assist .tag { letter-spacing: .22em; font-size: .8rem; margin-right: 0; }
.mx .hd .sub { color: var(--fg-dim); text-transform: uppercase; letter-spacing: .18em; font-size: .62rem; }
.mx .count { margin-left: auto; color: var(--gold); font-size: .66rem; letter-spacing: .1em; }
.mx.assist .count { font-size: .68rem; }
.mx .back { margin-left: auto; }

/* Feedback line after an action: ok, or .err. */
.mx .fb { margin: 0; padding: 4px 10px; font-size: .72rem; letter-spacing: .04em; color: var(--ok); border-bottom: 1px solid var(--border); flex: 0 0 auto; }
.mx .fb.err { color: var(--alert); }

/* Kind filters (Tickets): a wrapping row of .sh-toggle. */
.mx .filters { display: flex; flex-direction: column; align-items: stretch; gap: 4px; padding: 6px 10px; border-bottom: 1px solid var(--border); flex: 0 0 auto; }
.mx .fl { display: flex; flex-wrap: wrap; gap: 2px 6px; }

/* Lists of .sh-row. */
.mx .list { flex: 1; min-height: 0; overflow-y: auto; display: flex; flex-direction: column; }
.mx .r1 { display: flex; justify-content: space-between; align-items: baseline; gap: 1ch; min-width: 0; }
.mx.mine .r1 { justify-content: flex-start; }
.mx .kind { color: var(--accent-bright); text-transform: uppercase; letter-spacing: .12em; font-size: .68rem; }
.mx .row[data-kind=bug] .kind { color: var(--alert); }
.mx .row[data-kind=puppet] .kind { color: var(--gold); }
.mx .row[data-kind=report] .kind { color: var(--fg); }
.mx .sid, .mx .id { color: var(--fg-faint); font-size: .62rem; letter-spacing: 0; }
.mx.mine .id { font-size: .64rem; }
.mx .meta { display: flex; align-items: baseline; gap: .8ch; flex: 0 0 auto; }
.mx.assist .meta { gap: .7ch; }
.mx .pri { color: var(--alert); font-size: .62rem; }
.mx .asg { color: var(--fg-dim); font-size: .6rem; letter-spacing: .1em; text-transform: uppercase; }
.mx.assist .asg { color: var(--accent-bright); font-size: .62rem; letter-spacing: .06em; }
.mx .age { color: var(--fg-faint); font-size: .64rem; }
.mx.assist .age { font-size: .68rem; }
.mx.mine .age { margin-left: auto; }
.mx .row .who { color: var(--gold); font-size: .78rem; }
.mx.assist .row .who { text-transform: uppercase; letter-spacing: .08em; }
.mx .subject { color: var(--fg); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.mx.mine .row.hot .subject { color: var(--gold); }
.mx .prev { color: var(--fg-dim); font-size: .74rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.mx.mine .prev, .mx.assist .prev { font-size: .76rem; }

/* Empty states: uppercase tracked faint labels (delta #27). Commands in a hint keep their case. */
.mx .empty { color: var(--fg-faint); font-style: normal; padding: 12px 10px; margin: 0; font-size: .68rem; letter-spacing: .14em; text-transform: uppercase; line-height: 1.5; }
.mx.assist .empty { font-size: .66rem; }
.mx .empty .cmdref { color: var(--gold); text-transform: none; letter-spacing: .04em; }
.mx .empty.err { color: var(--alert); }
.mx .empty .sh-cmd { margin-left: 1ch; }

/* A conversation: head, context, messages, reply. */
.mx .convo { display: flex; flex-direction: column; min-height: 0; flex: 1; }
.mx .head { display: flex; align-items: flex-start; gap: 1ch; padding: 7px 10px; border-bottom: 1px solid var(--border); flex: 0 0 auto; }
.mx .who-head { display: flex; align-items: center; gap: 1ch; padding: 5px 10px; border-bottom: 1px solid var(--border); flex: 0 0 auto; }
.mx .petitioner { color: var(--gold); letter-spacing: .04em; font-size: .86rem; }
.mx.assist .petitioner { text-transform: uppercase; letter-spacing: .1em; font-size: .78rem; }
.mx .petitioner .sub { display: flex; flex-wrap: wrap; align-items: center; gap: .8ch; margin-top: 3px; color: var(--fg-dim); font-size: .7rem; letter-spacing: 0; }
.mx .acct { color: var(--fg-faint); }
.mx.assist .petitioner .acct { margin-left: 1ch; text-transform: none; letter-spacing: 0; font-size: .72rem; }
.mx .actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 2px; margin-left: auto; }
.mx .actions .grp { display: inline-flex; gap: 2px; }
.mx .ctx { padding: 6px 10px; border-bottom: 1px solid var(--border); display: flex; flex-direction: column; gap: 2px; flex: 0 0 auto; }
.mx .cx { font-size: .74rem; }
.mx .ck { color: var(--fg-faint); text-transform: uppercase; font-size: .6rem; letter-spacing: .14em; margin-right: .6ch; }
.mx .cv { color: var(--fg); }
.mx .dim { color: var(--fg-faint); }
.mx .loadbug { align-self: flex-start; margin: 3px 0 0 -.5ch; }
.mx .bug { padding: 6px 10px; border-bottom: 1px solid var(--border); display: flex; flex-direction: column; gap: 3px; }
.mx .bl { font-size: .74rem; color: var(--fg); }
.mx .tb { margin: 2px 0 4px; padding: 6px; background: var(--bg-deep); border: 0; border-left: 1px solid var(--border-bright); color: var(--fg-dim); font-size: .7rem; max-height: 180px; overflow: auto; white-space: pre-wrap; font-family: inherit; }
.mx .body { flex: 1; min-height: 0; overflow-y: auto; }

/* Messages: a left rule per message; staff messages take the accent rule, notes a dashed one. */
.mx .msgs { padding: 8px 10px; line-height: 1.5; display: flex; flex-direction: column; gap: 8px; flex: 1; min-height: 0; overflow-y: auto; }
.mx.mine .msgs { gap: 10px; }
.mx .body .msgs { overflow: visible; flex: none; }
.mx .m { padding-left: 1.5ch; border-left: 1px solid var(--border-bright); font-size: .85rem; }
.mx.mine .m { display: flex; flex-direction: column; gap: 2px; }
.mx .m.staffmsg { border-left-color: var(--accent); }
.mx .m.note { border-left-style: dashed; }
.mx .m .s { color: var(--accent-bright); margin-right: .6ch; text-decoration: none; } /* the terminal palette's global .s is strike-through */
.mx.mine .m .s { margin-right: 0; }
.mx.mine .m.me .s { color: var(--fg-dim); }
.mx .m .who { display: flex; align-items: baseline; gap: .8ch; }
.mx .m .sh-plate { margin-right: .6ch; }
.mx.mine .m .sh-plate { margin-right: 0; }
.mx .m .mts { color: var(--fg-faint); font-size: .64rem; margin-right: .6ch; }
.mx .m .t { display: block; color: var(--fg); white-space: pre-wrap; }
.mx.assist .m { padding-left: 0; border-left: 0; }
.mx.assist .m .t { display: inline; }
.mx .sys { color: var(--fg-faint); font-size: .64rem; letter-spacing: .12em; text-transform: uppercase; padding: 2px 0; }
.mx .sys::before { content: "-- " / ""; }
.mx .m.note .s::after { content: " (note)" / ""; color: var(--alert); font-size: .7em; letter-spacing: .1em; text-transform: uppercase; }

/* Reply: Tickets has the note switch and a bare textarea; My tickets a boxed .sh-field and [ REPLY ]; Assist a > line. */
.mx .reply { display: flex; align-items: center; gap: .8rem; padding: 7px 10px; border-top: 1px solid var(--accent); flex: 0 0 auto; }
.mx.mine .reply { flex-direction: column; align-items: stretch; gap: 4px; }
.mx.assist .reply { gap: .6rem; padding: 6px 10px; }
.mx .int { color: var(--fg-dim); font-size: .6rem; letter-spacing: .14em; text-transform: uppercase; display: flex; align-items: center; gap: 4px; }
.mx .reply textarea { flex: 1; min-width: 0; color: var(--fg); font-family: inherit; font-size: .85rem; caret-color: var(--accent-bright); resize: vertical; }
.mx.tickets .reply textarea { background: transparent; border: 0; outline: none; padding: 0; min-height: 0; }
.mx .rkeys { display: flex; gap: 6px; align-items: center; }
.mx .rkeys .send { margin-left: auto; }
.mx .chev { color: var(--accent-bright); }
.mx .reply input { flex: 1; min-width: 0; background: transparent; border: 0; outline: none; color: var(--fg); font: inherit; font-size: .85rem; caret-color: var(--accent-bright); min-height: 24px; }
.mx .closed-note { padding: 7px 10px; border-top: 1px solid var(--border); color: var(--fg-faint); font-size: .64rem; letter-spacing: .14em; text-transform: uppercase; flex: 0 0 auto; }
.mx .chead { display: flex; flex-direction: column; gap: 4px; padding: 7px 10px; border-bottom: 1px solid var(--border); flex: 0 0 auto; }
.mx .ctitle { color: var(--gold); letter-spacing: .04em; font-size: .88rem; }
.mx .cmeta { display: flex; flex-wrap: wrap; align-items: center; gap: 1ch; }
.mx .ckind { color: var(--accent-bright); text-transform: uppercase; letter-spacing: .12em; font-size: .66rem; }
/* A destructive command waiting for its confirming second press. */
.mx .sh-cmd.armed, .mx .sh-cmd.armed:is(:hover, :focus-visible) { background: var(--alert); color: var(--bg-deep); }

/* Puppets: .sh-row rows laid out in a line; the terminal view has a head, feed, scene and input. */
.mx.puppets { overflow: hidden; }
.mx.puppets .row { flex-direction: row; gap: 1ch; align-items: baseline; }
.mx.puppets .row strong, .mx.puppets .term-head strong, .mx.puppets .prompt { color: var(--gold); font-weight: 400; }
.mx.puppets small { color: var(--fg-faint); font-size: .8em; }
.mx.puppets .where { margin-left: auto; color: var(--fg-dim); font-size: .8em; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.mx.puppets .pbadge { margin-left: 6px; min-width: 1.4em; padding: 0 .5ch; background: var(--gold); color: var(--bg-deep); font-size: .64rem; text-align: center; }
.mx.puppets .term-head { display: flex; gap: 1ch; align-items: center; padding: 5px 8px 5px 10px; border-bottom: 1px solid var(--accent); flex: 0 0 auto; }
.mx.puppets .term-head .tool { flex: none; }
.mx.puppets .term-head .where { max-width: 40%; }
.mx.puppets .term-head .name { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; }
.mx.puppets .term-feed { flex: 1; min-height: 0; overflow-y: auto; padding: 8px 10px; display: flex; flex-direction: column; gap: 2px; }
.mx.puppets .term-line { color: var(--fg); font-size: .9em; white-space: pre-wrap; word-break: break-word; }
.mx.puppets .term-line.self { color: var(--fg-dim); }
.mx.puppets .pscene { border-top: 1px solid var(--border); padding: 4px 10px; font-size: .74rem; color: var(--fg-dim); display: flex; flex-direction: column; gap: 1px; flex: 0 0 auto; }
.mx.puppets .pscene .rn { color: var(--accent-bright); text-transform: uppercase; letter-spacing: .16em; font-size: .7rem; }
.mx.puppets .pscene .lk { color: var(--fg-faint); text-transform: uppercase; letter-spacing: .12em; font-size: .6rem; margin-right: .6ch; }
.mx.puppets .term-input { display: flex; gap: .8ch; align-items: center; padding: 6px 10px; border-top: 1px solid var(--accent); flex: 0 0 auto; }
.mx.puppets .term-input input { flex: 1; min-width: 0; background: transparent; border: 0; outline: none; color: var(--fg); padding: 3px 0; font: inherit; caret-color: var(--accent-bright); min-height: 24px; }
.mx.puppets .sync, .mx.puppets .empty { color: var(--fg-faint); font-size: .64rem; letter-spacing: .14em; text-transform: uppercase; padding: 10px; }
@media (max-width: 420px) { .mx button, .mx .sh-cmd, .mx .sh-toggle { min-height: 32px; } }
`;

// node_modules/@runmu.sh/ext-kit/dist/dom.js
function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props ?? {})) {
    if (v === void 0 || v === null || v === false)
      continue;
    if (k === "class")
      el.className = String(v);
    else if (k === "style")
      el.style.cssText = String(v);
    else if (k.startsWith("on") && typeof v === "function")
      el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === "value")
      el.value = String(v);
    else if (k === "checked")
      el.checked = !!v;
    else
      el.setAttribute(k, v === true ? "" : String(v));
  }
  append(el, kids);
  return el;
}
function append(el, kids) {
  for (const c of kids) {
    if (c === null || c === void 0 || c === false)
      continue;
    if (Array.isArray(c))
      append(el, c);
    else
      el.appendChild(typeof c === "string" || typeof c === "number" ? document.createTextNode(String(c)) : c);
  }
}
function age(mins) {
  if (mins === void 0 || mins === null || !Number.isFinite(+mins))
    return "";
  const m = Math.max(0, Math.round(+mins));
  if (m < 60)
    return `${m}m`;
  if (m < 60 * 24)
    return `${Math.floor(m / 60)}h`;
  return `${Math.floor(m / 1440)}d`;
}
function clock(ts) {
  if (ts === void 0 || ts === null || ts === "")
    return "";
  const n = typeof ts === "number" ? ts < 1e12 ? ts * 1e3 : ts : Date.parse(ts);
  if (!Number.isFinite(n))
    return "";
  const d = new Date(n);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
var ALLOWED = /* @__PURE__ */ new Set(["B", "I", "EM", "STRONG", "U", "S", "CODE", "PRE", "BR", "P", "SPAN", "A", "UL", "OL", "LI", "BLOCKQUOTE"]);
function sanitize(html) {
  const tpl = document.createElement("template");
  tpl.innerHTML = html;
  const walk = (n) => {
    for (const c of [...n.childNodes]) {
      if (c.nodeType === 1) {
        const e = c;
        if (!ALLOWED.has(e.tagName)) {
          if (/^(SCRIPT|STYLE|IFRAME|OBJECT|EMBED|TEMPLATE)$/.test(e.tagName)) {
            e.remove();
            continue;
          }
          walk(e);
          e.replaceWith(...e.childNodes);
          continue;
        }
        for (const a of [...e.attributes])
          if (!(e.tagName === "A" && a.name === "href" && /^https?:/i.test(a.value)))
            e.removeAttribute(a.name);
        if (e.tagName === "A") {
          e.setAttribute("target", "_blank");
          e.setAttribute("rel", "noopener noreferrer");
        }
        walk(e);
      } else if (c.nodeType !== 3)
        c.remove();
    }
  };
  walk(tpl.content);
  return tpl.content;
}
function body(m, rich) {
  if (rich && m.html) {
    const s = h("span");
    s.appendChild(sanitize(m.html));
    return s;
  }
  return document.createTextNode(m.text ?? (m.html ? sanitize(m.html).textContent ?? "" : ""));
}
function hint(text) {
  return text.split(/(`[^`]+`)/).filter(Boolean).map((p) => p.startsWith("`") ? h("span", { class: "cmdref" }, p.slice(1, -1)) : h("span", null, p));
}
function fill(el, ...kids) {
  el.replaceChildren();
  append(el, kids);
}
function plateOf(status) {
  const s = (status ?? "").toLowerCase();
  if (s === "open" || s === "pending")
    return "hot";
  if (s === "claimed" || s === "waiting")
    return "gold";
  if (s === "approved")
    return "ok";
  if (/^(resolved|closed|denied|withdrawn)$/.test(s))
    return "dim";
  return "";
}
var plateCls = (status, ...extra) => ["sh-plate", plateOf(status), ...extra].filter(Boolean).join(" ");
function replyArea(props) {
  const ta = h("textarea", { rows: 2, ...props });
  ta.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" || e.shiftKey || e.isComposing)
      return;
    e.preventDefault();
    ta.form?.dispatchEvent(new Event("submit", { cancelable: true }));
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

// src/index.ts
var P = "Client.Tickets";
var DEFAULT_HINT = "`@request subject = what you need`, `@bug` or `@puppetrequest` in the game to open one.";
var GMCP_GRACE_MS = 1500;
var TEXT_TIMEOUT_MS = 6e3;
var MENU_LINE = /^\s*([a-z]|\d+): /;
var OPEN_STATUS = /^(pending|waiting|open|claimed)$/;
var msgS = { type: "object", properties: { text: { type: "string" }, html: { type: "string" }, sender: { type: "string" }, visibility: { type: "string" }, origin: { type: "string" }, ts: { type: ["number", "string"] } } };
var ticketS = {
  type: "object",
  required: ["id"],
  properties: {
    id: { type: ["string", "integer"] },
    short_id: { type: "string" },
    kind: { type: "string" },
    status: { type: "string" },
    priority: { type: "integer" },
    subject: { type: "string" },
    requester_name: { type: "string" },
    account_name: { type: "string" },
    assignee: { type: "string" },
    age_mins: { type: "number" },
    preview: { type: "string" },
    context: { type: "object", additionalProperties: { type: ["string", "number", "boolean"] } },
    messages: { type: "array", items: msgS },
    bug: { type: "object" }
  }
};
var listS = { type: "object", required: ["tickets"], properties: { tickets: { type: "array", items: ticketS }, closed: { type: "boolean" } } };
var SCHEMAS = {
  Role: { type: "object", required: ["staff"], properties: { staff: { type: "boolean" } } },
  Inbox: listS,
  History: listS,
  Mine: listS,
  Thread: ticketS,
  MyThread: ticketS,
  Message: { type: "object", required: ["id", "message"], properties: { id: { type: ["string", "integer"] }, status: { type: "string" }, message: msgS } },
  Alert: { type: "object", properties: { label: { type: "string" }, who: { type: "string" }, age_mins: { type: "number" } } },
  BugDetail: { type: "object", required: ["id", "bug"], properties: { id: { type: ["string", "integer"] }, bug: { type: "object" } } }
};
var norm = (t) => ({ ...t, id: String(t.id), short_id: t.short_id ?? `#${t.id}` });
var isClosed = (s) => !!s && /^(closed|resolved|approved|denied)$/i.test(s);
var originOf = (m, requester) => m.origin ?? (m.sender && (m.sender === requester || /^you$/i.test(m.sender)) ? "player" : "staff");
var DONE = { claim: "Claimed", resolve: "Resolved", approve: "Approved", deny: "Denied", reply: "Reply sent", reply_note: "Note added", myreply: "Reply sent" };
var feedback = (r, name, short) => r === "none" ? null : { ok: true, text: `${DONE[name] ?? name} ${short}.` };
var failed = (e) => ({ ok: false, text: e instanceof Error ? e.message : String(e) });
var index_default = defineExtension({
  activate(ctx) {
    const mu = ctx.mu;
    const staffOf = /* @__PURE__ */ new Map();
    const mineOf = /* @__PURE__ */ new Map();
    const S = (sid) => staffOf.get(sid) ?? staffOf.set(sid, { role: false, inbox: [], history: null, threads: /* @__PURE__ */ new Map(), fresh: /* @__PURE__ */ new Set() }).get(sid);
    const M = (sid) => mineOf.get(sid) ?? mineOf.set(sid, { open: null, closed: null, threads: /* @__PURE__ */ new Map(), error: false }).get(sid);
    const active = () => mu.sessions.active()?.id ?? null;
    const need = (sid) => {
      const s = sid ?? active();
      if (!s) throw new Error("no active session");
      return s;
    };
    const tickets = new WorldModule(mu, {
      key: "tickets",
      title: "Tickets",
      panels: ["tickets"],
      pkg: P,
      staff: true,
      actions: {
        open: { label: "Open", via: "command", cmd: "@ticket {short_id}" },
        claim: { label: "Claim", via: "command", cmd: "@claim {short_id}" },
        resolve: { label: "Resolve", via: "command", cmd: "@resolve {short_id}" },
        approve: { label: "Approve", via: "command", cmd: "@approve {short_id}[ = {text}]" },
        deny: { label: "Deny", via: "command", cmd: "@deny {short_id}[ = {text}]" },
        reply: { label: "Reply", via: "command", cmd: "@ticket {short_id} = {text}" },
        reply_note: { label: "Reply (note)", via: "command", cmd: "" }
      },
      gmcpAction: (a, v) => a === "open" ? [`${P}.Get`, { id: v.id }] : [`${P}.Action`, { action: a === "reply_note" ? "reply" : a, id: v.id, ...v.text ? { text: v.text } : {}, ...v.internal ? { internal: true } : {} }],
      options: [{ key: "rich", label: "Rich text in messages", default: false, kind: "toggle", scope: "both" }]
    });
    const mine = new WorldModule(mu, {
      key: "mytickets",
      title: "My tickets",
      panels: ["mytickets"],
      pkg: P,
      defaultMode: "on",
      actions: { myreply: { label: "Reply", via: "command", cmd: "@ticket {id} = {text}" } },
      gmcpAction: (_a, v) => [`${P}.Action`, { action: "reply", id: v.id, text: v.text }],
      options: [
        { key: "emptyHint", label: "Empty-list hint", default: DEFAULT_HINT, kind: "text", hint: "wrap commands in `backticks`", scope: "both" },
        { key: "text", label: "Read @tickets output", default: true, kind: "toggle", hint: "when the game has no Client.Tickets GMCP: ask with @tickets / @ticket <id>, parse the text and hide it", scope: "both" }
      ]
    });
    mu.ui.style(MODULE_CSS);
    mu.settings.define({ title: "Tickets", items: [...tickets.settingItems(), ...mine.settingItems()] });
    const redraws = /* @__PURE__ */ new Set();
    const redraw = () => redraws.forEach((f) => f());
    const upsertIn = (list, t) => {
      if (!list) return false;
      const i = list.findIndex((x) => x.id === t.id);
      if (i >= 0) list[i] = { ...list[i], ...t };
      return i >= 0;
    };
    const setRole = (sid, staff) => {
      S(sid).role = staff;
      tickets.setStaff(sid, staff);
      redraw();
    };
    const setInbox = (sid, list) => {
      const st = S(sid);
      st.inbox = list.map(norm);
      const fresh = tickets.fresh(sid, st.inbox.map((t) => t.id));
      for (const id of fresh) st.fresh.add(id);
      for (const id of [...st.fresh]) if (!st.inbox.some((t) => t.id === id)) st.fresh.delete(id);
      tickets.announce(st.inbox.filter((t) => fresh.includes(t.id)).map((t) => ({ title: `New ${t.kind ?? "ticket"} ${t.short_id}`, body: [t.requester_name, t.subject].filter(Boolean).join(": ") })));
      tickets.touched(sid);
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
    const pushMessage = (sid, d) => {
      const id = String(d.id);
      for (const map of [S(sid).threads, M(sid).threads]) {
        const t = map.get(id);
        if (!t) continue;
        t.messages = [...t.messages ?? [], d.message];
        if (d.status) t.status = d.status;
      }
      if (d.status) {
        upsertIn(S(sid).inbox, { id, status: d.status });
        upsertIn(M(sid).open, { id, status: d.status });
      }
      redraw();
    };
    const setMine = (sid, list, closed) => {
      const m = M(sid);
      m.error = false;
      if (closed) m.closed = list.map(norm);
      else m.open = list.map(norm);
      mine.touched(sid);
      redraw();
    };
    const setMyThread = (sid, t) => {
      const n = norm(t), m = M(sid);
      m.threads.set(n.id, { ...m.threads.get(n.id), ...n });
      m.error = false;
      redraw();
    };
    const alert = (a) => mu.ui.toast(`Unclaimed ${a.label ?? "ticket"}`, [a.who, a.age_mins !== void 0 ? `waiting ${age(a.age_mins)}` : ""].filter(Boolean).join(" \xB7 "), { kind: "tickets" });
    const pending = /* @__PURE__ */ new Map();
    const pendKey = (sid, kind, closed, id) => `${sid}\0${kind}\0${kind === "mine" ? closed : id}`;
    const settle = (sid, kind, closed, id) => {
      const k = pendKey(sid, kind, closed, id);
      const t = pending.get(k);
      if (t) {
        clearTimeout(t);
        pending.delete(k);
      }
    };
    const handle = (pkg, data, sid) => {
      const sub = pkg.slice(P.length + 1);
      const schema = SCHEMAS[sub];
      if (!schema) return;
      const forMine = sub === "Mine" || sub === "MyThread";
      const mod = forMine ? mine : tickets;
      if (!mod.acceptsGmcp(sid) && !(sub === "Message" && mine.acceptsGmcp(sid))) return;
      if (!mod.check(sid, pkg, schema, data)) return;
      const d = data;
      switch (sub) {
        case "Role":
          setRole(sid, !!d.staff);
          break;
        case "Inbox":
          setInbox(sid, d.tickets);
          break;
        case "History":
          S(sid).history = d.tickets.map(norm);
          redraw();
          break;
        case "Thread":
          setThread(sid, d);
          tickets.touched(sid);
          break;
        case "Message":
          pushMessage(sid, d);
          break;
        case "Alert":
          if (S(sid).role) alert(d);
          break;
        case "BugDetail": {
          const t = S(sid).threads.get(String(d.id));
          if (t) {
            t.bug = d.bug;
            redraw();
          }
          break;
        }
        case "Mine":
          settle(sid, "mine", !!d.closed);
          setMine(sid, d.tickets, !!d.closed);
          break;
        case "MyThread":
          settle(sid, "thread", false, String(d.id));
          setMyThread(sid, d);
          break;
      }
    };
    mu.gmcp.on(P, (data, { sid, pkg }) => handle(pkg, data, sid));
    replay(mu, ["Role", "Inbox", "Mine"].map((s) => `${P}.${s}`), (pkg, data, sid) => handle(pkg, data, sid));
    const myViews = /* @__PURE__ */ new Map();
    const myViewOf = (sid) => myViews.get(sid) ?? myViews.set(sid, { closed: false, open: null, draft: "", fb: null }).get(sid);
    const textJobs = /* @__PURE__ */ new Map();
    const textQueue = /* @__PURE__ */ new Map();
    const echoes = /* @__PURE__ */ new Map();
    const textOn = (sid) => mine.option("text", sid) !== false && mine.source(mine.worldOf(sid)) !== "api";
    const say = (sid, cmd) => {
      (echoes.get(sid) ?? echoes.set(sid, /* @__PURE__ */ new Set()).get(sid)).add(cmd);
      void mu.sessions.send(cmd, sid);
    };
    const finishJob = (sid, ok) => {
      const j = textJobs.get(sid);
      if (!j) return;
      clearTimeout(j.timer);
      textJobs.delete(sid);
      if (j.phase === "open" || j.phase === "finished") say(sid, "q");
      if (j.kind === "mine") {
        if (ok || j.sawList) {
          setMine(sid, j.closed ? j.rows.filter((t) => !OPEN_STATUS.test(t.status ?? "")) : j.rows, j.closed);
        } else {
          M(sid).error = true;
          redraw();
        }
      } else if (j.th.t && !j.th.error) setMyThread(sid, j.th.t);
      else if (!ok || j.th.error) {
        const v = myViewOf(sid);
        if (v.open === j.id) v.fb = { ok: false, text: j.th.error ? `No ticket ${j.id}.` : "The game did not answer." };
        redraw();
      }
      textQueue.get(sid)?.shift()?.();
    };
    const startJob = (sid, kind, closed, id) => {
      if (textJobs.has(sid)) {
        (textQueue.get(sid) ?? textQueue.set(sid, []).get(sid)).push(() => startJob(sid, kind, closed, id));
        return;
      }
      const j = { kind, closed, id, rows: [], phase: "sent", hasNext: false, sawList: false, th: threadParse(), timer: setTimeout(() => finishJob(sid, false), TEXT_TIMEOUT_MS) };
      textJobs.set(sid, j);
      say(sid, kind === "mine" ? "@tickets" : `@ticket ${id}`);
    };
    const requestData = (a, sid, kind, closed, id) => {
      const pkg = kind === "mine" ? `${P}.Mine` : `${P}.MyGet`;
      void mu.gmcp.send(pkg, a, sid).then((sent) => {
        if (!textOn(sid)) return;
        if (!sent) {
          startJob(sid, kind, closed, id);
          return;
        }
        const k = pendKey(sid, kind, closed, id);
        settle(sid, kind, closed, id);
        pending.set(k, setTimeout(() => {
          pending.delete(k);
          startJob(sid, kind, closed, id);
        }, GMCP_GRACE_MS));
      });
    };
    mine.onRequest("mine", (a, s) => requestData(a, s.sid, "mine", !!a.closed));
    mine.onRequest("myget", (a, s) => requestData(a, s.sid, "thread", false, String(a.id)));
    const charName = (sid) => String(mu.gmcp.state("Char.Name", sid)?.name ?? mu.gmcp.state("Player.Context", sid)?.character ?? "");
    const menuStage = (j, sid, text, gag) => {
      if (LIST_HEAD.test(text)) {
        j.sawList = true;
        gag();
        j.phase = /FINISHED/.test(text) ? "finished" : "open";
        return;
      }
      if (j.phase === "sent") {
        if (text === "" || MENU_NOISE.test(text)) gag();
        return;
      }
      if (text === "" || MENU_NOISE.test(text)) {
        gag();
        return;
      }
      const row = parseRow(text);
      if (row) {
        if (!j.rows.some((t) => t.id === row.id)) j.rows.push(row);
        gag();
        return;
      }
      if (MENU_NEXT.test(text)) {
        j.hasNext = true;
        gag();
        return;
      }
      if (MENU_END.test(text)) {
        gag();
        if (j.closed && j.phase === "open") {
          j.rows = [];
          j.hasNext = false;
          say(sid, "f");
          return;
        }
        if (j.closed && j.hasNext) {
          j.hasNext = false;
          say(sid, "n");
          return;
        }
        say(sid, "q");
        j.phase = "done";
        finishJob(sid, true);
        return;
      }
      if (MENU_LINE.test(text)) gag();
    };
    ctx.subscriptions.push(mu.lines.stage({
      id: "mytickets-text",
      order: 300,
      run(line, c) {
        const text = line.text.replace(/\s+$/, "");
        if (line.kind === "echo") {
          const e = echoes.get(c.sid);
          if (e?.has(text)) {
            e.delete(text);
            c.gag();
          }
          return;
        }
        const j = textJobs.get(c.sid);
        if (!j || line.kind !== "output") return;
        if (j.kind === "mine") {
          menuStage(j, c.sid, text, c.gag);
          return;
        }
        if (!feedThread(j.th, text, charName(c.sid))) return;
        c.gag();
        if (!j.th.done) return;
        clearTimeout(j.timer);
        j.timer = setTimeout(() => finishJob(c.sid, !j.th.error), 150);
      }
    }));
    ctx.subscriptions.push(() => {
      for (const t of pending.values()) clearTimeout(t);
      pending.clear();
      for (const j of textJobs.values()) clearTimeout(j.timer);
      textJobs.clear();
      textQueue.clear();
      echoes.clear();
    });
    const views = /* @__PURE__ */ new Map();
    const viewOf = (key) => views.get(key) ?? views.set(key, { tab: "open", kinds: /* @__PURE__ */ new Set(), open: null, bug: false, draft: "", note: false, fb: null }).get(key);
    function mountTickets(el, pc, panelId, fixedKinds) {
      const sidOf = () => pc.sid ?? active();
      el.classList.add("mx", "tickets");
      el.dataset.testid = "tickets";
      const draw = () => {
        const sid = sidOf();
        const v = viewOf(`${panelId}\0${sid}`);
        const focused = el.contains(document.activeElement) ? document.activeElement.dataset.focus : void 0;
        if (!sid) {
          fill(el, h("p", { class: "empty" }, "No session"));
          return;
        }
        const st = S(sid);
        if (v.open) drawThread(sid, st, v);
        else drawList(sid, st, v);
        if (focused) el.querySelector(`[data-focus="${focused}"]`)?.focus();
      };
      const back = (testid, onclick, label = "Back") => h("button", { class: "sh-cmd back", type: "button", "data-testid": testid, "data-focus": "back", onclick }, label);
      const fbLine = (v) => v.fb ? h("p", { class: `fb${v.fb.ok ? "" : " err"}`, role: "status", "data-testid": "tickets-fb" }, v.fb.text) : null;
      const drawList = (sid, st, v) => {
        const all = v.tab === "open" ? st.inbox : st.history ?? [];
        const scoped = fixedKinds ? all.filter((t) => fixedKinds.includes(t.kind ?? "")) : all;
        const kinds = [...new Set(scoped.map((t) => t.kind).filter((k) => !!k))];
        for (const k of [...v.kinds]) if (!kinds.includes(k)) v.kinds.delete(k);
        const rows = v.kinds.size ? scoped.filter((t) => v.kinds.has(t.kind ?? "")) : scoped;
        const tab = (id, label) => h("button", {
          class: "sh-toggle",
          type: "button",
          "aria-pressed": String(v.tab === id),
          "data-testid": `tickets-tab-${id}`,
          "data-focus": `tab-${id}`,
          onclick: () => {
            v.tab = id;
            v.fb = null;
            if (id === "history" && st.history === null) void tickets.request("history", `${P}.List`, { history: true }, sid);
            draw();
          }
        }, label);
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
          kinds.length > 1 ? h("div", { class: "filters" }, h("div", { class: "fl", role: "group", "aria-label": "filter by kind" }, kinds.map((k) => h("button", {
            class: "sh-toggle fchip",
            type: "button",
            "aria-pressed": String(v.kinds.has(k)),
            "data-kind": k,
            "data-focus": `k-${k}`,
            onclick: () => {
              if (v.kinds.has(k)) v.kinds.delete(k);
              else v.kinds.add(k);
              draw();
            }
          }, k)))) : null,
          h(
            "div",
            { class: "list", "data-testid": "tickets-list" },
            rows.length ? rows.map((t) => h(
              "button",
              {
                class: `sh-row row${st.fresh.has(t.id) ? " hot" : ""}`,
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
                  draw();
                  void tickets.run("open", { id: t.id, short_id: t.short_id }, sid);
                }
              },
              h(
                "span",
                { class: "r1" },
                h("span", { class: "kind" }, `${t.kind ?? t.label ?? "ticket"} `, h("span", { class: "sid" }, t.short_id)),
                h(
                  "span",
                  { class: "meta" },
                  t.priority ? h("span", { class: "pri", title: "priority" }, "!".repeat(Math.min(4, t.priority))) : null,
                  t.assignee ? h("span", { class: "asg", title: `claimed by ${t.assignee}` }, t.assignee) : null,
                  t.status ? h("span", { class: plateCls(t.status, "status") }, t.status) : null,
                  h("span", { class: "age" }, age(t.age_mins))
                )
              ),
              t.requester_name ? h("span", { class: "who" }, t.requester_name) : null,
              t.subject ? h("span", { class: "subject" }, t.subject) : null,
              t.preview ? h("span", { class: "prev" }, t.preview) : null
            )) : h("p", { class: "empty", "data-testid": "tickets-empty" }, v.tab === "open" ? "No open tickets." : st.history === null ? "Loading" : "No closed tickets.")
          )
        );
      };
      const drawThread = (sid, st, v) => {
        const id = v.open;
        const row = st.inbox.find((t2) => t2.id === id) ?? st.history?.find((t2) => t2.id === id);
        const t = { ...row, ...st.threads.get(id), id };
        const vars = { id, short_id: t.short_id ?? `#${id}` };
        const rich = tickets.option("rich", sid);
        const reply = () => el.querySelector("[data-testid=tickets-reply]");
        const act = (name, label, cls = "") => tickets.shows(name, sid) ? h("button", {
          class: `sh-cmd act ${cls}`.trim(),
          type: "button",
          "data-action": name,
          "data-focus": `act-${name}`,
          onclick: async () => {
            const input = reply();
            const text = (name === "approve" || name === "deny") && input?.value.trim() ? input.value.trim() : "";
            try {
              v.fb = feedback(await tickets.run(name, { ...vars, text }, sid), name, vars.short_id);
            } catch (e) {
              v.fb = failed(e);
            }
            if (text && input) {
              input.value = "";
              v.draft = "";
            }
            draw();
          }
        }, label) : null;
        const closed = isClosed(t.status);
        const ctxRows = Object.entries(t.context ?? {});
        const isBug = (t.kind ?? "").toLowerCase() === "bug";
        fill(
          el,
          h(
            "div",
            { class: "hd" },
            h("span", { class: "tag glow-text" }, "Tickets"),
            h("span", { class: "sub" }, `${t.kind ?? "ticket"} ${vars.short_id}`),
            back("tickets-back", () => {
              v.open = null;
              v.fb = null;
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
                  t.account_name ? h("span", { class: "acct" }, t.account_name) : null,
                  t.status ? h("span", { class: plateCls(t.status), "data-testid": "tickets-status" }, t.status) : null,
                  t.assignee ? h("span", { class: "asg" }, t.assignee) : null
                )
              ),
              closed ? null : h("span", { class: "actions" }, act("claim", "Claim"), act("approve", "Approve", "primary"), act("deny", "Deny", "warn"), act("resolve", "Resolve"))
            ),
            h(
              "div",
              { class: "body" },
              t.subject || ctxRows.length || isBug ? h(
                "div",
                { class: "ctx" },
                t.subject ? h("div", { class: "cx" }, h("span", { class: "ck" }, "subject"), h("span", { class: "cv" }, t.subject)) : null,
                ctxRows.map(([k, val]) => h("div", { class: "cx" }, h("span", { class: "ck" }, k), h("span", { class: "cv" }, String(val)))),
                isBug && !v.bug ? h("button", { class: "sh-cmd loadbug", type: "button", "data-testid": "tickets-loadbug", "data-focus": "loadbug", "aria-expanded": "false", onclick: () => {
                  v.bug = true;
                  if (!t.bug) void tickets.request("bugdetail", `${P}.BugDetail`, { id }, sid);
                  draw();
                } }, "Report detail") : null
              ) : null,
              isBug && v.bug ? h(
                "div",
                { class: "bug", "data-testid": "tickets-bug" },
                t.bug && Object.keys(t.bug).length ? [
                  h("div", { class: "bl" }, h("span", { class: "ck" }, "reporter"), t.bug.reporter ?? "\u2014"),
                  h("div", { class: "bl" }, h("span", { class: "ck" }, "location"), t.bug.location ?? "\u2014"),
                  h("div", { class: "bl" }, h("span", { class: "ck" }, "last cmd"), h("span", { class: "dim" }, t.bug.last_cmd ?? "\u2014")),
                  t.bug.traceback ? [h("div", { class: "ck" }, "traceback"), h("pre", { class: "tb" }, t.bug.traceback)] : null,
                  t.bug.char_state ? [h("div", { class: "ck" }, "character state"), h("pre", { class: "tb" }, t.bug.char_state)] : null
                ] : h("span", { class: "dim" }, t.bug ? "No detailed bug report attached." : "Loading")
              ) : null,
              h(
                "div",
                { class: "msgs", role: "log", "aria-label": "Conversation", "data-testid": "tickets-msgs" },
                t.messages?.length ? t.messages.map((m) => {
                  const o = originOf(m, t.requester_name);
                  if (o === "system") return h("div", { class: "sys" }, m.ts !== void 0 ? h("span", { class: "mts" }, clock(m.ts)) : null, ` ${m.text ?? ""}`);
                  return h(
                    "div",
                    { class: `m${m.visibility === "internal" ? " note" : ""}${o === "staff" ? " staffmsg" : ""}` },
                    h("span", { class: "s" }, m.sender ?? "?"),
                    o === "player" ? h("span", { class: "sh-plate gold" }, "Player") : null,
                    m.ts !== void 0 ? h("span", { class: "mts" }, clock(m.ts)) : null,
                    h("span", { class: "t" }, body(m, rich))
                  );
                }) : h("p", { class: "empty" }, "No messages yet.")
              )
            ),
            tickets.shows("reply", sid) ? h(
              "form",
              {
                class: "reply",
                onsubmit: async (e) => {
                  e.preventDefault();
                  const input = e.currentTarget.querySelector("textarea");
                  const text = input.value.trim();
                  if (!text) return;
                  const note = v.note;
                  const useNote = note && tickets.action("reply_note", tickets.worldOf(sid)).cmd;
                  const name = useNote ? "reply_note" : "reply";
                  try {
                    v.fb = feedback(await tickets.run(name, { ...vars, text, internal: note ? "1" : "" }, sid), note ? "reply_note" : "reply", vars.short_id);
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
              replyArea({ class: "sh-field", "aria-label": "ticket reply", "aria-describedby": `${panelId}-reply-keys`, placeholder: v.note ? "Staff note" : "Reply to player", value: v.draft, "data-testid": "tickets-reply", "data-focus": "reply", oninput: (e) => {
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
        el.replaceChildren();
      };
    }
    const loadMine = (sid, closed) => {
      M(sid).error = false;
      void mine.request("mine", `${P}.Mine`, { closed }, sid);
    };
    function mountMine(el, pc) {
      const sidOf = () => pc.sid ?? active();
      el.classList.add("mx", "mine");
      el.dataset.testid = "mytickets";
      const draw = () => {
        const sid2 = sidOf();
        const focused = el.contains(document.activeElement) ? document.activeElement.dataset.focus : void 0;
        if (!sid2) {
          fill(el, h("p", { class: "empty" }, "No session"));
          return;
        }
        const m = M(sid2), v = myViewOf(sid2);
        const back = h("button", { class: "sh-cmd back", type: "button", "data-testid": "mytickets-back", "data-focus": "back", onclick: () => {
          v.open = null;
          v.fb = null;
          draw();
        } }, "Back");
        const fbLine = v.fb ? h("p", { class: `fb${v.fb.ok ? "" : " err"}`, role: "status", "data-testid": "mytickets-fb" }, v.fb.text) : null;
        if (v.open) {
          const id = v.open;
          const row = [...m.open ?? [], ...m.closed ?? []].find((t2) => t2.id === id);
          const t = { ...row, ...m.threads.get(id), id };
          const closed = isClosed(t.status);
          const short = t.short_id ?? `#${id}`;
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
                h("span", { class: "ctitle" }, t.subject ?? short),
                h(
                  "span",
                  { class: "cmeta" },
                  h("span", { class: "ckind" }, `${t.kind ?? "ticket"} ${short}`),
                  t.status ? h("span", { class: plateCls(t.status), "data-testid": "mytickets-status" }, t.status) : null
                )
              ),
              h(
                "div",
                { class: "msgs", role: "log", "aria-label": "Conversation", "data-testid": "mytickets-msgs" },
                t.messages?.length ? t.messages.filter((x) => x.visibility !== "internal").map((x) => {
                  const o = originOf(x, t.requester_name);
                  if (o === "system") return h("div", { class: "sys" }, x.ts !== void 0 ? h("span", { class: "mts" }, clock(x.ts)) : null, ` ${x.text ?? ""}`);
                  return h(
                    "div",
                    { class: `m${o === "player" ? " me" : " staffmsg"}` },
                    h(
                      "span",
                      { class: "who" },
                      h("span", { class: "s" }, x.sender ?? "?"),
                      o === "staff" ? h("span", { class: "sh-plate hot" }, "Staff") : h("span", { class: "sh-plate dim" }, "You"),
                      x.ts !== void 0 ? h("span", { class: "mts" }, clock(x.ts)) : null
                    ),
                    h("span", { class: "t" }, body(x, false))
                  );
                }) : h("p", { class: "empty" }, closed ? "No messages." : "No messages yet. Add one below.")
              ),
              closed ? h("div", { class: "closed-note", "data-testid": "mytickets-closed" }, "This ticket is closed. Open a new one if you still need help.") : mine.shows("myreply", sid2) ? h(
                "form",
                {
                  class: "reply",
                  onsubmit: async (e) => {
                    e.preventDefault();
                    const input = e.currentTarget.querySelector("textarea");
                    const text = input.value.trim();
                    if (!text) return;
                    try {
                      const r = await mine.run("myreply", { id, short_id: short, text }, sid2);
                      v.fb = feedback(r, "myreply", short);
                      if (r === "command" && textOn(sid2)) setTimeout(() => {
                        if (v.open === id) void mine.request("myget", `${P}.MyGet`, { id }, sid2);
                      }, 600);
                    } catch (err) {
                      v.fb = failed(err);
                    }
                    input.value = "";
                    v.draft = "";
                    draw();
                  }
                },
                replyArea({ class: "sh-field", "aria-label": "reply to staff", "aria-describedby": "mine-reply-keys", placeholder: "Reply to staff", value: v.draft, "data-testid": "mytickets-reply", "data-focus": "reply", oninput: (e) => {
                  v.draft = e.target.value;
                } }),
                h("span", { id: "mine-reply-keys", class: "sr-only" }, "Enter sends. Shift+Enter starts a new line."),
                h("div", { class: "rkeys" }, h("button", { class: "sh-cmd primary send", type: "submit", "data-testid": "mytickets-send", "data-focus": "send" }, "Reply"))
              ) : null
            )
          );
        } else {
          const list = v.closed ? m.closed : m.open;
          const tab = (closed, label) => h("button", {
            class: "sh-toggle",
            type: "button",
            "aria-pressed": String(v.closed === closed),
            "data-testid": `mytickets-tab-${closed ? "closed" : "open"}`,
            "data-focus": `tab-${closed}`,
            onclick: () => {
              v.closed = closed;
              v.fb = null;
              if ((closed ? m.closed : m.open) === null) loadMine(sid2, closed);
              draw();
            }
          }, label);
          fill(
            el,
            h(
              "div",
              { class: "hd" },
              h("span", { class: "tag glow-text" }, "My tickets"),
              tab(false, "Open"),
              tab(true, "Closed"),
              list?.length ? h("span", { class: "count" }, String(list.length)) : null
            ),
            fbLine,
            h(
              "div",
              { class: "list", "data-testid": "mytickets-list" },
              m.error ? h(
                "p",
                { class: "empty err", role: "alert", "data-testid": "mytickets-error" },
                "Could not load tickets.",
                h("button", { class: "sh-cmd retry", type: "button", "data-focus": "retry", onclick: () => {
                  loadMine(sid2, v.closed);
                  draw();
                } }, "Try again")
              ) : list === null ? h("p", { class: "empty" }, "Loading") : list.length ? list.map((t) => h(
                "button",
                {
                  class: "sh-row row",
                  type: "button",
                  "data-id": t.id,
                  "data-kind": t.kind ?? "",
                  "data-focus": `row-${t.id}`,
                  onclick: () => {
                    v.open = t.id;
                    v.fb = null;
                    draw();
                    void mine.request("myget", `${P}.MyGet`, { id: t.id }, sid2);
                  }
                },
                h(
                  "span",
                  { class: "r1" },
                  h("span", { class: "kind" }, t.kind ?? "ticket"),
                  h("span", { class: "id" }, t.short_id ?? ""),
                  t.status ? h("span", { class: plateCls(t.status) }, t.status) : null,
                  h("span", { class: "age" }, age(t.age_mins))
                ),
                t.subject ? h("span", { class: "subject" }, t.subject) : null,
                t.preview ? h("span", { class: "prev" }, t.preview) : null
              )) : h("p", { class: "empty", "data-testid": "mytickets-empty" }, ...hint(mine.option("emptyHint", sid2) || DEFAULT_HINT))
            )
          );
        }
        if (focused) el.querySelector(`[data-focus="${focused}"]`)?.focus();
      };
      redraws.add(draw);
      const off = mu.sessions.on("switch", () => draw());
      const sid = sidOf();
      if (sid && M(sid).open === null) loadMine(sid, false);
      draw();
      return () => {
        redraws.delete(draw);
        off();
        el.replaceChildren();
      };
    }
    mu.panels.register({ id: "tickets", title: "Tickets", singleton: true, defaultPosition: "right-bottom", inViewsMenu: false, mount: (el, pc) => mountTickets(el, pc, "tickets") });
    mu.panels.register({ id: "mytickets", title: "My tickets", singleton: true, defaultPosition: "right-bottom", inViewsMenu: false, mount: (el, pc) => mountMine(el, pc) });
    ctx.subscriptions.push(...tickets.bind(), ...mine.bind(), tickets.onChange(redraw), mine.onChange(redraw));
    const mineApi = {
      enable: (mode, w) => mine.configure({ enabled: mode }, w),
      open: () => mu.panels.open("mytickets"),
      onAction: (a, fn) => mine.onAction(a, fn),
      onRequest: (k, fn) => mine.onRequest(k, fn),
      configure: (cfg, w) => mine.configure(cfg, w),
      set(what, data, sid) {
        const s = need(sid);
        if (!mine.acceptsApi(s)) return;
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
    const api = {
      enable: (mode, w) => tickets.configure({ enabled: mode }, w),
      open: () => mu.panels.open("tickets"),
      onAction: (a, fn) => tickets.onAction(a, fn),
      onRequest: (k, fn) => tickets.onRequest(k, fn),
      configure: (cfg, w) => tickets.configure(cfg, w),
      setRole: (role, sid) => setRole(need(sid), role === "staff"),
      set(what, data, sid) {
        const s = need(sid);
        if (!tickets.acceptsApi(s)) return;
        if (what === "inbox") setInbox(s, data.tickets ?? []);
        else {
          S(s).history = (data.tickets ?? []).map(norm);
          redraw();
        }
      },
      upsert(_w, t, sid) {
        const s = need(sid), st = S(s), id = String(t.id);
        const n = { ...t, id };
        if (!upsertIn(st.inbox, n) && !upsertIn(st.history, n)) st.inbox.push(norm(n));
        const th = st.threads.get(id);
        if (th) Object.assign(th, n);
        tickets.touched(s);
        redraw();
      },
      remove(_w, id, sid) {
        const st = S(need(sid));
        st.inbox = st.inbox.filter((t) => t.id !== String(id));
        if (st.history) st.history = st.history.filter((t) => t.id !== String(id));
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
        return mu.panels.register({ id: opts.id, title: opts.title, singleton: true, defaultPosition: "right-bottom", mount: (el, pc) => mountTickets(el, pc, opts.id, kinds) });
      },
      mine: mineApi
    };
    return api;
  }
});
export {
  index_default as default
};
