const fs = require('fs');
const path = require('path');

const targetPath = path.join(__dirname, 'src', 'app', 'dashboard', 'documents', 'page.tsx');
const content = fs.readFileSync(targetPath, 'utf8');

const lines = content.split('\n');

const newImports = `import { Upload, ClipboardPaste, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const MOCK_DOCUMENTS = [
  { id: 1, name: "INV-2026-03-01.pdf", method: "Smart Upload", date: "Today, 09:41 AM", type: "N935", typeName: "Commercial invoice", mrn: "26GB1234567890ABCD", status: "verified", de23: "N935" },
  { id: 2, name: "PL-004-B.pdf", method: "Smart Upload", date: "Today, 09:42 AM", type: "N271", typeName: "Packing list", mrn: "26GB1234567890ABCD", status: "verified", de23: "N271" },
  { id: 3, name: "CERT-ORIGIN-CH.pdf", method: "Manual Paste", date: "Yesterday, 14:22 PM", type: "N864", typeName: "Certificate of origin", mrn: "26GB9876543210WXYZ", status: "review", flag: "Signature unverified", de23: "N864" },
  { id: 4, name: "Missing Document", method: "System Flag", date: "System", type: "C400", typeName: "Licence", mrn: "26GB9876543210WXYZ", status: "missing", flag: "Required for 6110 30 10 00", de23: "C400" },
  { id: 5, name: "BOL-HKG-LHR.pdf", method: "Smart Upload", date: "Mar 18, 11:05 AM", type: "N705", typeName: "Bill of lading", mrn: "26GB1234567890ABCD", status: "verified", de23: "N705" },
];
`;

