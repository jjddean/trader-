import { Metadata } from "next";
import { ContactEnquiryForm } from "@/components/contact-enquiry-form";

export const metadata: Metadata = {
  title: "Contact | freightcode®",
  description: "Get in touch for custom solutions, partnership opportunities, or support.",
  alternates: {
    canonical: "/contact",
  },
};

export default function ContactPage() {
  return (
    <article className="py-4">
      <div className="grid grid-cols-1 items-start gap-10 lg:grid-cols-[1fr_400px] lg:gap-12">
        <div>
          <p className="mb-3 text-[13px] font-semibold uppercase tracking-widest text-blue-600">Support</p>
          <h1 className="mb-4 text-3xl font-bold leading-snug tracking-tight text-slate-900">Contact Us</h1>
          <p className="mb-8 text-[16px] leading-relaxed text-slate-600">
            Get in touch for custom solutions, partnership opportunities, or support. We&apos;re here to help your business succeed.
          </p>

          <h2 className="mb-4 text-[20px] font-semibold tracking-tight text-slate-900">Support &amp; Partnerships</h2>
          <p className="text-[15px] leading-relaxed text-slate-700">
            Email{" "}
            <a href="mailto:info@freightcode.co.uk" className="font-semibold text-blue-600 hover:text-blue-700 hover:underline">
              info@freightcode.co.uk
            </a>{" "}
            for product support, partnership enquiries, or help getting started with HMRC CDS workflows.
          </p>
        </div>

        <div className="rounded-2xl bg-[#0f172a] p-8 text-white">
          <h2 className="mb-3 text-[18px] font-semibold">Send an enquiry</h2>
          <p className="mb-6 text-[14px] leading-relaxed text-slate-300">
            Leave your details and we&apos;ll respond as soon as possible.
          </p>
          <ContactEnquiryForm />
        </div>
      </div>
    </article>
  );
}
