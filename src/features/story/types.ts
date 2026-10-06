export interface ScenePlan {
  caption: string;
  imagePrompt: string;
}

export type SceneStatus = "pending" | "generating" | "done" | "error";

export interface Scene extends ScenePlan {
  status: SceneStatus;
  imageUrl: string | null;
  error?: string;
  /** True when imageUrl is a local dev placeholder, not a real generation. */
  mock?: boolean;
}

export interface ScenePlanResponse {
  scenes: ScenePlan[];
  segments: string[];
  reference: string | null;
}
