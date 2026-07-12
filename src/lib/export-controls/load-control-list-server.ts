import { readFile } from "node:fs/promises";
import path from "node:path";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../convex/_generated/api";
import {
  loadControlListSnapshot,
  type ControlListSnapshot,
} from "@/lib/export-controls/control-list";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function resolveControlListUrl(convexToken: string): Promise<string> {
  convex.setAuth(convexToken);
  const dataset = await convex.query(api.reference_data.getLatestDataset, {
    name: "export_control_list",
  });
  if (dataset?.storageUrl) return dataset.storageUrl;
  if (dataset?.storagePath && process.env.NEXT_PUBLIC_R2_PUBLIC_URL) {
    return `${process.env.NEXT_PUBLIC_R2_PUBLIC_URL}${dataset.storagePath}`;
  }
  throw new Error("Control list dataset URL not configured");
}

export async function loadControlListWithFallback(url: string): Promise<ControlListSnapshot> {
  try {
    return await loadControlListSnapshot(url);
  } catch {
    const localPath = path.join(process.cwd(), "data", "export-controls", "v2025-12-16.json");
    const raw = await readFile(localPath, "utf8");
    return JSON.parse(raw) as ControlListSnapshot;
  }
}

export async function loadControlListForUser(convexToken: string): Promise<ControlListSnapshot> {
  try {
    const url = await resolveControlListUrl(convexToken);
    return await loadControlListWithFallback(url);
  } catch {
    const localPath = path.join(process.cwd(), "data", "export-controls", "v2025-12-16.json");
    const raw = await readFile(localPath, "utf8");
    return JSON.parse(raw) as ControlListSnapshot;
  }
}
