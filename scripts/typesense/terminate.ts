import 'dotenv/config';

const MANAGEMENT_KEY = process.env.TYPESENSE_CLOUD_MANAGEMENT_API_KEY;
const CLUSTER_ID = process.env.TYPESENSE_CLOUD_CLUSTER_ID;

if (!MANAGEMENT_KEY || !CLUSTER_ID) {
  console.error("MANAGEMENT_KEY or CLUSTER_ID is missing.");
  process.exit(1);
}

async function terminate() {
  console.log(`🛑 Terminating cluster with ID: ${CLUSTER_ID}`);
  
  const response = await fetch(`https://api.typesense.cloud/clusters/${CLUSTER_ID}`, {
    method: "DELETE",
    headers: {
      "Authorization": `Bearer ${MANAGEMENT_KEY}`
    }
  });

  if (response.ok) {
    console.log("✅ Termination request accepted.");
  } else {
    throw new Error(`Termination failed: ${await response.text()}`);
  }
}

terminate().catch(console.error);
