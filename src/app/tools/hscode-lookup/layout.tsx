import { Metadata } from 'next';

export const metadata: Metadata = {
    title: "HS Code & Commodity Search | FreightCode",
    description: "Search the official HMRC UK Trade Tariff database to find accurate HS (Harmonized System) commodity codes for your import and export declarations.",
};

export default function HSCodeLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return <>{children}</>;
}
