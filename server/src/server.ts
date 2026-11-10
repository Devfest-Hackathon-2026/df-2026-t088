import { serve } from "@hono/node-server";
import { pathToFileURL } from "node:url";
import { createApp } from "./app.ts";
import { readAiSettings } from "./ai/settings.ts";

export function assertApproverKeyConfigured(env: NodeJS.ProcessEnv): void {
  if ((env.NODE_ENV === "production" || env.K_SERVICE !== undefined) && !env.LOOP_APPROVER_KEY?.trim()) {
    throw new Error("本番環境では LOOP_APPROVER_KEY を設定してください。");
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  assertApproverKeyConfigured(process.env);

  // --env-file で PORT= のように空で渡されたときも、既定値にする。
  const port = Number(process.env.PORT || 8080);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("PORT must be an integer from 1 to 65535.");

  // モックで動いていることに気付けるよう、起動時に理由を出す（設定の値そのものは出さない）。
  const settings = readAiSettings(process.env);
  if (settings.mode === "mock") console.warn(`Gemini is not used; running with mock AI (reason: ${settings.reason}).`);

  // ローカル開発ではキーなしで開く。公開するときは必ず設定する（docs/dev/dev-setup.md）。
  if (!process.env.LOOP_APPROVER_KEY?.trim()) console.warn("LOOP_APPROVER_KEY is not set: approving and reading the audit log need no key. Set it before publishing.");

  serve({ fetch: createApp().fetch, port });
}
