export const ASSISTANT_FEEDBACK_CATEGORY_VALUES = [
  "COMPLAINT",
  "BUG",
  "FEATURE",
  "SUPPORT",
  "OTHER",
] as const;

export type AssistantFeedbackCategory = (typeof ASSISTANT_FEEDBACK_CATEGORY_VALUES)[number];

export function assistantFeedbackCategoryLabel(value: AssistantFeedbackCategory) {
  switch (value) {
    case "BUG":
      return "Bug report";
    case "FEATURE":
      return "Feature request";
    case "SUPPORT":
      return "Support";
    case "OTHER":
      return "Other";
    case "COMPLAINT":
    default:
      return "Complaint";
  }
}
