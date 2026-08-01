import { v } from "convex/values";
import type { MutationCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";

function trimRequired(value: string, label: string) {
  const t = value.trim();
  if (!t) throw new Error(`${label} is required`);
  return t;
}

function trimOptional(value: string | undefined | null) {
  const t = String(value ?? "").trim();
  return t || undefined;
}

const formArgs = {
  companyName: v.string(),
  tradingName: v.optional(v.string()),
  country: v.string(),
  addressLine: v.string(),
  postcode: v.string(),
  city: v.optional(v.string()),
  website: v.optional(v.string()),
  eori: v.optional(v.string()),
  contactName: v.string(),
  contactEmail: v.string(),
  contactPhone: v.optional(v.string()),
};

async function requireUser(ctx: MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Unauthenticated");
  let dbUser = await ctx.db
    .query("users")
    .withIndex("by_clerk", (q) => q.eq("clerkId", identity.subject))
    .unique();
  if (!dbUser) {
    const email =
      typeof identity.email === "string" ? identity.email.trim().toLowerCase() : undefined;
    const id = await ctx.db.insert("users", {
      clerkId: identity.subject,
      email,
      name: typeof identity.name === "string" ? identity.name : undefined,
    });
    dbUser = await ctx.db.get(id);
  }
  if (!dbUser) throw new Error("User not synced — refresh and try again");
  return { identity, dbUser };
}

export const getStatus = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const dbUser = await ctx.db
      .query("users")
      .withIndex("by_clerk", (q) => q.eq("clerkId", identity.subject))
      .unique();

    const profile = await ctx.db
      .query("onboarding_profiles")
      .withIndex("by_clerk", (q) => q.eq("clerkId", identity.subject))
      .order("desc")
      .first();

    return {
      completedAt: dbUser?.onboardingCompletedAt ?? null,
      path: dbUser?.onboardingPath ?? profile?.path ?? null,
      hasProfile: Boolean(profile),
    };
  },
});

/** Broker: save form, mark onboarding done → UI sends to create-org. */
export const completeBroker = mutation({
  args: formArgs,
  handler: async (ctx, args) => {
    const { identity, dbUser } = await requireUser(ctx);

    const companyName = trimRequired(args.companyName, "Company name");
    const country = trimRequired(args.country, "Country");
    const addressLine = trimRequired(args.addressLine, "Business address");
    const postcode = trimRequired(args.postcode, "Postcode");
    const contactName = trimRequired(args.contactName, "Full name");
    const contactEmail = trimRequired(args.contactEmail, "Email").toLowerCase();

    const now = Date.now();
    const existing = await ctx.db
      .query("onboarding_profiles")
      .withIndex("by_clerk", (q) => q.eq("clerkId", identity.subject))
      .order("desc")
      .first();

    const fields = {
      path: "broker" as const,
      companyName,
      tradingName: trimOptional(args.tradingName),
      country: country.toUpperCase(),
      addressLine,
      postcode,
      city: trimOptional(args.city),
      website: trimOptional(args.website),
      eori: trimOptional(args.eori)?.toUpperCase(),
      contactName,
      contactEmail,
      contactPhone: trimOptional(args.contactPhone),
      updatedAt: now,
    };

    if (existing) {
      await ctx.db.patch(existing._id, fields);
    } else {
      await ctx.db.insert("onboarding_profiles", {
        clerkId: identity.subject,
        ...fields,
        createdAt: now,
      });
    }

    await ctx.db.patch(dbUser._id, {
      onboardingPath: "broker",
      onboardingCompletedAt: now,
      name: contactName,
    });

    return { next: "choose-organization" as const };
  },
});

/**
 * Managed Service: create client under FreightCode org, bind portal to this user.
 * Requires Convex env FREIGHTCODE_MANAGED_ORG_ID (Clerk org id that owns these clients).
 */
