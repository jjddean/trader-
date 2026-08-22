import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { amendEns, correlationIdOf, submitEns } from "../../src/lib/ens/ens-client";
import {
  ENS_ACCEPT_HEADER,
  ENS_PATHS,
  ENS_SCOPE,
  ensSimulationHeaders,
} from "../../src/lib/ens/ens-config";
import {
  groupErrorsByBand,
  isSchemaOnlyFailure,
  parseSubmissionResponse,
} from "../../src/lib/ens/ens-response-parser";
import type { EnsDeclaration } from "../../src/lib/ens/types";

/**
 * Spec: docs/hmrc/ens/IMPLEMENTATION_SPEC.md §3–4
 * Sandbox: docs/hmrc/ens/testing/sandbox.md
 *
 * No network. `fetchImpl` is injected so these assert what FreightCode sends
 * and how it reads the reply, without touching HMRC.
 */

const FIXED = new Date(Date.UTC(2026, 8, 15, 9, 5));

const declaration: EnsDeclaration = {
  localReferenceNumber: "FCENS0001",
  transportModeAtBorder: "4",
  customsOfficeOfFirstEntry: "GB000060",
  expectedArrivalDateTime: "202609161200",
  personLodgingSummaryDeclaration: { eori: "GB553202734852" },
  carrier: { eori: "GB111222333444" },
  goodsItems: [
    {
      itemNumber: 1,
      goodsDescription: "Machine parts",
      grossMass: 120,
      packages: [{ kindOfPackages: "BX", numberOfPackages: 2, marksAndNumbers: "ACME-1" }],
    },
  ],
  totalNumberOfPackages: 2,
};

const SUCCESS_XML = `<?xml version="1.0" encoding="UTF-8"?>
<ns:SuccessResponse xmlns:ns="http://www.hmrc.gov.uk/successresponse/2" xmlns="http://www.govtalk.gov.uk/enforcement/ICS/responsedata/7">
  <ns:ResponseData><CorrelationId>0JRF7UncK0t004</CorrelationId></ns:ResponseData>
</ns:SuccessResponse>`;

const ERROR_XML = `<?xml version="1.0" encoding="UTF-8"?>
<ErrorResponse xmlns="http://www.govtalk.gov.uk/CM/errorresponse" SchemaVersion="2.0">
  <Error>
    <RaisedBy>ICS</RaisedBy>
    <Number>8103</Number>
    <Type>business</Type>
    <Text>Gross mass is required.</Text>
    <Location>/CC315A/GOOITEGDS</Location>
  </Error>
  <Error>
    <RaisedBy>ICS</RaisedBy>
    <Number>4065</Number>
    <Type>schema</Type>
    <Text>Message sender does not match the required pattern.</Text>
    <Location>/CC315A/MesSenMES3</Location>
  </Error>
</ErrorResponse>`;

/** Records the request so assertions can inspect what was actually sent. */
function recordingFetch(status: number, body: string) {
  const calls: { url: string; init: RequestInit }[] = [];
  const impl = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    return new Response(body, { status });
  }) as unknown as typeof fetch;
  return { impl, calls };
}

function opts(over: Partial<Parameters<typeof submitEns>[1]> = {}) {
  return {
    environment: "sandbox" as const,
    accessToken: "test-token",
    messageSender: "GB553202734852/1234567890",
    now: FIXED,
    ...over,
  };
}

describe("ENS config", () => {
  it("uses the single published scope for all three APIs", () => {
    assert.equal(ENS_SCOPE, "write:import-control-system");
  });

  it("uses the one Accept value the OAS declares", () => {
    assert.equal(ENS_ACCEPT_HEADER, "application/vnd.hmrc.1.0+xml");
  });

  it("keeps the trailing slash the OAS declares on collection paths", () => {
    assert.equal(ENS_PATHS.submit, "/customs/imports/declarations/");
    assert.equal(ENS_PATHS.listOutcomes, "/customs/imports/outcomes/");
  });

  it("url-encodes identifiers in paths", () => {
    assert.ok(ENS_PATHS.amend("26GB/08").includes("26GB%2F08"));
    assert.ok(ENS_PATHS.outcome("a b").includes("a%20b"));
  });
});

