import { test, expect, type Page } from '@playwright/test';

const one = { id: 'fixture-one', title: 'A conversation worth finishing', timestamp: '2026-10-23T10:00:00Z', channelId: 'channel-one', channelTitle: 'Example Conversations', thumbnail: '', duration: 30 };
const two = { ...one, id: 'fixture-two', title: 'How sound travels', channelId: 'channel-two', channelTitle: 'Example Science' };
const found = { ...one, id: 'fixture-found', title: 'Search result episode' };
const added = { id: 'channel-added', name: 'A New Channel' };
const apiPattern = /^https?:\/\/(?:localhost|127\.0\.0\.1):8000\//;

// A real, short PCM audio resource exercises the browser's native media pipeline.
// Upstream YouTube and metadata are mocked; this does not verify live extraction.
function audioFixture() {
  const rate = 8000;
  const size = rate * 30 * 2;
  const wav = Buffer.alloc(44 + size);
  wav.write('RIFF', 0); wav.writeUInt32LE(36 + size, 4); wav.write('WAVEfmt ', 8);
  wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(rate, 24); wav.writeUInt32LE(rate * 2, 28);
  wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34);
  wav.write('data', 36); wav.writeUInt32LE(size, 40);
  for (let i = 0; i < size / 2; i++) wav.writeInt16LE(Math.round(Math.sin(i * 2 * Math.PI * 220 / rate) * 256), 44 + i * 2);
  return wav;
}
const wav = audioFixture();

