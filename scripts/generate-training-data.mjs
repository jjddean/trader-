import fs from 'fs';
import readline from 'readline';

/**
 * HS Code LoRA Training Data Generator (v3 - Goods Items JSONL)
 * 
 * This version uses the goods_items/documents.jsonl from the Convex export.
 */

const INPUT_FILE = './goods_items/documents.jsonl';
const OUTPUT_FILE = './train.csv';

async function generate() {
    if (!fs.existsSync(INPUT_FILE)) {
        console.error(`❌ Error: ${INPUT_FILE} not found.`);
        return;
    }

    const fileStream = fs.createReadStream(INPUT_FILE);
    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
    });

    const csvRows = ['text'];
    let count = 0;

    for await (const line of rl) {
        if (!line.trim()) continue;
        try {
            const record = JSON.parse(line);
            const description = record.description || "";
            let hsCode = record.commodityCode || "";

            // Basic cleaning: remove dots from HS code and ensure it is long enough
            hsCode = hsCode.replace(/\./g, '').trim();

            if (description && hsCode && hsCode.length >= 10) {
                // Mistral Instruction Format
                const cleanDesc = description.replace(/"/g, '""').trim();
                const text = `"[INST] Classify this product using GIRs 1-6: ${cleanDesc} [/INST] ${hsCode}"`;
                csvRows.push(text);
                count++;
            }
        } catch (e) {
            console.error("Error parsing line:", line, e);
        }
    }

    fs.writeFileSync(OUTPUT_FILE, csvRows.join('\n'));
    console.log(`✅ Success! Created ${OUTPUT_FILE} with ${count} training examples.`);
    console.log(`👉 Now you can upload this file to the AutoTrain Colab notebook.`);
}

generate();
