#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Platform — Azure pilot setup (run once, from your Mac)
#
# Creates, in one region:
#   • Resource group            platform-prod
#   • PostgreSQL Flexible Server Burstable B1ms, 32 GB, 14-day backups, v16
#   • App Service plan (Linux)  B1   (upgrade later: az appservice plan update --sku B2)
#   • Web App (.NET 10)          Always On, HTTPS only, TLS 1.2, health check /health
#   • All app settings (secrets are asked for interactively, never written to disk)
#   • GitHub → Azure deploy identity (OIDC, no stored password) + role assignment
#   • GitHub secrets/variable + "production" environment (if the gh CLI is logged in)
#
# Prerequisites:
#   brew install azure-cli       (and optionally: brew install gh && gh auth login)
#   az login                     (approve the MFA prompt on your phone)
#
# Usage:
#   bash deploy/azure-pilot-setup.sh
#   LOCATION=italynorth bash deploy/azure-pilot-setup.sh     # other region
#
# Safe to stop at any point; re-running reuses what already exists where it can,
# but generates NEW Jwt/AssetToken keys and a NEW DB password only on first run
# of each resource — see the notes printed at the end.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

command -v openssl >/dev/null || { echo "openssl is required"; exit 1; }

LOCATION="${LOCATION:-francecentral}"
RG="${RG:-platform-prod}"
# Not `tr </dev/urandom | head`: under `set -o pipefail` head closing the pipe
# kills tr with SIGPIPE, which silently aborts the whole script on macOS.
SUFFIX="${SUFFIX:-$(openssl rand -hex 3 | cut -c1-5)}"
APP="${APP:-platform-$SUFFIX}"
PLAN="${PLAN:-platform-plan}"
DB="${DB:-platform-db-$SUFFIX}"
DB_ADMIN="platformadmin"
DB_NAME="platform"
REPO="${REPO:-Doaa1982/Platform}"
DEPLOY_APP_NAME="github-platform-deploy"

say()  { printf '\n\033[1;34m▶ %s\033[0m\n' "$*"; }
ok()   { printf '  \033[32m✓ %s\033[0m\n' "$*"; }
warn() { printf '  \033[33m! %s\033[0m\n' "$*"; }
ask_secret() { # $1 var name, $2 prompt, $3 "optional" to allow empty
  local v=""
  while :; do
    read -r -s -p "  $2: " v; echo
    [[ -n "$v" || "${3:-}" == "optional" ]] && break
    warn "required"
  done
  printf -v "$1" '%s' "$v"
}
rand() { openssl rand -base64 "$1" | tr -d '\n'; }

# ── 0. Preconditions ─────────────────────────────────────────────────────────
command -v az >/dev/null || { echo "Install the Azure CLI first: brew install azure-cli"; exit 1; }
az account show >/dev/null 2>&1 || { echo "Run 'az login' first."; exit 1; }

SUB_ID=$(az account show --query id -o tsv)
TENANT_ID=$(az account show --query tenantId -o tsv)
say "Subscription: $(az account show --query name -o tsv)  ($SUB_ID)"
say "Region: $LOCATION   Web App: $APP   Database: $DB"
read -r -p "  Continue? [y/N] " yn; [[ "$yn" =~ ^[Yy]$ ]] || exit 0

# ── 1. Collect secrets (kept in memory only) ─────────────────────────────────
say "Secrets (input is hidden)"
ask_secret R2_KEY_ID      "R2 production Access Key ID"
ask_secret R2_SECRET      "R2 production Secret Access Key"
ask_secret DEEPGRAM_KEY   "Deepgram API key"
echo "  AI provider for the pilot: 1) Gemini  2) Claude  3) OpenAI"
read -r -p "  Choose [1]: " AI_CHOICE; AI_CHOICE="${AI_CHOICE:-1}"
case "$AI_CHOICE" in
  1) AI_PROVIDER="Gemini"; ask_secret AI_KEY "Gemini API key" ;;
  2) AI_PROVIDER="Claude"; ask_secret AI_KEY "Anthropic (Claude) API key" ;;
  3) AI_PROVIDER="OpenAI"; ask_secret AI_KEY "OpenAI API key"
     warn "Audit §9: OpenAI's HttpClient still lacks the extended timeout — long AI skills may time out." ;;
  *) echo "invalid choice"; exit 1 ;;
