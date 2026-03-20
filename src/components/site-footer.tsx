"use client";

import React from "react";
import Link from "next/link";
import { SignInButton } from "@clerk/nextjs";

export function SiteFooter({ isSignedIn }: { isSignedIn?: boolean }) {
  return (
    <footer className="py-12 px-6 bg-white border-t border-gray-200 mt-24">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-7 gap-6 mb-10">
          {/* Logo / About */}
          <div className="col-span-2 md:col-span-1 -mt-1">
            <div className="mb-4">
              <div className="flex items-baseline whitespace-nowrap text-[#020817] leading-none">
                <span className="font-bold tracking-tight text-[22px]">freight</span>
                <span className="font-bold tracking-tight text-[22px] text-slate-400">code</span>
                <span className="font-normal text-[13px] -translate-y-[5px] ml-[-1px] text-slate-400">®</span>
              </div>
            </div>
            <p className="text-gray-500 text-xs leading-relaxed">
              Automate your declarations, uncover hidden savings,<br />and ensure total HMRC compliance.
            </p>
            <p className="text-gray-400 text-xs mt-3">
              London, UK
              <br />
              info@freightcode.co.uk
            </p>
          </div>

          {/* Product */}
          <div>
            <h4 className="text-[#020817] font-medium text-xs mb-4">Product</h4>
            <ul className="text-gray-500 text-xs space-y-2">
              <li><Link href="/solutions" className="hover:text-[#020817]">Solutions</Link></li>
              <li><Link href="/resources" className="hover:text-[#020817]">Resources</Link></li>
            </ul>
          </div>

          {/* Company */}
          <div>
            <h4 className="text-[#020817] font-medium text-xs mb-4">Company</h4>
            <ul className="text-gray-500 text-xs space-y-2">
              <li><Link href="/about" className="hover:text-[#020817]">About</Link></li>
              <li><Link href="/contact" className="hover:text-[#020817]">Contact</Link></li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="text-[#020817] font-medium text-xs mb-4">Legal</h4>
            <ul className="text-gray-500 text-xs space-y-2">
              <li><Link href="/privacy" className="hover:text-[#020817]">Privacy</Link></li>
              <li><Link href="/terms" className="hover:text-[#020817]">Terms</Link></li>
            </ul>
          </div>

          {/* Socials */}
          <div>
            <h4 className="text-[#020817] font-medium text-xs mb-4">Socials</h4>
            <ul className="text-gray-500 text-xs space-y-2">
              <li><a href="https://x.com/freightcode" className="hover:text-[#020817]">X</a></li>
              <li><a href="https://linkedin.com/company/freightcode" className="hover:text-[#020817]">LinkedIn</a></li>
              <li><a href="https://youtube.com/@freightcode" className="hover:text-[#020817]">YouTube</a></li>
            </ul>
          </div>

          {/* Security & Trust */}
          <div>
            <h4 className="text-[#020817] font-medium text-xs mb-4">Security & Trust</h4>
            <ul className="text-gray-500 text-xs space-y-2">
              <li>Secure billing via Stripe</li>
              <li>Enterprise authentication</li>
              <li>Encrypted data</li>
              <li>Activity logging</li>
              <li>Role-based access</li>
            </ul>
          </div>

          {/* Trusted Infrastructure */}
          <div>
            <h4 className="text-[#020817] font-medium text-xs mb-4">Trusted Infrastructure</h4>
            <ul className="text-gray-500 text-xs space-y-2">
              <li className="flex items-center gap-2 group">
                <a href="https://stripe.com" target="_blank" rel="noopener noreferrer" className="hover:text-[#020817]">Stripe</a>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="https://cdn.brandfetch.io/stripe.com?c=1idbnvbXCRylLLzZ6DP&type=symbol" alt="Stripe" className="w-3 h-3 object-contain opacity-40 group-hover:opacity-100 transition-opacity" />
              </li>
              <li className="flex items-center gap-2 group">
                <a href="https://clerk.com" target="_blank" rel="noopener noreferrer" className="hover:text-[#020817]">Clerk</a>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="https://cdn.brandfetch.io/clerk.com?c=1idbnvbXCRylLLzZ6DP&type=symbol" alt="Clerk" className="w-3 h-3 object-contain opacity-40 group-hover:opacity-100 transition-opacity" />
              </li>
              <li className="flex items-center gap-2 group">
                <a href="https://convex.dev" target="_blank" rel="noopener noreferrer" className="hover:text-[#020817]">Convex</a>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="https://cdn.brandfetch.io/convex.dev?c=1idbnvbXCRylLLzZ6DP&type=symbol" alt="Convex" className="w-3 h-3 object-contain opacity-40 group-hover:opacity-100 transition-opacity" />
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="pt-6 border-t border-gray-100 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-gray-400 text-xs">
            © {new Date().getFullYear()} Freightcode. All rights reserved.
          </p>
          <div className="opacity-0 hover:opacity-100 transition-opacity flex items-center">
            {!isSignedIn && (
              <SignInButton mode="modal">
                <button className="text-[10px] text-gray-400 hover:text-gray-600 uppercase tracking-widest cursor-pointer">
                  Admin Login
                </button>
              </SignInButton>
            )}
          </div>
        </div>
      </div>
    </footer>
  );
}
