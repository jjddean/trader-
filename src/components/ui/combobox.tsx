"use client";

import * as React from "react";
import { ChevronDownIcon, CheckIcon } from "lucide-react";
import { Combobox as ComboboxPrimitive } from "@base-ui/react/combobox";

import { cn } from "@/lib/utils";

function Combobox({ ...props }: React.ComponentProps<typeof ComboboxPrimitive.Root>) {
    return <ComboboxPrimitive.Root data-slot="combobox" {...props} />;
}

function ComboboxTrigger({
    className,
    children,
    ...props
}: React.ComponentProps<typeof ComboboxPrimitive.Trigger>) {
    return (
        <ComboboxPrimitive.Trigger
            data-slot="combobox-trigger"
            className={cn(
                "flex w-fit h-9 items-center justify-between gap-2 rounded-md border border-input bg-transparent px-3 py-2 text-sm whitespace-nowrap shadow-xs transition-[color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 data-[placeholder]:text-muted-foreground",
                className
            )}
            {...props}
        >
            {children}
            <ComboboxPrimitive.Icon asChild>
                <ChevronDownIcon className="size-4 opacity-50" />
            </ComboboxPrimitive.Icon>
        </ComboboxPrimitive.Trigger>
    );
}

function ComboboxContent({
    className,
    ...props
}: React.ComponentProps<typeof ComboboxPrimitive.Popup>) {
    return (
        <ComboboxPrimitive.Portal>
            <ComboboxPrimitive.Positioner sideOffset={4}>
                <ComboboxPrimitive.Popup
                    data-slot="combobox-content"
                    className={cn(
                        "relative z-50 max-h-(--radix-combobox-content-available-height) min-w-[10rem] overflow-x-hidden overflow-y-auto rounded-md border bg-white text-popover-foreground shadow-md data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
                        className
                    )}
                    {...props}
                />
            </ComboboxPrimitive.Positioner>
        </ComboboxPrimitive.Portal>
    );
}

function ComboboxInput({
    className,
    ...props
}: React.ComponentProps<typeof ComboboxPrimitive.Input>) {
    return (
        <ComboboxPrimitive.Input
            data-slot="combobox-input"
            className={cn(
                "m-1 mb-0 h-8 w-[calc(100%-0.5rem)] rounded-md border border-input bg-transparent px-2 text-sm outline-none placeholder:text-muted-foreground",
                className
            )}
            {...props}
        />
    );
}

function ComboboxItem({
    className,
    children,
    ...props
}: React.ComponentProps<typeof ComboboxPrimitive.Item>) {
    return (
        <ComboboxPrimitive.Item
            data-slot="combobox-item"
            className={cn(
                "relative flex w-full cursor-default items-center gap-2 rounded-sm py-1.5 pr-8 pl-2 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
                className
            )}
            {...props}
        >
            <span className="absolute right-2 flex size-3.5 items-center justify-center">
                <ComboboxPrimitive.ItemIndicator>
                    <CheckIcon className="size-4" />
                </ComboboxPrimitive.ItemIndicator>
            </span>
            {children}
        </ComboboxPrimitive.Item>
    );
}

function ComboboxEmpty({
    className,
    ...props
}: React.ComponentProps<typeof ComboboxPrimitive.Empty>) {
    return (
        <ComboboxPrimitive.Empty
            data-slot="combobox-empty"
            className={cn("p-2 text-xs text-muted-foreground", className)}
            {...props}
        />
    );
}

function ComboboxValue({
    placeholder,
    ...props
}: React.ComponentProps<typeof ComboboxPrimitive.Value>) {
    return (
        <ComboboxPrimitive.Value
            data-slot="combobox-value"
            placeholder={placeholder}
            {...props}
        />
    );
}

export {
    Combobox,
    ComboboxTrigger,
    ComboboxContent,
    ComboboxInput,
    ComboboxItem,
    ComboboxEmpty,
    ComboboxValue,
};
