"use client";

import React from "react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { useAuth } from "@clerk/nextjs";
import { Mail, MapPin } from "lucide-react";

export default function ContactPage() {
  const { isSignedIn } = useAuth();
  
  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      <SiteHeader />
      <main className="pt-[140px] pb-24">
        <div className="mx-auto max-w-[1024px] px-[24px]">
          <h1 className="mb-4 text-[42px] font-bold tracking-tight text-[#020817] md:text-[52px] text-center">
            Get in Touch
          </h1>
          <p className="mx-auto mb-16 max-w-2xl text-[20px] text-slate-500 text-center">
            Have questions about our platform or enterprise pricing? We'd love to hear from you.
          </p>

          <div className="grid md:grid-cols-2 gap-12 max-w-4xl mx-auto">
            <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm h-full">
              <h2 className="text-2xl font-bold mb-6">Contact Information</h2>
              <div className="space-y-8">
                <div className="flex items-start gap-4">
                  <div className="mt-1 h-10 w-10 flex items-center justify-center rounded-full bg-blue-50 text-blue-600 shrink-0">
                    <Mail className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900 mb-1">Email Us</h3>
                    <p className="text-slate-500 mb-2">Our friendly team is here to help.</p>
                    <a href="mailto:info@freightcode.co.uk" className="text-blue-600 font-medium hover:underline">
                      info@freightcode.co.uk
                    </a>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="mt-1 h-10 w-10 flex items-center justify-center rounded-full bg-slate-50 text-slate-600 shrink-0">
                    <MapPin className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900 mb-1">Office</h3>
                    <p className="text-slate-500 mb-2">Come say hello at our London headquarters.</p>
                    <p className="text-slate-700 font-medium">London, UK</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
              <form className="space-y-6" onSubmit={(e) => { e.preventDefault(); alert('Message sent! We will be in touch soon.'); }}>
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-slate-700 mb-2">Name</label>
                  <input type="text" id="name" className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Jane Doe" required />
                </div>
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-2">Email</label>
                  <input type="email" id="email" className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="jane@company.com" required />
                </div>
                <div>
                  <label htmlFor="message" className="block text-sm font-medium text-slate-700 mb-2">Message</label>
                  <textarea id="message" rows={4} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="How can we help..." required></textarea>
                </div>
                <button type="submit" className="w-full bg-[#111827] text-white font-medium py-3 rounded-lg hover:bg-[#374151] transition-colors">
                  Send Message
                </button>
              </form>
            </div>
          </div>
        </div>
      </main>
      <SiteFooter isSignedIn={isSignedIn} />
    </div>
  );
}
