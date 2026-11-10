#!/usr/bin/env bash
set -euo pipefail

# Windows の Git Bash で bq が「python3.12: command not found」で止まるときは、gcloud に同梱の Python を指定してから実行する
# export CLOUDSDK_PYTHON="$LOCALAPPDATA/Google/Cloud SDK/google-cloud-sdk/platform/bundledpython/python.exe"

if [[ $# -ne 3 ]]; then
  echo "使い方: bash scripts/setup-bigquery.sh PROJECT_ID DATASET RUNTIME_SERVICE_ACCOUNT" >&2
  exit 2
fi

PROJECT_ID=$1
DATASET=$2
RUNTIME_SERVICE_ACCOUNT=$3
LOCATION=${BIGQUERY_LOCATION:-asia-northeast1}

if [[ ! $PROJECT_ID =~ ^[A-Za-z0-9_-]+$ || ! $DATASET =~ ^[A-Za-z0-9_-]+$ || ! $RUNTIME_SERVICE_ACCOUNT =~ ^[A-Za-z0-9@._-]+$ ]]; then
  echo "プロジェクト、データセット、サービスアカウントの値を確認してください" >&2
  exit 2
fi

echo "BigQuery API を有効にします。課金と権限の設定を確認してから実行してください。"
gcloud services enable bigquery.googleapis.com --project "$PROJECT_ID"

if ! bq --project_id "$PROJECT_ID" show --dataset "$PROJECT_ID:$DATASET" >/dev/null 2>&1; then
  bq --project_id "$PROJECT_ID" mk --dataset --location "$LOCATION" "$PROJECT_ID:$DATASET"
fi

if ! bq --project_id "$PROJECT_ID" show "$PROJECT_ID:$DATASET.stumbles" >/dev/null 2>&1; then
  bq --project_id "$PROJECT_ID" mk --table "$PROJECT_ID:$DATASET.stumbles" \
    'lessonKey:STRING,problem:STRING,pattern:STRING,hintsShown:INTEGER,occurredAt:DATE,schoolHash:STRING,source:STRING'
fi

view_sql=$(<scripts/bigquery-views.sql)
view_sql=${view_sql//\$\{PROJECT_ID\}/$PROJECT_ID}
view_sql=${view_sql//\$\{DATASET\}/$DATASET}
printf '%s\n' "$view_sql" | bq --project_id "$PROJECT_ID" query --use_legacy_sql=false

# 動作を確かめる見本。3 校から各型 4 件ずつ入れるので、各まとまりは 12 件になる。
bq --project_id "$PROJECT_ID" query --use_legacy_sql=false <<SQL
INSERT INTO \`$PROJECT_ID.$DATASET.stumbles\`
  (lessonKey, problem, pattern, hintsShown, occurredAt, schoolHash, source)
SELECT
  'main-6', '1/3+1/4', pattern, 0, DATE_SUB(CURRENT_DATE('Asia/Tokyo'), INTERVAL 1 DAY),
  TO_HEX(SHA256(schoolId)), 'dummy'
FROM UNNEST(['demo-school-1', 'demo-school-2', 'demo-school-3']) AS schoolId
CROSS JOIN UNNEST(['sum-both', 'sum-num-only']) AS pattern
CROSS JOIN UNNEST(GENERATE_ARRAY(1, 4)) AS sampleNumber;
SQL

echo "データセット $PROJECT_ID:$DATASET に見本を入れました。"
echo "BigQuery の準備ができたら、Cloud Run のサービスアカウントにこのデータセットだけの権限を付けます。"
bq --project_id "$PROJECT_ID" add-iam-policy-binding --dataset "$PROJECT_ID:$DATASET" \
  --member="serviceAccount:$RUNTIME_SERVICE_ACCOUNT" --role="roles/bigquery.dataEditor"

echo "完了。Cloud Run の LOOP_BIGQUERY_DATASET に $DATASET を設定してください。"
# 「ほかの学校では」の表（GET /api/v1/loop/region）は jobs.query でビューを読むので、問い合わせを実行する権限も要る
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:$RUNTIME_SERVICE_ACCOUNT" --role="roles/bigquery.jobUser" --condition=None
echo "Cloud Run のサービスアカウントに、データセットへの書き込みと問い合わせの実行の権限を付けました。"
