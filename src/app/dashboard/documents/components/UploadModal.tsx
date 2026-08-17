"use client";

import React, { useState } from "react";
import { 
  Upload, 
  FileText, 
  Loader2 
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DOCUMENT_TYPES } from "@/lib/utils/document-utils";
import { ApiError } from "@/lib/convex-errors";

interface UploadModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  allDeclarationOptions: any[];
  userId: string;
}

export function UploadModal({ isOpen, onOpenChange, allDeclarationOptions, userId }: UploadModalProps) {
  const [uploadStep, setUploadStep] = useState(1);
  const [uploadForm, setUploadForm] = useState({ type: "", linkedDeclarationId: "", file: null as any });
  const [isUploading, setIsUploading] = useState(false);

  const handleSubmit = async () => {
    if (!uploadForm.file) return;
    setIsUploading(true);
    
    try {
      const linkedDeclaration = allDeclarationOptions.find((decl: any) => decl.id === uploadForm.linkedDeclarationId);
      const formData = new FormData();
      formData.append("file", uploadForm.file);
      formData.append("type", uploadForm.type);
      formData.append("linkedDeclarationId", uploadForm.linkedDeclarationId);
      formData.append("linkedMrn", linkedDeclaration?.mrn || "none");
      formData.append("userId", userId);

      const res = await fetch("/api/ai/smart-upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new ApiError(data.error || "Smart upload pipeline failed");
      }

      onOpenChange(false);
      setUploadStep(1);
      setUploadForm({ type: "", linkedDeclarationId: "", file: null as any });
    } catch (err: any) {
      console.error(err);
      alert(err.message);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!open) {
        setUploadStep(1);
        setUploadForm({ type: "", linkedDeclarationId: "", file: null as any });
      }
      onOpenChange(open);
    }}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Upload document</DialogTitle>
        </DialogHeader>

        {uploadStep === 1 && (
          <div>
            <div className="grid gap-4 py-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  Document Type
                </label>
                <Select value={uploadForm.type} onValueChange={(val) => setUploadForm({...uploadForm, type: val})}>
                  <SelectTrigger className="h-9 w-full bg-slate-50 border-slate-200 text-xs text-slate-700">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent position="popper" className="max-h-[300px] z-[110]">
                    {DOCUMENT_TYPES.map((type) => (
                      <SelectItem key={type.code} value={`${type.code} ${type.name}`} className="text-xs">
                        {type.name} ({type.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  Link to Declaration
                </label>
                <Select value={uploadForm.linkedDeclarationId} onValueChange={(val) => setUploadForm({...uploadForm, linkedDeclarationId: val})}>
                  <SelectTrigger className="h-9 w-full bg-slate-50 border-slate-200 text-xs text-slate-700">
                    <SelectValue placeholder="Select declaration" />
                  </SelectTrigger>
                  <SelectContent position="popper" className="max-h-[300px] z-[110]">
                    {allDeclarationOptions.map((decl: any) => (
                      <SelectItem key={decl.id} value={decl.id} className="font-mono text-xs">
                        {decl.mrn}
                      </SelectItem>
                    ))}
                    <SelectItem value="none" className="text-xs">Do not link</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <button
                disabled={!uploadForm.type || !uploadForm.linkedDeclarationId}
                onClick={() => setUploadStep(2)}
                className="flex h-9 w-full sm:w-auto items-center justify-center gap-2 rounded-md bg-black px-4 text-xs font-medium text-white transition-opacity hover:bg-slate-800 disabled:opacity-50"
              >
                Continue
              </button>
            </DialogFooter>
          </div>
        )}

        {uploadStep === 2 && (
          <div>
            <div className="grid gap-4 py-4">
              <div className="border-2 border-dashed border-slate-200 rounded-lg p-8 flex flex-col items-center justify-center text-center bg-slate-50/50">
                <Upload className="h-8 w-8 text-slate-400 mb-3" />
                <p className="text-sm font-medium text-slate-900">Drag and drop document here</p>
                <p className="text-xs text-slate-500 mt-1 mb-4">Accepted: PDF, JPG, PNG</p>
                
                <input 
                  type="file" 
                  id="file-upload" 
                  className="hidden" 
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      setUploadForm({...uploadForm, file: e.target.files[0]});
                    }
                  }}
                />
                <button onClick={() => document.getElementById('file-upload')?.click()} className="flex h-9 items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-4 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50">
                  Browse files
                </button>
              </div>
              
              {uploadForm.file && (
                <div className="flex items-center justify-between p-3 border border-slate-200 rounded-md bg-white">
                  <div className="flex items-center gap-2 overflow-hidden">
                    <FileText className="h-4 w-4 text-blue-500 shrink-0" />
                    <span className="text-xs font-medium text-slate-700 truncate">{uploadForm.file.name}</span>
                  </div>
                  <span className="text-[0.625rem] text-slate-400 shrink-0 ml-2">
                    {(uploadForm.file.size / 1024).toFixed(1)} KB
                  </span>
                </div>
              )}
            </div>
            <DialogFooter>
              <button
                disabled={!uploadForm.file || isUploading}
                onClick={handleSubmit}
                className="flex h-9 w-full sm:w-auto items-center justify-center gap-2 rounded-md bg-black px-4 text-xs font-medium text-white transition-opacity hover:bg-slate-800 disabled:opacity-50"
              >
                {isUploading && <Loader2 className="h-4 w-4 animate-spin" />}
                {isUploading ? "Analyzing..." : "Upload & Analyze"}
              </button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
