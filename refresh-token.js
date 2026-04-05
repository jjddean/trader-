require("dotenv").config({ path: ".env.local" });

const hmrcBase = process.env.HMRC_ENVIRONMENT === "sandbox"
  ? "https://test-api.service.hmrc.gov.uk"
  : "https://api.service.hmrc.gov.uk";

const refreshToken = "bf4fb4bfcd74f1a4a333d883e4a6a51c";

async function refresh() {
  const body = new URLSearchParams({
    client_id: process.env.HMRC_CLIENT_ID,
    client_secret: process.env.HMRC_CLIENT_SECRET,
    grant_type: "refresh_token",
    refresh_token: refreshToken
  });

  console.log("Refreshing token at:", `${hmrcBase}/oauth/token`);
  try {
    const res = await fetch(`${hmrcBase}/oauth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString()
    });
    const data = await res.json();
    console.log("Response:", JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("Refresh failed:", err);
  }
}

refresh();
