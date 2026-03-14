import fs from "fs";
import path from "path";

const DATA_FILE = path.resolve("data/companies_hmrc.json");

function searchCompanies(query, limit = 5) {
  const data = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  const results = data
    .filter(
      (c) =>
        (c.name && c.name.toLowerCase().includes(query.toLowerCase())) ||
        (c.category && c.category.toLowerCase().includes(query.toLowerCase())) ||
        (c.hscode && c.hscode.startsWith(query)),
    )
    .slice(0, limit);

  console.log(`\nSearch Results for "${query}":`);
  results.forEach((r) => {
    console.log(`- ${r.name} | Cat: ${r.category} | HS: ${r.hscode}`);
  });
}

// Demo searches for DCTS-relevant categories
searchCompanies("61"); // Apparal/Knitted
searchCompanies("Textile");
searchCompanies("Clothing");
searchCompanies("Leather");
