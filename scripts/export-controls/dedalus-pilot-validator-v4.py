import json, sys

d = json.loads(sys.stdin.read())
evidence = d["evidence"]
records = d["proposed"].get("records", [])
errors = []
allowed_results = {"MET", "NOT_MET", "EQUAL_TO_BOUNDARY", "CANNOT_DETERMINE", "NOT_APPLICABLE"}
allowed_statuses = {"POSSIBLY_LISTED", "POSSIBLY_NOT_LISTED", "INSUFFICIENT_EVIDENCE", "CHECK_NEIGHBOUR_ENTRY"}
expected = {p["recordId"]: p for p in evidence["products"]}

def derive(results):
    if any(x in ("NOT_MET", "EQUAL_TO_BOUNDARY") for x in results): return "NOT_MET"
    if "CANNOT_DETERMINE" in results: return "CANNOT_DETERMINE"
    if results and all(x == "MET" for x in results): return "MET"
    return "NOT_APPLICABLE"

if len(records) != 3: errors.append("exactly three records required")
for r in records:
    rid = r.get("recordId")
    source = expected.get(rid)
    if not source:
        errors.append("unexpected recordId: " + str(rid)); continue
    for f in ("manufacturer", "model", "sourceUrl"):
        if r.get(f) != source[f]: errors.append(rid + ": " + f + " changed")
    if r.get("evidenceQuotes") != source["evidence"]: errors.append(rid + ": evidence quotations changed")
    for f in ("cameraTypeResult", "frameRateResult", "testedEntryResult"):
        if r.get(f) not in allowed_results: errors.append(rid + ": invalid " + f)
    if r.get("candidateStatus") not in allowed_statuses: errors.append(rid + ": invalid candidateStatus")
    if any(r.get(f) is not None for f in ("finalControlEntry", "finalStatus", "reviewerReasoning")):
        errors.append(rid + ": consultant fields populated")

cordin = next((r for r in records if r.get("recordId") == "gb-dualuse-0002"), None)
if cordin:
    assessments = {a.get("controlEntry"): a for a in cordin.get("entryAssessments", [])}
    original = assessments.get("6A003.a.4")
    neighbour = assessments.get("6A203.b.1")
    if not original or original.get("testedEntryResult") != "NOT_MET": errors.append("Cordin: failed 6A003.a.4 assessment not preserved")
    if not neighbour: errors.append("Cordin: separate 6A203.b.1 assessment missing")
    else:
        conditions = neighbour.get("conditionResults", [])
        results = [x.get("comparisonResult") for x in conditions]
        if any(x not in allowed_results for x in results): errors.append("Cordin: invalid neighbour condition enum")
        if neighbour.get("testedEntryResult") != derive(results): errors.append("Cordin: neighbour result is not deterministic")
        existing_quotes = set(cordin.get("evidenceQuotes", []))
        used_quotes = {q for x in conditions for q in x.get("evidenceQuotes", [])}
        if not used_quotes.issubset(existing_quotes): errors.append("Cordin: neighbour assessment invented evidence quotation")
    if cordin.get("candidateStatus") != "POSSIBLY_LISTED" or cordin.get("candidateControlEntry") != "6A203.b.1":
        errors.append("Cordin: overall status not derived from met 6A203.b.1")

print(json.dumps({"records": records, "validation": {"accepted": not errors, "errors": errors, "validator": "dedalus-machine-deterministic-v4", "openAIRequestMade": False}}))
