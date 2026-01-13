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
DB_USER="robost_user" # In Cloud SQL, imports usually run as the instance service account or default user. 
# Explicit user in import command requires that user to have permissions. 
# Standard import uses 'postgres' or default. Let's see. 'gcloud sql import sql' executes as the user owning the instance or can specify --user.

BUCKET_NAME="gs://${PROJECT_ID}-sql-migrations"

echo "=========================================="
echo "Applying Database Schema Migrations"
echo "=========================================="
echo "Project: $PROJECT_ID"
echo "Instance: $DB_INSTANCE"
echo "Bucket: $BUCKET_NAME"

# 1. Create Bucket if not exists
echo "Creating/Verifying GCS bucket..."
gcloud storage buckets create $BUCKET_NAME --project=$PROJECT_ID --location=$REGION --uniform-bucket-level-access 2>/dev/null || echo "Bucket exists"

# 1.5 Grant permissions to Cloud SQL Service Account
echo "Granting permissions to Cloud SQL Service Account..."
SA_EMAIL=$(gcloud sql instances describe $DB_INSTANCE --project=$PROJECT_ID --format="value(serviceAccountEmailAddress)")
echo "Service Account: $SA_EMAIL"

gcloud storage buckets add-iam-policy-binding $BUCKET_NAME \
    --member=serviceAccount:$SA_EMAIL \
    --role=roles/storage.objectAdmin \
    --project=$PROJECT_ID
    
# 2. Upload SQL files
echo "Uploading schema files..."
gcloud storage cp database/init.sql $BUCKET_NAME/init.sql
gcloud storage cp database/multi_tenancy_migration.sql $BUCKET_NAME/multi_tenancy_migration.sql

# 3. Import Schema (Base) - Skipped as it exists
echo "Importing base schema (init.sql)... SKIPPED"
# gcloud sql import sql $DB_INSTANCE $BUCKET_NAME/init.sql \
#    --database=$DB_NAME \
#    --quiet

# 4. Import Multi-Tenancy Migration
echo "Importing multi-tenancy migration..."
gcloud sql import sql $DB_INSTANCE $BUCKET_NAME/multi_tenancy_migration.sql \
    --database=$DB_NAME \
    --quiet

echo "=========================================="
echo "Migrations Applied Successfully!"
echo "=========================================="
