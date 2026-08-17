import { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://www.freightcode.co.uk';

  const guides = [
    '/hmrc-cds-complete-guide-uk-importers-2026',
    '/what-is-tre-hmrc-trade-data',
    '/dmsacc-dmsrog-dmscle-hmrc-cds-notifications',
    '/how-to-read-cds-csv-export-tre',
    '/cds-commodity-codes-how-to-find',
  ].map((slug) => ({
    url: `${baseUrl}/guides${slug}`,
    lastModified: new Date(),
    changeFrequency: 'monthly' as const,
    priority: 0.6,
  }));

  const corePages = [
    '',
    '/solutions',
    '/solutions/export-controls',
    '/solutions/financial-control',
    '/docs',
    '/about',
    '/contact',
    '/tools',
    '/hs-code-lookup',
  ].map((slug) => ({
    url: `${baseUrl}${slug}`,
    lastModified: new Date(),
    changeFrequency: slug === '' ? ('weekly' as const) : ('monthly' as const),
    priority: slug === '' ? 1 : 0.9,
  }));

  return [...corePages, ...guides];
}
