// Google の OpenID Connect（認可コード + PKCE）。ID トークンは jose で検査する（発行元、宛先、期限、署名、nonce、メールの確認、学校のドメイン）。
import { createHash, randomBytes, type KeyObject } from "node:crypto";
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";

export const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
export const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_KEYS = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));

export type OidcConfig = { clientId: string; clientSecret: string; redirectUri: string; schoolDomain?: string };
export type Identity = { subject: string; email: string };

export const randomToken = (): string => randomBytes(32).toString("base64url");
export const challengeOf = (verifier: string): string => createHash("sha256").update(verifier).digest("base64url");

export function authorizationUrl(config: OidcConfig, state: string, nonce: string, challenge: string): string {
  const query = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: "code",
    scope: "openid email",
    state,
    nonce,
    code_challenge: challenge,
    code_challenge_method: "S256",
    prompt: "select_account",
  });
  // 学校のドメインは、表示の手がかりに付ける。正しさは ID トークンの hd で確かめる
  if (config.schoolDomain) query.set("hd", config.schoolDomain);
  return `${GOOGLE_AUTH_URL}?${query.toString()}`;
}

export async function exchangeCode(config: OidcConfig, code: string, verifier: string, fetchImpl: typeof fetch = fetch): Promise<string> {
  const response = await fetchImpl(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.redirectUri,
      grant_type: "authorization_code",
      code_verifier: verifier,
    }),
  });
  if (!response.ok) throw new Error("token exchange failed");
  const body = (await response.json()) as { id_token?: unknown };
  if (typeof body.id_token !== "string") throw new Error("id_token is missing");
  return body.id_token;
}

// keys は本番では Google の公開鍵。試験では手元の鍵を渡す
export async function verifyIdToken(config: OidcConfig, idToken: string, nonce: string, keys: JWTVerifyGetKey | KeyObject = GOOGLE_KEYS): Promise<Identity> {
  const { payload } = await jwtVerify(idToken, keys as JWTVerifyGetKey, {
    issuer: ["https://accounts.google.com", "accounts.google.com"],
    audience: config.clientId,
  });
  if (payload.nonce !== nonce) throw new Error("nonce mismatch");
  if (payload.email_verified !== true) throw new Error("email is not verified");
  if (config.schoolDomain && payload.hd !== config.schoolDomain) throw new Error("domain is not allowed");
  if (typeof payload.sub !== "string" || typeof payload.email !== "string") throw new Error("claims are missing");
  return { subject: payload.sub, email: payload.email.toLowerCase() };
}
