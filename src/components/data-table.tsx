"use client";

export function DataTable({ data }: { data: any[] }) {
    return (
        <div className="px-4 lg:px-6 py-4">
            <div className="border rounded-lg overflow-hidden bg-card">
                <div className="bg-muted/50 p-4 border-b font-medium">Saved Trade Partners</div>
                <div className="divide-y">
                    {data.length > 0 ? (
                        data.map((company) => (
                            <div key={company._id} className="p-4 flex justify-between items-center text-sm">
                                <div className="font-semibold">{company.companyName}</div>
                                <div className="text-muted-foreground">{company.country}</div>
                            </div>
                        ))
                    ) : (
                        <div className="p-8 text-center text-muted-foreground italic">
                            No trade partners saved yet. Discover partners in the Search tab.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
