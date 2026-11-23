import { ApiError, describeParty, storage, submitRsvp, type RsvpResponse } from './api.ts';

type Saved = { name: string; response: RsvpResponse; adults: number; children: number };
const SAVED_KEY = 'aman-rsvp';
const MAX_COUNT = 10;

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const form = $<HTMLFormElement>('rsvp-form');
const nameInput = $<HTMLInputElement>('name');
const choiceBtns = [...document.querySelectorAll<HTMLButtonElement>('.choice-btn')];
const countsField = $('counts-field');
const errorEl = $('form-error');
const submitBtn = $<HTMLButtonElement>('submit');
const thanks = $('thanks');

/** A −/+ stepper bound to the markup with data-stepper="<key>". */
function stepper(key: string, initial: number) {
  const root = document.querySelector<HTMLElement>(`[data-stepper="${key}"]`)!;
  const out = root.querySelector('output')!;
  const [minus, plus] = root.querySelectorAll<HTMLButtonElement>('button');
  let value = initial;
  const set = (n: number) => {
    value = Math.min(MAX_COUNT, Math.max(0, n));
    out.textContent = String(value);
    minus.disabled = value <= 0;
    plus.disabled = value >= MAX_COUNT;
    showError(null);
  };
  minus.addEventListener('click', () => set(value - 1));
  plus.addEventListener('click', () => set(value + 1));
  set(initial);
  return { get: () => value, set };
}

const adults = stepper('adults', 1);
const children = stepper('children', 0);
let response: RsvpResponse | null = null;

function setResponse(value: RsvpResponse | null) {
  response = value;
  for (const b of choiceBtns) b.setAttribute('aria-pressed', String(b.dataset.response === value));
  countsField.hidden = value === null || value === 'no';
}

function showError(msg: string | null) {
  errorEl.textContent = msg ?? '';
  errorEl.hidden = !msg;
}

function showThanks(s: Saved) {
  const first = s.name.split(' ')[0];
  const party = describeParty(s.adults, s.children);
  const copy: Record<RsvpResponse, [string, string, string]> = {
    yes: ['🎉', `See you on the 20th, ${first}!`, `We've saved a spot for ${party}. Aman can't wait!`],
    maybe: ['🤞', `Hope you can make it, ${first}!`, `We've noted ${party} as a maybe. You can update your answer anytime.`],
    no: ['💛', `We'll miss you, ${first}!`, 'Thanks for letting us know. Aman sends a big hug.'],
  };
  const [emoji, title, detail] = copy[s.response];
  $('thanks-emoji').textContent = emoji;
  $('thanks-title').textContent = title;
  $('thanks-detail').textContent = detail;
  form.hidden = true;
  thanks.hidden = false;
}

function showForm(s?: Saved) {
  if (s) {
    nameInput.value = s.name;
    setResponse(s.response);
    adults.set(s.response === 'no' ? 1 : s.adults);
    children.set(s.response === 'no' ? 0 : s.children);
  }
  showError(null);
  thanks.hidden = true;
  form.hidden = false;
  nameInput.focus();
}

function readSaved(): Saved | null {
  const raw = storage.get(localStorage, SAVED_KEY);
  if (!raw) return null;
  try {
    const s = JSON.parse(raw);
    if (s && typeof s.name === 'string' && ['yes', 'maybe', 'no'].includes(s.response)) return s as Saved;
  } catch {
    /* fall through */
  }
  storage.set(localStorage, SAVED_KEY, null); // old or corrupt format
  return null;
}

for (const b of choiceBtns) {
  b.addEventListener('click', () => {
    setResponse(b.dataset.response as RsvpResponse);
    showError(null);
  });
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = nameInput.value.trim().replace(/\s+/g, ' ');
  if (!name) {
    showError('Please enter your name.');
    nameInput.focus();
    return;
  }
  if (response === null) {
    showError('Please choose Yes, Maybe or No.');
    return;
  }
  const coming = response !== 'no';
  if (coming && adults.get() + children.get() < 1) {
    showError('Please tell us how many are coming.');
    return;
  }

  showError(null);
  submitBtn.disabled = true;
  submitBtn.textContent = 'Sending…';

  const s: Saved = {
    name,
    response,
    adults: coming ? adults.get() : 0,
    children: coming ? children.get() : 0,
  };
  try {
    await submitRsvp(s.name, s.response, s.adults, s.children);
    storage.set(localStorage, SAVED_KEY, JSON.stringify(s));
    showThanks(s);
  } catch (err) {
    showError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Send RSVP';
  }
});

$('change').addEventListener('click', () => showForm(readSaved() ?? undefined));

// Initial state: returning guests see their saved answer.
setResponse(null);
const saved = readSaved();
if (saved) showThanks(saved);
