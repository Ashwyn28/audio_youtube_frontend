import { test, expect, type Page } from '@playwright/test';

const first = { id: 'spectrum001', title: 'Low tone, high tone, then silence', timestamp: '2026-10-24T12:00:00Z', channelId: 'spectrum-channel', channelTitle: 'Spectrum QA', thumbnail: '', duration: 6 };
const second = { ...first, id: 'spectrum002', title: 'Another frequency test' };
const apiPattern = /^https?:\/\/(?:localhost|127\.0\.0\.1):8000\//;

// These are audible samples, not stubbed analyser values: the Web Audio graph
// must distinguish a 160 Hz tone from a 3.2 kHz tone and actual digital silence.
function frequencyFixture() {
  const rate = 24000, seconds = 6, bytes = rate * seconds * 2;
  const wav = Buffer.alloc(44 + bytes);
  wav.write('RIFF'); wav.writeUInt32LE(36 + bytes, 4); wav.write('WAVEfmt ', 8);
  wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(rate, 24); wav.writeUInt32LE(rate * 2, 28);
  wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34);
  wav.write('data', 36); wav.writeUInt32LE(bytes, 40);
  for (let index = 0; index < rate * seconds; index++) {
    const time = index / rate;
    const frequency = time < 2 ? 160 : time < 4 ? 3200 : 0;
    wav.writeInt16LE(frequency ? Math.round(Math.sin(2 * Math.PI * frequency * time) * 16000) : 0, 44 + index * 2);
  }
  return wav;
}
const wav = frequencyFixture();

