Write-Host "Dropping Legacy Indexes..."
npx wrangler vectorize delete dcts-rules-index --force
npx wrangler vectorize delete company-embeddings-index --force

Write-Host "Creating HMRC CDS Indexes..."
npx wrangler vectorize create hmrc-cds-errors --dimensions=768 --metric=cosine
npx wrangler vectorize create uk-global-tariff --dimensions=768 --metric=cosine

Write-Host "Migration complete."
