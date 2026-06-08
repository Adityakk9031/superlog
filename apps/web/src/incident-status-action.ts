export type IncidentStatusAction = {
  label: "Resolve incident" | "Reopen incident";
  targetStatus: "open" | "resolved";
  variant: "secondary" | "ghost";
};

export function getIncidentStatusAction(status: string): IncidentStatusAction {
  if (status === "open") {
    return {
      label: "Resolve incident",
      targetStatus: "resolved",
      variant: "secondary",
    };
  }
  return {
    label: "Reopen incident",
    targetStatus: "open",
    variant: "ghost",
  };
}
