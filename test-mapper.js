import { mapToCDS_H1 } from "./src/lib/wco-mapper.js";

const lane = { eori: "GB123456789000" };
const items = [{
  sequenceNumber: 1,
  commodityCode: "6109",
  valueCurrency: "GBP",
  valueAmount: 100
}];

try {
  const payload = mapToCDS_H1(lane, items);
  console.log(JSON.stringify(payload, null, 2));
} catch (e) {
  console.error("MAPPING FAILED:", e);
}
