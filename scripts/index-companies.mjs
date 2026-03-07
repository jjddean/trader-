import { Client as TypesenseClient } from "typesense";
import fs from "fs";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const client = new TypesenseClient({
    nodes: [{
        host: process.env.TYPESENSE_NODES?.replace("https://", "").split(":")[0] || "",
        port: 443,
        protocol: "https"
    }],
    apiKey: process.env.TYPESENSE_API_KEY || "",
    connectionTimeoutSeconds: 2
});

const companySchema = {
    name: "companies",
    fields: [
        { name: "id", type: "string" },
        { name: "name", type: "string" },
        { name: "country", type: "string", facet: true },
        { name: "category", type: "string", facet: true },
        { name: "hscode", type: "string", facet: true },
    ],
};

async function setupIndex() {
    try {
        console.log("Checking if collection exists...");
        await client.collections("companies").retrieve();
        console.log("Collection exists. Deleting...");
        await client.collections("companies").delete();
    } catch (err) {
        // Collection doesn't exist
    }

    console.log("Creating collection...");
    await client.collections().create(companySchema);
    console.log("Collection 'companies' created successfully.");
}

async function indexCompanies() {
    console.log("Reading data/companies.json...");
    const companies = JSON.parse(fs.readFileSync("./data/companies.json", "utf8"));

    console.log(`Indexing ${companies.length} companies...`);
    try {
        const results = await client.collections("companies").documents().import(companies, { action: "create" });
        console.log("Indexing complete.");
        console.log(results);
    } catch (err) {
        console.error("Error indexing documents:", err);
    }
}

async function main() {
    await setupIndex();
    await indexCompanies();
}

main();
