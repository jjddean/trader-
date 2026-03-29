import 'dotenv/config';

const MANAGEMENT_KEY = process.env.TYPESENSE_CLOUD_MANAGEMENT_API_KEY;

if (!MANAGEMENT_KEY) {
  console.error("TYPESENSE_CLOUD_MANAGEMENT_API_KEY is missing.");
  process.exit(1);
}

async function provision() {
  console.log("🚀 Provisioning new Typesense Cloud cluster (1 node)...");
  
  const response = await fetch("https://api.typesense.cloud/clusters", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${MANAGEMENT_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      name: "tradedna-search-v1",
      num_nodes: 1,
      node_type: "hobby-small",
      region: "eu-west-1"
    })
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(`Provision failed: ${JSON.stringify(data)}`);
  }

  const clusterId = data.id;
  console.log(`✅ Cluster created! ID: ${clusterId}`);
  console.log("⏳ Waiting for cluster to become 'ready'...");

  // Polling for readiness
  let isReady = false;
  while (!isReady) {
    const statusRes = await fetch(`https://api.typesense.cloud/clusters/${clusterId}`, {
      headers: { "Authorization": `Bearer ${MANAGEMENT_KEY}` }
    });
    const statusData = await statusRes.json();
    
    if (statusData.state === "ready") {
      isReady = true;
      console.log(`✨ Cluster is READY! Host: ${statusData.nodes[0].hostname}`);
      console.log(`🔗 Nodes: ${statusData.connection_url}`);
      // In a real scenario, you'd update your .env or Convex env here.
    } else {
      process.stdout.write(".");
      await new Promise(r => setTimeout(r, 5000));
    }
  }
}

provision().catch(console.error);
