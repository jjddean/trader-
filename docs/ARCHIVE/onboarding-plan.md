# Onboarding plan

**Status:** DONE — broker and Managed Service onboarding shipped; covered by `e2e/auth/broker-onboarding.spec.ts` and `e2e/auth/managed-service-onboarding.spec.ts`. History, not instructions.

## Flow
1. Sign up (Clerk) → `/after-auth`  
2. Invite bind → `/portal` (skip forms)  
3. Else → `/onboarding` (Welcome) → form  
4. Broker → create/join org → `/dashboard`  
5. Managed Service → client under FreightCode → `/portal`  

## Look
Clerk-style centred card on slate-50  

## Config
Set Convex env **`FREIGHTCODE_MANAGED_ORG_ID`** = Clerk org id that owns Managed Service clients (your ops org). Without it, Managed Service form errors on submit.  
