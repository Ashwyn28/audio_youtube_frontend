import type { EndpointOutput } from "@sveltejs/kit";

const BASE = "https://ioos6b24n1.execute-api.us-east-1.amazonaws.com";

export const get = async (resource: string): Promise<EndpointOutput> => {
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

export const post = async (
  resource: string,
  data: any
): Promise<EndpointOutput> => {
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

export const search = async (q: string): Promise<EndpointOutput> => {
  try {
    const res = await get(`search?query=${q}`);
    return res;
  } catch (error) {
    console.log(error);
  }
};

export const searchChannelsLatest = async (q: string[]): Promise<EndpointOutput> => {
  try {
    const res = await post('channels/latest', q);
    return res;
  } catch (error) {
    console.log(error)
  }
}

export const searchChannelLatest = async (q: string): Promise<EndpointOutput> => {
  try {
    const res = await get(`channel/latest?channel_id=${q}`)
    return res;
  } catch (error) {
    console.log(error)
  }
}