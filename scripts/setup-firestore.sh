#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 3 || $# -gt 4 ]]; then
  echo "使い方: bash scripts/setup-firestore.sh PROJECT_ID DATABASE RUN_SERVICE_ACCOUNT [LOCATION]" >&2
  exit 2
fi

PROJECT_ID="$1"
DATABASE="$2"
RUN_SERVICE_ACCOUNT="$3"
LOCATION="${4:-asia-northeast1}"

if [[ ! "$PROJECT_ID" =~ ^[A-Za-z0-9_-]+$ ]]; then
  echo "PROJECT_ID の形式を確認してください" >&2
  exit 2
fi
if [[ "$DATABASE" != "(default)" && ! "$DATABASE" =~ ^[A-Za-z0-9_-]+$ ]]; then
  echo "DATABASE の形式を確認してください" >&2
  exit 2
fi
if [[ ! "$RUN_SERVICE_ACCOUNT" =~ ^[A-Za-z0-9._+-]+@[A-Za-z0-9_-]+\.iam\.gserviceaccount\.com$ ]]; then
  echo "RUN_SERVICE_ACCOUNT の形式を確認してください" >&2
  exit 2
fi
if [[ ! "$LOCATION" =~ ^[A-Za-z0-9-]+$ ]]; then
  echo "LOCATION の形式を確認してください" >&2
  exit 2
fi

gcloud services enable firestore.googleapis.com --project "$PROJECT_ID"
gcloud firestore databases create --database "$DATABASE" --location "$LOCATION" --type firestore-native --project "$PROJECT_ID"
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${RUN_SERVICE_ACCOUNT}" \
  --role="roles/datastore.user"
