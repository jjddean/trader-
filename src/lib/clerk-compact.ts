/** Same 12px scale as org-switcher / user-button dropdowns — pass to profile modals. */
export const compactClerkAppearance = {
  variables: {
    fontSize: "12px",
    spacingUnit: "0.65rem",
  },
} as const;

/** Manage-account / manage-org modals (portaled — use organizationProfileProps / userProfileProps). */
export const compactProfileModalAppearance = {
  ...compactClerkAppearance,
  elements: {
    cardBox: "max-w-xl w-[calc(100vw-2rem)] max-h-[85vh] overflow-y-auto",
  },
} as const;

/** Inline on Settings → Team — wrap in a [font-size:12px] container. */
export const compactEmbeddedOrgProfileAppearance = {
  ...compactClerkAppearance,
  elements: {
    rootBox: "w-full max-w-xl",
    card: "shadow-none border-0 w-full",
    profileSectionContent: "min-w-0",
    profileSectionPrimaryButton: "shrink-0 text-[12px]",
  },
} as const;
