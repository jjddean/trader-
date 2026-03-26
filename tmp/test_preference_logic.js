
const preferenceCountries = new Set(["BD", "PK", "LK", "KE", "GH", "NG", "TZ", "UG", "ZM", "ZW"]);
const hsDutyRateByPrefix = {
  "61": 0.12,
  "62": 0.12,
  "64": 0.08,
  "84": 0.035,
  "85": 0.03,
  "87": 0.1,
  "90": 0.025,
};

function resolveRates(item, historicalRates = {}) {
  const code = String(item?.commodityCode || "");
  const prefix = code.substring(0, 2);
  const historical = historicalRates[prefix];

  const historicalDutyRate =
    historical && historical.customsTotal > 0
      ? historical.dutyTotal / historical.customsTotal
      : null;

  const baseDutyRate = historicalDutyRate ?? hsDutyRateByPrefix[prefix] ?? 0.06;
  const originCountry = String(item?.originCountry || "").toUpperCase();
  const effectiveDutyRate = preferenceCountries.has(originCountry) ? 0 : baseDutyRate;

  return { dutyRate: effectiveDutyRate };
}

function test() {
  console.log("Starting Preference Logic Test...");

  // Test Case 1: Bangladesh (BD) - Should have 0% duty (Preference)
  const item1 = { commodityCode: "6109100010", originCountry: "BD", valueAmount: 1000 };
  const { dutyRate: rate1 } = resolveRates(item1);
  const baselineRate1 = hsDutyRateByPrefix["61"];
  const overpayment1 = (item1.valueAmount * baselineRate1) - (item1.valueAmount * rate1);
  
  console.log(`Test 1 (BD): Rate=${rate1}, Overpayment=${overpayment1}`);
  if (rate1 === 0 && overpayment1 === 120) {
    console.log("✅ Test 1 Passed: Correctly identified preference relief for BD.");
  } else {
    console.log("❌ Test 1 Failed.");
  }

  // Test Case 2: China (CN) - Should have standard duty (No Preference)
  const item2 = { commodityCode: "6109100010", originCountry: "CN", valueAmount: 1000 };
  const { dutyRate: rate2 } = resolveRates(item2);
  const baselineRate2 = hsDutyRateByPrefix["61"];
  const overpayment2 = (item2.valueAmount * baselineRate2) - (item2.valueAmount * rate2);

  console.log(`Test 2 (CN): Rate=${rate2}, Overpayment=${overpayment2}`);
  if (rate2 === 0.12 && overpayment2 === 0) {
    console.log("✅ Test 2 Passed: Correctly applied standard duty for CN.");
  } else {
    console.log("❌ Test 2 Failed.");
  }

  // Test Case 3: Pakistan (PK) - Should have 0% duty (Preference)
  const item3 = { commodityCode: "8471300000", originCountry: "PK", valueAmount: 5000 };
  const { dutyRate: rate3 } = resolveRates(item3);
  const baselineRate3 = hsDutyRateByPrefix["84"];
  const overpayment3 = (item3.valueAmount * baselineRate3) - (item3.valueAmount * rate3);

  console.log(`Test 3 (PK): Rate=${rate3}, Overpayment=${overpayment3}`);
  if (rate3 === 0 && Math.abs(overpayment3 - 175) < 0.001) {
    console.log("✅ Test 3 Passed: Correctly identified preference relief for PK.");
  } else {
    console.log("❌ Test 3 Failed.");
  }
}

test();
