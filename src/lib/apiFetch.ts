export type ApiError = { error: string; code?: string };

async function parseJsonSafe(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export async function apiFetch<T>(
  input: RequestInfo | URL,
  init: RequestInit & { csrfToken?: string | null } = {}
): Promise<T> {
  const { csrfToken, headers, ...rest } = init;
  const headerBag = new Headers(headers);
  if (csrfToken) headerBag.set("x-tweet-delete-csrf", csrfToken);
  if (rest.body && !headerBag.has("Content-Type")) {
    headerBag.set("Content-Type", "application/json");
  }
  const response = await fetch(input, { ...rest, headers: headerBag });
  const data = (await parseJsonSafe(response)) as T | ApiError | null;
  if (!response.ok) {
    const message = (data && (data as ApiError).error) || `Request failed (${response.status}).`;
    throw new Error(message);
  }
  return data as T;
}