async function setup(page: Page, unsupported = false) {
  await page.addInitScript(({ first, second, unsupported }) => {
    localStorage.setItem('audiotube:v1', JSON.stringify({ version: 1,
      channels: [{ id: 'spectrum-channel', name: 'Spectrum QA' }], queue: [first, second],
      currentIndex: 0, saved: [], history: [], autoplay: false, playbackRate: 1,
    }));
    const counts = { contexts: 0, sources: 0 };
    (window as unknown as { audioGraphCounts: typeof counts }).audioGraphCounts = counts;
    if (unsupported) {
      Object.defineProperty(window, 'AudioContext', { value: undefined, configurable: true });
      Object.defineProperty(window, 'webkitAudioContext', { value: undefined, configurable: true });
    } else {
      const NativeAudioContext = window.AudioContext;
      class MeasuredAudioContext extends NativeAudioContext {
        constructor(options?: AudioContextOptions) { super(options); counts.contexts++; }
        createMediaElementSource(media: HTMLMediaElement) {
          counts.sources++;
          return super.createMediaElementSource(media);
        }
      }
      Object.defineProperty(window, 'AudioContext', { value: MeasuredAudioContext, configurable: true });
    }
  }, { first, second, unsupported });
  await page.route(apiPattern, async route => {
    const headers = { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET,POST,OPTIONS', 'access-control-allow-headers': '*' };
    if (route.request().method() === 'OPTIONS') { await route.fulfill({ status: 204, headers }); return; }
    if (!new URL(route.request().url()).pathname.startsWith('/audio/')) {
      await route.fulfill({ headers, json: [first, second] }); return;
    }
    const range = route.request().headers().range?.match(/^bytes=(\d+)-(\d*)$/);
    const start = range ? Math.min(Number(range[1]), wav.length - 1) : 0;
    const end = range?.[2] ? Math.min(Number(range[2]), wav.length - 1) : wav.length - 1;
    await route.fulfill({ status: range ? 206 : 200, contentType: 'audio/wav', headers: {
      ...headers, 'accept-ranges': 'bytes', ...(range ? { 'content-range': `bytes ${start}-${end}/${wav.length}` } : {}),
    }, body: wav.subarray(start, end + 1) }).catch(() => {});
  });
  await page.goto('/');
  await expect(card(page, first.title)).toBeVisible();
}
function card(page: Page, title: string) { return page.locator('article').filter({ has: page.getByRole('button', { name: title, exact: true }) }); }
function toggle(page: Page, title = first.title) { return card(page, title).getByRole('button', { name: new RegExp(`^(?:Play|Pause|Resume) ${title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`) }); }
async function play(page: Page, title = first.title) {
  await toggle(page, title).click();
  await expect.poll(() => page.locator('audio').evaluate((audio: HTMLAudioElement) => audio.readyState >= 1 && !audio.paused)).toBe(true);
}
async function seek(page: Page, position: number, title = first.title) {
  await card(page, title).getByRole('slider', { name: `Playback position for ${title}` }).evaluate((input: HTMLInputElement, position) => {
    input.value = String(position);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }, position);
}
async function heights(page: Page) { return page.getByTestId('logo-spectrum').locator('rect').evaluateAll(rects => rects.map(rect => Number(rect.getAttribute('height')))); }
const lowPeak = (values: number[]) => Math.max(...values.slice(0, 3));
const highPeak = (values: number[]) => Math.max(...values.slice(4));

test('logo shows real frequency content, silence, and returns to its original paused mark', async ({ page }) => {
  await setup(page);
  const mark = page.getByTestId('brand-mark');
  await expect(mark).toHaveAttribute('data-state', 'idle');
  await play(page);
  await expect(mark).toHaveAttribute('data-state', 'playing');
  await expect(page.getByTestId('logo-spectrum').locator('rect')).toHaveCount(7);
  await seek(page, 0);
  await expect.poll(async () => { const values = await heights(page); return lowPeak(values) - highPeak(values); }).toBeGreaterThan(2);
  const low = await heights(page);
  await seek(page, 2);
  await expect.poll(async () => { const values = await heights(page); return highPeak(values) - lowPeak(values); }).toBeGreaterThan(2);
  const high = await heights(page);
  expect(lowPeak(low)).toBeGreaterThan(lowPeak(high));
  expect(highPeak(high)).toBeGreaterThan(highPeak(low));
  await seek(page, 4);
  await expect.poll(async () => Math.max(...await heights(page))).toBeLessThanOrEqual(5);
  expect(await page.locator('audio').evaluate((audio: HTMLAudioElement) => audio.paused)).toBe(false);
  await toggle(page).click();
  await expect(mark).toHaveAttribute('data-state', 'idle');
  await expect(page.getByTestId('logo-spectrum')).toHaveCSS('opacity', '0');
  const position = await page.locator('audio').evaluate((audio: HTMLAudioElement) => audio.currentTime);
  await play(page);
  await expect.poll(() => page.locator('audio').evaluate((audio: HTMLAudioElement) => audio.currentTime)).toBeGreaterThan(position);
  await expect(mark).toHaveAttribute('data-state', 'playing');
});

test('track switches reuse one native audio context and media-element source', async ({ page }) => {
  await setup(page);
  await play(page);
  await expect(page.getByTestId('brand-mark')).toHaveAttribute('data-state', 'playing');
  await play(page, second.title);
  await expect.poll(() => page.locator('audio').evaluate((audio: HTMLAudioElement) => audio.currentSrc)).toContain(second.id);
  await toggle(page, second.title).click();
  await expect(page.getByTestId('brand-mark')).toHaveAttribute('data-state', 'idle');
  await play(page, second.title);
  expect(await page.evaluate(() => (window as unknown as { audioGraphCounts: unknown }).audioGraphCounts)).toEqual({ contexts: 1, sources: 1 });
});

test('frequency display remains driven by audio in dark mode with reduced motion', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
  await setup(page);
  await play(page);
  await expect(page.getByTestId('brand-mark')).toHaveAttribute('data-state', 'playing');
  await expect.poll(async () => { const values = await heights(page); return lowPeak(values) - highPeak(values); }).toBeGreaterThan(2);
  await toggle(page).click();
  await expect(page.getByTestId('brand-mark')).toHaveAttribute('data-state', 'idle');
  await page.emulateMedia({ colorScheme: 'light' });
  await expect(page.getByTestId('brand-mark')).toBeVisible();
});

test('without Web Audio support the original logo remains and native playback works', async ({ page }) => {
  await setup(page, true);
  await play(page);
  await expect(page.getByTestId('brand-mark')).toHaveAttribute('data-state', 'idle');
  await expect(page.getByTestId('logo-spectrum')).toHaveCSS('opacity', '0');
  await expect.poll(() => page.locator('audio').evaluate((audio: HTMLAudioElement) => audio.currentTime)).toBeGreaterThan(0.1);
  await toggle(page).click();
  await expect.poll(() => page.locator('audio').evaluate((audio: HTMLAudioElement) => audio.paused)).toBe(true);
});
