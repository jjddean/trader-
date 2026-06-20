"use client";

import { UserButton } from "@clerk/nextjs";
import { cn } from "@/lib/utils";

const compactUserAppearance = {
  variables: {
    fontSize: "12px",
  },
  elements: {
    rootBox: "shrink-0",
    avatarBox: "h-7 w-7",
    userButtonPopoverCard: "w-52 rounded-md border border-gray-200 shadow-lg",
    userButtonPopoverMain: "gap-1 p-1.5",
    userButtonPopoverActions: "gap-0 p-1.5 pt-0",
    userButtonPopoverActionButton: "rounded px-1.5 py-1",
    userButtonPopoverActionButtonText: "text-[12px]",
    userButtonPopoverActionButtonIcon: "h-3.5 w-3.5",
    userButtonPopoverFooter: "hidden",
    userPreviewAvatarBox: "h-8 w-8",
    userPreviewMainIdentifier: "text-[12px] font-medium leading-tight",
    userPreviewSecondaryIdentifier: "text-[10px] leading-tight text-gray-500",
  },
} as const;

interface SidebarUserButtonProps {
  className?: string;
}

/** Clerk UserButton at fixed 12px — matches compact org switcher in the header. */
export function SidebarUserButton({ className }: SidebarUserButtonProps) {
  return (
    <div className={cn("shrink-0 leading-tight [font-size:12px]", className)}>
      <UserButton appearance={compactUserAppearance} />
    </div>
  );
}
