import { v } from "convex/values";
import type { MutationCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import {
  managedServiceBindingConflict,
  managedServiceClientToReuse,
} from "./lib/managed_service_binding";
import { resolveSignedInEmail } from "./lib/signed_in_email";
import { unauthenticatedError, userError } from "./lib/user_errors";

function trimRequired(value: string, label: string) {
  const t = value.trim();
  if (!t) throw userError("field_required", `${label} is required`);
  return t;
}

function trimOptional(value: string | undefined | null) {
  const t = String(value ?? "").trim();
  return t || undefined;
}

const formArgs = {
  companyName: v.string(),
  legalEntityType: v.string(),
  companyRegistrationNumber: v.optional(v.string()),
  tradingName: v.optional(v.string()),
  country: v.string(),
  addressLine: v.string(),
  postcode: v.string(),
  city: v.optional(v.string()),
  website: v.optional(v.string()),
  eori: v.optional(v.string()),
  contactName: v.string(),
  contactJobTitle: v.string(),
  contactEmail: v.string(),
  contactPhone: v.optional(v.string()),
  cdsSubscribed: v.optional(v.boolean()),
  termsAccepted: v.boolean(),
};

function validateEori(value: string) {
  const eori = value.trim().toUpperCase();
  if (!/^(GB|XI)\d{12}$/.test(eori)) {
    throw userError(
      "invalid_eori",
      "EORI number must start with GB or XI followed by 12 digits",
    );
  }
  return eori;
}

function validateCommonForm(args: {
  legalEntityType: string;
  companyRegistrationNumber?: string;
  contactJobTitle: string;
  termsAccepted: boolean;
}) {
  const legalEntityType = trimRequired(args.legalEntityType, "Legal entity type");
  const registrationRequired =
    legalEntityType === "limited_company" || legalEntityType === "limited_liability_partnership";
  const companyRegistrationNumber = registrationRequired
    ? trimRequired(args.companyRegistrationNumber ?? "", "Company registration number")
    : trimOptional(args.companyRegistrationNumber);
  const contactJobTitle = trimRequired(args.contactJobTitle, "Job title");
  if (!args.termsAccepted) {
    throw userError("terms_not_accepted", "You must accept the Terms of Service");
  }
  return { legalEntityType, companyRegistrationNumber, contactJobTitle };
}

async function requireUser(ctx: MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw unauthenticatedError();
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
  if (!dbUser) {
    throw userError("user_not_synced", "Your account is still syncing. Refresh and try again.");
  }
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
    const common = validateCommonForm(args);
    const country = trimRequired(args.country, "Country");
    const addressLine = trimRequired(args.addressLine, "Business address");
    const postcode = trimRequired(args.postcode, "Postcode");
    const city = trimRequired(args.city ?? "", "City");
    const eori = validateEori(trimRequired(args.eori ?? "", "EORI number"));
    if (!args.cdsSubscribed) {
      throw userError(
        "cds_not_confirmed",
        "You must confirm that your organisation is subscribed to CDS",
      );
    }
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
      ...common,
      tradingName: trimOptional(args.tradingName),
      country: country.toUpperCase(),
      addressLine,
      postcode,
      city,
      website: trimOptional(args.website),
      eori,
      contactName,
      contactEmail,
      contactPhone: trimOptional(args.contactPhone),
      cdsSubscribed: true,
      termsAcceptedAt: now,
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
      console.error(
        "[onboarding:completeManagedService] FREIGHTCODE_MANAGED_ORG_ID is not set on this deployment",
        { clerkId: identity.subject },
      );
      throw userError(
        "managed_service_unconfigured",
        "Managed Service sign-up is unavailable right now. Please contact FreightCode support.",
      );
    }

    const companyName = trimRequired(args.companyName, "Company name");
    const common = validateCommonForm(args);
    const country = trimRequired(args.country, "Country");
    const addressLine = trimRequired(args.addressLine, "Business address");
    const postcode = trimRequired(args.postcode, "Postcode");
    const city = trimRequired(args.city ?? "", "City");
    const contactName = trimRequired(args.contactName, "Full name");
    const contactEmail = trimRequired(args.contactEmail, "Email").toLowerCase();

    // Portal identity is whatever Clerk says this session owns — never the typed
    // contact email. Binding portalEmail to a form value let any signed-in user
    // claim someone else's address and permanently lock them out of onboarding.
    // contactEmail stays free text: it is the business contact, not a login.
    const signedIn = await resolveSignedInEmail(ctx, identity);
    if (!signedIn) {
      throw userError(
        "no_account_email",
        "We could not read the email address on your account. Sign out, sign back in, and try again.",
      );
    }
    // Only block on a positive "not verified". A missing or unparseable claim
    // must not lock anyone out — that would trade one production block for another.
    if (signedIn.verified === false) {
      throw userError(
        "email_not_verified",
        "Verify your email address with the link we sent you, then set up Managed Service.",
      );
    }
    const portalEmail = signedIn.email;

    const byClerk = await ctx.db
      .query("clients")
      .withIndex("by_portal_clerk", (q) => q.eq("portalClerkId", identity.subject))
      .first();

    const byEmail = await ctx.db
      .query("clients")
      .withIndex("by_portal_email", (q) => q.eq("portalEmail", portalEmail))
      .first();

    const conflict = managedServiceBindingConflict({ managedOrgId, byClerk, byEmail });
    if (conflict === "portal_linked_to_broker") {
      throw userError(
        conflict,
        "This account is already linked to a broker's client portal. Use a different account for Managed Service, or ask that broker to revoke portal access first.",
      );
    }
    if (conflict === "email_belongs_to_broker_client") {
      throw userError(
        conflict,
        "This email address is already registered as a broker's client. Contact FreightCode support to move it to Managed Service.",
      );
    }

    const existingClient = managedServiceClientToReuse(byClerk, byEmail);

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
        city,
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
        city,
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
      ...common,
      tradingName,
      country: country.toUpperCase(),
      addressLine,
      postcode,
      city,
      website,
      eori: trimOptional(args.eori) ? validateEori(args.eori!) : undefined,
      contactName,
      contactEmail,
      contactPhone: trimOptional(args.contactPhone),
      termsAcceptedAt: now,
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
