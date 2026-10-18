export async function validateHfToken(
  token: string | undefined,
  fetcher: typeof fetch = fetch,
) {
  if (!token)
    return {
      valid: false,
      message:
        "No Hugging Face token is configured. Public datasets can be downloaded anonymously.",
    };
  if (!/^hf_[A-Za-z0-9_-]+$/.test(token))
    return {
      valid: false,
      message: "Enter a Hugging Face access token beginning with hf_.",
    };
  try {
    const response = await fetcher("https://huggingface.co/api/whoami-v2", {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(10000),
      redirect: "error",
    });
    if (response.status === 401 || response.status === 403)
      return {
        valid: false,
        message:
          "Hugging Face rejected this token. Check that it is active and has read access.",
      };
    if (!response.ok)
      return {
        valid: false,
        message:
          response.status === 429
            ? "Hugging Face is rate limiting validation. Try again shortly."
            : "Hugging Face could not validate the token. Try again.",
      };
    const value = (await response.json()) as { name?: unknown };
    return {
      valid: true,
      message:
        typeof value.name === "string"
          ? `Valid token for ${value.name}.`
          : "Token accepted by Hugging Face.",
    };
  } catch {
    return {
      valid: false,
      message:
        "Could not reach Hugging Face to validate the token. Check your connection and try again.",
    };
  }
}
