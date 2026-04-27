/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as actions_cds_codes from "../actions/cds_codes.js";
import type * as actions_companies from "../actions/companies.js";
import type * as actions_currency from "../actions/currency.js";
import type * as actions_hmrc from "../actions/hmrc.js";
import type * as actions_stripe from "../actions/stripe.js";
import type * as actions_tariff from "../actions/tariff.js";
import type * as admin_subscriptions from "../admin_subscriptions.js";
import type * as ai from "../ai.js";
import type * as analytics from "../analytics.js";
import type * as archive from "../archive.js";
import type * as audit from "../audit.js";
import type * as cds_codes from "../cds_codes.js";
import type * as compliance from "../compliance.js";
import type * as crons from "../crons.js";
import type * as declarations from "../declarations.js";
import type * as documents from "../documents.js";
import type * as getFirstLane from "../getFirstLane.js";
import type * as goods_items from "../goods_items.js";
import type * as hmrc from "../hmrc.js";
import type * as hmrc_actions from "../hmrc_actions.js";
import type * as hmrc_internal from "../hmrc_internal.js";
import type * as http from "../http.js";
import type * as ingest from "../ingest.js";
import type * as lib_rule_engine from "../lib/rule_engine.js";
import type * as lib_tariff_parser from "../lib/tariff_parser.js";
import type * as notifications from "../notifications.js";
import type * as reference_data from "../reference_data.js";
import type * as rule_definitions from "../rule_definitions.js";
import type * as rule_seed from "../rule_seed.js";
import type * as seed_reference_data from "../seed_reference_data.js";
import type * as stripe_webhooks from "../stripe_webhooks.js";
import type * as subscriptions from "../subscriptions.js";
import type * as tariff_internal from "../tariff_internal.js";
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
  "actions/cds_codes": typeof actions_cds_codes;
  "actions/companies": typeof actions_companies;
  "actions/currency": typeof actions_currency;
  "actions/hmrc": typeof actions_hmrc;
  "actions/stripe": typeof actions_stripe;
  "actions/tariff": typeof actions_tariff;
  admin_subscriptions: typeof admin_subscriptions;
  ai: typeof ai;
  analytics: typeof analytics;
  archive: typeof archive;
  audit: typeof audit;
  cds_codes: typeof cds_codes;
  compliance: typeof compliance;
  crons: typeof crons;
  declarations: typeof declarations;
  documents: typeof documents;
  getFirstLane: typeof getFirstLane;
  goods_items: typeof goods_items;
  hmrc: typeof hmrc;
  hmrc_actions: typeof hmrc_actions;
  hmrc_internal: typeof hmrc_internal;
  http: typeof http;
  ingest: typeof ingest;
  "lib/rule_engine": typeof lib_rule_engine;
  "lib/tariff_parser": typeof lib_tariff_parser;
  notifications: typeof notifications;
  reference_data: typeof reference_data;
  rule_definitions: typeof rule_definitions;
  rule_seed: typeof rule_seed;
  seed_reference_data: typeof seed_reference_data;
  stripe_webhooks: typeof stripe_webhooks;
  subscriptions: typeof subscriptions;
  tariff_internal: typeof tariff_internal;
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
