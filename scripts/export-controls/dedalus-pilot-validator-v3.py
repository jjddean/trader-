import json,sys
d=json.loads(sys.stdin.read()); evidence=d["evidence"]; records=d["proposed"].get("records",[]); errors=[]
allowed_results={"MET","NOT_MET","EQUAL_TO_BOUNDARY","CANNOT_DETERMINE","NOT_APPLICABLE"}; allowed_statuses={"POSSIBLY_LISTED","POSSIBLY_NOT_LISTED","INSUFFICIENT_EVIDENCE","CHECK_NEIGHBOUR_ENTRY"}; expected={p["recordId"]:p for p in evidence["products"]}
if len(records)!=3: errors.append("exactly three records required")
for r in records:
    rid=r.get("recordId"); source=expected.get(rid)
    if not source: errors.append("unexpected recordId: "+str(rid)); continue
    for f in ("manufacturer","model","sourceUrl"):
        if r.get(f)!=source[f]: errors.append(rid+": "+f+" changed")
    if r.get("evidenceQuotes")!=source["evidence"]: errors.append(rid+": evidence quotations changed")
    for f in ("cameraTypeResult","frameRateResult","testedEntryResult"):
        if r.get(f) not in allowed_results: errors.append(rid+": invalid "+f)
    if r.get("candidateStatus") not in allowed_statuses: errors.append(rid+": invalid candidateStatus")
    c=[r.get("cameraTypeResult"),r.get("frameRateResult")]; derived="NOT_MET" if any(x in ("NOT_MET","EQUAL_TO_BOUNDARY") for x in c) else "CANNOT_DETERMINE" if "CANNOT_DETERMINE" in c else "MET" if all(x=="MET" for x in c) else "NOT_APPLICABLE"
    if r.get("testedEntryResult")!=derived: errors.append(rid+": testedEntryResult must be "+derived)
    neighbours=r.get("neighbourEntries",[])
    if r.get("candidateStatus")=="POSSIBLY_NOT_LISTED" and r.get("neighbourEntryCheckCompleted") is not True: errors.append(rid+": POSSIBLY_NOT_LISTED requires completed neighbour check")
    if derived=="NOT_MET" and neighbours and r.get("candidateStatus")!="CHECK_NEIGHBOUR_ENTRY": errors.append(rid+": plausible neighbour requires CHECK_NEIGHBOUR_ENTRY")
    if r.get("candidateStatus")=="CHECK_NEIGHBOUR_ENTRY" and (derived!="NOT_MET" or not neighbours): errors.append(rid+": invalid neighbour-check status")
    if any(r.get(f) is not None for f in ("finalControlEntry","finalStatus","reviewerReasoning")): errors.append(rid+": consultant fields populated")
print(json.dumps({"records":records,"validation":{"accepted":not errors,"errors":errors,"validator":"dedalus-machine-deterministic-v3","openAIRequestMade":False}}))
