import React from 'react';
import { HSCodeLookup } from '@/components/tools/HSCodeLookup';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

const HSCodePage = () => {
    return (
        <div className="space-y-8 p-8">
            <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
                <div>
                    <h1 className="text-xl font-semibold tracking-tight text-gray-900">HS Code Lookup</h1>
                    <p className="mt-1 text-sm text-gray-500">
                        Find Harmonized System codes for your shipments.
                    </p>
                </div>
            </div>

            <div className="max-w-4xl">
                <HSCodeLookup />
            </div>
        </div>
    );
};

export default HSCodePage;
