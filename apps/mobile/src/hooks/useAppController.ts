import { useAuthController } from "./controllers/useAuthController";
import { useCasesController } from "./controllers/useCasesController";
import { useUploadController } from "./controllers/useUploadController";
import { useUiController } from "./controllers/useUiController";
import { useWorkspaceController } from "./controllers/useWorkspaceController";

export function useAppController() {
  const ui = useUiController();
  const auth = useAuthController(ui);
  const cases = useCasesController(ui);
  const upload = useUploadController(ui, cases);
  const workspace = useWorkspaceController(ui, cases);

  // Cross-wire callbacks if needed
  // ...

  return {
    ...ui,
    ...auth,
    ...cases,
    ...upload,
    ...workspace
  };
}
