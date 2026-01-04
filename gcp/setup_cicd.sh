#!/bin/bash
set -euo pipefail

PROJECT_ID="${GCP_PROJECT_ID:-$(gcloud config get-value project 2>/dev/null)}"
TRIGGER_REGION="${CLOUD_BUILD_REGION:-us-central1}"
DEPLOY_REGION="${GCP_REGION:-me-central1}"
CONNECTION_ID="${CLOUD_BUILD_CONNECTION_ID:-robost-github-conn-us}"
REPOSITORY_ID="${CLOUD_BUILD_REPOSITORY_ID:-robost-clarity-us}"

if [ -z "$PROJECT_ID" ]; then
  echo "ERROR: GCP project is not set. Set GCP_PROJECT_ID or run: gcloud config set project <PROJECT_ID>"
  exit 1
fi

REPOSITORY_RESOURCE="$(gcloud builds repositories describe "${REPOSITORY_ID}" --connection="${CONNECTION_ID}" --region="${TRIGGER_REGION}" --format='value(name)')"

API_URL_DEFAULT="${API_URL:-https://robost-api-ehnzr3alha-ww.a.run.app}"

echo "Using project: ${PROJECT_ID}"
echo "Using trigger region: ${TRIGGER_REGION}"
echo "Using deploy region: ${DEPLOY_REGION}"
echo "Using repository: ${REPOSITORY_RESOURCE}"

create_or_update_trigger() {
  local trigger_name=$1
  shift

  if gcloud builds triggers describe "${trigger_name}" --region="${REGION}" >/dev/null 2>&1; then
    echo "Updating trigger: ${trigger_name}"
    gcloud builds triggers update github "${trigger_name}" --region="${TRIGGER_REGION}" "$@"
  else
    echo "Creating trigger: ${trigger_name}"
    gcloud builds triggers create github \
      --name="${trigger_name}" \
      --region="${TRIGGER_REGION}" \
      --repository="${REPOSITORY_RESOURCE}" \
      "$@"
  fi
}

create_or_update_trigger "backend-deploy-main" \
  --description="Build and deploy API (and build/push consumer image) on push to main" \
  --branch-pattern="^main$" \
  --build-config="gcp/cloudbuild-backend.yaml" \
  --substitutions="_REGION=${DEPLOY_REGION}" \
  --included-files="services/api/**,services/consumer/**,gcp/cloudbuild-backend.yaml"

create_or_update_trigger "web-deploy-main" \
  --description="Build and deploy web on push to main" \
  --branch-pattern="^main$" \
  --build-config="gcp/cloudbuild-web.yaml" \
  --substitutions="_REGION=${DEPLOY_REGION},_API_URL=${API_URL_DEFAULT}" \
  --included-files="services/web/**,gcp/cloudbuild-web.yaml"

echo "Done. Triggers:"
gcloud builds triggers list --region="${TRIGGER_REGION}" --format='table(name,id,filename)'
