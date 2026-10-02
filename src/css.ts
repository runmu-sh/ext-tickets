/**
 * The Tickets and My tickets panel styles: the terminal look of the world modules, in tokens only, laid
 * out around the host's primitives from `mu.ui.css` (`.sh-row`, `.sh-plate`, `.sh-cmd`, `.sh-toggle`,
 * `.sh-field`), which are never redefined here. Every rule is scoped under this extension's panel box,
 * `.ext-panel[data-ext="tickets"]`. Radius 0, weights 400/500, 1px rules.
 */
const R = '.ext-panel[data-ext="tickets"] .mx';

export const PANEL_CSS = `
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
