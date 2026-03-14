# Trader App Design System

This document "hard codes" the established UI standards for the Trader application to ensure consistency in future development and AI-agent interactions.

## Typography & Metrics

*   **KPI Metrics**: Always use `font-normal` (not `font-light`) for primary digits (e.g., dashboard stats, lane savings, prospect HS codes) to ensure visual weight and readability.
*   **Messaging**: Content within communication hubs should follow these exact standards:
    *   **Detail Bubbles**: `text-[13.75px]` (Inbox) or `text-[14px]` (Workspace) with `leading-relaxed`.
    *   **List Items**: `text-[13.75px]` for titles and `text-[13px]` for snippet text.
    *   **Reply Area**: Uses a two-stage transition. Default to a row of buttons ("Reply", "Forward") that expands into a full `textarea` on click. Use `blue-200/50` borders and `shadow-sm` for the expanded state to signify active communication.

## Layout Density

### Sidebar (Maximum Density)
*   **SidebarContent**: Use `space-y-1` for group spacing.
*   **SidebarGroupLabel**: Use `mb-0.5` for label margins.
*   **SidebarMenu**: Use `space-y-0.5` for item spacing.
*   **SidebarMenuButton**: Use hover effects and `py-1` for padding.

### Workspace
*   **Unified Hubs**: Prefer merging related components (e.g., conversation lists and message details) into a single card structure (`rounded-xl border border-gray-200 overflow-hidden`) with internal gray-100 borders rather than using separate grid items with gaps.

## Interactivity

### Lists & Selects
*   **Hover Highlights**: Lists and dropdown items MUST provide immediate visual feedback.
    *   **SelectItem**: Use `data-[highlighted]:bg-gray-50 data-[highlighted]:text-black` to replace generic focus styles.
    *   **Interactive Cards**: Use `transition-all hover:bg-gray-50/50 cursor-pointer` for list items.

## Global Styles
*   **Backgrounds**: Standard interactive elements (like notification bells or buttons) should be `bg-white` with subtle `gray-200` borders and `shadow-sm`.
*   **Separators**: Vertical separators in the dashboard header should be a prominent `bg-gray-200` line (`w-px h-4 mx-1`) positioned between the sidebar trigger and page title for visual clarity.
