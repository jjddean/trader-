"use client";

import { OrganizationSwitcher } from "@clerk/nextjs";
import { cn } from "@/lib/utils";
import { compactClerkAppearance, compactProfileModalAppearance } from "@/lib/clerk-compact";

interface OrgSwitcherProps {
  className?: string;
  hidePersonal?: boolean;
}

/**
 * Clerk OrganizationSwitcher at a fixed 12px base so it is not inflated by
 * globals.css text-scale (default 1.125× on html).
 */
export function OrgSwitcher({ className, hidePersonal = false }: OrgSwitcherProps) {
  return (
    <div className={cn("shrink-0 leading-tight [font-size:12px]", className)}>
      <OrganizationSwitcher
        hidePersonal={hidePersonal}
        afterCreateOrganizationUrl="/dashboard"
        afterLeaveOrganizationUrl="/dashboard"
        afterSelectOrganizationUrl="/dashboard"
        afterSelectPersonalUrl="/dashboard"
        appearance={{
          variables: compactClerkAppearance.variables,
          elements: {
            rootBox: "flex",
            organizationSwitcherTrigger:
              "flex h-8 max-w-[160px] items-center gap-1 rounded-md border border-slate-200 bg-white px-2 font-medium text-slate-700 shadow-sm hover:bg-slate-50",
            organizationSwitcherTriggerIcon: "h-3 w-3 text-slate-400",
            organizationPreviewAvatarBox: "h-4 w-4",
            organizationPreviewMainIdentifier: "text-[12px] font-medium leading-none",
            organizationPreviewSecondaryIdentifier: "text-[10px] leading-none text-slate-500",
            organizationPreviewTextContainer: "gap-0",
            organizationSwitcherPopoverCard: "w-52 rounded-md border border-slate-200 shadow-lg",
            organizationSwitcherPopoverMain: "gap-0.5 p-1.5",
            organizationSwitcherPopoverActions: "gap-0 p-1.5 pt-0",
            organizationSwitcherPopoverActionButton: "rounded px-1.5 py-1",
            organizationSwitcherPopoverActionButtonIconBox: "h-3.5 w-3.5",
            organizationSwitcherPopoverActionButtonText: "text-[12px]",
            organizationSwitcherPopoverFooter: "hidden",
            userPreviewAvatarBox: "h-4 w-4",
            userPreviewMainIdentifier: "text-[12px] font-medium",
            userPreviewSecondaryIdentifier: "text-[10px] text-slate-500",
          },
        }}
        organizationProfileProps={{ appearance: compactProfileModalAppearance }}
      />
    </div>
  );
}
