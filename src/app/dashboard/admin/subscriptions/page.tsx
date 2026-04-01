"use client";

import React, { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { 
  Plus, 
  ExternalLink, 
  Copy, 
  RefreshCcw, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle,
  MoreHorizontal,
  Trash2,
  Edit,
  Loader2,
  ArrowRight
} from "lucide-react";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export default function AdminSubscriptionsPage() {
  const subscriptions = useQuery(api.admin_subscriptions.list);
  const seedMutation = useMutation(api.admin_subscriptions.seedSubscriptions);
  const upsertMutation = useMutation(api.admin_subscriptions.upsert);
  const removeMutation = useMutation(api.admin_subscriptions.remove);

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    service: "",
    plan: "",
    status: "active",
    loginUrl: "",
    nextRenewal: Date.now() + 30 * 24 * 60 * 60 * 1000,
    notes: ""
  });

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Link copied to clipboard");
  };

  const handleSeed = async () => {
    try {
      const result = await seedMutation();
      toast.success(result);
    } catch (error) {
      toast.error("Failed to seed: " + (error as Error).message);
    }
  };

  const handleUpsert = async () => {
    try {
      await upsertMutation({
        ...(isEditing ? { id: isEditing as any } : {}),
        ...formData
      });
      setIsAddOpen(false);
      setIsEditing(null);
      setFormData({
        service: "",
        plan: "",
        status: "active",
        loginUrl: "",
        nextRenewal: Date.now() + 30 * 24 * 60 * 60 * 1000,
        notes: ""
      });
      toast.success(isEditing ? "Updated successfully" : "Added successfully");
    } catch (error) {
      toast.error("Error: " + (error as Error).message);
    }
  };

  const handleDelete = async (id: any) => {
    if (confirm("Are you sure you want to delete this service?")) {
      try {
        await removeMutation({ id });
        toast.success("Deleted successfully");
      } catch (error) {
        toast.error("Delete failed: " + (error as Error).message);
      }
    }
  };

  const getStatusBadge = (status: string, nextRenewal: number) => {
    const isExpiringSoon = nextRenewal - Date.now() < 7 * 24 * 60 * 60 * 1000;
    const finalStatus = status === "active" && isExpiringSoon ? "expiring" : status;

    switch (finalStatus) {
      case "active":
        return (
          <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-green-200 gap-1 px-2 py-0.5 uppercase text-[9px] font-bold tracking-wider">
            <CheckCircle2 className="h-2.5 w-2.5" />
            Active
          </Badge>
        );
      case "expiring":
        return (
          <Badge className="bg-yellow-100 text-yellow-700 hover:bg-yellow-100 border-yellow-200 gap-1 px-2 py-0.5 uppercase text-[9px] font-bold tracking-wider">
            <AlertTriangle className="h-2.5 w-2.5" />
            Expiring
          </Badge>
        );
      case "suspended":
        return (
          <Badge className="bg-red-100 text-red-700 hover:bg-red-100 border-red-200 gap-1 px-2 py-0.5 uppercase text-[9px] font-bold tracking-wider">
            <XCircle className="h-2.5 w-2.5" />
            Suspended
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (subscriptions === undefined) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-8">
      {/* Header Section */}
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-gray-900 font-geist">Platform Subscriptions</h1>
          <p className="mt-1 text-sm text-gray-500 font-geist">
            Track and manage shared API keys, SaaS plans, and critical service logins.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            className="h-9 gap-2 text-xs font-medium"
            onClick={handleSeed}
          >
            <RefreshCcw className="h-3.5 w-3.5 text-blue-500" />
            Refresh Status
          </Button>
          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="h-9 gap-2 bg-black text-white hover:bg-gray-800 text-xs font-medium">
                <Plus className="h-3.5 w-3.5" />
                Add Service
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Plus className="h-5 w-5 text-blue-500" />
                  {isEditing ? "Edit Service" : "Add New Service"}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-6 pt-4">
                <div className="grid gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Service / API Name</label>
                    <Input 
                      placeholder="e.g. Hugging Face" 
                      value={formData.service} 
                      onChange={(e) => setFormData({...formData, service: e.target.value})}
                      className="h-9 w-full rounded-md border-gray-200 bg-gray-50 text-xs text-gray-700 transition-colors focus:border-gray-400 focus:outline-none"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Plan</label>
                      <Input 
                        placeholder="e.g. Pro / PAYG" 
                        value={formData.plan} 
                        onChange={(e) => setFormData({...formData, plan: e.target.value})}
                        className="h-9 w-full rounded-md border-gray-200 bg-gray-50 text-xs text-gray-700 transition-colors focus:border-gray-400 focus:outline-none"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Status</label>
                      <select 
                        className="flex h-9 w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-1 text-xs text-gray-700 transition-colors focus:border-gray-400 focus:outline-none"
                        value={formData.status}
                        onChange={(e) => setFormData({...formData, status: e.target.value})}
                      >
                        <option value="active">Active</option>
                        <option value="suspended">Suspended</option>
                      </select>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Login / Dashboard URL</label>
                    <Input 
                      placeholder="https://..." 
                      value={formData.loginUrl} 
                      onChange={(e) => setFormData({...formData, loginUrl: e.target.value})}
                      className="h-9 w-full rounded-md border-gray-200 bg-gray-50 text-xs text-gray-700 transition-colors focus:border-gray-400 focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Notes (Internal)</label>
                    <Input 
                      placeholder="e.g. Shared engineering credentials" 
                      value={formData.notes} 
                      onChange={(e) => setFormData({...formData, notes: e.target.value})}
                      className="h-9 w-full rounded-md border-gray-200 bg-gray-50 text-xs text-gray-700 transition-colors focus:border-gray-400 focus:outline-none"
                    />
                  </div>
                </div>
                
                <Button onClick={handleUpsert} className="w-full h-9 bg-black text-white hover:bg-gray-800 text-xs">
                  {isEditing ? "Save Changes" : "Create Service Entry"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Main Table */}
      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm">
        {subscriptions.length === 0 ? (
          <div className="py-20 text-center">
            <RefreshCcw className="mx-auto mb-4 h-12 w-12 text-gray-200" />
            <h3 className="text-sm font-medium text-gray-900">No subscriptions found</h3>
            <p className="mt-1 text-xs text-gray-500">Seed the initial service list to get started.</p>
            <Button 
                variant="outline" 
                className="mt-4 gap-2 border-dashed"
                onClick={handleSeed}
            >
                Seed Services Now
                <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <TooltipProvider>
            <Table>
              <TableHeader className="bg-gray-50/50">
                <TableRow>
                  <TableHead className="px-6 py-3 uppercase tracking-wider text-[10px] font-bold text-gray-400">Service / API</TableHead>
                  <TableHead className="px-6 py-3 uppercase tracking-wider text-[10px] font-bold text-gray-400">Plan</TableHead>
                  <TableHead className="px-6 py-3 uppercase tracking-wider text-[10px] font-bold text-gray-400">Status</TableHead>
                  <TableHead className="px-6 py-3 uppercase tracking-wider text-[10px] font-bold text-gray-400">Login Link</TableHead>
                  <TableHead className="px-6 py-3 uppercase tracking-wider text-[10px] font-bold text-gray-400">Next Renewal</TableHead>
                  <TableHead className="px-6 py-3 uppercase tracking-wider text-[10px] font-bold text-gray-400">Notes</TableHead>
                  <TableHead className="px-6 py-3 text-right"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {subscriptions.map((sub) => (
                  <TableRow key={sub._id} className="group hover:bg-gray-50/30 transition-colors border-gray-100">
                    <TableCell className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gray-50 border border-gray-100">
                           <span className="text-[10px] font-bold text-gray-600">{sub.service[0]}</span>
                        </div>
                        <span className="font-semibold text-gray-900 text-xs tracking-tight">{sub.service}</span>
                      </div>
                    </TableCell>
                    <TableCell className="px-6 py-4 text-xs font-medium text-gray-600">{sub.plan}</TableCell>
                    <TableCell className="px-6 py-4">
                      <Tooltip>
                        <TooltipTrigger asChild>
                           <div className="cursor-help">
                             {getStatusBadge(sub.status, sub.nextRenewal)}
                           </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          {sub.status === "active" && (sub.nextRenewal - Date.now() < 7 * 24 * 60 * 60 * 1000) 
                            ? "Service expires in less than 7 days" 
                            : `Current status: ${sub.status.toUpperCase()}`}
                        </TooltipContent>
                      </Tooltip>
                    </TableCell>
                    <TableCell className="px-6 py-4">
                      <div className="flex items-center gap-1.5">
                        <a 
                          href={sub.loginUrl} 
                          target="_blank" 
                          rel="noreferrer"
                          className="flex items-center gap-1 text-[11px] font-medium text-blue-600 hover:text-blue-700 underline-offset-4 hover:underline"
                        >
                          <ExternalLink className="h-3 w-3" />
                          Login
                        </a>
                        <button 
                            onClick={() => handleCopy(sub.loginUrl)}
                            className="p-1 text-gray-400 hover:text-gray-600 transition-colors rounded-md hover:bg-gray-100"
                        >
                            <Copy className="h-3 w-3" />
                        </button>
                      </div>
                    </TableCell>
                    <TableCell className="px-6 py-4 text-[11px] font-mono font-medium text-gray-500">
                      {new Date(sub.nextRenewal).toLocaleDateString("en-GB", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric"
                      })}
                    </TableCell>
                    <TableCell className="px-6 py-4 max-w-[200px] truncate">
                      <span className="text-[11px] text-gray-400">{sub.notes || "—"}</span>
                    </TableCell>
                    <TableCell className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                         <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-7 w-7 p-0"
                            onClick={() => {
                                setIsEditing(sub._id);
                                setFormData({
                                    service: sub.service,
                                    plan: sub.plan,
                                    status: sub.status,
                                    loginUrl: sub.loginUrl,
                                    nextRenewal: sub.nextRenewal,
                                    notes: sub.notes || ""
                                });
                                setIsAddOpen(true);
                            }}
                         >
                            <Edit className="h-3.5 w-3.5 text-gray-500" />
                         </Button>
                         <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-7 w-7 p-0"
                            onClick={() => handleDelete(sub._id)}
                         >
                            <Trash2 className="h-3.5 w-3.5 text-red-400" />
                         </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TooltipProvider>
        )}
      </div>
    </div>
  );
}
