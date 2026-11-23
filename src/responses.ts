import { ApiError, getRsvps, storage, type RsvpResponse, type Rsvp } from './api.ts';

const PASS_KEY = 'aman-rsvp-passcode';
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const lock = $('lock');
const results = $('results');
const passForm = $<HTMLFormElement>('pass-form');
const passInput = $<HTMLInputElement>('passcode');
const passError = $('pass-error');
const unlockBtn = $<HTMLButtonElement>('unlock');
const refreshBtn = $<HTMLButtonElement>('refresh');

let passcode: string | null = storage.get(sessionStorage, PASS_KEY);
let rows: Rsvp[] = [];

const fmt = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });
const LABEL: Record<RsvpResponse, string> = { yes: '✅ Yes', maybe: '🤔 Maybe', no: '❌ No' };
const sum = (rs: Rsvp[], f: (r: Rsvp) => number) => rs.reduce((n, r) => n + f(r), 0);

function render() {
  const yes = rows.filter((r) => r.response === 'yes');
  const maybe = rows.filter((r) => r.response === 'maybe');
  const no = rows.filter((r) => r.response === 'no');
  const yesAdults = sum(yes, (r) => r.adults);
  const yesKids = sum(yes, (r) => r.children);
  const maybePeople = sum(maybe, (r) => r.adults + r.children);

  $('stat-adults').textContent = String(yesAdults);
  $('stat-kids').textContent = String(yesKids);
  $('stat-total').textContent = String(yesAdults + yesKids);
  $('stat-total-sub').textContent = `${yes.length} ${yes.length === 1 ? 'household' : 'households'}`;
  $('stat-maybe').textContent = String(maybe.length);
  $('stat-maybe-sub').textContent = `${maybePeople} ${maybePeople === 1 ? 'person' : 'people'}`;
  $('stat-no').textContent = String(no.length);
  $('updated').textContent = `Updated ${fmt.format(new Date())}`;

  $('rows').replaceChildren(
    ...rows.map((r) => {
      const tr = document.createElement('tr');
      const coming = r.response !== 'no';
      const cells: [string, string][] = [
        [r.name, ''],
        [LABEL[r.response], r.response],
        [coming ? String(r.adults) : '—', 'num'],
        [coming ? String(r.children) : '—', 'num'],
        [fmt.format(new Date(r.updated_at)), 'muted'],
      ];
      for (const [text, cls] of cells) {
        const td = document.createElement('td');
        td.textContent = text;
        if (cls) td.className = cls;
        tr.append(td);
      }
      return tr;
    }),
  );
  $('empty').hidden = rows.length > 0;
  $('table').hidden = rows.length === 0;
}

async function load(code: string): Promise<boolean> {
  try {
    rows = await getRsvps(code);
    passcode = code;
    storage.set(sessionStorage, PASS_KEY, code);
    lock.hidden = true;
    results.hidden = false;
    render();
    return true;
  } catch (err) {
    const wrong = err instanceof ApiError && (err.code === '28P01' || err.message === 'invalid passcode');
    if (wrong) {
      passcode = null;
      storage.set(sessionStorage, PASS_KEY, null);
      results.hidden = true;
      lock.hidden = false;
    }
    passError.textContent = wrong ? 'That passcode is not right. Try again.' : (err as Error).message;
    passError.hidden = false;
    return false;
  }
}

passForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  passError.hidden = true;
  unlockBtn.disabled = true;
  unlockBtn.textContent = 'Checking…';
  const ok = await load(passInput.value);
  unlockBtn.disabled = false;
  unlockBtn.textContent = 'View responses';
  if (!ok) passInput.select();
});

refreshBtn.addEventListener('click', async () => {
  if (!passcode) return;
  refreshBtn.disabled = true;
  refreshBtn.textContent = 'Refreshing…';
  await load(passcode);
  refreshBtn.disabled = false;
  refreshBtn.textContent = 'Refresh';
});

$('lock-btn').addEventListener('click', () => {
  passcode = null;
  storage.set(sessionStorage, PASS_KEY, null);
  rows = [];
  passInput.value = '';
  results.hidden = true;
  lock.hidden = false;
});

if (passcode) void load(passcode);
else passInput.focus();