describe("sandbox simulation headers", () => {
  it("emits nothing in production", () => {
    assert.deepEqual(ensSimulationHeaders("production", { riskingResponse: "accept" }), {});
  });

  it("emits nothing when no simulation is requested", () => {
    assert.deepEqual(ensSimulationHeaders("sandbox"), {});
  });

  it("emits the risking headers", () => {
    const h = ensSimulationHeaders("sandbox", {
      riskingResponse: "reject",
      riskingResponseError: "nonUniqueLRN",
    });
    assert.equal(h.simulateRiskingResponse, "reject");
    assert.equal(h.riskingResponseError, "nonUniqueLRN");
  });

  it("caps latency at 30 seconds, as HMRC states", () => {
    const h = ensSimulationHeaders("sandbox", { riskingResponseLatencyMillis: 90_000 });
    assert.equal(h.simulateRiskingResponseLatencyMillis, "30000");
  });

  it("emits the intervention headers, including false", () => {
    const h = ensSimulationHeaders("sandbox", { interventionResponse: false });
    assert.equal(h.simulateInterventionResponse, "false");
  });
});

describe("submitEns — request shape", () => {
  it("POSTs to the declarations endpoint with the right headers", async () => {
    const { impl, calls } = recordingFetch(200, SUCCESS_XML);
    await submitEns(declaration, opts({ fetchImpl: impl }));
    assert.equal(calls.length, 1);
    assert.ok(calls[0].url.endsWith("/customs/imports/declarations/"));
    assert.ok(calls[0].url.startsWith("https://test-api.service.hmrc.gov.uk"));
    assert.equal(calls[0].init.method, "POST");
    const headers = calls[0].init.headers as Record<string, string>;
    assert.equal(headers.Accept, ENS_ACCEPT_HEADER);
    assert.equal(headers.Authorization, "Bearer test-token");
    assert.ok(headers["Content-Type"].startsWith("application/xml"));
  });

  it("targets the production host when the environment says so", async () => {
    const { impl, calls } = recordingFetch(200, SUCCESS_XML);
    await submitEns(declaration, opts({ fetchImpl: impl, environment: "production" }));
    assert.ok(calls[0].url.startsWith("https://api.service.hmrc.gov.uk"));
  });

  // These headers are absent from the OAS; missing them means no outcome ever.
  it("passes sandbox simulation headers through", async () => {
    const { impl, calls } = recordingFetch(200, SUCCESS_XML);
    await submitEns(
      declaration,
      opts({ fetchImpl: impl, simulation: { riskingResponse: "accept" } }),
    );
    const headers = calls[0].init.headers as Record<string, string>;
    assert.equal(headers.simulateRiskingResponse, "accept");
  });

  it("never sends simulation headers to production", async () => {
    const { impl, calls } = recordingFetch(200, SUCCESS_XML);
    await submitEns(
      declaration,
      opts({ fetchImpl: impl, environment: "production", simulation: { riskingResponse: "accept" } }),
    );
    const headers = calls[0].init.headers as Record<string, string>;
    assert.equal(headers.simulateRiskingResponse, undefined);
  });

  it("sends a CC315A body", async () => {
    const { impl, calls } = recordingFetch(200, SUCCESS_XML);
    await submitEns(declaration, opts({ fetchImpl: impl }));
    assert.ok(String(calls[0].init.body).includes("<ie:CC315A"));
  });
});

describe("submitEns — local validation gate", () => {
  // The point: a submission that fails validation produces no outcome, so the
  // correlation id it would have created is a dangling reference.
  it("does not call HMRC when local rules fail", async () => {
    const { impl, calls } = recordingFetch(200, SUCCESS_XML);
    const result = await submitEns(
      { ...declaration, goodsItems: [{ itemNumber: 1 }] },
      opts({ fetchImpl: impl }),
    );
    assert.equal(calls.length, 0, "nothing should be sent");
    assert.ok((result.localViolations ?? []).length > 0);
    assert.equal(result.requestXml, "");
  });

  it("reports the HMRC error code for a local failure", async () => {
    const { impl } = recordingFetch(200, SUCCESS_XML);
    const result = await submitEns(
      { ...declaration, transportModeAtBorder: "1" },
      opts({ fetchImpl: impl }),
    );
    assert.ok(result.localViolations?.some((v) => v.errorCode === "8107"));
  });

  it("checks the message sender against rule 4065", async () => {
    const { impl, calls } = recordingFetch(200, SUCCESS_XML);
    const result = await submitEns(declaration, opts({ fetchImpl: impl, messageSender: "NOTVALID" }));
    assert.equal(calls.length, 0);
    assert.ok(result.localViolations?.some((v) => v.errorCode === "4065"));
  });
});

