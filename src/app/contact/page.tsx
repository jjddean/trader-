"use client";

import React from "react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { useAuth } from "@clerk/nextjs";
import { Mail, MapPin } from "lucide-react";

export default function ContactPage() {
  const { isSignedIn } = useAuth();
  
  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 flex flex-col">
      <SiteHeader />
      <main className="pt-[140px] pb-24 flex-grow w-full bg-white">
        <article className="max-w-3xl mx-auto px-6">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-slate-900 mb-6 leading-snug">
            Contact Us
          </h1>
          <p className="text-[16px] text-slate-600 leading-relaxed mb-12">
            Get in touch for custom solutions, partnership opportunities, or support. We're here to help your business succeed.
          </p>

          <div className="grid md:grid-cols-2 gap-12 mt-12 bg-white">
            <div className="space-y-10">
              <h2 className="text-[20px] font-semibold tracking-tight text-slate-900 mb-6 border-b border-slate-100 pb-4">Contact Information</h2>
              
              <div className="flex items-start gap-4">
                <div className="mt-1 h-10 w-10 flex items-center justify-center rounded-lg bg-slate-50 text-slate-600 shrink-0 border border-slate-200">
                  <Mail className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-[16px] font-semibold text-slate-900 mb-1">Support & Partnerships</h3>
                  <a href="mailto:info@freightcode.co.uk" className="text-[15px] text-blue-600 font-medium hover:underline">
                    info@freightcode.co.uk
                  </a>
                </div>
              </div>
              
              <div className="flex items-start gap-4">
                <div className="mt-1 h-10 w-10 flex items-center justify-center rounded-lg bg-slate-50 text-slate-600 shrink-0 border border-slate-200">
                  <MapPin className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-[16px] font-semibold text-slate-900 mb-1">Global Headquarters</h3>
                  <p className="text-[15px] text-slate-700 font-medium">London, United Kingdom</p>
                </div>
              </div>
            </div>

            <div className="bg-slate-50 p-6 md:p-8 rounded-2xl border border-slate-200 shadow-sm">
              <h2 className="text-[18px] font-bold text-slate-900 mb-6">Send an Enquiry</h2>
              <form className="space-y-6" onSubmit={(e) => { e.preventDefault(); alert('Inquiry successfully recorded. A representative will be in touch shortly.'); }}>
                <div>
                  <label htmlFor="name" className="block text-[14px] font-semibold text-slate-800 mb-2">Full Name</label>
                  <input type="text" id="name" className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-lg text-[15px] focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="e.g. Jane Doe" required />
                </div>
                <div>
                  <label htmlFor="email" className="block text-[14px] font-semibold text-slate-800 mb-2">Work Email</label>
                  <input type="email" id="email" className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-lg text-[15px] focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="jane@company.com" required />
                </div>
                <div>
                  <label htmlFor="message" className="block text-[14px] font-semibold text-slate-800 mb-2">Enquiry Details</label>
                  <textarea id="message" rows={4} className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-lg text-[15px] focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="How can we help?" required></textarea>
                </div>
                <button type="submit" className="w-full bg-[#0f172a] text-white text-[15px] font-semibold py-3 rounded-lg hover:bg-slate-800 transition-colors shadow-sm">
                  Send Message
                </button>
              </form>
            </div>
          </div>
        </article>
      </main>
      <SiteFooter isSignedIn={isSignedIn} />
    </div>
  );
}
