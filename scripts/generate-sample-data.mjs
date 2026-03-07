import fs from "fs";
import path from "path";

const dataDir = path.join(process.cwd(), "data");
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir);
}

// 1. HS Codes (Sample)
const hsCodes = [
    { hs_code: "610910", description: "T-shirts, singlets and other vests, of cotton, knitted or crocheted", chapter: "61", section: "XI" },
    { hs_code: "640319", description: "Footwear with outer soles of rubber, plastics, leather or composition leather and uppers of leather", chapter: "64", section: "XII" },
    { hs_code: "851713", description: "Smartphones", chapter: "85", section: "XVI" },
    { hs_code: "090121", description: "Coffee, roasted: Not decaffeinated", chapter: "09", section: "II" },
    { hs_code: "220410", description: "Sparkling wine of fresh grapes", chapter: "22", section: "IV" }
];

// 2. DCTS Countries
const dctsCountries = [
    { name: "India", tier: "Standard", region: "South Asia" },
    { name: "Indonesia", tier: "Standard", region: "South East Asia" },
    { name: "Vietnam", tier: "Comprehensive", region: "South East Asia" },
    { name: "Ethiopia", tier: "Comprehensive", region: "Africa" },
    { name: "Nigeria", tier: "Standard", region: "Africa" }
];

// 3. UK Tariffs
const tariffs = [
    { hs_code: "610910", rate: 12, vat: 20, measure: "Import duty 12%" },
    { hs_code: "640319", rate: 8, vat: 20, measure: "Import duty 8%" },
    { hs_code: "851713", rate: 0, vat: 20, measure: "Zero rated" },
    { hs_code: "090121", rate: 0, vat: 20, measure: "Zero rated" },
    { hs_code: "220410", rate: 32, vat: 20, measure: "Excise duty applicable" }
];

// 4. Currency Rates
const currency = {
    base: "GBP",
    date: new Date().toISOString().split('T')[0],
    rates: {
        USD: 1.25,
        EUR: 1.18,
        CNY: 8.95,
        INR: 104.2,
        VND: 30500
    }
};

// 5. Companies (Sample for Discovery)
const companies = [
    { id: "c1", name: "Global Textiles Ltd", country: "India", category: "Textiles", hscode: "610910" },
    { id: "c2", name: "Loom & Thread Co", country: "Vietnam", category: "Apparel", hscode: "610910" },
    { id: "c3", name: "Summit Footwear", country: "Indonesia", category: "Footwear", hscode: "640319" },
    { id: "c4", name: "Nile Cotton Corp", country: "Ethiopia", category: "Raw Materials", hscode: "520100" },
    { id: "c5", name: "TechParts Nigeria", country: "Nigeria", category: "Electronics", hscode: "851713" }
];

fs.writeFileSync(path.join(dataDir, "latest.json"), JSON.stringify(hsCodes, null, 2));
fs.writeFileSync(path.join(dataDir, "countries.json"), JSON.stringify(dctsCountries, null, 2));
fs.writeFileSync(path.join(dataDir, "uk_tariffs.json"), JSON.stringify(tariffs, null, 2));
fs.writeFileSync(path.join(dataDir, "currency_latest.json"), JSON.stringify(currency, null, 2));
fs.writeFileSync(path.join(dataDir, "companies.json"), JSON.stringify(companies, null, 2));

console.log("✅ All sample data files generated in /data folder:");
console.log("- data/latest.json (HS Codes)");
console.log("- data/countries.json (DCTS Countries)");
console.log("- data/uk_tariffs.json (UK Tariffs)");
console.log("- data/currency_latest.json (Currency Rates)");
console.log("- data/companies.json (Companies Discovery)");