describe("submitEns — response handling", () => {
  it("returns the correlation id on success", async () => {
    const { impl } = recordingFetch(200, SUCCESS_XML);
    const result = await submitEns(declaration, opts({ fetchImpl: impl }));
    assert.equal(result.httpStatus, 200);
    assert.equal(correlationIdOf(result), "0JRF7UncK0t004");
  });

  it("parses every error from a 400", async () => {
    const { impl } = recordingFetch(400, ERROR_XML);
    const result = await submitEns(declaration, opts({ fetchImpl: impl }));
    assert.equal(result.httpStatus, 400);
    assert.equal(result.response?.kind, "error");
    const errors = result.response?.kind === "error" ? result.response.errors : [];
    assert.equal(errors.length, 2);
    assert.equal(errors[0].errorCode, "8103");
    assert.equal(errors[0].contextElement, "/CC315A/GOOITEGDS");
    assert.equal(correlationIdOf(result), null);
  });

  it("retains the raw request and response for the audit record", async () => {
    const { impl } = recordingFetch(400, ERROR_XML);
    const result = await submitEns(declaration, opts({ fetchImpl: impl }));
    assert.ok(result.requestXml.includes("<ie:CC315A"));
    assert.ok(result.responseXml?.includes("ErrorResponse"));
  });

  // A 200 whose body cannot be read must not be recorded as accepted.
  it("treats an unparseable 200 as a failure, not a success", async () => {
    const { impl } = recordingFetch(200, "<html>maintenance</html>");
    const result = await submitEns(declaration, opts({ fetchImpl: impl }));
    assert.equal(result.response?.kind, "error");
    assert.equal(correlationIdOf(result), null);
  });

  it("reports a transport failure without inventing a status", async () => {
    const impl = (async () => {
      throw new Error("socket hang up");
    }) as unknown as typeof fetch;
    const result = await submitEns(declaration, opts({ fetchImpl: impl }));
    assert.equal(result.httpStatus, 0);
    assert.match(result.transportError ?? "", /socket hang up/);
    assert.equal(result.response, undefined);
  });
});

describe("amendEns", () => {
  it("PUTs to the MRN path with a CC313A body", async () => {
    const { impl, calls } = recordingFetch(200, SUCCESS_XML);
    const result = await amendEns(
      { ...declaration, movementReferenceNumber: "26GB08I01234567891" },
      "26GB08I01234567891",
      opts({ fetchImpl: impl }),
    );
    assert.equal(calls[0].init.method, "PUT");
    assert.ok(calls[0].url.endsWith("/customs/imports/declarations/26GB08I01234567891"));
    assert.ok(String(calls[0].init.body).includes("<ie:CC313A"));
    assert.equal(correlationIdOf(result), "0JRF7UncK0t004");
  });

  it("refuses a body MRN that disagrees with the path", async () => {
    const { impl } = recordingFetch(200, SUCCESS_XML);
    await assert.rejects(
      amendEns(
        { ...declaration, movementReferenceNumber: "26GB08I01234567891" },
        "26GB08I09999999999",
        opts({ fetchImpl: impl }),
      ),
      /MRN mismatch/,
    );
  });
});

describe("error classification", () => {
  it("recognises a schema-only failure", () => {
    const parsed = parseSubmissionResponse(ERROR_XML);
    const errors = parsed.kind === "error" ? parsed.errors : [];
    assert.equal(isSchemaOnlyFailure(errors), false, "mixed bands are not schema-only");
    assert.equal(isSchemaOnlyFailure(errors.filter((e) => e.errorCode === "4065")), true);
  });

  it("groups errors by band and keeps unknown codes", () => {
    const parsed = parseSubmissionResponse(ERROR_XML);
    const errors = parsed.kind === "error" ? parsed.errors : [];
    const grouped = groupErrorsByBand([...errors, { errorCode: "9999" }]);
    assert.equal(grouped.schema.length, 1);
    assert.equal(grouped.business.length, 1);
    assert.equal(grouped.other.length, 1);
  });
});
