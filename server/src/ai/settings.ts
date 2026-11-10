export type AiSettings =
  | { mode: "mock"; reason: "model_missing" | "mode_missing" }
  | { mode: "developer"; apiKey: string; model: string }
  | { mode: "vertex"; project: string; location: string; model: string };

export function readAiSettings(environment: NodeJS.ProcessEnv): AiSettings {
  const mode = environment.GEMINI_MODE;
  const model = environment.GEMINI_MODEL;
  if (!mode) return { mode: "mock", reason: "mode_missing" };
  // 綴り間違いを、モデルが無いときの黙ったモックで隠さない
  if (mode !== "developer" && mode !== "vertex") throw new Error("GEMINI_MODE must be developer or vertex.");
  if (!model) return { mode: "mock", reason: "model_missing" };
  if (mode === "developer") {
    const apiKey = environment.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY is required in developer mode.");
    return { mode, apiKey, model };
  }
  if (mode === "vertex") {
    const project = environment.GOOGLE_CLOUD_PROJECT;
    const location = environment.GOOGLE_CLOUD_LOCATION;
    if (!project || !location) throw new Error("Google Cloud project and location are required in vertex mode.");
    return { mode, project, location, model };
  }
  throw new Error("GEMINI_MODE must be developer or vertex.");
}
