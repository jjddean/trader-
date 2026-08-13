"use server";

import { auth, currentUser } from "@clerk/nextjs/server";

import { emailPathUrl } from "@/lib/export-controls/email-link-base";
import { resend } from "@/lib/resend";

function escapeHtml(value: string): string {
    return value.replace(/[&<>"']/g, (character) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
    })[character]!);
}

export async function sendSevereRiskAlert(incident: {
    title: string;
    location: string;
    description: string;
    recommendation: string;
}) {
    try {
        const { userId } = await auth();
        if (!userId) return { success: false, error: "Unauthenticated" };

        const from = process.env.RESEND_FROM_EMAIL?.trim();
        if (!process.env.RESEND_API_KEY?.trim() || !from) {
            return { success: false, error: "Risk alert email is not configured" };
        }

        const user = await currentUser();
        const recipient = user?.primaryEmailAddress?.emailAddress?.trim();
        if (!recipient) return { success: false, error: "No alert email is available" };

        const title = escapeHtml(incident.title.trim().slice(0, 200));
        const location = escapeHtml(incident.location.trim().slice(0, 200));
        const description = escapeHtml(incident.description.trim().slice(0, 4000));
        const recommendation = escapeHtml(incident.recommendation.trim().slice(0, 2000));
        const intelFeedUrl = emailPathUrl("/dashboard/trade-lanes");

        const { data, error } = await resend.emails.send({
            from,
            to: [recipient],
            subject: `SEVERE RISK ALERT: ${incident.title.trim().slice(0, 150).replace(/[\r\n]/g, " ")}`,
            html: `
                <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #fee2e2; border-radius: 12px; overflow: hidden;">
                    <div style="background-color: #ef4444; padding: 20px; color: white;">
                        <h1 style="margin: 0; font-size: 20px;">Critical Maritime Intelligence</h1>
                    </div>
                    <div style="padding: 24px;">
                        <h2 style="margin-top: 0; color: #111827;">${title}</h2>
                        <p style="color: #6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em;">Location: ${location}</p>

                        <div style="margin: 24px 0; padding: 16px; background-color: #f9fafb; border-left: 4px solid #ef4444;">
                            <p style="margin: 0; color: #374151; font-size: 14px; line-height: 1.6;">${description}</p>
                        </div>

                        <div style="margin-top: 24px; padding: 16px; background-color: #fef2f2; border: 1px solid #fee2e2; border-radius: 8px;">
                            <h3 style="margin-top: 0; color: #991b1b; font-size: 12px; text-transform: uppercase;">Recommended Action</h3>
                            <p style="margin-bottom: 0; color: #b91c1c; font-weight: 600; font-size: 14px;">${recommendation}</p>
                        </div>

                        <div style="margin-top: 32px; border-top: 1px solid #e5e7eb; padding-top: 20px; text-align: center;">
                            <a href="${intelFeedUrl}" style="display: inline-block; padding: 12px 24px; background-color: #000; color: #fff; text-decoration: none; border-radius: 6px; font-size: 13px; font-weight: 500;">View Trade Lanes</a>
                        </div>
                    </div>
                    <div style="background-color: #f9fafb; padding: 16px; text-align: center; font-size: 11px; color: #9ca3af;">
                        GeoRisk Pro • Automated Enterprise Intelligence
                    </div>
                </div>
            `
        });

        if (error) {
            console.error("Resend Error:", error);
            return { success: false, error: "Risk alert email could not be sent" };
        }

        return { success: true, data };
    } catch (err) {
        console.error("Generic Error sending email:", err);
        return { success: false, error: "Risk alert email could not be sent" };
    }
}