export const completeManagedService = mutation({
  args: formArgs,
  handler: async (ctx, args) => {
    const { identity, dbUser } = await requireUser(ctx);

    const managedOrgId = String(process.env.FREIGHTCODE_MANAGED_ORG_ID ?? "").trim();
    if (!managedOrgId) {
      throw new Error(
        "Managed Service is not configured yet (FREIGHTCODE_MANAGED_ORG_ID). Contact FreightCode.",
      );
    }

    const companyName = trimRequired(args.companyName, "Company name");
    const country = trimRequired(args.country, "Country");
    const addressLine = trimRequired(args.addressLine, "Business address");
    const postcode = trimRequired(args.postcode, "Postcode");
    const contactName = trimRequired(args.contactName, "Full name");
    const contactEmail = trimRequired(args.contactEmail, "Email").toLowerCase();

    const portalEmail = contactEmail;

    const byClerk = await ctx.db
      .query("clients")
      .withIndex("by_portal_clerk", (q) => q.eq("portalClerkId", identity.subject))
      .first();

    if (byClerk && byClerk.orgId && byClerk.orgId !== managedOrgId) {
      throw new Error(
        "This account is already linked to a broker’s client portal. Use a different email/account for Managed Service, or revoke portal access on that client first.",
      );
    }

    const byEmail = await ctx.db
      .query("clients")
      .withIndex("by_portal_email", (q) => q.eq("portalEmail", portalEmail))
      .first();

    if (
      byEmail &&
      byEmail.portalClerkId &&
      byEmail.portalClerkId !== identity.subject
    ) {
      throw new Error(
        "This email is already used for portal access. Use a different contact email, or revoke portal on that client first.",
      );
    }

    if (
      byEmail &&
      byEmail.orgId &&
      byEmail.orgId !== managedOrgId &&
      (!byClerk || byClerk._id !== byEmail._id)
    ) {
      throw new Error(
        "This email belongs to another organisation’s client. Use a different contact email.",
      );
    }

    const existingClient =
      byClerk ??
      (byEmail && (!byEmail.portalClerkId || byEmail.portalClerkId === identity.subject)
        ? byEmail
        : null);

    const now = Date.now();
    const tradingName = trimOptional(args.tradingName);
    const website = trimOptional(args.website);
    const noteParts = [
      tradingName ? `Trading name: ${tradingName}` : null,
      website ? `Website: ${website}` : null,
      "Source: Managed Service onboarding",
    ].filter(Boolean);

    let clientId = existingClient?._id;
    if (existingClient) {
      await ctx.db.patch(existingClient._id, {
        name: companyName,
        eori: trimOptional(args.eori)?.toUpperCase(),
        addressLine,
        city: trimOptional(args.city),
        postcode,
        country: country.toUpperCase(),
        contactName,
        contactEmail,
        contactPhone: trimOptional(args.contactPhone),
        notes: noteParts.join(" · "),
        orgId: managedOrgId,
        portalEmail,
        portalClerkId: identity.subject,
        status: "active" as const,
        updatedAt: now,
      });
    } else {
      clientId = await ctx.db.insert("clients", {
        userId: identity.subject,
        orgId: managedOrgId,
        name: companyName,
        eori: trimOptional(args.eori)?.toUpperCase(),
        addressLine,
        city: trimOptional(args.city),
        postcode,
        country: country.toUpperCase(),
        contactName,
        contactEmail,
        contactPhone: trimOptional(args.contactPhone),
        notes: noteParts.join(" · "),
        portalEmail,
        portalClerkId: identity.subject,
        status: "active",
        createdAt: now,
        updatedAt: now,
      });
    }

    const existing = await ctx.db
      .query("onboarding_profiles")
      .withIndex("by_clerk", (q) => q.eq("clerkId", identity.subject))
      .order("desc")
      .first();

    const fields = {
      path: "managed_service" as const,
      companyName,
      tradingName,
      country: country.toUpperCase(),
      addressLine,
      postcode,
      city: trimOptional(args.city),
      website,
      eori: trimOptional(args.eori)?.toUpperCase(),
      contactName,
      contactEmail,
      contactPhone: trimOptional(args.contactPhone),
      clientId,
      updatedAt: now,
    };

    if (existing) {
      await ctx.db.patch(existing._id, fields);
    } else {
      await ctx.db.insert("onboarding_profiles", {
        clerkId: identity.subject,
        ...fields,
        createdAt: now,
      });
    }

    await ctx.db.patch(dbUser._id, {
      onboardingPath: "managed_service",
      onboardingCompletedAt: now,
      name: contactName,
    });

    return { next: "portal" as const, clientId };
  },
});