const newReturn = `
  const totalDocs = MOCK_DOCUMENTS.length;
  const verifiedDocs = MOCK_DOCUMENTS.filter(d => d.status === 'verified').length;
  const reviewDocs = MOCK_DOCUMENTS.filter(d => d.status === 'review').length;
  const missingDocs = MOCK_DOCUMENTS.filter(d => d.status === 'missing').length;

  return (
    <div className="space-y-8 p-8 max-w-7xl mx-auto">
      {/* PAGE HEADER */}
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-gray-900">Documents</h1>
          <p className="mt-1 text-sm text-gray-500">
            Supporting documents required for CDS declarations
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" className="h-9 text-xs">
            <ClipboardPaste className="mr-2 h-4 w-4" />
            Manual paste
          </Button>
          <Button className="h-9 text-xs">
            <Upload className="mr-2 h-4 w-4" />
            Upload document
          </Button>
        </div>
      </div>

      {/* KPI CARDS ROW */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="rounded-xl border border-[#e9e9e7] bg-white p-5">
          <p className="mb-1 text-[0.625rem] font-semibold tracking-widest text-gray-500 uppercase">TOTAL DOCUMENTS</p>
          <h2 className="text-2xl font-medium tracking-tight text-foreground tabular-nums">{totalDocs}</h2>
          <p className="mt-1 text-[0.625rem] text-gray-500">across 2 declarations</p>
        </div>
        <div className="rounded-xl border border-[#e9e9e7] bg-white p-5">
          <p className="mb-1 text-[0.625rem] font-semibold tracking-widest text-gray-500 uppercase">VERIFIED BY AI</p>
          <div className="flex items-baseline gap-2">
            <h2 className="text-2xl font-medium tracking-tight text-green-600 tabular-nums">{verifiedDocs}</h2>
          </div>
          <p className="mt-1 text-[0.625rem] text-gray-500">no issues found</p>
        </div>
        <div className="rounded-xl border border-[#e9e9e7] bg-white p-5">
          <p className="mb-1 text-[0.625rem] font-semibold tracking-widest text-gray-500 uppercase">NEEDS REVIEW</p>
          <div className="flex items-baseline gap-2">
            <h2 className="text-2xl font-medium tracking-tight text-amber-600 tabular-nums">{reviewDocs}</h2>
          </div>
          <p className="mt-1 text-[0.625rem] text-gray-500">compliance flags</p>
        </div>
        <div className="rounded-xl border border-[#e9e9e7] bg-white p-5">
          <p className="mb-1 text-[0.625rem] font-semibold tracking-widest text-gray-500 uppercase">MISSING</p>
          <h2 className="text-2xl font-medium tracking-tight text-red-600 tabular-nums">{missingDocs}</h2>
          <p className="mt-1 text-[0.625rem] text-gray-500">required for submission</p>
        </div>
      </div>

      {/* FILTER BAR & TABLE AREA */}
      <div className="flex flex-col overflow-hidden rounded-xl border border-[#e9e9e7] bg-white shadow-none">
        <div className="flex items-center gap-3 border-b border-[#e9e9e7] bg-gray-50 px-5 py-4">
          <Select defaultValue="all">
            <SelectTrigger className="w-[180px] h-8 bg-white text-xs border-gray-200">
              <SelectValue placeholder="All declarations" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">All declarations</SelectItem>
              <SelectItem value="26GB1234567890ABCD" className="text-xs font-mono">26GB1234567890ABCD</SelectItem>
              <SelectItem value="26GB9876543210WXYZ" className="text-xs font-mono">26GB9876543210WXYZ</SelectItem>
            </SelectContent>
          </Select>
          
          <Select defaultValue="all">
            <SelectTrigger className="w-[180px] h-8 bg-white text-xs border-gray-200">
              <SelectValue placeholder="All types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">All types</SelectItem>
              <SelectItem value="Commercial invoice" className="text-xs">Commercial invoice</SelectItem>
              <SelectItem value="Packing list" className="text-xs">Packing list</SelectItem>
              <SelectItem value="Certificate of origin" className="text-xs">Certificate of origin</SelectItem>
              <SelectItem value="Bill of lading" className="text-xs">Bill of lading</SelectItem>
              <SelectItem value="Licence" className="text-xs">Licence</SelectItem>
              <SelectItem value="Other" className="text-xs">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="w-full overflow-x-auto">
          <Table className="w-full">
            <TableHeader>
              <TableRow className="border-[#e9e9e7] hover:bg-transparent">
                <TableHead className="px-5 py-3 text-[0.625rem] font-semibold tracking-wider text-gray-500 uppercase w-[40%]">DOCUMENT</TableHead>
                <TableHead className="px-5 py-3 text-[0.625rem] font-semibold tracking-wider text-gray-500 uppercase">TYPE</TableHead>
                <TableHead className="px-5 py-3 text-[0.625rem] font-semibold tracking-wider text-gray-500 uppercase">LINKED MRN</TableHead>
                <TableHead className="px-5 py-3 text-[0.625rem] font-semibold tracking-wider text-gray-500 uppercase">STATUS</TableHead>
                <TableHead className="px-5 py-3 text-[0.625rem] font-semibold tracking-wider text-gray-500 uppercase text-right w-[80px]">DE 2/3</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-[#e9e9e7]">
              {MOCK_DOCUMENTS.map((doc) => {
                const isWarning = doc.status === 'review';
                const isMissing = doc.status === 'missing';

                return (
                  <TableRow 
                    key={doc.id} 
                    className={cn(
                      "group transition-colors cursor-pointer",
                      isWarning ? "bg-amber-50/50 hover:bg-amber-50" : "",
                      isMissing ? "bg-red-50/50 hover:bg-red-50" : "hover:bg-gray-50"
                    )}
                  >
                    <TableCell className="px-5 py-4">
                      <div className="flex flex-col">
                        <span className={cn("font-semibold text-sm", isWarning ? "text-amber-900" : isMissing ? "text-red-900" : "text-gray-900")}>
                          {doc.name}
                        </span>
                        <span className={cn("text-xs mt-0.5", isWarning ? "text-amber-700 font-medium" : isMissing ? "text-red-700 font-medium" : "text-gray-500")}>
                          {isMissing || isWarning ? doc.flag : \`\${doc.method} • \${doc.date}\`}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="px-5 py-4 text-sm text-gray-700">
                      {doc.type} <span className="text-xs text-gray-400 ml-1">({doc.typeName})</span>
                    </TableCell>
                    <TableCell className="px-5 py-4">
                      <span className="font-mono text-[0.6875rem] font-semibold text-gray-900">{doc.mrn}</span>
                    </TableCell>
                    <TableCell className="px-5 py-4">
                      {doc.status === 'verified' && (
                        <Badge variant="secondary" className="bg-green-100 text-green-700 hover:bg-green-100 font-medium rounded-md px-2 py-0.5 text-[0.625rem]">Verified</Badge>
                      )}
                      {doc.status === 'review' && (
                        <Badge variant="secondary" className="bg-amber-100 text-amber-700 hover:bg-amber-100 font-medium rounded-md px-2 py-0.5 text-[0.625rem]">Review</Badge>
                      )}
                      {doc.status === 'missing' && (
                        <Badge variant="secondary" className="bg-red-100 text-red-700 hover:bg-red-100 font-medium rounded-md px-2 py-0.5 text-[0.625rem]">Missing</Badge>
                      )}
                    </TableCell>
                    <TableCell className="px-5 py-4 text-right">
                      <span className="font-mono text-xs text-gray-400">{doc.de23}</span>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>
      
      <p className="text-xs text-gray-400 flex items-center gap-1.5 mt-2">
        <Info className="h-3.5 w-3.5" />
        DE 2/3 = CDS Data Element reference used in declaration submission
      </p>

      {/* --- LEGACY TOOLS (MOVED TO COMMENTS TO PRESERVE FOR FUTURE TRANSFER) --- */}
      {/*
`;

let result = '';

// Imports block: Find where to insert new imports
// Actually we can just prepend it along with regular imports
let i = 0;
while(i < lines.length && !lines[i].includes('export default function')) {
  result += lines[i] + '\\n';
  i++;
}

result += newImports;

// Now handle export default function line
result += lines[i] + '\\n';
i++;

// Inside the component, we want to comment out everything until the first return (
let insideState = true;
while(i < lines.length && !lines[i].includes('return (')) {
  result += '// ' + lines[i] + '\\n';
  i++;
}

// Now insert our new return statement
result += newReturn;

// Now for all subsequent lines (the JSX), put them inside comments block
while(i < lines.length) {
  if (lines[i].trim() === '  );') {
    result += lines[i] + '\\n';
    result += '      */}\\n';
    result += '  );\\n';
    i++;
  } else if (lines[i].trim() === '}') {
    result += lines[i] + '\\n';
    i++;
  } else {
    // Escape any nested block comments if they existed, though usually JSX comments are {/* */}
    let line = lines[i].replace(/\\/\\*|\\*\\//g, ''); 
    result += line + '\\n';
    i++;
  }
}

fs.writeFileSync(targetPath, result);
console.log("Rewritten successfully!");
