import { HelpCircle, BookOpen, FileText, Zap, Bot } from "lucide-react";

export default function UserGuidePage() {
  const sections = [
    {
      title: "Getting Started",
      icon: <Zap className="h-5 w-5 text-[#787774]" />,
      content: "Welcome to FreightCode. To submit declarations to HMRC, you must first connect your Government Gateway account. Go to Settings > Security and click 'Connect HMRC'. Once authorised, you can begin processing declarations.",
    },
    {
      title: "Creating Declarations",
      icon: <FileText className="h-5 w-5 text-[#787774]" />,
      content: "Navigate to the Declarations page and click 'New Declaration'. You can upload a commercial invoice or packing list, and our AI will automatically extract the goods items, HS codes, and values. Review the data, provide any missing CPC codes, and click 'Submit to HMRC'.",
    },
    {
      title: "Understanding HMRC Notifications",
      icon: <HelpCircle className="h-5 w-5 text-[#787774]" />,
      content: "After submitting, HMRC will send status updates. A DMSACC means the declaration is accepted and assigned an MRN. A DMSREJ means it was rejected; check the error codes in the notification. A DMSCLE means your goods are cleared.",
    },
    {
      title: "AI Assistant",
      icon: <Bot className="h-5 w-5 text-[#787774]" />,
      content: "The Compliance Assistant can help you classify goods, understand complex HMRC errors, and explain customs procedures. Just type your question into the chat on the Assistant page.",
    },
    {
      title: "Looking up HS Codes",
      icon: <BookOpen className="h-5 w-5 text-[#787774]" />,
      content: "Use the HS Code Lookup tool in the sidebar to search the UK Global Tariff. You can type keywords like 'cotton t-shirt' or enter a partial 10-digit commodity code to see the full hierarchy and duty rates.",
    },
  ];

  return (
    <div className="mx-auto flex h-full max-w-[800px] flex-col px-8 py-12">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-[#37352f] mb-2">User Guide</h1>
        <p className="text-xs text-[#787774]">
          Everything you need to know about using FreightCode for customs declarations.
        </p>
      </div>

      <div className="flex flex-col gap-4">
        {sections.map((section, idx) => (
          <div key={idx} className="rounded-[4px] border border-[#e9e9e7] bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-3">
              {section.icon}
              <h2 className="text-base font-semibold text-[#37352f]">{section.title}</h2>
            </div>
            <p className="text-xs text-[#37352f] leading-relaxed">
              {section.content}
            </p>
          </div>
        ))}
      </div>
      
      <div className="mt-12 text-center rounded-[4px] border border-[#e9e9e7] bg-gray-50 p-6">
        <h3 className="text-sm font-semibold text-[#37352f] mb-2">Still need help?</h3>
        <p className="text-xs text-[#787774] mb-4">
          If you run into an HMRC error you don't understand, try asking the Compliance Assistant first.
        </p>
      </div>
    </div>
  );
}
