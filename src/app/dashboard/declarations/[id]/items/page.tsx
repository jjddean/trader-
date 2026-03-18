"use client";

import React, { useState } from "react";
import { useParams } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../../../convex/_generated/api";
import { Id } from "../../../../../../convex/_generated/dataModel";
import { Plus, Trash2, UploadCloud, Loader2, Sparkles, AlertCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function GoodsItemsPage() {
  const params = useParams<{ id: string }>();
  const declarationId = params?.id as Id<"declarations">;
  
  const items = useQuery(api.goods_items.getItems, declarationId ? { declarationId } : "skip");
  const addItem = useMutation(api.goods_items.addItem);
  const removeItem = useMutation(api.goods_items.removeItem);

  const [isUploading, setIsUploading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [showAddRowModal, setShowAddRowModal] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  
  const [originCountry, setOriginCountry] = useState("");
  const [hsCode, setHsCode] = useState("");
  const [description, setDescription] = useState("");

  const handleManualAdd = async () => {
    setIsAdding(true);
    try {
      await addItem({
        declarationId,
        sequenceNumber: (items?.length || 0) + 1,
        commodityCode: hsCode || "",
        description: description || "New Item",
        originCountry: originCountry || "GB",
        procedureCode: "4000",
        valueAmount: 0,
        valueCurrency: "GBP",
      });
      setShowAddRowModal(false);
      // Reset form
      setHsCode("");
      setDescription("");
      setOriginCountry("");
    } catch (err) {
      console.error("Failed to add row:", err);
    } finally {
      setIsAdding(false);
    }
  };

  const handleAIUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setAiError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      // Hit our existing AWS Textract + Groq endpoint
      const res = await fetch("/api/ai/extract", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to extract invoice data.");
      }

      // Automatically add the extracted items to Convex (Acting as the Human-in-the-Loop review staging)
      if (data.items && Array.isArray(data.items)) {
        for (let i = 0; i < data.items.length; i++) {
          const item = data.items[i];
          await addItem({
            declarationId,
            sequenceNumber: (items?.length || 0) + i + 1,
            commodityCode: item.commodityCode || "",
            description: item.description || "Unknown Item",
            originCountry: item.originCountry || "GB",
            procedureCode: "4000", // Default to home use
            valueAmount: Number(item.valueAmount) || 0,
            valueCurrency: item.valueCurrency || "GBP",
          });
        }
      }

    } catch (err: any) {
      console.error("AI Extraction failed:", err);
      setAiError(err.message);
    } finally {
      setIsUploading(false);
      if (e.target) e.target.value = ''; // Reset input
    }
  };

  if (items === undefined) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-medium text-gray-900">Goods Items</h2>
          <p className="mt-1 text-xs text-gray-500">
            Define the physical commodities in this shipment. Required for WCO payload.
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="relative">
             <input
                type="file"
                accept="application/pdf,image/*"
                onChange={handleAIUpload}
                disabled={isUploading}
                className="absolute inset-0 z-10 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
             />
             <button
               disabled={isUploading}
               className="flex h-9 items-center gap-2 rounded-md border border-purple-200 bg-purple-50 px-4 text-xs font-medium text-purple-700 transition-colors hover:bg-purple-100 disabled:opacity-50"
             >
               {isUploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
               {isUploading ? "Extracting JSON with Groq..." : "AI Auto-Fill (Invoice PDF)"}
             </button>
          </div>
          
          <button
            onClick={() => setShowAddRowModal(true)}
            className="flex h-9 items-center gap-2 rounded-md bg-black px-4 text-xs font-medium text-white transition-opacity hover:bg-gray-800"
          >
            <Plus className="h-4 w-4" />
            Add Row
          </button>
        </div>
      </div>

      {aiError && (
        <div className="flex items-center gap-2 rounded-md bg-red-50 p-3 text-xs text-red-600 border border-red-100">
          <AlertCircle className="h-4 w-4" />
          <span className="font-medium">Extraction Failed:</span> {aiError}
        </div>
      )}

      {/* Mandatory Human-in-the-Loop Review Banner */}
      {items.length > 0 && (
         <div className="flex items-center gap-2 rounded-md bg-yellow-50 p-3 text-xs text-yellow-800 border border-yellow-200">
          <InfoIcon className="h-4 w-4 text-yellow-600" />
          <p>
             <strong>Important:</strong> According to HMRC guidelines, you are legally responsible for verifying all AI-extracted fields below before submission.
          </p>
         </div>
      )}

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        {items.length > 0 ? (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-gray-200 bg-gray-50/50">
              <tr>
                <th className="px-4 py-3 font-medium text-gray-500 uppercase tracking-wider text-[10px]">Seq</th>
                <th className="px-4 py-3 font-medium text-gray-500 uppercase tracking-wider text-[10px]">Description</th>
                <th className="px-4 py-3 font-medium text-gray-500 uppercase tracking-wider text-[10px]">HS Code</th>
                <th className="px-4 py-3 font-medium text-gray-500 uppercase tracking-wider text-[10px]">Origin</th>
                <th className="px-4 py-3 font-medium text-gray-500 uppercase tracking-wider text-[10px]">Value</th>
                <th className="px-4 py-3 font-medium text-gray-500 uppercase tracking-wider text-[10px]">CPC</th>
                <th className="px-4 py-3 text-right"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((item: any, index: number) => (
                <tr key={item._id} className="transition-colors hover:bg-gray-50/50">
                  <td className="px-4 py-3 text-xs text-gray-400">{index + 1}</td>
                  <td className="px-4 py-3">
                    <input 
                      type="text" 
                      defaultValue={item.description} 
                      className="w-full bg-transparent text-xs font-medium text-gray-900 outline-none" 
                    />
                  </td>
                  <td className="px-4 py-3">
                    <input 
                      type="text" 
                      defaultValue={item.commodityCode} 
                      placeholder="e.g. 6109100010"
                      className="w-28 rounded border border-transparent bg-transparent p-1 font-mono text-xs text-gray-700 outline-none hover:border-gray-200 focus:border-blue-500 focus:bg-white" 
                    />
                  </td>
                  <td className="px-4 py-3">
                    <input 
                      type="text" 
                      defaultValue={item.originCountry} 
                      className="w-12 rounded border border-transparent bg-transparent p-1 font-mono text-xs text-gray-700 outline-none hover:border-gray-200 focus:border-blue-500 focus:bg-white" 
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-gray-400">{item.valueCurrency}</span>
                      <input 
                        type="number" 
                        defaultValue={item.valueAmount} 
                        className="w-20 rounded border border-transparent bg-transparent p-1 text-xs text-gray-700 outline-none hover:border-gray-200 focus:border-blue-500 focus:bg-white" 
                      />
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600">{item.procedureCode}</td>
                  <td className="px-4 py-3 text-right">
                     <button
                        onClick={() => removeItem({ id: item._id })}
                        className="text-gray-400 hover:text-red-600 transition-colors p-1"
                     >
                        <Trash2 className="h-4 w-4" />
                     </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
           <div className="flex flex-col items-center justify-center py-20 text-center">
             <UploadCloud className="mb-4 h-8 w-8 text-gray-300" />
             <h3 className="text-sm font-medium text-gray-900">No goods items yet</h3>
             <p className="mt-1 text-xs text-gray-500 max-w-sm">
               You can manually add rows or use our AI to automatically extract the line items from your commercial invoice PDF.
             </p>
           </div>
        )}
      </div>

      <Dialog open={showAddRowModal} onOpenChange={setShowAddRowModal}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Add Goods Item</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <label htmlFor="origin" className="text-xs font-medium text-gray-700">
                ORIGIN COUNTRY
              </label>
              <Select value={originCountry} onValueChange={setOriginCountry}>
                <SelectTrigger id="origin" className="h-10 w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent">
                  <SelectValue placeholder="Select Origin Country" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="GB">United Kingdom (GB)</SelectItem>
                  <SelectItem value="US">United States (US)</SelectItem>
                  <SelectItem value="CN">China (CN)</SelectItem>
                  <SelectItem value="BD">Bangladesh (BD)</SelectItem>
                  <SelectItem value="DE">Germany (DE)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <label htmlFor="hsCode" className="text-xs font-medium text-gray-700">
                HS CODE (OPTIONAL)
              </label>
              <input
                id="hsCode"
                value={hsCode}
                onChange={(e) => setHsCode(e.target.value)}
                placeholder="e.g., 6109100010"
                className="flex h-10 w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
            <div className="grid gap-2">
              <label htmlFor="description" className="text-xs font-medium text-gray-700">
                DESCRIPTION
              </label>
              <Select value={description} onValueChange={setDescription}>
                <SelectTrigger id="description" className="h-10 w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent">
                  <SelectValue placeholder="Select Cargo Description" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Knitwear">Knitwear</SelectItem>
                  <SelectItem value="Electronics">Electronics</SelectItem>
                  <SelectItem value="Machinery">Machinery</SelectItem>
                  <SelectItem value="Apparel">Apparel</SelectItem>
                  <SelectItem value="Furniture">Furniture</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <button
              disabled={isAdding || !originCountry || !description}
              onClick={handleManualAdd}
              className="flex h-9 w-full sm:w-auto items-center justify-center gap-2 rounded-md bg-black px-4 text-xs font-medium text-white transition-opacity hover:bg-gray-800 disabled:opacity-50"
            >
              {isAdding && <Loader2 className="h-4 w-4 animate-spin" />}
              Add Row
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Quick helper icon for the banner
function InfoIcon(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4" />
      <path d="M12 8h.01" />
    </svg>
  )
}
