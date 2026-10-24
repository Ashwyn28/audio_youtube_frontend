import { test, expect, type Page } from '@playwright/test';

const first = { id: 'qatest00001', title: 'Playback test one', timestamp: '2026-10-24T10:00:00Z', channelId: 'qa-channel', channelTitle: 'Playback QA', thumbnail: '', duration: 30 };
const second = { ...first, id: 'qatest00002', title: 'Playback test two' };
const apiPattern = /^https?:\/\/(?:localhost|127\.0\.0\.1):8000\//;
function wavFixture() {
  const rate = 8000, bytes = rate * 30 * 2;
  const data = Buffer.alloc(44 + bytes);
  data.write('RIFF'); data.writeUInt32LE(36 + bytes, 4); data.write('WAVEfmt ', 8);
  data.writeUInt32LE(16, 16); data.writeUInt16LE(1, 20); data.writeUInt16LE(1, 22);
  data.writeUInt32LE(rate, 24); data.writeUInt32LE(rate * 2, 28);
  data.writeUInt16LE(2, 32); data.writeUInt16LE(16, 34);
  data.write('data', 36); data.writeUInt32LE(bytes, 40);
  return data;
}
const wav = wavFixture();
async function setup(page: Page, options: { autoplay?: boolean; failFirstAudio?: boolean; slowFirst?: boolean } = {}) {
  await page.addInitScript(({ first, second, autoplay }) => {
    if (!localStorage.getItem('audiotube:v1')) localStorage.setItem('audiotube:v1', JSON.stringify({
      version: 1, channels: [{ id: 'qa-channel', name: 'Playback QA' }], queue: [first, second],
      currentIndex: 0, saved: [], history: [], autoplay, playbackRate: 1,
    }));
  }, { first, second, autoplay: options.autoplay ?? true });
  let attempts = 0;
  const audioRequests: string[] = [];
  await page.route(apiPattern, async route => {
    const url = new URL(route.request().url());
    const headers = { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET,POST,OPTIONS', 'access-control-allow-headers': '*' };
    if (route.request().method() === 'OPTIONS') { await route.fulfill({ status: 204, headers }); return; }
    if (!url.pathname.startsWith('/audio/')) { await route.fulfill({ headers, json: [first, second] }); return; }
    audioRequests.push(url.pathname);
    if (options.failFirstAudio && ++attempts === 1) { await route.fulfill({ status: 503, headers, body: 'temporarily unavailable' }); return; }
    if (options.slowFirst && url.pathname.endsWith(first.id)) await new Promise(resolve => setTimeout(resolve, 500));
    const range = route.request().headers().range?.match(/^bytes=(\d+)-(\d*)$/);
    const start = range ? Math.min(Number(range[1]), wav.length - 1) : 0;
    const end = range?.[2] ? Math.min(Number(range[2]), wav.length - 1) : wav.length - 1;
    await route.fulfill({ status: range ? 206 : 200, contentType: 'audio/wav', headers: {
      ...headers, 'accept-ranges': 'bytes', ...(range ? { 'content-range': `bytes ${start}-${end}/${wav.length}` } : {}),
    }, body: wav.subarray(start, end + 1) }).catch(() => {}); // Switching sources can cancel the pending request.
  });
  await page.goto('/');
  await expect(card(page, first.title)).toBeVisible();
  return audioRequests;
}
function card(page: Page, title = first.title) { return page.locator('article').filter({ has: page.getByRole('button', { name: title, exact: true }) }); }
function playbackButton(page: Page, title = first.title) { return card(page, title).getByRole('button', { name: new RegExp(`^(?:Play|Pause|Resume) ${title}$`) }); }
async function settings(page: Page) { await page.getByRole('button', { name: 'Settings', exact: true }).click(); }
async function feed(page: Page) { await page.getByRole('button', { name: 'All channels', exact: true }).click(); }
async function playing(page: Page) {
  await expect.poll(() => page.locator('audio').evaluate((audio: HTMLAudioElement) => audio.readyState >= 1 && !audio.paused)).toBe(true);
}
async function paused(page: Page) {
  await expect.poll(() => page.locator('audio').evaluate((audio: HTMLAudioElement) => audio.paused)).toBe(true);
}
async function seek(page: Page, position: number, title = first.title) {
  const slider = card(page, title).getByRole('slider', { name: `Playback position for ${title}` });
  await expect(slider).toBeEnabled();
  await slider.evaluate((input: HTMLInputElement, position) => {
    input.value = String(position); input.dispatchEvent(new Event('input', { bubbles: true }));
  }, position);
}

test('native audio plays, seeks, changes speed, pauses and restores position without autoplay', async ({ page }) => {
  await setup(page);
  await playbackButton(page).click();
  await playing(page);
  await seek(page, 8);
  await settings(page);
  await page.getByLabel('Playback speed').selectOption('1.5');
  await expect.poll(() => page.locator('audio').evaluate((audio: HTMLAudioElement) => audio.playbackRate)).toBe(1.5);
  await feed(page);
  await playbackButton(page).click();
  await paused(page);
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('audiotube:v1')!).history[0].position)).toBeGreaterThanOrEqual(8);
  await page.reload();
  await paused(page);
  await expect.poll(() => page.locator('audio').evaluate((audio: HTMLAudioElement) => audio.readyState >= 1 && audio.currentTime >= 8)).toBe(true);
  await settings(page);
  await expect(page.getByLabel('Playback speed')).toHaveValue('1.5');
  await feed(page);
  await playbackButton(page).click();
  await playing(page);
});