esac
read -r -p "  First admin (Platform Operator) email: " OP_EMAIL
ask_secret OP_PASSWORD "First admin password (min. what the app requires)"

JWT_KEY=$(rand 48)
ASSET_KEY=$(rand 48)
DB_PASSWORD="$(openssl rand -base64 64 | tr -dc 'A-Za-z0-9' | cut -c1-32)"

# ── 2. Providers + resource group ────────────────────────────────────────────
say "Registering resource providers (first time can take a few minutes)"
for ns in Microsoft.Web Microsoft.DBforPostgreSQL; do
  az provider register --namespace "$ns" --wait >/dev/null; ok "$ns"
done

say "Resource group $RG"
az group create -n "$RG" -l "$LOCATION" -o none; ok "ready"

# ── 3. PostgreSQL ────────────────────────────────────────────────────────────
say "PostgreSQL Flexible Server $DB (≈5–10 min)"
if az postgres flexible-server show -g "$RG" -n "$DB" >/dev/null 2>&1; then
  warn "already exists — reusing; resetting admin password so the app setting matches"
  az postgres flexible-server update -g "$RG" -n "$DB" --admin-password "$DB_PASSWORD" -o none
else
  if ! az postgres flexible-server create \
      -g "$RG" -n "$DB" -l "$LOCATION" \
      --tier Burstable --sku-name Standard_B1ms \
      --storage-size 32 --version 16 \
      --backup-retention 14 \
      --admin-user "$DB_ADMIN" --admin-password "$DB_PASSWORD" \
      --public-access 0.0.0.0 \
      --yes -o none; then
    echo
    warn "Database creation failed — see the error above."
    warn "If it says the region/location is restricted for your subscription, re-run with"
    warn "another region (keep the same SUFFIX so names stay consistent), e.g.:"
    warn "  LOCATION=northeurope SUFFIX=$SUFFIX bash deploy/azure-pilot-setup.sh"
    exit 1
  fi
fi
# Created separately: newer CLI versions only accept --database-name on create
# for elastic clusters.
if ! az postgres flexible-server db show -g "$RG" --server-name "$DB" --name "$DB_NAME" >/dev/null 2>&1; then
  az postgres flexible-server db create -g "$RG" --server-name "$DB" --name "$DB_NAME" -o none
fi
ok "database '$DB_NAME'"
DB_HOST=$(az postgres flexible-server show -g "$RG" -n "$DB" --query fullyQualifiedDomainName -o tsv)
ok "$DB_HOST  (firewall: Azure services allowed)"

# ── 4. App Service ───────────────────────────────────────────────────────────
say "App Service plan $PLAN (Linux B1)"
az appservice plan show -g "$RG" -n "$PLAN" >/dev/null 2>&1 \
  || az appservice plan create -g "$RG" -n "$PLAN" -l "$LOCATION" --is-linux --sku B1 -o none
ok "ready"

RUNTIME="DOTNETCORE:10.0"
# `--runtime` accepts either ':' or '|' as the framework/version separator (both are in
# _StackRuntimeHelper.ALLOWED_DELIMETERS), but `list-runtimes` always PRINTS '|' — so
# comparing $RUNTIME as-is against that output never matches and always warns, even when
# the runtime is present. Normalize to '|' for the check only; the create call below still
# uses the colon form.
RUNTIME_LISTED="${RUNTIME/:/|}"
az webapp list-runtimes --os-type linux -o tsv 2>/dev/null | grep -qi "^$RUNTIME_LISTED$" \
  || warn "Runtime $RUNTIME not listed by this CLI version — trying anyway (update: brew upgrade azure-cli)"

