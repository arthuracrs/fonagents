#!/usr/bin/env bash
# Agent-gated bd close: runs an anagent validator review before closing an issue.
# Usage: validate-close.sh <issue-id> [extra bd close flags...]
#
# Requires: anagent (github.com/arthuracrs/anagent) installed and on PATH.
# Customize validation rules in .anagent/prompts/validator.md

set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: $(basename "$0") <issue-id> [bd close flags...]" >&2
  exit 1
fi

ISSUE_ID="$1"
shift
EXTRA_ARGS=("$@")

ISSUE_TEXT=$(bd show "$ISSUE_ID" 2>&1) || {
  echo "Error: could not fetch issue $ISSUE_ID" >&2
  exit 1
}

GATE_OUTPUT=$(bd gate create --blocks "$ISSUE_ID" --type human --reason "Pending agent validation" --json 2>&1)
GATE_ID=$(echo "$GATE_OUTPUT" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [[ -z "$GATE_ID" ]]; then
  echo "Error: failed to create gate. bd output:" >&2
  echo "$GATE_OUTPUT" >&2
  exit 1
fi

echo "Gate $GATE_ID created — running agent review of $ISSUE_ID..."

RESULT=$(echo "$ISSUE_TEXT" | anagent run validator --stdin --json 2>&1)
VERDICT=$(echo "$RESULT" | python3 -c "import sys,json; r=json.load(sys.stdin); print(r['verdict'])" 2>/dev/null || echo "ERROR")
REASON=$(echo "$RESULT"  | python3 -c "import sys,json; r=json.load(sys.stdin); print(r['reason'])"  2>/dev/null || echo "$RESULT")

if [[ "$VERDICT" == "APPROVED" ]]; then
  bd gate resolve "$GATE_ID" --reason "Agent approved: $REASON" -q
  bd close "$ISSUE_ID" "${EXTRA_ARGS[@]+"${EXTRA_ARGS[@]}"}"
  echo "✓ $ISSUE_ID closed — $REASON"
elif [[ "$VERDICT" == "REJECTED" ]]; then
  echo "✗ $ISSUE_ID NOT closed — $REASON"
  echo "  Gate $GATE_ID remains open. Fix the issue and run this command again."
  exit 1
else
  echo "✗ Agent returned unexpected output. Gate $GATE_ID left open." >&2
  echo "  Raw: $RESULT" >&2
  exit 1
fi
