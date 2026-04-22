export type XDeletePostResponse = {
  data?: { deleted: boolean };
  errors?: Array<{ title?: string; detail?: string; status?: number }>;
};

export async function deleteOwnedPost(params: {
  accessToken: string;
  postId: string;
}): Promise<XDeletePostResponse> {
  if (!/^\d{1,19}$/.test(params.postId)) {
    throw new Error("Invalid post ID.");
  }

  const response = await fetch(`https://api.x.com/2/tweets/${params.postId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${params.accessToken}`
    }
  });

  const body = (await response.json().catch(() => ({}))) as XDeletePostResponse;

  if (!response.ok) {
    throw new Error(body.errors?.[0]?.detail ?? `X API delete failed with ${response.status}.`);
  }

  return body;
}