say "Web App $APP"
az webapp show -g "$RG" -n "$APP" >/dev/null 2>&1 \
  || az webapp create -g "$RG" -p "$PLAN" -n "$APP" --runtime "$RUNTIME" -o none
az webapp update -g "$RG" -n "$APP" --https-only true -o none
az webapp config set -g "$RG" -n "$APP" \
  --always-on true --min-tls-version 1.2 --http20-enabled true --ftps-state Disabled \
  --generic-configurations '{"healthCheckPath":"/health"}' -o none
APP_URL="https://$(az webapp show -g "$RG" -n "$APP" --query defaultHostName -o tsv)"
ok "$APP_URL"

# ── 5. App settings (via a temp file so secrets never appear in `ps`) ────────
say "App settings"
case "$AI_PROVIDER" in
  Gemini) AI_KEY_SETTING="Gemini__ApiKey" ;;
  *)      AI_KEY_SETTING="Ai__ApiKey" ;;
esac
TMP=$(mktemp); chmod 600 "$TMP"; trap 'rm -f "$TMP"' EXIT
DB_HOST="$DB_HOST" DB_NAME="$DB_NAME" DB_ADMIN="$DB_ADMIN" DB_PASSWORD="$DB_PASSWORD" \
JWT_KEY="$JWT_KEY" ASSET_KEY="$ASSET_KEY" R2_KEY_ID="$R2_KEY_ID" R2_SECRET="$R2_SECRET" \
DEEPGRAM_KEY="$DEEPGRAM_KEY" AI_PROVIDER="$AI_PROVIDER" AI_KEY_SETTING="$AI_KEY_SETTING" AI_KEY="$AI_KEY" \
APP_URL="$APP_URL" OP_EMAIL="$OP_EMAIL" OP_PASSWORD="$OP_PASSWORD" \
python3 - "$TMP" <<'PY'
# Values arrive through the environment, not string interpolation, so a secret
# containing quotes or backslashes can't break (or inject into) this JSON.
import json, os, sys
e = os.environ
s = {
  "ASPNETCORE_ENVIRONMENT": "Production",
  "ASPNETCORE_FORWARDEDHEADERS_ENABLED": "true",
  "ConnectionStrings__PlatformDB":
      f"Host={e['DB_HOST']};Database={e['DB_NAME']};Username={e['DB_ADMIN']};Password={e['DB_PASSWORD']};SSL Mode=Require",
  "Jwt__Key": e["JWT_KEY"],
  "Storage__AssetTokenKey": e["ASSET_KEY"],
  "Storage__R2__AccessKeyId": e["R2_KEY_ID"],
  "Storage__R2__SecretAccessKey": e["R2_SECRET"],
  "Deepgram__ApiKey": e["DEEPGRAM_KEY"],
  "Ai__Provider": e["AI_PROVIDER"],
  e["AI_KEY_SETTING"]: e["AI_KEY"],
  # Pilot has no domain yet: Resend can't send from an unverified domain, so
  # email is off and invitation / reset links are shown in the admin console
  # to deliver by hand (WhatsApp etc.). Turn on once the domain is verified.
  "Email__Enabled": "false",
  "Email__PublicBaseUrl": e["APP_URL"],
  "InitialPlatformOperator__Email": e["OP_EMAIL"],
  "InitialPlatformOperator__Password": e["OP_PASSWORD"],
  "Storage__VideoDelivery": "Presigned",
}
# The list shape is what `az webapp config appsettings list` emits, and what
# --settings @file reliably accepts.
json.dump([{"name": k, "value": v, "slotSetting": False} for k, v in s.items()], open(sys.argv[1], "w"))
PY
az webapp config appsettings set -g "$RG" -n "$APP" --settings "@$TMP" -o none
rm -f "$TMP"
ok "$(az webapp config appsettings list -g "$RG" -n "$APP" --query 'length(@)' -o tsv) settings set"

