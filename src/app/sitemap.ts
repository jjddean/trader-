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
    priority: 0.8,
  }));

  const corePages = [
    '',
    '/solutions',
    '/resources',
    '/about',
    '/contact',
    '/tools',
    '/tools/hscode-lookup',
  ].map((slug) => ({
    url: `${baseUrl}${slug}`,
    lastModified: new Date(),
    changeFrequency: slug === '' ? 'weekly' as const : 'monthly' as const,
    priority: slug === '' ? 1 : 0.9,
  }));

  return [...corePages, ...guides];
}
