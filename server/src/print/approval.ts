import { PRINT_TEMPLATES } from "./templates.ts";

export type PrintTemplateDecision = "approved" | "revoked";
export type PrintTemplateApprovalStore = {
  isApproved(templateId: string): boolean;
  setDecision(templateId: string, decision: PrintTemplateDecision): boolean;
};

// デモで画面がそのまま動くよう、初期状態はすべて承認済みにする。
export function createPrintTemplateApprovalStore(): PrintTemplateApprovalStore {
  const approvals = new Map<string, boolean>(PRINT_TEMPLATES.map((template) => [template.id, true]));
  return {
    isApproved(templateId) {
      return approvals.get(templateId) ?? false;
    },
    setDecision(templateId, decision) {
      if (!approvals.has(templateId)) return false;
      approvals.set(templateId, decision === "approved");
      return true;
    },
  };
}