test('natural ending advances to the next queued item with autoplay enabled', async ({ page }) => {
  await setup(page);
  await playbackButton(page).click();
  await playing(page);
  await seek(page, 29);
  await expect.poll(() => page.locator('audio').evaluate((audio: HTMLAudioElement) => audio.currentSrc)).toContain(second.id);
  await playing(page);
  await expect.poll(() => page.evaluate(id => JSON.parse(localStorage.getItem('audiotube:v1')!).history.find((entry: { video: { id: string }; completed: boolean }) => entry.video.id === id)?.completed, first.id)).toBe(true);
});

test('autoplay off stops at the end and preserves the next queued item', async ({ page }) => {
  await setup(page, { autoplay: false });
  await playbackButton(page).click();
  await playing(page);
  await seek(page, 29);
  await expect.poll(() => page.locator('audio').evaluate((audio: HTMLAudioElement) => audio.ended)).toBe(true);
  await paused(page);
  await expect.poll(() => page.locator('audio').evaluate((audio: HTMLAudioElement) => audio.currentSrc)).toContain(first.id);
  await page.getByRole('navigation', { name: 'Your library' }).getByRole('button', { name: /^Queue/ }).click();
  await expect(page.locator('.queue-list li.current')).toContainText(first.title);
  await expect(page.locator('.queue-list')).toContainText(second.title);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('audiotube:v1')!).queue.length)).toBe(2);
});

test('end-of-episode sleep stops instead of advancing even with autoplay enabled', async ({ page }) => {
  await setup(page);
  await playbackButton(page).click();
  await playing(page);
  await settings(page);
  await page.getByLabel('Sleep timer', { exact: true }).selectOption('episode');
  await feed(page);
  await seek(page, 29);
  await expect.poll(() => page.locator('audio').evaluate((audio: HTMLAudioElement) => audio.ended)).toBe(true);
  await paused(page);
  await expect.poll(() => page.locator('audio').evaluate((audio: HTMLAudioElement) => audio.currentSrc)).toContain(first.id);
});

test('switching tracks while a source is loading leaves the latest selection playing', async ({ page }) => {
  const requests = await setup(page, { slowFirst: true });
  await playbackButton(page).click();
  await playbackButton(page, second.title).click();
  await expect.poll(() => page.locator('audio').evaluate((audio: HTMLAudioElement) => audio.currentSrc)).toContain(second.id);
  await playing(page);
  await playbackButton(page, first.title).click();
  await playbackButton(page, second.title).click();
  await playing(page);
  await expect.poll(() => page.locator('audio').evaluate((audio: HTMLAudioElement) => audio.currentTime)).toBeGreaterThan(0.5);
  await expect(card(page).getByRole('alert')).toHaveCount(0);
  await expect.poll(() => page.locator('audio').evaluate((audio: HTMLAudioElement) => new URL(audio.currentSrc).pathname)).toBe(`/audio/${second.id}`);
  expect(requests.length).toBeLessThan(8);
});

test('a failed source can retry successfully without losing the selected item', async ({ page }) => {
  await setup(page, { failFirstAudio: true });
  await expect(card(page).getByRole('alert')).toBeVisible();
  await card(page).getByRole('button', { name: 'Retry playback', exact: true }).click();
  await playing(page);
  await expect.poll(() => page.locator('audio').evaluate((audio: HTMLAudioElement) => audio.currentSrc)).toContain(first.id);
  await expect(card(page).getByRole('alert')).toHaveCount(0);
});

test('a browser autoplay rejection can recover from an explicit Play action', async ({ page }) => {
  await page.addInitScript(() => {
    const play = HTMLMediaElement.prototype.play;
    let firstAttempt = true;
    HTMLMediaElement.prototype.play = function () {
      if (firstAttempt) {
        firstAttempt = false;
        return Promise.reject(new DOMException('A user gesture is required', 'NotAllowedError'));
      }
      return play.call(this);
    };
  });
  await setup(page);
  await playbackButton(page).click();
  await expect(card(page).getByRole('alert')).toContainText('needs a tap');
  await paused(page);
  await playbackButton(page).click();
  await playing(page);
  await expect(card(page).getByRole('alert')).toHaveCount(0);
});