async function mockAPI(page: Page, failFirstFeed = false) {
  let feedAttempts = 0;
  await page.route(apiPattern, async route => {
    const url = new URL(route.request().url());
    const headers = { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET,POST,OPTIONS', 'access-control-allow-headers': '*' };
    if (route.request().method() === 'OPTIONS') { await route.fulfill({ status: 204, headers }); return; }
    if (url.pathname.startsWith('/audio/')) {
      const range = route.request().headers().range?.match(/^bytes=(\d+)-(\d*)$/);
      const start = range ? Math.min(Number(range[1]), wav.length - 1) : 0;
      const end = range?.[2] ? Math.min(Number(range[2]), wav.length - 1) : wav.length - 1;
      await route.fulfill({ status: range ? 206 : 200, contentType: 'audio/wav',
        headers: { ...headers, 'accept-ranges': 'bytes', ...(range ? { 'content-range': `bytes ${start}-${end}/${wav.length}` } : {}) },
        body: wav.subarray(start, end + 1) });
      return;
    }
    let body: unknown;
    if (url.pathname === '/channels/latest') {
      feedAttempts++;
      if (failFirstFeed && feedAttempts === 1) { await route.fulfill({ status: 429, headers, json: { detail: 'Quota exhausted' } }); return; }
      body = [one, two];
    } else if (url.pathname === '/videos/search') body = { items: [found], nextPageToken: null };
    else if (url.pathname === '/channels/search') body = { items: [added], nextPageToken: null };
    else if (url.pathname === '/resolve') body = url.searchParams.get('url')?.includes('/channel/')
      ? { type: 'channel', channel: added } : { type: 'video', video: found };
    else if (/\/channels\/[^/]+\/latest/.test(url.pathname)) body = { items: [two], nextPageToken: null };
    else { await route.fulfill({ status: 404, headers, json: { detail: 'Unexpected test endpoint' } }); return; }
    await route.fulfill({ headers, json: body });
  });
}

async function openApp(page: Page, failFirstFeed = false) {
  await mockAPI(page, failFirstFeed);
  await page.goto('/');
  await expect(page.getByRole('link', { name: 'AudioTube home' })).toBeVisible();
}
function card(page: Page, title: string) { return page.locator('article').filter({ has: page.getByRole('button', { name: title, exact: true }) }); }
async function itemAction(page: Page, title: string, action: string) {
  const item = card(page, title);
  await item.getByLabel(`Actions for ${title}`).click();
  await item.getByRole('button', { name: action, exact: true }).click();
}

// Each test gets a clean browser context and independent device storage.
test('search, native playback, queue, saved items, history and paused restoration', async ({ page }) => {
  await openApp(page);
  await expect(card(page, one.title)).toBeVisible();
  await page.getByLabel('Search videos or paste a YouTube link').fill('conversation');
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Results for “conversation”' })).toBeVisible();
  await card(page, found.title).getByRole('button', { name: `Play ${found.title}`, exact: true }).click();
  await expect(page.getByRole('region', { name: 'Now playing', exact: true })).toHaveCount(0);
  const seek = card(page, found.title).getByRole('slider', { name: `Playback position for ${found.title}` });
  await expect.poll(() => page.locator('audio').evaluate((audio: HTMLAudioElement) => Number.isFinite(audio.duration) && !audio.paused)).toBe(true);
  await seek.focus();
  await seek.press('Home');
  await seek.press('ArrowRight');
  await seek.press('ArrowRight');
  await card(page, found.title).getByRole('button', { name: `Pause ${found.title}`, exact: true }).click();
  await expect.poll(() => page.locator('audio').evaluate((audio: HTMLAudioElement) => audio.paused)).toBe(true);
  await itemAction(page, found.title, 'Save for later');
  await page.getByRole('button', { name: 'All channels', exact: true }).click();
  await itemAction(page, two.title, 'Add to queue');
  await page.getByRole('navigation', { name: 'Your library' }).getByRole('button', { name: /^Queue/ }).click();
  await expect(page.getByRole('heading', { name: 'Queue', exact: true })).toBeVisible();
  await expect(page.locator('.queue-list')).toContainText(two.title);
  await page.getByRole('button', { name: 'Saved', exact: true }).click();
  await expect(card(page, found.title)).toBeVisible();
  await page.getByRole('button', { name: 'History', exact: true }).click();
  await expect(card(page, found.title)).toBeVisible();
  await page.reload();
  await expect(page.getByRole('region', { name: 'Now playing', exact: true })).toHaveCount(0);
  await expect.poll(() => page.locator('audio').evaluate((audio: HTMLAudioElement) => audio.readyState >= 1 && audio.paused && audio.currentTime >= 1)).toBe(true);
  await page.getByRole('button', { name: 'Saved', exact: true }).click();
  await expect(card(page, found.title)).toBeVisible();
  await expect(card(page, found.title).getByRole('button', { name: `Resume ${found.title}`, exact: true })).toBeVisible();
});

test('choose a channel result, reorder it and remove it', async ({ page }) => {
  await openApp(page);
  await page.getByRole('button', { name: 'Add or manage channels' }).click();
  const initialChannelCount = await page.locator('.saved-channel-list li').count();
  await page.getByLabel('Find a channel to add').fill('new channel');
  await page.getByRole('button', { name: 'Find channels', exact: true }).click();
  await page.locator('.channel-results').getByRole('button', { name: 'Add channel', exact: true }).click();
  const channels = page.getByRole('navigation', { name: 'Saved channels' });
  await expect(channels.getByRole('button', { name: added.name, exact: true })).toBeVisible();
  await page.getByRole('button', { name: `Move ${added.name} earlier`, exact: true }).click();
  await expect(page.locator('.saved-channel-list li').nth(initialChannelCount - 1)).toContainText(added.name);
  await page.getByRole('button', { name: `Remove ${added.name}`, exact: true }).click();
  await expect(channels.getByRole('button', { name: added.name, exact: true })).toHaveCount(0);
  await page.reload();
  await expect(channels.getByRole('button', { name: added.name, exact: true })).toHaveCount(0);
});

test('a failed feed can retry without losing the app', async ({ page }) => {
  await openApp(page, true);
  await expect(page.getByRole('alert')).toContainText('limiting requests');
  await page.getByRole('button', { name: 'Try again', exact: true }).click();
  await expect(card(page, one.title)).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('pasted video and channel links resolve into the player and channel feed', async ({ page }) => {
  await openApp(page);
  const search = page.getByLabel('Search videos or paste a YouTube link');
  await search.fill('https://www.youtube.com/watch?v=fixture-found');
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await expect(card(page, found.title)).toBeVisible();
  await expect.poll(() => page.locator('audio').evaluate((audio: HTMLAudioElement) => audio.currentSrc)).toContain(found.id);
  await expect(page.getByRole('region', { name: 'Now playing' })).toHaveCount(0);
  await search.fill('https://www.youtube.com/channel/channel-added');
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await expect(page.getByRole('heading', { name: added.name, exact: true })).toBeVisible();
  await expect(card(page, two.title)).toBeVisible();
});

test('mobile layout keeps search and library usable without horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openApp(page);
  await expect(card(page, one.title)).toBeVisible();
  await expect(page.getByLabel('Search videos or paste a YouTube link')).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Add or manage channels' }).click();
  await expect(page.getByLabel('Find a channel to add')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('native audio integrates media actions, speed, and sleep settings', async ({ page }) => {
  await page.addInitScript(() => {
    const callbacks: Record<string, ((details: unknown) => void) | null> = {};
    (window as unknown as { mediaActions: typeof callbacks }).mediaActions = callbacks;
    if ('mediaSession' in navigator) {
      const original = navigator.mediaSession.setActionHandler.bind(navigator.mediaSession);
      navigator.mediaSession.setActionHandler = (action, callback) => { callbacks[action] = callback as typeof callbacks[string]; original(action, callback); };
    }
  });
  await openApp(page);
  await card(page, one.title).getByRole('button', { name: `Play ${one.title}`, exact: true }).click();
  await expect.poll(() => page.locator('audio').evaluate((audio: HTMLAudioElement) => !audio.paused && audio.readyState >= 1)).toBe(true);
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByLabel('Playback speed').selectOption('1.5');
  await expect.poll(() => page.locator('audio').evaluate((audio: HTMLAudioElement) => audio.playbackRate)).toBe(1.5);
  await page.getByLabel('Sleep timer', { exact: true }).selectOption('episode');
  await page.evaluate(() => (window as unknown as { mediaActions: Record<string, (details: unknown) => void> }).mediaActions.pause({ action: 'pause' }));
  await expect.poll(() => page.locator('audio').evaluate((audio: HTMLAudioElement) => audio.paused)).toBe(true);
  await page.evaluate(() => (window as unknown as { mediaActions: Record<string, (details: unknown) => void> }).mediaActions.play({ action: 'play' }));
  await expect.poll(() => page.locator('audio').evaluate((audio: HTMLAudioElement) => !audio.paused)).toBe(true);
  await expect.poll(() => page.evaluate(() => navigator.mediaSession.metadata?.title)).toBe(one.title);
});

test('library export, clear and import restore saved items without autoplay', async ({ page }) => {
  await openApp(page);
  await expect(card(page, one.title)).toBeVisible();
  await itemAction(page, one.title, 'Save for later');
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  const downloaded = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export library', exact: true }).click();
  const download = await downloaded;
  expect(download.suggestedFilename()).toBe('audiotube-library.json');
  const stream = await download.createReadStream();
  if (!stream) throw new Error('The exported library was not readable');
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  const backup = Buffer.concat(chunks);
  expect(JSON.parse(backup.toString()).saved[0].id).toBe(one.id);
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Clear personal data', exact: true }).click();
  await expect(page.getByRole('navigation', { name: 'Saved channels' }).locator('.channel-pill')).toHaveCount(1);
  await page.locator('input[type="file"]').setInputFiles({ name: 'audiotube-library.json', mimeType: 'application/json', buffer: backup });
  await expect(page.getByRole('status')).toContainText('Library imported');
  await page.getByRole('button', { name: 'Saved', exact: true }).click();
  await expect(card(page, one.title)).toBeVisible();
  expect(await page.locator('audio').evaluate((audio: HTMLAudioElement) => audio.paused)).toBe(true);
});


test('system dark mode preserves readable cards and never adds a separate playback panel', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await openApp(page);
  await expect(card(page, one.title)).toBeVisible();
  const colours = async () => page.evaluate(() => {
    // Canvas resolves modern CSS colour spaces (including DaisyUI's OKLCH)
    // into rendered sRGB channels for an actual contrast measurement.
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 1;
    const context = canvas.getContext('2d')!;
    const rgb = (value: string) => {
      context.fillStyle = value; context.fillRect(0, 0, 1, 1);
      return Array.from(context.getImageData(0, 0, 1, 1).data).slice(0, 3);
    };
    const luminance = (value: string) => rgb(value).map(part => part / 255).map(part => part <= 0.04045 ? part / 12.92 : ((part + 0.055) / 1.055) ** 2.4).reduce((sum, part, i) => sum + part * [0.2126, 0.7152, 0.0722][i], 0);
    const body = getComputedStyle(document.body);
    const foreground = luminance(body.color), background = luminance(getComputedStyle(document.documentElement).backgroundColor);
    return { background, contrast: (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05) };
  });
  await expect.poll(async () => (await colours()).background).toBeLessThan(0.15);
  expect((await colours()).contrast).toBeGreaterThan(4.5);
  await card(page, one.title).getByRole('button', { name: `Play ${one.title}`, exact: true }).click();
  await expect.poll(() => page.locator('audio').evaluate((audio: HTMLAudioElement) => !audio.paused)).toBe(true);
  await expect(card(page, one.title).getByRole('button', { name: `Pause ${one.title}`, exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Now playing' })).toHaveCount(0);
  await expect(page.locator('.listening-desk')).toHaveCount(0);
  await expect(page.locator('audio')).toHaveCount(1);
  await page.emulateMedia({ colorScheme: 'light' });
  await expect.poll(async () => (await colours()).background).toBeGreaterThan(0.8);
  expect((await colours()).contrast).toBeGreaterThan(4.5);
  await expect(card(page, one.title).getByRole('button', { name: `Pause ${one.title}`, exact: true })).toBeVisible();
});
