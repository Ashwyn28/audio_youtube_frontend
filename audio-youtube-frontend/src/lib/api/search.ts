import type { EndpointOutput } from "@sveltejs/kit";

const BASE = "http://localhost:8000";

/**
 * create generic get fetch call
 * @param {string} resource
 * @returns {Promise<EndpointOutput>}
 */
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
    const res = await fetch(resource, {
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
    const res = await get(`youtube_search?query=${q}`);
    return res;
  } catch (error) {
    console.log(error);
  }
};
