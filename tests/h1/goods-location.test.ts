import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { APPENDIX_16C_MARITIME_CODES } from "../../src/lib/generated/appendix-16c-codes";
import { validateGoodsLocationForSubmit } from "../../src/lib/goods-location";

describe("Appendix 16C goods location", () => {
  it("includes Felixstowe and Immingham from generated mirror", () => {
    assert.ok(APPENDIX_16C_MARITIME_CODES.GBAUFXTFXTFXT);
    assert.ok(APPENDIX_16C_MARITIME_CODES.GBAUIMMIMMIMM);
  });

  it("accepts Immingham for submit validation", () => {
    const errors = validateGoodsLocationForSubmit({
      locationId: "GBAUIMMIMMIMM",
      goodsLocationKind: "port",
    });
    assert.deepEqual(errors, []);
  });
});
