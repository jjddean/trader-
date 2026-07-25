/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as account_export from "../account_export.js";
import type * as actions_cds_codes from "../actions/cds_codes.js";
import type * as actions_companies from "../actions/companies.js";
import type * as actions_currency from "../actions/currency.js";
import type * as actions_hmrc from "../actions/hmrc.js";
import type * as actions_hmrc_token_encrypt from "../actions/hmrc_token_encrypt.js";
import type * as actions_sanctions from "../actions/sanctions.js";
import type * as actions_stripe from "../actions/stripe.js";
import type * as actions_tariff from "../actions/tariff.js";
import type * as admin_ops from "../admin_ops.js";
import type * as admin_subscriptions from "../admin_subscriptions.js";
import type * as analytics from "../analytics.js";
import type * as assistantMutations from "../assistantMutations.js";
import type * as assistantQueries from "../assistantQueries.js";
import type * as assistantSchema from "../assistantSchema.js";
import type * as audit from "../audit.js";
import type * as cds_codes from "../cds_codes.js";
import type * as clients from "../clients.js";
import type * as compliance_consultant from "../compliance_consultant.js";
import type * as compliance_end_user from "../compliance_end_user.js";
import type * as crons from "../crons.js";
import type * as declaration_completeness from "../declaration_completeness.js";
import type * as declarations from "../declarations.js";
import type * as documents from "../documents.js";
import type * as export_controls from "../export_controls.js";
import type * as goods_items from "../goods_items.js";
import type * as hmrc from "../hmrc.js";
import type * as hmrc_actions from "../hmrc_actions.js";
import type * as hmrc_internal from "../hmrc_internal.js";
import type * as http from "../http.js";
import type * as ingest from "../ingest.js";
import type * as lib_cds_badge from "../lib/cds_badge.js";
import type * as lib_cds_h1_data_elements from "../lib/cds_h1_data_elements.js";
import type * as lib_cds_wco_references from "../lib/cds_wco_references.js";
import type * as lib_collect_declaration_notifications from "../lib/collect_declaration_notifications.js";
import type * as lib_currency_conversion from "../lib/currency_conversion.js";
import type * as lib_declaration_completeness from "../lib/declaration_completeness.js";
import type * as lib_duty_rate_parser from "../lib/duty_rate_parser.js";
import type * as lib_export_routing from "../lib/export_routing.js";
import type * as lib_financial_labels from "../lib/financial_labels.js";
import type * as lib_financial_obligations from "../lib/financial_obligations.js";
import type * as lib_financial_variance from "../lib/financial_variance.js";
import type * as lib_hmrc_notification_parser from "../lib/hmrc_notification_parser.js";
import type * as lib_hmrc_oauth from "../lib/hmrc_oauth.js";
import type * as lib_hmrc_pull_runtime from "../lib/hmrc_pull_runtime.js";
import type * as lib_hmrc_token_crypto from "../lib/hmrc_token_crypto.js";
import type * as lib_hmrc_token_refresh from "../lib/hmrc_token_refresh.js";
import type * as lib_hmrc_token_row from "../lib/hmrc_token_row.js";
import type * as lib_notification_dms_context from "../lib/notification_dms_context.js";
import type * as lib_notification_status from "../lib/notification_status.js";
import type * as lib_org_access from "../lib/org_access.js";
import type * as lib_org_live_readiness from "../lib/org_live_readiness.js";
import type * as lib_replay_declaration_status from "../lib/replay_declaration_status.js";
import type * as lib_rule_engine from "../lib/rule_engine.js";
import type * as lib_stripe_customer from "../lib/stripe_customer.js";
import type * as lib_stripe_plan from "../lib/stripe_plan.js";
import type * as lib_tariff_parser from "../lib/tariff_parser.js";
import type * as lib_tre_links from "../lib/tre_links.js";
import type * as lib_tre_opportunity from "../lib/tre_opportunity.js";
import type * as lib_user_role from "../lib/user_role.js";
import type * as notifications from "../notifications.js";
import type * as org_hmrc from "../org_hmrc.js";
import type * as org_migration from "../org_migration.js";
import type * as reference_data from "../reference_data.js";
import type * as representation from "../representation.js";
import type * as rule_definitions from "../rule_definitions.js";
import type * as rule_seed from "../rule_seed.js";
import type * as sanctions_data from "../sanctions_data.js";
import type * as seed_reference_data from "../seed_reference_data.js";
import type * as stripe_webhooks from "../stripe_webhooks.js";
import type * as submissions from "../submissions.js";
import type * as subscriptions from "../subscriptions.js";
import type * as tariff_internal from "../tariff_internal.js";
import type * as tre_analytics from "../tre_analytics.js";
import type * as tre_audit from "../tre_audit.js";
import type * as tre_imports from "../tre_imports.js";
import type * as users from "../users.js";
import type * as validation_results from "../validation_results.js";
import type * as waitlist from "../waitlist.js";
import type * as workspaces from "../workspaces.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  account_export: typeof account_export;
  "actions/cds_codes": typeof actions_cds_codes;
  "actions/companies": typeof actions_companies;
  "actions/currency": typeof actions_currency;
  "actions/hmrc": typeof actions_hmrc;
  "actions/hmrc_token_encrypt": typeof actions_hmrc_token_encrypt;
  "actions/sanctions": typeof actions_sanctions;
  "actions/stripe": typeof actions_stripe;
  "actions/tariff": typeof actions_tariff;
  admin_ops: typeof admin_ops;
  admin_subscriptions: typeof admin_subscriptions;
  analytics: typeof analytics;
  assistantMutations: typeof assistantMutations;
  assistantQueries: typeof assistantQueries;
  assistantSchema: typeof assistantSchema;
  audit: typeof audit;
  cds_codes: typeof cds_codes;
  clients: typeof clients;
  compliance_consultant: typeof compliance_consultant;
  compliance_end_user: typeof compliance_end_user;
  crons: typeof crons;
  declaration_completeness: typeof declaration_completeness;
  declarations: typeof declarations;
  documents: typeof documents;
  export_controls: typeof export_controls;
  goods_items: typeof goods_items;
  hmrc: typeof hmrc;
  hmrc_actions: typeof hmrc_actions;
  hmrc_internal: typeof hmrc_internal;
  http: typeof http;
  ingest: typeof ingest;
  "lib/cds_badge": typeof lib_cds_badge;
  "lib/cds_h1_data_elements": typeof lib_cds_h1_data_elements;
  "lib/cds_wco_references": typeof lib_cds_wco_references;
  "lib/collect_declaration_notifications": typeof lib_collect_declaration_notifications;
  "lib/currency_conversion": typeof lib_currency_conversion;
  "lib/declaration_completeness": typeof lib_declaration_completeness;
  "lib/duty_rate_parser": typeof lib_duty_rate_parser;
  "lib/export_routing": typeof lib_export_routing;
  "lib/financial_labels": typeof lib_financial_labels;
  "lib/financial_obligations": typeof lib_financial_obligations;
  "lib/financial_variance": typeof lib_financial_variance;
  "lib/hmrc_notification_parser": typeof lib_hmrc_notification_parser;
  "lib/hmrc_oauth": typeof lib_hmrc_oauth;
  "lib/hmrc_pull_runtime": typeof lib_hmrc_pull_runtime;
  "lib/hmrc_token_crypto": typeof lib_hmrc_token_crypto;
  "lib/hmrc_token_refresh": typeof lib_hmrc_token_refresh;
  "lib/hmrc_token_row": typeof lib_hmrc_token_row;
  "lib/notification_dms_context": typeof lib_notification_dms_context;
  "lib/notification_status": typeof lib_notification_status;
  "lib/org_access": typeof lib_org_access;
  "lib/org_live_readiness": typeof lib_org_live_readiness;
  "lib/replay_declaration_status": typeof lib_replay_declaration_status;
  "lib/rule_engine": typeof lib_rule_engine;
  "lib/stripe_customer": typeof lib_stripe_customer;
  "lib/stripe_plan": typeof lib_stripe_plan;
  "lib/tariff_parser": typeof lib_tariff_parser;
  "lib/tre_links": typeof lib_tre_links;
  "lib/tre_opportunity": typeof lib_tre_opportunity;
  "lib/user_role": typeof lib_user_role;
  notifications: typeof notifications;
  org_hmrc: typeof org_hmrc;
  org_migration: typeof org_migration;
  reference_data: typeof reference_data;
  representation: typeof representation;
  rule_definitions: typeof rule_definitions;
  rule_seed: typeof rule_seed;
  sanctions_data: typeof sanctions_data;
  seed_reference_data: typeof seed_reference_data;
  stripe_webhooks: typeof stripe_webhooks;
  submissions: typeof submissions;
  subscriptions: typeof subscriptions;
  tariff_internal: typeof tariff_internal;
  tre_analytics: typeof tre_analytics;
  tre_audit: typeof tre_audit;
  tre_imports: typeof tre_imports;
  users: typeof users;
  validation_results: typeof validation_results;
  waitlist: typeof waitlist;
  workspaces: typeof workspaces;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
