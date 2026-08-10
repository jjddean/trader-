"use server";

import { resend } from "@/lib/resend";

export async function sendSevereRiskAlert(incident: {
    title: string;
    location: string;
    description: string;
    recommendation: string;
}) {
    try {
        const { data, error } = await resend.emails.send({
            from: 'GeoRisk Intelligence <alerts@resend.dev>',
            to: ['jdean.dean@gmail.com'], // User's email from context or mock
            subject: `🚨 SEVERE RISK ALERT: ${incident.title}`,
            html: `
                <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #fee2e2; border-radius: 12px; overflow: hidden;">
                    <div style="background-color: #ef4444; padding: 20px; color: white;">
                        <h1 style="margin: 0; font-size: 20px;">Critical Maritime Intelligence</h1>
                    </div>
                    <div style="padding: 24px;">
                        <h2 style="margin-top: 0; color: #111827;">${incident.title}</h2>
                        <p style="color: #6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em;">Location: ${incident.location}</p>
                        
                        <div style="margin: 24px 0; padding: 16px; background-color: #f9fafb; border-left: 4px solid #ef4444;">
                            <p style="margin: 0; color: #374151; font-size: 14px; line-height: 1.6;">${incident.description}</p>
                        </div>

                        <div style="margin-top: 24px; padding: 16px; background-color: #fef2f2; border: 1px solid #fee2e2; border-radius: 8px;">
                            <h3 style="margin-top: 0; color: #991b1b; font-size: 12px; text-transform: uppercase;">Recommended Action</h3>
                            <p style="margin-bottom: 0; color: #b91c1c; font-weight: 600; font-size: 14px;">${incident.recommendation}</p>
                        </div>
                        
                        <div style="margin-top: 32px; border-top: 1px solid #e5e7eb; padding-top: 20px; text-align: center;">
                            <a href="http://localhost:3001/intel-feed" style="display: inline-block; padding: 12px 24px; background-color: #000; color: #fff; text-decoration: none; border-radius: 6px; font-size: 13px; font-weight: 500;">View Full Intel Feed</a>
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
            return { success: false, error };
        }

        return { success: true, data };
    } catch (err) {
        console.error("Generic Error sending email:", err);
        return { success: false, error: err };
    }
}
