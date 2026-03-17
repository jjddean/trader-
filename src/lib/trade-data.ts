export interface TariffCategory {
    id: string;
    name: string;
    rate: number;
}

export interface TradeData {
    categories: TariffCategory[];
    hs_overrides: Record<string, number>;
}

export async function fetchTradeData(): Promise<TradeData> {
    const response = await fetch('/uk-tariff-rates.json');
    if (!response.ok) throw new Error('Failed to fetch tariff data');
    return response.json();
}

export async function fetchHSCode(code: string): Promise<{ code: string; desc: string } | null> {
    const response = await fetch('/hs-codes.json');
    if (!response.ok) return null;
    const codes = await response.json();
    return codes.find((item: any) => item.code.startsWith(code)) || null;
}

export function calculateUKImportCosts(params: {
    goodsValue: number;
    freight: number;
    insurance: number;
    dutyRate: number;
    isVatRegistered: boolean;
    hasPreference: boolean;
}) {
    const { goodsValue, freight, insurance, dutyRate, hasPreference } = params;

    // Customs Value = Goods + Freight + Insurance (CIF approx)
    const customsValue = goodsValue + freight + insurance;

    // Duty = Customs Value * Rate (0 if preference)
    const effectiveDutyRate = hasPreference ? 0 : dutyRate;
    const dutyAmount = customsValue * effectiveDutyRate;

    // VAT = (Customs Value + Duty) * 0.20
    const vatBase = customsValue + dutyAmount;
    const vatAmount = vatBase * 0.20;

    const totalTaxes = dutyAmount + vatAmount;

    return {
        customsValue,
        dutyRate: effectiveDutyRate,
        dutyAmount,
        vatAmount,
        totalTaxes
    };
}
