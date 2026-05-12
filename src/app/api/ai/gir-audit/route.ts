import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

interface GIRResponse {
  correctHsCode?: string;
  confidence?: number;
  girsApplied?: Array<{ rule: string; analysis: string; conclusion?: string }>;
  complianceVerdict?: string;
  verdictReasoning?: string;
  officerExplanation?: string;
  error?: string;
}

function validateGIRResponse(data: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (data.error) {
    errors.push(`API returned error: ${data.error}`);
    return { valid: false, errors };
  }

  if (!data.correctHsCode || typeof data.correctHsCode !== "string") {
    errors.push("Missing or invalid correctHsCode");
  }

  if (typeof data.confidence !== "number" || data.confidence < 0 || data.confidence > 1) {
    errors.push("Missing or invalid confidence (must be 0-1)");
  }

  if (!Array.isArray(data.girsApplied)) {
    errors.push("Missing or invalid girsApplied (must be array)");
  } else if (data.girsApplied.length === 0) {
    errors.push("girsApplied is empty");
  }

  if (!data.complianceVerdict || !["COMPLIANT", "NON_COMPLIANT", "AMBIGUOUS"].includes(data.complianceVerdict)) {
    errors.push("Missing or invalid complianceVerdict");
  }

  if (!data.verdictReasoning) {
    errors.push("Missing verdictReasoning");
  }

  if (!data.officerExplanation) {
    errors.push("Missing officerExplanation");
  }

  return { valid: errors.length === 0, errors };
}

function buildFallbackResponse(declaredHsCode: string, reason: string): GIRResponse {
  return {
    correctHsCode: declaredHsCode,
    confidence: 0.0,
    girsApplied: [
      {
        rule: "FALLBACK",
        analysis: reason,
        conclusion: "Unable to classify via AI; returned declared code as fallback",
      },
    ],
    complianceVerdict: "AMBIGUOUS",
    verdictReasoning: `Classification service unavailable: ${reason}. Defaulting to declared code pending manual review.`,
    officerExplanation: `This classification could not be verified by the automated GIR engine. An HMRC officer should manually verify the HS code using General Interpretative Rules 1-6.`,
  };
}

export async function POST(request: Request) {
  try {
    // Authenticate request
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { textractOutput, declaredHsCode } = await request.json();

    if (!textractOutput || !declaredHsCode) {
      return NextResponse.json(
        { error: "Missing textractOutput or declaredHsCode" },
        { status: 400 }
      );
    }

    const cloudagentUrl = process.env.CLOUDAGENT_GIR_ENDPOINT || "https://cloudagent.workers.dev/classify-gir";

    let response: Response;
    try {
      response = await fetch(cloudagentUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          textractOutput,
          declaredHsCode,
        }),
        signal: AbortSignal.timeout(10000), // 10s timeout
      });
    } catch (fetchError: any) {
      const reason = fetchError.name === "AbortError" ? "Request timeout" : fetchError.message;
      console.error(`Cloudagent fetch error: ${reason}`);
      return NextResponse.json(buildFallbackResponse(declaredHsCode, reason));
    }

    if (!response.ok) {
      const statusText = response.statusText || `HTTP ${response.status}`;
      const errBody = await response.text().catch(() => "(no response body)");
      console.error(`Cloudagent API error: ${response.status} ${statusText}`, { body: errBody });
      return NextResponse.json(
        buildFallbackResponse(declaredHsCode, `External service returned ${response.status}`)
      );
    }

    let data: any;
    try {
      data = await response.json();
    } catch (parseError) {
      console.error("Failed to parse Cloudagent JSON response", { error: parseError });
      return NextResponse.json(
        buildFallbackResponse(declaredHsCode, "Invalid response format from classification service")
      );
    }

    // Validate response schema
    const validation = validateGIRResponse(data);
    if (!validation.valid) {
      console.error("GIR response validation failed", { errors: validation.errors, data });
      return NextResponse.json(
        buildFallbackResponse(declaredHsCode, `Schema validation failed: ${validation.errors.join("; ")}`)
      );
    }

    return NextResponse.json(data);

  } catch (error: any) {
    console.error("GIR Audit Error:", error);
    // Try to extract declared code from request for fallback
    try {
      const body = await request.json().catch(() => ({}));
      const declaredHsCode = body.declaredHsCode || "0000000000";
      return NextResponse.json(buildFallbackResponse(declaredHsCode, error.message || "Unexpected error"));
    } catch {
      return NextResponse.json(
        { error: "Failed to process GIR audit" },
        { status: 500 }
      );
    }
  }
}
