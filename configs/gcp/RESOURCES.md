# GCP Resources Inventory: Robost Clarity

This document tracks the active, billable resources in the Google Cloud Project: `thermal-cathode-477302-h1`.

## Active Services (Billable)

### 1. Cloud SQL (PostgreSQL)
- **Instance**: `robost-postgres`
- **Location**: `me-central1`
- **Status**: Running
- **Note**: This is the most significant cost driver.

### 2. Cloud Run (Serverless)
- **Service**: `robost-api`
- **Service**: `robost-web` / `clarity.robostai.com`
- **Location**: `me-central1`
- **Cost Mode**: Pay-per-request / Allocation (configured for minimum instances 0).

### 3. Pub/Sub
- **Topic**: `llm-traffic-logs`
- **Subscription**: `robost-consumer-sub`

### 4. Artifact Registry
- **Repository**: `clarity` (Docker images)
- **Repository**: `gcr.io` (Legacy GCR storage)

### 5. Cloud Storage
- **Bucket**: `thermal-cathode-477302-h1_cloudbuild` (Staging for builds)
- **Bucket**: `gcf-sources-832846281418-us-central1` (Function sources)

## Cost Optimization Actions Taken
- [x] Deleted temporary migration bucket: `gs://thermal-cathode-477302-h1-sql-migrations`
- [x] Cloud Run min-instances set to 0 to avoid idle compute costs.

---
*Last Updated: 2025-12-27*
