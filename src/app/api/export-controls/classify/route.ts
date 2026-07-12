import { readFile } from "node:fs/promises";
import path from "node:path";
import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { NextResponse } from "next/server";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";
import { aiClassifyLimiter } from "@/lib/api-rate-limiter";
import {
  classifyProductAgainstControlList,
  EXPORT_CLASSIFICATION_PROMPT_VERSION,
} from "@/lib/export-controls/classification";
import { loadControlListSnapshot, type ControlListSnapshot } from "@/lib/export-controls/control-list";
import type { ExportProduct, ExportProductSpec } from "@/lib/export-controls/extraction";
import { runPredicates } from "@/lib/export-controls/predicates";
import { retrieveControlListCandidates, specsToProduct } from "@/lib/export-controls/retrieval";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

async function resolveControlListUrl(convexToken: string): Promise<string> {
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

async function loadControlListWithFallback(url: string): Promise<ControlListSnapshot> {
  try {
    return await loadControlListSnapshot(url);
  } catch (error) {
    const localPath = path.join(process.cwd(), "data", "export-controls", "v2025-12-16.json");
    const raw = await readFile(localPath, "utf8");
    return JSON.parse(raw) as ControlListSnapshot;
  }
}

function mapConvexSpecs(
  specs: Array<{
    key: string;
    valueRaw: string;
    valueNum?: number;
    unit?: string;
    sourcePage?: number;
    sourceQuote?: string;
    confidence?: number;
  }>,
): ExportProductSpec[] {
  return specs.map((s) => ({
    key: s.key,
    valueRaw: s.valueRaw,
    valueNum: s.valueNum ?? null,
    unit: s.unit ?? null,
    sourcePage: s.sourcePage ?? null,
    sourceQuote: s.sourceQuote ?? s.valueRaw,
    confidence: s.confidence ?? 0.7,
  }));
}

export async function POST(request: Request) {
  try {
    const { userId, getToken } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }
    if (!aiClassifyLimiter.tryConsume(userId)) {
      return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
    }

    const convexToken = await getToken({ template: "convex" });
    if (!convexToken) {
      return NextResponse.json({ error: "Missing Convex auth token" }, { status: 401 });
    }
    convex.setAuth(convexToken);

    const body = await request.json();
    const productId = body.productId as Id<"export_products"> | undefined;
    const persist = body.persist !== false;
    const inlineProduct = body.product as
      | {
          name: string;
          techDescription?: string;
          manufacturer?: string;
          modelNo?: string;
          specs?: Array<Partial<ExportProductSpec>>;
        }
      | undefined;

    let product: ExportProduct;
    let resolvedProductId: Id<"export_products"> | undefined = productId;

    if (productId) {
      const loaded = await convex.query(api.export_controls.getProductForClassification, { productId });
      if (!loaded) {
        return NextResponse.json({ error: "Product not found" }, { status: 404 });
      }
      product = {
        lineItemRef: null,
        productName: loaded.name,
        manufacturer: loaded.manufacturer ?? null,
        modelNo: loaded.modelNo ?? null,
        partNo: loaded.partNo ?? null,
        quantity: loaded.quantity ?? null,
        unitValueGbp: loaded.valueGbp ?? null,
        technicalDescription: loaded.techDescription ?? loaded.name,
        specs: mapConvexSpecs(loaded.specs),
      };
    } else if (inlineProduct?.name) {
      product = specsToProduct(inlineProduct);
    } else {
      return NextResponse.json({ error: "productId or product.name required" }, { status: 400 });
    }

    const controlListUrl = await resolveControlListUrl(convexToken);
    const snapshot = await loadControlListWithFallback(controlListUrl);
    const retrievalHits = retrieveControlListCandidates(snapshot, product);
    const predicateHits = runPredicates(
      product,
      retrievalHits.slice(0, 8).map((h) => h.entryCode),
    );

    const classification = await classifyProductAgainstControlList({
      product,
      retrievalHits,
      predicateHits,
      controlListVersion: snapshot.version,
      missingFields: product.specs.length === 0 ? ["technical_specs"] : [],
    });

    let runId: string | undefined;
    if (persist && resolvedProductId) {
      runId = await convex.mutation(api.export_controls.recordClassificationRun, {
        productId: resolvedProductId,
        candidates: {
          matches: classification.matches,
          possible_matches: classification.possible_matches,
          insufficient_evidence: classification.insufficient_evidence,
          predicateHits: classification.predicateHits,
          retrievalHits: classification.retrievalHits.map((h) => ({
            entryCode: h.entryCode,
            score: h.score,
            clausePath: h.clausePath,
          })),
        },
        confidence: classification.confidence,
        requiresReview: classification.requiresReview,
        controlListVersion: classification.controlListVersion,
        promptVersion: EXPORT_CLASSIFICATION_PROMPT_VERSION,
        modelVersion: classification.modelVersion,
      });
    }

    const assessmentStatus =
      classification.matches.length > 0 ||
      classification.predicateHits.some((h) => h.outcome === "threshold_met")
        ? "flagged"
        : classification.possible_matches.length > 0
          ? "review_required"
          : "review_required";

    if (persist && resolvedProductId) {
      const loaded = await convex.query(api.export_controls.getProductForClassification, {
        productId: resolvedProductId,
      });
      if (loaded?.assessmentId) {
        await convex.mutation(api.export_controls.updateAssessment, {
          assessmentId: loaded.assessmentId,
          status: assessmentStatus,
          controlListVersion: snapshot.version,
          promptVersion: EXPORT_CLASSIFICATION_PROMPT_VERSION,
        });
      }
    }

    return NextResponse.json({
      classification,
      runId,
      promptVersion: EXPORT_CLASSIFICATION_PROMPT_VERSION,
    });
  } catch (error: unknown) {
    console.error("Export controls classify error:", error);
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
