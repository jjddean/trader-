"use client";

type SavedCompanyRow = { _id: string; companyName: string; country: string };

export function DataTable({ data }: { data: SavedCompanyRow[] }) {
  return (
    <div className="px-4 py-4 lg:px-6">
      <div className="bg-card overflow-hidden rounded-lg border">
        <div className="bg-muted/50 border-b p-4 font-medium">Saved Trade Partners</div>
        <div className="divide-y">
          {data.length > 0 ? (
            data.map((company) => (
              <div key={company._id} className="flex items-center justify-between p-4 text-sm">
                <div className="font-semibold">{company.companyName}</div>
                <div className="text-muted-foreground">{company.country}</div>
              </div>
            ))
          ) : (
            <div className="text-muted-foreground p-8 text-center italic">
              No trade partners saved yet. Discover partners in the Search tab.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
