#!/usr/bin/env bash
set -euo pipefail

BASE="${BASE:-https://bagcat.online}"
OUTDIR="${OUTDIR:-audit-bagcat-$(date +%Y%m%d-%H%M%S)}"
TIMEOUT="${TIMEOUT:-20}"
CREATE_TEST_USERS="${CREATE_TEST_USERS:-1}"
TEST_PASSWORD="${TEST_PASSWORD:-BagcatAudit!2026}"

PASS=0
FAIL=0
WARN=0

mkdir -p "$OUTDIR"

log() { printf '%s\n' "$*" | tee -a "$OUTDIR/summary.log"; }
pass() { PASS=$((PASS+1)); log "PASS: $*"; }
fail() { FAIL=$((FAIL+1)); log "FAIL: $*"; }
warn() { WARN=$((WARN+1)); log "WARN: $*"; }

need_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

need_cmd curl
need_cmd jq
need_cmd date

request() {
  # Args: name method path [json_body] [auth_token]
  local name="$1"
  local method="$2"
  local path="$3"
  local body="${4:-}"
  local token="${5:-}"

  local url="$BASE$path"
  local hdr="$OUTDIR/${name}.headers.txt"
  local body_out="$OUTDIR/${name}.body.txt"
  local code

  if [[ -n "$body" && -n "$token" ]]; then
    code=$(curl -sS -m "$TIMEOUT" -D "$hdr" -o "$body_out" -w "%{http_code}" \
      -X "$method" "$url" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer $token" \
      --data "$body")
  elif [[ -n "$body" ]]; then
    code=$(curl -sS -m "$TIMEOUT" -D "$hdr" -o "$body_out" -w "%{http_code}" \
      -X "$method" "$url" \
      -H "Content-Type: application/json" \
      --data "$body")
  elif [[ -n "$token" ]]; then
    code=$(curl -sS -m "$TIMEOUT" -D "$hdr" -o "$body_out" -w "%{http_code}" \
      -X "$method" "$url" \
      -H "Authorization: Bearer $token")
  else
    code=$(curl -sS -m "$TIMEOUT" -D "$hdr" -o "$body_out" -w "%{http_code}" \
      -X "$method" "$url")
  fi

  echo "$code" > "$OUTDIR/${name}.status.txt"
  printf '%s' "$code"
}

json_field() {
  local file="$1"
  local query="$2"
  jq -r "$query // empty" "$file" 2>/dev/null || true
}

log "Audit started"
log "Target: $BASE"
log "Output: $OUTDIR"

# Baseline checks
status=$(request "health" "GET" "/api/health")
if [[ "$status" == "200" ]]; then
  pass "GET /api/health returned 200"
else
  warn "GET /api/health returned $status"
fi

status=$(request "root_headers" "GET" "/")
if grep -qi '^strict-transport-security:' "$OUTDIR/root_headers.headers.txt"; then
  pass "HSTS header present on /"
else
  warn "HSTS header missing on /"
fi

if grep -qi '^content-security-policy:' "$OUTDIR/root_headers.headers.txt"; then
  pass "CSP header present on /"
else
  warn "CSP header missing on /"
fi

# Optional active tests that require test users
U1_T="${U1_T:-}"
U2_T="${U2_T:-}"
U3_T="${U3_T:-}"
U4_T="${U4_T:-}"
U1_ID="${U1_ID:-}"
U2_ID="${U2_ID:-}"
U3_ID="${U3_ID:-}"
U4_ID="${U4_ID:-}"

create_user() {
  local name="$1"
  local tag
  tag=$(date +%s%N | tail -c 7)
  local body
  body=$(printf '{"displayName":"%s_%s","password":"%s"}' "$name" "$tag" "$TEST_PASSWORD")
  local status
  status=$(request "signup_${name}" "POST" "/api/auth/signup" "$body")
  if [[ "$status" != "200" ]]; then
    echo ""
    return 1
  fi
  cat "$OUTDIR/signup_${name}.body.txt"
}

if [[ "$CREATE_TEST_USERS" == "1" && -z "$U1_T" ]]; then
  log "Creating temporary test users via signup"

  U1_JSON=$(create_user u1) || true
  U2_JSON=$(create_user u2) || true
  U3_JSON=$(create_user u3) || true
  U4_JSON=$(create_user u4) || true

  if [[ -n "${U1_JSON:-}" && -n "${U2_JSON:-}" && -n "${U3_JSON:-}" && -n "${U4_JSON:-}" ]]; then
    U1_T=$(printf '%s' "$U1_JSON" | jq -r '.token')
    U2_T=$(printf '%s' "$U2_JSON" | jq -r '.token')
    U3_T=$(printf '%s' "$U3_JSON" | jq -r '.token')
    U4_T=$(printf '%s' "$U4_JSON" | jq -r '.token')

    U1_ID=$(printf '%s' "$U1_JSON" | jq -r '.user.id')
    U2_ID=$(printf '%s' "$U2_JSON" | jq -r '.user.id')
    U3_ID=$(printf '%s' "$U3_JSON" | jq -r '.user.id')
    U4_ID=$(printf '%s' "$U4_JSON" | jq -r '.user.id')

    pass "Created 4 temporary audit users"
  else
    warn "Could not create all test users; active vulnerability checks will be skipped"
  fi
fi

if [[ -n "$U1_T" && -n "$U2_T" && -n "$U3_T" && -n "$U4_T" && -n "$U1_ID" && -n "$U2_ID" && -n "$U3_ID" ]]; then
  # DM deletion by outsider
  start_dm_body=$(printf '{"userNumber":%s}' "$U3_ID")
  status=$(request "dm_start" "POST" "/api/dm/start" "$start_dm_body" "$U2_T")
  if [[ "$status" != "200" ]]; then
    warn "Could not create DM for outsider-delete test (status $status)"
  else
    if (( U2_ID < U3_ID )); then
      DM_ID="dm_${U2_ID}:${U3_ID}"
    else
      DM_ID="dm_${U3_ID}:${U2_ID}"
    fi

    status=$(request "dm_outsider_leave" "POST" "/api/threads/${DM_ID}/leave" "" "$U1_T")
    request "u2_threads_after_dm_leave" "GET" "/api/threads" "" "$U2_T" >/dev/null
    exists_after=$(jq -r --arg id "$DM_ID" '[.threads[] | select(.id==$id)] | length' "$OUTDIR/u2_threads_after_dm_leave.body.txt" 2>/dev/null || echo "0")

    if [[ "$status" == "200" && "$exists_after" == "0" ]]; then
      fail "Outsider DM delete vulnerability reproduced (non-member deleted DM ${DM_ID})"
    else
      pass "Outsider DM delete blocked (status=$status, exists_after=$exists_after)"
    fi
  fi

  # Group add by non-creator
  create_group_body=$(printf '{"name":"audit-group","memberNumbers":[%s]}' "$U2_ID")
  status=$(request "group_create" "POST" "/api/groups" "$create_group_body" "$U1_T")
  if [[ "$status" != "200" ]]; then
    warn "Could not create group for non-creator add test (status $status)"
  else
    GID=$(json_field "$OUTDIR/group_create.body.txt" '.thread.id')
    if [[ -z "$GID" ]]; then
      warn "Missing group id in create response"
    else
      add_member_body=$(printf '{"memberNumbers":[%s]}' "$U3_ID")
      status=$(request "group_add_by_non_creator" "POST" "/api/groups/${GID}/members" "$add_member_body" "$U2_T")
      request "u3_threads_after_group_add" "GET" "/api/threads" "" "$U3_T" >/dev/null
      seen=$(jq -r --arg id "$GID" '[.threads[] | select(.id==$id)] | length' "$OUTDIR/u3_threads_after_group_add.body.txt" 2>/dev/null || echo "0")

      if [[ "$status" == "200" && "$seen" == "1" ]]; then
        fail "Group privilege vulnerability reproduced (non-creator added member to ${GID})"
      else
        pass "Non-creator group add blocked (status=$status, seen=$seen)"
      fi
    fi
  fi

  # Login brute-force throttling (using valid user number, bad passwords)
  throttled=0
  for i in $(seq 1 20); do
    body=$(printf '{"userNumber":%s,"password":"wrong-%s"}' "$U1_ID" "$i")
    status=$(request "login_bad_${i}" "POST" "/api/auth/login" "$body")
    if [[ "$status" == "429" ]]; then
      throttled=$((throttled+1))
    fi
  done

  if (( throttled > 0 )); then
    pass "Login brute-force defenses present (429 seen $throttled times)"
  else
    fail "No login throttling observed across 20 bad attempts"
  fi

  # Message limiter quick check
  blocked=0
  for i in $(seq 1 6); do
    body=$(printf '{"content":"audit message %s"}' "$i")
    status=$(request "msg_${i}" "POST" "/api/threads/global/messages" "$body" "$U1_T")
    if [[ "$status" == "429" ]]; then
      blocked=1
    fi
  done
  if (( blocked == 1 )); then
    pass "Message rate limit active (429 observed in burst)"
  else
    warn "No message rate limit observed in burst of 6"
  fi

  # WebSocket tests (requires node + ws)
  if command -v node >/dev/null 2>&1; then
    log "Running websocket checks"

    set +e
    U2_T="$U2_T" U4_T="$U4_T" BASE="$BASE" node --input-type=module -e '
      import WebSocket from "ws";
      const base = process.env.BASE.replace(/^http/, "ws") + "/ws";
      const ws2 = new WebSocket(base + "?token=" + encodeURIComponent(process.env.U2_T));
      const ws4 = new WebSocket(base + "?token=" + encodeURIComponent(process.env.U4_T));
      let open2=false, open4=false, leaked=false;
      function trigger() {
        if (open2 && open4) {
          fetch(process.env.BASE + "/api/me/display-name", {
            method: "PATCH",
            headers: {"Content-Type":"application/json", "Authorization":"Bearer " + process.env.U2_T},
            body: JSON.stringify({ displayName: "audit-ws-leak" })
          }).catch(() => {});
        }
      }
      ws2.on("open", () => { open2=true; trigger(); });
      ws4.on("open", () => { open4=true; trigger(); });
      ws4.on("message", (m) => {
        const s = m.toString();
        if (s.includes("user:updated")) {
          leaked = true;
          console.log("WS_LEAK=true");
          process.exit(0);
        }
      });
      setTimeout(() => {
        console.log("WS_LEAK=" + (leaked ? "true" : "false"));
        process.exit(0);
      }, 5000);
    ' > "$OUTDIR/ws_leak_check.txt" 2>&1
    set -e

    if grep -q 'WS_LEAK=true' "$OUTDIR/ws_leak_check.txt"; then
      fail "WebSocket privacy leak reproduced (unrelated user received user:updated)"
    else
      pass "No websocket profile-update leak observed in this run"
    fi

    set +e
    U1_T="$U1_T" BASE="$BASE" node --input-type=module -e '
      import WebSocket from "ws";
      const wsBase = process.env.BASE.replace(/^http/, "ws") + "/ws";
      const ws = new WebSocket(wsBase + "?token=" + encodeURIComponent(process.env.U1_T), {
        headers: { Origin: "http://evil.example" }
      });
      ws.on("open", () => { console.log("WS_ORIGIN_BYPASS=true"); process.exit(0); });
      ws.on("error", () => { console.log("WS_ORIGIN_BYPASS=false"); process.exit(0); });
      setTimeout(() => { console.log("WS_ORIGIN_BYPASS=timeout"); process.exit(0); }, 4000);
    ' > "$OUTDIR/ws_origin_check.txt" 2>&1
    set -e

    if grep -q 'WS_ORIGIN_BYPASS=true' "$OUTDIR/ws_origin_check.txt"; then
      fail "WebSocket origin bypass reproduced (evil Origin connected)"
    else
      pass "WebSocket origin check appears enforced in this run"
    fi
  else
    warn "Node not available; websocket checks skipped"
  fi
else
  warn "Active vulnerability checks skipped (missing tokens/IDs)."
  warn "Provide U1_T..U4_T and U1_ID..U4_ID or keep CREATE_TEST_USERS=1."
fi

log ""
log "Audit complete"
log "PASS=$PASS FAIL=$FAIL WARN=$WARN"
log "Artifacts saved in: $OUTDIR"

if (( FAIL > 0 )); then
  exit 2
fi

exit 0
