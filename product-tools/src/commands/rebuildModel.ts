import { DEFAULT_EVENTS_ROOT } from "../validation/validateEvents.js";
import { DEFAULT_MODEL_ROOT, projectModel } from "../projection/projectModel.js";

export async function rebuildModel(
  eventsRoot = DEFAULT_EVENTS_ROOT,
  modelRoot = DEFAULT_MODEL_ROOT,
) {
  return projectModel(eventsRoot, modelRoot);
}
