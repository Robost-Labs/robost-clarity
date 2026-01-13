#!/bin/bash
set -e

# Load config
if [ -f gcp/.env.gcp ]; then
    export $(cat gcp/.env.gcp | grep -v '^#' | xargs)
fi

PROJECT_ID="${GCP_PROJECT_ID:-thermal-cathode-477302-h1}"
REGION="${GCP_REGION:-me-central1}"
DB_INSTANCE="${CLOUD_SQL_INSTANCE:-robost-postgres}"
DB_NAME="robost_clarity"
BUCKET_NAME="gs://${PROJECT_ID}-sql-migrations"

echo "=========================================="
echo "Applying Name Column Migration"
echo "=========================================="

# 1. Grant permissions (ensure they exist)
SA_EMAIL=$(gcloud sql instances describe $DB_INSTANCE --project=$PROJECT_ID --format="value(serviceAccountEmailAddress)")
gcloud storage buckets add-iam-policy-binding $BUCKET_NAME \
    --member=serviceAccount:$SA_EMAIL \
    --role=roles/storage.objectAdmin \
    --project=$PROJECT_ID > /dev/null

# 2. Upload SQL file
echo "Uploading migration file..."
gcloud storage cp database/migration_add_user_names.sql $BUCKET_NAME/migration_add_user_names.sql

# 3. Import Migration
echo "Importing migration (migration_add_user_names.sql)..."
gcloud sql import sql $DB_INSTANCE $BUCKET_NAME/migration_add_user_names.sql \
    --database=$DB_NAME \
    --quiet

echo "=========================================="
echo "Migration Applied Successfully!"
echo "=========================================="
