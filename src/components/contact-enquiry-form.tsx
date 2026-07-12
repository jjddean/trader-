"use client";

interface ContactEnquiryFormProps {
  idPrefix?: string;
}

export function ContactEnquiryForm({ idPrefix = "" }: ContactEnquiryFormProps) {
  const fieldId = (name: string) => `${idPrefix}${name}`;

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        alert("Inquiry successfully recorded. A representative will be in touch shortly.");
      }}
    >
      <div>
        <label htmlFor={fieldId("name")} className="mb-2 block text-[13px] font-semibold text-slate-200">
          Full Name
        </label>
        <input
          type="text"
          id={fieldId("name")}
          name="name"
          className="w-full rounded-md border border-slate-600 bg-slate-800 px-4 py-2.5 text-[15px] text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="e.g. Jane Doe"
          required
        />
      </div>
      <div>
        <label htmlFor={fieldId("email")} className="mb-2 block text-[13px] font-semibold text-slate-200">
          Work Email
        </label>
        <input
          type="email"
          id={fieldId("email")}
          name="email"
          className="w-full rounded-md border border-slate-600 bg-slate-800 px-4 py-2.5 text-[15px] text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="jane@company.com"
          required
        />
      </div>
      <div>
        <label htmlFor={fieldId("message")} className="mb-2 block text-[13px] font-semibold text-slate-200">
          Enquiry Details
        </label>
        <textarea
          id={fieldId("message")}
          name="message"
          rows={4}
          className="w-full rounded-md border border-slate-600 bg-slate-800 px-4 py-2.5 text-[15px] text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="How can we help?"
          required
        />
      </div>
      <button
        type="submit"
        className="inline-flex items-center rounded-md bg-white px-4 py-2 text-[13px] font-semibold text-slate-900 transition-colors hover:bg-slate-100"
      >
        Send Message
      </button>
    </form>
  );
}
