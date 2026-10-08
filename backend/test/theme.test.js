const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

test('dark theme text and key actions have readable contrast', () => {
  const css = readFileSync(join(__dirname, '../../frontend/src/styles/dark.css'), 'utf8');
  const color = name => css.match(new RegExp(`--${name}:\\s*(#[0-9a-f]{6})`, 'i'))[1];
  const luminance = hex => {
    const rgb = hex.slice(1).match(/../g).map(part => parseInt(part, 16) / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4);
    return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722;
  };
  const pairs = [
    [color('color-text'), color('color-bg')], [color('color-text-sub'), color('color-surface')],
    [color('color-primary'), color('color-surface')], ['#241810', color('color-primary')],
    [color('badge-open-text'), color('badge-open-bg')], [color('badge-closed-text'), color('badge-closed-bg')],
  ];
  for (const [foreground, background] of pairs) {
    const a = luminance(foreground); const b = luminance(background);
    assert.ok((Math.max(a, b) + .05) / (Math.min(a, b) + .05) >= 4.5, `${foreground} on ${background}`);
  }
});

test('theme restores, toggles, synchronizes tabs and handles unavailable storage', async () => {
  const keys = ['localStorage', 'document', 'window', 'CustomEvent'];
  const original = keys.map(key => Object.getOwnPropertyDescriptor(globalThis, key));
  const values = new Map([['calar.theme', 'dark']]); const listeners = new Map(); const events = [];
  const root = { dataset: {}, style: {} }; let browserColor;
  try {
    globalThis.localStorage = { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value) };
    globalThis.document = { documentElement: root, querySelector: () => ({ setAttribute: (_, value) => { browserColor = value; } }) };
    globalThis.window = { addEventListener: (name, callback) => listeners.set(name, callback), dispatchEvent: event => events.push(event) };
    globalThis.CustomEvent = class { constructor(type, options) { this.type = type; this.detail = options.detail; } };
    const theme = await import('../../frontend/src/services/theme.js');
    theme.initializeTheme();
    assert.equal(root.dataset.theme, 'dark'); assert.equal(root.style.colorScheme, 'dark'); assert.equal(browserColor, '#171512');
    assert.equal(theme.setTheme('light'), true); assert.equal(theme.readTheme(), 'light'); assert.equal(root.dataset.theme, 'light');
    assert.equal(events.at(-1).detail, 'light');
    values.set('calar.theme', 'dark'); listeners.get('storage')({ key: 'calar.theme' });
    assert.equal(root.dataset.theme, 'dark'); assert.equal(events.at(-1).detail, 'dark');
    values.clear(); listeners.get('storage')({ key: null }); assert.equal(root.dataset.theme, 'light');
    values.set('calar.theme', 'invalid'); assert.equal(theme.readTheme(), 'light');
    globalThis.localStorage = { getItem() { throw Error('blocked'); }, setItem() { throw Error('blocked'); } };
    assert.equal(theme.readTheme(), 'light'); assert.equal(theme.setTheme('dark'), false);
    assert.equal(root.dataset.theme, 'dark'); assert.equal(events.at(-1).detail, 'dark');
  } finally {
    keys.forEach((key, index) => { if (original[index]) Object.defineProperty(globalThis, key, original[index]); else delete globalThis[key]; });
  }
});
