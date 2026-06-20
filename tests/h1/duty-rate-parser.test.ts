import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

import {
  calculateDutyAmount,
  estimateItemDutyFromTariff,
  evaluatePreferenceOptions,
  findLowestDutyMeasure,
  parseDutyExpressionBase,
  parseDutyMeasures,
} from "../../convex/lib/duty_rate_parser";
import { buildPreferenceEngineResult } from "../../src/lib/preference-engine";
import type { TariffJsonApi } from "../../convex/lib/tariff_parser";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturePath = join(__dirname, "../../tariff-cache.json");

function loadTariffFixture(): TariffJsonApi {
  const cacheRow = JSON.parse(readFileSync(fixturePath, "utf8"));
  return cacheRow.rawResponse as TariffJsonApi;
}

describe("duty rate parser", () => {
  const doc = loadTariffFixture();
  const fetchedAt = "2026-06-16T00:00:00.000Z";

  it("parses ad valorem and specific duty expression strings", () => {
    assert.deepEqual(parseDutyExpressionBase("6.50 %"), {
      adValoremPercent: 6.5,
      specificAmountGbp: 0,
      specificUnitQuantity: 1,
      specificUnitLabel: "",
    });

    assert.deepEqual(parseDutyExpressionBase("27.00 GBP / 100 kg"), {
      adValoremPercent: 0,
      specificAmountGbp: 27,
      specificUnitQuantity: 100,
      specificUnitLabel: "kg",
    });

    assert.deepEqual(parseDutyExpressionBase("2.00 % + 0.08 GBP / kg"), {
      adValoremPercent: 2,
      specificAmountGbp: 0.08,
      specificUnitQuantity: 1,
      specificUnitLabel: "kg",
    });
  });

  it("extracts MFN and preference duty measures from tariff JSON", () => {
    const measures = parseDutyMeasures(doc, fetchedAt);
    assert.ok(measures.length > 0);

    const mfn = measures.find((m) => m.measureTypeId === "103" && m.geographicalAreaId === "1011");
    assert.ok(mfn);
    assert.equal(mfn!.specificAmountGbp, 27);
    assert.equal(mfn!.specificUnitQuantity, 100);

    const euPref = measures.find((m) => m.measureTypeId === "142" && m.geographicalAreaId === "1013");
    assert.ok(euPref);
    assert.equal(euPref!.adValoremPercent, 0);
    assert.equal(euPref!.preferenceCodeId, "300");
  });

  it("calculates MFN specific duty for third-country origin with net weight", () => {
    const estimate = estimateItemDutyFromTariff(doc, {
      originCountry: "US",
      preferenceCode: "100",
      fetchedAtIso: fetchedAt,
      input: { customsValueGbp: 1000, netWeightKg: 500 },
    });

    assert.ok(estimate);
    assert.equal(estimate!.measureTypeId, "103");
    assert.equal(estimate!.geographicalAreaId, "1011");
    assert.equal(estimate!.dutyAmount, 135);
    assert.equal(estimate!.incompleteInput, false);
    assert.match(estimate!.source, /^trade-tariff:0207129000@/);
  });

  it("applies EU preference zero rate when preference is claimed", () => {
    const estimate = estimateItemDutyFromTariff(doc, {
      originCountry: "DE",
      preferenceCode: "300",
      fetchedAtIso: fetchedAt,
      input: { customsValueGbp: 1000, netWeightKg: 500 },
    });

    assert.ok(estimate);
    assert.equal(estimate!.measureTypeId, "142");
    assert.equal(estimate!.geographicalAreaId, "1013");
    assert.equal(estimate!.dutyAmount, 0);
    assert.equal(estimate!.isPreference, true);
  });

  it("uses MFN rate for EU origin when no preference is claimed", () => {
    const estimate = estimateItemDutyFromTariff(doc, {
      originCountry: "DE",
      preferenceCode: "100",
      fetchedAtIso: fetchedAt,
      input: { customsValueGbp: 1000, netWeightKg: 500 },
    });

    assert.ok(estimate);
    assert.equal(estimate!.measureTypeId, "103");
    assert.equal(estimate!.dutyAmount, 135);
  });

  it("flags incomplete input when specific duty needs weight", () => {
    const measures = parseDutyMeasures(doc, fetchedAt);
    const mfn = measures.find((m) => m.measureTypeId === "103" && m.geographicalAreaId === "1011");
    assert.ok(mfn);

    const { amount, incompleteInput } = calculateDutyAmount(mfn!, { customsValueGbp: 1000 });
    assert.equal(amount, 0);
    assert.equal(incompleteInput, true);
  });

  it("finds lowest applicable duty measure for an origin", () => {
    const lowest = findLowestDutyMeasure(
      doc,
      "DE",
      { customsValueGbp: 1000, netWeightKg: 500 },
      fetchedAt,
    );
    assert.ok(lowest);
    assert.equal(lowest!.measureTypeId, "142");
    assert.equal(lowest!.adValoremPercent, 0);
  });

  it("evaluates preference options with correct MFN vs EU duty amounts", () => {
    const evaluation = evaluatePreferenceOptions(doc, {
      originCountry: "DE",
      fetchedAtIso: fetchedAt,
      input: { customsValueGbp: 1000, netWeightKg: 500 },
    });
    assert.ok(evaluation);
    assert.equal(evaluation!.best.measureTypeId, "142");
    assert.equal(evaluation!.best.dutyAmount, 0);
    assert.ok(evaluation!.mfn);
    assert.equal(evaluation!.mfn!.dutyAmount, 135);

    const ui = buildPreferenceEngineResult(evaluation!);
    assert.match(ui.best.saving, /£135\.00/);
    assert.equal(ui.best.dutyAmount, 0);
  });
});
