"use client";

import { useEffect, useState } from "react";
import { Minus, Plus } from "lucide-react";

const SCALES = [
    { label: "Compact", value: 1 },
    { label: "Default", value: 1.125 },
    { label: "Large", value: 1.25 },
] as const;

const STORAGE_KEY = "tradedna-text-scale";

export function TextScaleToggle() {
    const [activeIndex, setActiveIndex] = useState(1); // Default

    useEffect(() => {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            const idx = SCALES.findIndex((s) => s.value === parseFloat(stored));
            if (idx !== -1) {
                setActiveIndex(idx);
                document.documentElement.style.setProperty("--text-scale", stored);
            }
        }
    }, []);

    const setScale = (index: number) => {
        const scale = SCALES[index];
        setActiveIndex(index);
        document.documentElement.style.setProperty("--text-scale", String(scale.value));
        localStorage.setItem(STORAGE_KEY, String(scale.value));
    };

    return (
        <div className="flex items-center gap-2">
            <button
                onClick={() => setScale(Math.max(0, activeIndex - 1))}
                disabled={activeIndex === 0}
                className="p-1.5 rounded-md border border-gray-200 hover:bg-gray-50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
                <Minus className="h-3.5 w-3.5 text-gray-500" />
            </button>

            <div className="flex bg-gray-100 rounded-lg p-0.5">
                {SCALES.map((scale, i) => (
                    <button
                        key={scale.label}
                        onClick={() => setScale(i)}
                        className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${activeIndex === i
                                ? "bg-white text-gray-900 shadow-sm"
                                : "text-gray-500 hover:text-gray-700"
                            }`}
                    >
                        {scale.label}
                    </button>
                ))}
            </div>

            <button
                onClick={() => setScale(Math.min(SCALES.length - 1, activeIndex + 1))}
                disabled={activeIndex === SCALES.length - 1}
                className="p-1.5 rounded-md border border-gray-200 hover:bg-gray-50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
                <Plus className="h-3.5 w-3.5 text-gray-500" />
            </button>
        </div>
    );
}
