import fs from 'fs';

const BASE_URL = "https://cloudflare.com";
const CLOUDFLARE_API_TOKEN = "8275bd1947f0b03a3e0efa0cc8cd908e670681eff56bc88fb2f4452c0dbb11be"; 

const hmrcErrorBook = [
  {
    code: "CDS12005",
    description: "Declaration contains an invalid combination of Procedure Code (DE 1/10) and Previous Document Type (DE 2/1). Often caused by incorrect valuation syntax.",
    fixAction: "Navigate to your Goods Items tab. Look at your Additional Documents formatting. Ensure your invoice identifier strings do not contain trailing delimiters, double colons, or invalid tracking suffixes."
  },
  {
    code: "CDS12015",
    description: "Goods Location Code Mismatch. The declared warehouse, airport, or maritime port identification code is structurally invalid for the specified border customs office entry configuration.",
    fixAction: "Go to Step 1 (Border Entry Details) and cross-reference your Location of Goods alphanumeric string against the valid codes listed in HMRC CDS Appendix 16."
  },
  {
    code: "CDS14022",
    description: "Missing Mandatory Document Certificate Reference. The chosen commodity tariff code legally mandates a specific preference certificate, veterinary check, or import license to clear free circulation.",
    fixAction: "Upload the required document asset (e.g., EUR1 certificate, organic product waiver) and explicitly map its corresponding status identifier inside Data Element 2/3."
  },
  {
    code: "CDS51001",
    description: "EORI Financial Account Authorization Failure. The Deferment Account (DDA) or Cash Account number declared in Data Element 4/8 is not authorized to be used by this submitting EORI.",
    fixAction: "Verify your payment account sequence numbers in Step 4. If using a third-party or foreign partner DDA, ensure they have granted active standing authorization to your EORI within their HMRC online gateway portal."
  },
  {
    code: "CDS11003",
    description: "Malformed Gross Mass Measure. The total mass weight string format or metric value configuration violates cross-field consistency limits for this commodity classification group.",
    fixAction: "Check your weight parameters in Step 2. Gross Mass cannot be lower than Net Mass, and values must be precisely rounded up to 3 decimal places without alphabetic characters."
  }
];

async function seedErrors() {
  console.log("📡 Initializing HMRC Error Book vector construction engine...");

  for (const error of hmrcErrorBook) {
    const textToEmbed = `Error Code: ${error.code} | Definition: ${error.description} | Remediate: ${error.fixAction}`;
    console.log(`⏳ Generating 1024-dimension vector for: ${error.code}...`);

    const embeddingResponse = await fetch(`${BASE_URL}/ai/run/@hf/baai/bge-large-en-v1.5`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${CLOUDFLARE_API_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ text: [textToEmbed] })
    });

    const embeddingData = await embeddingResponse.json();
    if (!embeddingResponse.ok || !embeddingData.result?.data) {
      console.error(`❌ Failed embedding generation for ${error.code}:`, embeddingData);
      continue;
    }

    const vectorValues = embeddingData.result.data[0];

    console.log(`📥 Upserting record vectors directly into hmrc-cds-errors index...`);
    const insertResponse = await fetch(`${BASE_URL}/ai/vectorize/indexes/hmrc-cds-errors/insert`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${CLOUDFLARE_API_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        vectors: [{
          id: error.code,
          values: vectorValues,
          metadata: {
            code: error.code,
            description: error.description,
            fixAction: error.fixAction
          }
        }]
      })
    });

    const insertResult = await insertResponse.json();
    if (insertResult.success) {
      console.log(`✅ Successfully stored error reference token: ${error.code}`);
    } else {
      console.error(`❌ Failed vector storage for ${error.code}:`, insertResult);
    }
  }

  console.log("\n🏁 Seeding complete! Go refresh your Cloudflare browser dashboard window.");
}

seedErrors().catch(console.error);
