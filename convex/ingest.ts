import { v } from "convex/values";
import { internalMutation } from "./_generated/server";

export const processEmailAttachment = internalMutation({
  args: {
    userId: v.string(),
    attachmentName: v.string(),
    base64Content: v.string(),
  },
  handler: async (ctx, args) => {
    // Decode base64
    const binary = atob(args.base64Content);
    // Simple CSV parsing for PoC
    const lines = binary.split(/\r?\n/);
    if (lines.length < 2) return;
    
    // Assume HMRC Import Item Report format
    // Map headers flexibly to handle variations like "Entry Identifier" vs "Entry No"
    const headers = lines[0].split(",").map(h => h.trim().toLowerCase().replace(/"/g, ''));
    
    for (let i = 1; i < lines.length; i++) {
        // Simple comma split (a production parser would handle quoted commas better)
        const row = lines[i].split(",").map(c => c.trim().replace(/"/g, ''));
        if (row.length < 2 || row.join("").trim() === "") continue; // skip short/empty rows
      
        const record: any = {};
        headers.forEach((header, idx) => {
          record[header] = row[idx];
        });

      let dutyAmount = 0;
      if (record["duty paid"]) dutyAmount = parseFloat(record["duty paid"]);
      else if (record["tax amount"]) dutyAmount = parseFloat(record["tax amount"]);
      else if (record["tax linetotal amount"]) dutyAmount = parseFloat(record["tax linetotal amount"]);

      let customsValue = 0;
      if (record["customs value"]) customsValue = parseFloat(record["customs value"]);
      else if (record["item customs value"]) customsValue = parseFloat(record["item customs value"]);

      await ctx.db.insert("historical_declarations", {
        userId: args.userId,
        entryIdentifierMrn: record["entry number"] || record["entry identifier"] || `csv_import_${Date.now()}_${i}`,
        declarantEori: record["declarant eori"] || record["agent eori"],
        commodityCode: record["commodity code"],
        countryOfOriginCode: record["country of origin"] || record["origin"],
        preferenceCode: record["preference code"] || record["preference"],
        itemCustomsValue: isNaN(customsValue) ? undefined : customsValue,
        taxLineTotalAmount: isNaN(dutyAmount) ? undefined : dutyAmount,
        methodOfPaymentCode: record["mop"] || record["method of payment code"],
        taxType: record["tax type"] || record["tax type code"],
        createdAt: Date.now()
      });
    }
  }
});
