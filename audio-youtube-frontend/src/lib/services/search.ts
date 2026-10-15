import { env } from "$env/dynamic/public";
import type { Video } from "$lib/types";

type Channel = { id: string; name: string };

const BASE = (env.PUBLIC_API_BASE_URL || "https://ioos6b24n1.execute-api.us-east-1.amazonaws.com").replace(/\/+$/, "");

export const get = async <T>(resource: string): Promise<T | undefined> => {
  try {
    const res = await fetch(`${BASE}/${resource}`, {
      headers: {
        "content-type": "application/json",
      },
    });
    if (res.ok) {
      return res.json();
    }
  } catch (error) {
    console.log(error);
  }
};

export const post = async <T>(
  resource: string,
  data: unknown
): Promise<T | undefined> => {
  try {
    const res = await fetch(`${BASE}/${resource}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      return res.json();
    }
  } catch (error) {
    console.log(error);
  }
};

export const search = async (q: string): Promise<Video[] | undefined> => {
  try {
    const res = await get<Video[]>(`videos/search?query=${encodeURIComponent(q)}`);
    return res;
  } catch (error) {
    console.log(error);
  }
};

export const searchChannelsLatest = async (q: string[]): Promise<Video[] | undefined> => {
  try {
    const res = await post<Video[]>('channels/latest', q);
    return res;
  } catch (error) {
    console.log(error)
  }
}

export const searchChannelLatest = async (q: string): Promise<Video[] | undefined> => {
  try {
    const res = await get<Video[]>(`channels/${encodeURIComponent(q)}/latest`)
    return res;
  } catch (error) {
    console.log(error)
  }
}

export const addChannel = async (q: string): Promise<Channel | undefined> => {
  try {
    const res = await get<Channel>(`channels/search?query=${encodeURIComponent(q)}`)
    return res;
  } catch (error) {
    console.log(error)
  }
}
