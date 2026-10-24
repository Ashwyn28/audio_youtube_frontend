import { env } from "$env/dynamic/public";
import type { Channel, Video, VideoPage } from "$lib/types";

const base = (
  env.PUBLIC_API_BASE_URL ||
  "http://localhost:8000"
).replace(/\/+$/, "");
async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${base}/${path}`, options);
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw error;
    throw new Error(
      "Could not reach AudioTube. Check your connection and try again.",
    );
  }
  if (!response.ok) {
    if (response.status === 404)
      throw new Error("No matching channel or video found. Try another name or link.");
    if (response.status === 403 || response.status === 429)
      throw new Error("YouTube is limiting requests. Please try again later.");
    throw new Error("Could not load results. Please try again.");
  }
  return response.json();
}
export function search(query: string, pageToken = "", signal?: AbortSignal) {
  return request<VideoPage>(
    `videos/search?${new URLSearchParams({ query, paginated: "true", ...(pageToken ? { page_token: pageToken } : {}) })}`,
    { signal },
  );
}
export function channelLatest(
  id: string,
  pageToken = "",
  signal?: AbortSignal,
) {
  return request<VideoPage>(
    `channels/${encodeURIComponent(id)}/latest?${new URLSearchParams({ paginated: "true", ...(pageToken ? { page_token: pageToken } : {}) })}`,
    { signal },
  );
}
export function feed(ids: string[], signal?: AbortSignal) {
  return request<Video[]>("channels/latest", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(ids),
    signal,
  });
}
export function findChannel(query: string) {
  return request<Channel>(`channels/search?${new URLSearchParams({ query })}`);
}

export async function searchChannels(query: string, signal?: AbortSignal) {
  const page = await request<{ items: Channel[]; nextPageToken: string | null }>(
    `channels/search?${new URLSearchParams({ query, paginated: "true" })}`,
    { signal },
  );
  return page.items;
}

export interface ResolvedLink {
  type: "video" | "channel";
  video?: Video;
  channel?: Channel;
}

export function resolveLink(url: string, signal?: AbortSignal) {
  return request<ResolvedLink>(`resolve?${new URLSearchParams({ url })}`, { signal });
}

export function audioUrl(id: string) {
  return `${base}/audio/${encodeURIComponent(id)}`;
}
