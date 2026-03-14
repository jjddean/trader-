
import fs from 'fs';
import { execSync } from 'child_process';

async function seedD1() {
    console.log("--- Seeding Cloudflare D1 (Direct Command Mode) ---");

    // 1. Read companies.json
    const rawData = fs.readFileSync('./cloudagent/data/companies.json', 'utf8');
    const companies = JSON.parse(rawData);

    // 2. Insert in small batches using --command
    console.log(`Inserting ${companies.length} records into D1...`);
    
    for (const c of companies) {
        // Map to correct D1 columns: country_code, hs_codes, category
        const sql = `INSERT OR IGNORE INTO companies (id, name, country_code, category, hs_codes) VALUES ('${c.id}', '${c.name.replace(/'/g, "''")}', '${c.country}', '${c.category}', '${c.hscode}');`;
        
        console.log(`Seeding: ${c.name}...`);
        try {
            execSync(`npx wrangler d1 execute companies-db --remote --command="${sql}"`, { stdio: 'inherit' });
        } catch (e) {
            console.error(`Failed to seed ${c.name}:`, e.message);
        }
    }

    console.log("✅ D1 Seeding Complete!");
}

seedD1();
