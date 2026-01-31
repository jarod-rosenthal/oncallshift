#!/bin/bash
# Pre-commit hook to detect hardcoded secrets in Terraform files
# Looks for patterns like secret_string = "...", api_key = "...", etc.

set -e

# Colors for output
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

SECRETS_FOUND=0

# Patterns to check for hardcoded secrets
declare -a PATTERNS=(
  'secret_string\s*=\s*"[^"]*"'              # secret_string = "value"
  'secret_string\s*=\s*"[^"]+"'              # secret_string = "anything"
  'api_key\s*=\s*"[^"]*[a-zA-Z0-9]"'         # api_key = "...alphanumeric..."
  'token\s*=\s*"[^"]*[a-zA-Z0-9]"'           # token = "...alphanumeric..."
  'password\s*=\s*"[^"]*[a-zA-Z0-9]"'        # password = "...alphanumeric..."
  'private_key\s*=\s*"[^"]+"'                # private_key = "..."
  'platform_credential\s*=\s*"[^"]+"'        # platform_credential = "..."
)

for file in "$@"; do
  if [[ ! $file =~ \.tf$ ]]; then
    continue
  fi

  for pattern in "${PATTERNS[@]}"; do
    # Check if the line contains a variable reference (var. or data. or resource.)
    # These are safe and should not trigger the check
    matches=$(grep -nE "$pattern" "$file" || true)

    if [ ! -z "$matches" ]; then
      while IFS= read -r line; do
        line_num=$(echo "$line" | cut -d: -f1)
        content=$(echo "$line" | cut -d: -f2-)

        # Skip lines that reference variables or other resources
        if [[ $content =~ var\. ]] || [[ $content =~ data\. ]] || [[ $content =~ aws_secret ]] || [[ $content =~ random_password ]]; then
          continue
        fi

        # Skip comments
        if [[ $content =~ ^[[:space:]]*# ]]; then
          continue
        fi

        echo -e "${RED}[SECURITY] Possible hardcoded secret in $file:$line_num${NC}"
        echo -e "${YELLOW}$content${NC}"
        SECRETS_FOUND=$((SECRETS_FOUND + 1))
      done <<< "$matches"
    fi
  done
done

if [ $SECRETS_FOUND -gt 0 ]; then
  echo -e "\n${RED}Error: Found $SECRETS_FOUND potential hardcoded secrets!${NC}"
  echo -e "${YELLOW}Please use Terraform variables with 'sensitive = true' instead.${NC}"
  echo -e "${YELLOW}Example:${NC}"
  echo "  variable \"expo_access_token\" {"
  echo "    type      = string"
  echo "    sensitive = true"
  echo "    default   = null"
  echo "  }"
  echo ""
  echo "  Then use: secret_string = var.expo_access_token"
  exit 1
fi

exit 0
