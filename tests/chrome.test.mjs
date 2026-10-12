import test from 'node:test';
import assert from 'node:assert/strict';
import { renderBar, renderFooter, renderCss, inject } from '../tools/chrome.mjs';

test('the bar marks the current site and lists every site', () => {
  const bar = renderBar('oceans.exposed');
  assert.ok(bar.includes('data-network-site="oceans.exposed"'));
  assert.ok(bar.includes('data-site="oceans.exposed" aria-current="true"'));
  for (const s of ['water.exposed', 'waste.exposed', 'oceans.exposed', 'earth.exposed']) assert.ok(bar.includes(`data-site="${s}"`));
});
test('the footer has the optional sponsor slot, empty', () => {
  assert.ok(renderFooter().includes('<span class="ex-net-slot" data-network-slot="credit"></span>'));
});
test('the css has a current-site rule per site and both theme hooks', () => {
  const css = renderCss();
  assert.ok(css.includes('.ex-net-bar[data-network-site="water.exposed"]'));
  assert.ok(css.includes('prefers-color-scheme: light') && css.includes(':root[data-theme="light"]'));
  assert.ok(!/\{\{\w+\}\}/.test(css), 'no unfilled placeholders');
});
test('inject replaces the markers and is idempotent', () => {
  const page = '<body>\n<!-- network-bar -->\n<!-- /network-bar -->\n<footer>\n<!-- network-footer -->\n<!-- /network-footer -->\n</footer></body>';
  const once = inject(page, 'earth.exposed'), twice = inject(once, 'earth.exposed');
  assert.ok(once.includes('class="ex-net-bar"') && once.includes('class="ex-net-foot"'));
  assert.equal(once, twice);
});
