export async function getGoogleAccessToken(fetcher: typeof fetch, service: string): Promise<string> {
  const response = await fetcher("http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token", {
    headers: { "Metadata-Flavor": "Google" },
    signal: AbortSignal.timeout(5_000),
  });
  if (!response.ok) throw new Error(`${service} token request failed`);
  const result: unknown = await response.json();
  if (typeof result !== "object" || result === null || typeof (result as { access_token?: unknown }).access_token !== "string") {
    throw new Error(`${service} token response is invalid`);
  }
  return (result as { access_token: string }).access_token;
}
