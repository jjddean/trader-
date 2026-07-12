import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import type { ControlListSnapshot } from "../../src/lib/export-controls/control-list";
import { buildCordin560NeighbourAssessment, deriveOverallStatus, extract6A203B1 } from "../../src/lib/export-controls/neighbour-entry-assessment";
const snapshot=JSON.parse(readFileSync("data/export-controls/v2025-12-16.json","utf8")) as ControlListSnapshot;
const entry=snapshot.entries.find((item)=>item.entryCode==="6A203"&&item.fullText.includes("225 000"));assert.ok(entry);
describe("Cordin 560 neighbour assessment",()=>{
  it("extracts 6A203.b.1 from the official snapshot",()=>{const requirement=extract6A203B1(entry);assert.equal(requirement.threshold,225_000);assert.equal(requirement.operator,">");});
  it("stores 6A203.b.1 separately and meets all mandatory conditions",()=>{const assessment=buildCordin560NeighbourAssessment(entry);assert.equal(assessment.controlEntry,"6A203.b.1");assert.equal(assessment.testedEntryResult,"MET");assert.ok(assessment.conditionResults.every((result)=>result.comparisonResult==="MET"));});
  it("derives POSSIBLY_LISTED from the met neighbour without overwriting the failed entry",()=>{const failed={...buildCordin560NeighbourAssessment(entry),controlEntry:"6A003.a.4",testedEntryResult:"NOT_MET" as const};const neighbour=buildCordin560NeighbourAssessment(entry);const overall=deriveOverallStatus([failed,neighbour],[]);assert.deepEqual(overall,{candidateStatus:"POSSIBLY_LISTED",candidateControlEntry:"6A203.b.1"});assert.equal(failed.testedEntryResult,"NOT_MET");});
  it("cannot become POSSIBLY_NOT_LISTED while a neighbour remains unresolved",()=>{const failed={...buildCordin560NeighbourAssessment(entry),controlEntry:"6A003.a.4",testedEntryResult:"NOT_MET" as const};assert.equal(deriveOverallStatus([failed],["6A203.b.1"]).candidateStatus,"CHECK_NEIGHBOUR_ENTRY");});
  it("uses only the existing Cordin manufacturer quotations",()=>{const allowed=new Set(["The Cordin Model 560 high-speed rotating mirror framing camera","Maximum Framing Rate 4 million fps (78 frames)","Model 560 HIGH SPEED ROTATING MIRROR CMOS CAMERA","The system uses a rotating mirror optical system"]);for(const result of buildCordin560NeighbourAssessment(entry).conditionResults)for(const quote of result.evidenceQuotes)assert.ok(allowed.has(quote));});
});
