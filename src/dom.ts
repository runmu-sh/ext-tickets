/**
 * The few plain-DOM helpers the panels need (inlined from ext-kit's dom.ts in 2.0). The SDK's `h` sets every
 * attribute as an attribute; ours also sets the `value` / `checked` properties, which a re-render needs to put a
 * draft back into a textarea or a checkbox.
 */
export type Child = Node | string | number | null | undefined | false | Child[];
type Props = Record<string, unknown> | null | undefined;

export function h(tag: string, props?: Props, ...kids: Child[]): HTMLElement {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props ?? {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') el.className = String(v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v as EventListener);
    else if (k === 'value') (el as HTMLInputElement).value = String(v);
    else if (k === 'checked') (el as HTMLInputElement).checked = !!v;
    else if (k === 'disabled') (el as HTMLButtonElement).disabled = !!v;
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  append(el, kids);
  return el;
}

function append(el: Node, kids: Child[]) {
  for (const c of kids) {
    if (c === null || c === undefined || c === false) continue;
    if (Array.isArray(c)) append(el, c);
    else el.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
  }
}

/** Replace the children of `el`. */
export function fill(el: HTMLElement, ...kids: Child[]) { el.replaceChildren(); append(el, kids); }

/** Seconds since the epoch from s, ms or an ISO string; NaN when absent. */
const epochS = (ts?: number | string): number => {
  if (ts === undefined || ts === null || ts === '') return NaN;
  const n = typeof ts === 'number' ? ts : /^\d+(\.\d+)?$/.test(ts) ? +ts : Date.parse(ts) / 1000;
  return n > 1e12 ? n / 1000 : n;
};

/** An age like the game's: `now`, `12m`, `3h`, `2d`. From `updated` (epoch) when given, else `age_mins`. */
export function age(mins?: number, updated?: number | string): string {
  const u = epochS(updated);
  const m = Number.isFinite(u) ? (Date.now() / 1000 - u) / 60 : mins;
  if (m === undefined || m === null || !Number.isFinite(+m)) return '';
  const n = Math.max(0, Math.floor(+m));
  if (Number.isFinite(u) && n < 1) return 'now';
  if (n < 60) return `${n}m`;
  if (n < 60 * 24) return `${Math.floor(n / 60)}h`;
  return `${Math.floor(n / 1440)}d`;
}

const pad = (n: number) => String(n).padStart(2, '0');
/** A message time: `HH:MM` today, `M/D HH:MM` before (`always`: the date every time, as the staff queue). */
export function stamp(ts?: number | string, always = false): string {
  const s = epochS(ts);
  if (!Number.isFinite(s)) return '';
  const d = new Date(s * 1000);
  const hm = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  return !always && d.toDateString() === new Date().toDateString() ? hm : `${d.getMonth() + 1}/${d.getDate()} ${hm}`;
}

/** The `.sh-plate` variant of a status: waiting on staff hot, on someone gold, approved ok, finished dim. */
export function plateOf(status?: string): string {
  const s = (status ?? '').toLowerCase();
  if (s === 'open' || s === 'pending') return 'hot';
  if (s === 'claimed' || s === 'waiting') return 'gold';
  if (s === 'approved') return 'ok';
  if (/^(resolved|closed|denied|withdrawn)$/.test(s)) return 'dim';
  return '';
}
/** `base` is the host's plate class (`mu.ui.css.plate`). */
export const plateCls = (base: string, status?: string, ...extra: string[]) => [base, plateOf(status), ...extra].filter(Boolean).join(' ');

/** Text with `backtick` spans shown as game commands (the My tickets empty hint). */
export function hint(text: string): HTMLElement[] {
  return text.split(/(`[^`]+`)/).filter(Boolean).map((p) => (p.startsWith('`') ? h('span', { class: 'cmdref' }, p.slice(1, -1)) : h('span', null, p)));
}

/** A textarea where Enter submits its form and Shift+Enter starts a new line. */
export function replyArea(props: Record<string, unknown>): HTMLTextAreaElement {
  const ta = h('textarea', { rows: 2, ...props }) as HTMLTextAreaElement;
  ta.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' || e.shiftKey || e.isComposing) return;
    e.preventDefault();
    (ta.form ?? ta.closest('form'))?.dispatchEvent(new Event('submit', { cancelable: true }));
  });
  return ta;
}