# ── 6. GitHub → Azure deploy identity (OIDC) ─────────────────────────────────
say "GitHub deploy identity ($DEPLOY_APP_NAME)"
CLIENT_ID=$(az ad app list --display-name "$DEPLOY_APP_NAME" --query '[0].appId' -o tsv)
if [[ -z "$CLIENT_ID" ]]; then
  CLIENT_ID=$(az ad app create --display-name "$DEPLOY_APP_NAME" --query appId -o tsv)
fi
az ad sp show --id "$CLIENT_ID" >/dev/null 2>&1 || az ad sp create --id "$CLIENT_ID" -o none
if ! az ad app federated-credential list --id "$CLIENT_ID" --query "[?name=='github-production']" -o tsv | grep -q .; then
  az ad app federated-credential create --id "$CLIENT_ID" --parameters "{
    \"name\": \"github-production\",
    \"issuer\": \"https://token.actions.githubusercontent.com\",
    \"subject\": \"repo:$REPO:environment:production\",
    \"audiences\": [\"api://AzureADTokenExchange\"]
  }" -o none
fi
WEBAPP_ID=$(az webapp show -g "$RG" -n "$APP" --query id -o tsv)
for i in 1 2 3 4 5 6; do   # a brand-new identity can take a minute to be visible
  if az role assignment create --assignee "$CLIENT_ID" --role "Website Contributor" --scope "$WEBAPP_ID" -o none 2>/dev/null; then
    ok "Website Contributor on $APP"; break
  fi
  [[ $i == 6 ]] && { warn "role assignment failed — re-run the script in a minute"; exit 1; }
  sleep 15
done

# ── 7. GitHub secrets / variable / environment ───────────────────────────────
say "GitHub configuration for $REPO"
if command -v gh >/dev/null && gh auth status >/dev/null 2>&1; then
  gh api -X PUT "repos/$REPO/environments/production" >/dev/null && ok "environment 'production'"
  gh secret set AZURE_CLIENT_ID       -R "$REPO" -b "$CLIENT_ID"
  gh secret set AZURE_TENANT_ID       -R "$REPO" -b "$TENANT_ID"
  gh secret set AZURE_SUBSCRIPTION_ID -R "$REPO" -b "$SUB_ID"
  gh variable set AZURE_WEBAPP_NAME   -R "$REPO" -b "$APP"
  ok "secrets + variable set"
else
  warn "gh CLI not logged in — add these by hand in GitHub → Settings → Secrets and variables → Actions:"
  echo "    Secret   AZURE_CLIENT_ID       = $CLIENT_ID"
  echo "    Secret   AZURE_TENANT_ID       = $TENANT_ID"
  echo "    Secret   AZURE_SUBSCRIPTION_ID = $SUB_ID"
  echo "    Variable AZURE_WEBAPP_NAME     = $APP"
  echo "  …and create an environment named 'production' (Settings → Environments)."
fi

# ── Done ─────────────────────────────────────────────────────────────────────
cat <<DONE

$(printf '\033[1;32m')Setup complete.$(printf '\033[0m')

  App URL:        $APP_URL
  Health check:   $APP_URL/health   (will 404/503 until the first deploy)
  Database host:  $DB_HOST
  Database admin: $DB_ADMIN
  Database pwd:   $DB_PASSWORD

  ⚠ Save the database password in your password manager NOW — it is not stored
    anywhere else except inside the Web App's settings.

Next:
  1. GitHub → Actions → "Build and deploy" → Run workflow (or push to main).
  2. Open $APP_URL/health — expect "Healthy".
  3. Log in at $APP_URL with $OP_EMAIL.
  4. Before day ~25 of the free trial: Azure portal → Upgrade to pay-as-you-go,
     and set a budget alert (Cost Management → Budgets, \$25/month).
DONE
