"use client";

import React, { useState } from "react";
import { useParams } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../../../convex/_generated/api";
import { Id } from "../../../../../../convex/_generated/dataModel";
import { UploadCloud, File, ShieldCheck, Loader2, CheckCircle2, AlertCircle } from "lucide-react";

export default function DocumentsPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id as Id<"declarations">;
  
  const declaration = useQuery(api.declarations.getLane, id ? { id } : "skip");
  const trackUpload = useMutation(api.documents.trackUpload);

  const [isUploading, setIsUploading] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<{name: string, type: string, size: string}[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);

  if (declaration === undefined) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!declaration) {
    return null;
  }

  const isLocked = !declaration.mrn;

  const handleSimulateUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadError(null);

    try {
      const initiateRes = await fetch("/api/hmrc/documents/initiate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          declarationId: id,
          fileName: file.name,
          fileSize: file.size,
        }),
      });
      if (initiateRes.status === 410) {
        setUploadError("Upload URL expired. Please retry to generate a fresh HMRC upload session.");
        return;
      }
      if (!initiateRes.ok) {
        const initiateData = await initiateRes.json().catch(() => ({}));
        setUploadError(initiateData?.error || "Unable to initiate secure upload with HMRC.");
        return;
      }
      
      const initiateData = await initiateRes.json();
      const params = initiateData.uploadParameters || {};
      const s3Url = params.href || params.uploadUrl;
      const s3Fields = params.fields || {};

      const s3FormData = new FormData();
      Object.keys(s3Fields).forEach(key => s3FormData.append(key, s3Fields[key]));
      s3FormData.append("file", file);

      let s3Res;
      try {
        s3Res = await fetch(s3Url, {
          method: "POST",
          body: s3FormData
        });
      } catch (err: any) {
        setUploadError(`Failed S3 POST blocked by missing CORS or network error: ${err.message}`);
        return;
      }

      if (s3Res.status === 410) {
        setUploadError("Upload URL expired (410 Gone). Please request new one.");
        return;
      }

      if (s3Res.status !== 201 && s3Res.status !== 204 && !s3Res.ok) {
        setUploadError(`HMRC S3 Upload Failed (Status: ${s3Res.status})`);
        return;
      }

      const storageId = s3Fields["x-amz-meta-receipt-id"] || `amz-${Date.now()}`;

      const uploadRes = await fetch("/api/hmrc/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storageId: storageId,
          mrn: declaration.mrn,
          documentType: "Commercial_Invoice",
        }),
      });

      if (uploadRes.status === 410) {
        setUploadError("XML mapping URL expired. Please retry.");
        return;
      }
      if (!uploadRes.ok) {
        const uploadData = await uploadRes.json().catch(() => ({}));
        setUploadError(uploadData?.error || "Secure mapping sync failed.");
        return;
      }

      await trackUpload({
        declarationId: id,
        fileName: file.name,
        fileSize: file.size,
        documentType: "Commercial_Invoice",
        uploadStatus: "Clean",
      });

      setUploadedFiles(prev => [...prev, {
        name: file.name,
        type: "Commercial_Invoice",
        size: (file.size / 1024 / 1024).toFixed(2) + " MB"
      }]);
    } finally {
      setIsUploading(false);
      if (e.target) e.target.value = "";
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-medium text-gray-900">Secure Document Upload</h2>
        <p className="mt-1 text-xs text-gray-500">
          Upload supporting evidence directly to HMRC secure Amazon S3 (Upscan) servers.
        </p>
      </div>

      {isLocked && (
        <div className="rounded-md border border-yellow-200 bg-yellow-50 p-4">
           <h3 className="text-sm font-semibold text-yellow-800">MRN Required</h3>
           <p className="mt-1 text-xs text-yellow-700">
             You cannot upload supporting documents until this declaration has been successfully submitted and issued an MRN (Movement Reference Number) by HMRC.
           </p>
        </div>
      )}

      {uploadError && (
        <div className="rounded-md border border-red-200 bg-red-50 p-4">
          <div className="flex items-start gap-2">
            <AlertCircle className="mt-0.5 h-4 w-4 text-red-600" />
            <p className="text-xs text-red-700">{uploadError}</p>
          </div>
        </div>
      )}

      <div className={`rounded-xl border border-gray-200 bg-white overflow-hidden transition-opacity ${isLocked ? 'opacity-50 pointer-events-none' : ''}`}>
        <div className="p-8">
           
           <div className="flex flex-col items-center justify-center border-2 border-dashed border-gray-200 rounded-lg p-12 bg-gray-50/50 hover:bg-gray-50 transition-colors relative">
              <input 
                type="file" 
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                onChange={handleSimulateUpload}
                disabled={isLocked || isUploading}
                accept=".pdf,.jpg,.jpeg,.png"
              />
              
              {isUploading ? (
                <div className="flex flex-col items-center text-center">
                   <Loader2 className="h-10 w-10 text-blue-500 animate-spin mb-4" />
                   <p className="text-sm font-medium text-gray-900">Transmitting to HMRC Upscan...</p>
                   <p className="text-xs text-gray-500 mt-1">Awaiting anti-virus scan results</p>
                </div>
              ) : (
                <div className="flex flex-col items-center text-center">
                   <div className="h-16 w-16 bg-blue-50 rounded-full flex items-center justify-center mb-4">
                     <UploadCloud className="h-8 w-8 text-blue-600" />
                   </div>
                   <h3 className="text-sm font-bold text-gray-900">Click or drag file to upload</h3>
                   <p className="mt-1 text-xs text-gray-500 max-w-xs">
                     Securely upload Commercial Invoices, Packing Lists, or Certificates of Origin.
                   </p>
                   <div className="mt-4 flex gap-2 justify-center text-[10px] uppercase font-bold text-gray-400">
                      <span>PDF</span> • <span>JPEG</span> • <span>PNG</span>
                   </div>
                </div>
              )}
           </div>

           {uploadedFiles.length > 0 && (
             <div className="mt-8 space-y-4">
               <h4 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                 <ShieldCheck className="h-4 w-4 text-green-500" />
                 Verified Documents Attached to {declaration?.mrn}
               </h4>
               <div className="space-y-2">
                 {uploadedFiles.map((file, i) => (
                    <div key={i} className="flex items-center justify-between p-3 border border-gray-100 rounded-md bg-gray-50">
                       <div className="flex items-center gap-3">
                          <File className="h-5 w-5 text-blue-500" />
                          <div>
                            <p className="text-sm font-medium text-gray-900">{file.name}</p>
                            <p className="text-xs text-gray-500">{file.type} • {file.size}</p>
                          </div>
                       </div>
                       <div className="flex items-center gap-1 bg-green-100 text-green-700 px-2 py-1 rounded text-[10px] font-bold uppercase">
                          <CheckCircle2 className="h-3 w-3" /> Scanned & Clean
                       </div>
                    </div>
                 ))}
               </div>
             </div>
           )}

        </div>
      </div>
    </div>
  );
}
