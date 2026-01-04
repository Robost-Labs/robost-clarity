# CI/CD Setup Guide for Robost Clarity

## Prerequisites
- GitHub repository: https://github.com/robostai/robost-clarity
- GCP Project: thermal-cathode-477302-h1
- Region: me-central1

## Option 1: Using Google Cloud Console (Recommended)

### Step 1: Connect GitHub Repository
1. Go to [Cloud Build Triggers](https://console.cloud.google.com/cloud-build/triggers)
2. Click "Create Trigger" or "Connect Repository"
3. Select "GitHub" as the source
4. Click "Authenticate GitHub" and follow the OAuth flow
5. Select the `robostai/robost-clarity` repository
6. Choose "Global" or "me-central1" region
7. Click "Connect"

### Step 2: Create Backend Trigger
1. Click "Create Trigger"
2. Configure:
   - **Name**: `backend-deploy-main`
   - **Description**: Deploy Backend services on main branch push
   - **Event**: Push to branch
   - **Branch**: `^main$`
   - **Configuration**: Cloud Build configuration file (yaml or json)
   - **Build configuration file**: `gcp/cloudbuild-backend.yaml`
   - **Substitutions**:
     ```
     _REGION: me-central1
     ```
   - **Included files** (optional):
     ```
     services/api/**/*
     services/consumer/**/*
     gcp/cloudbuild-backend.yaml
     ```
3. Click "Create"

### Step 3: Create Web Trigger
1. Click "Create Trigger"
2. Configure:
   - **Name**: `web-deploy-main`
   - **Description**: Deploy Web frontend on main branch push
   - **Event**: Push to branch
   - **Branch**: `^main$`
   - **Configuration**: Cloud Build configuration file (yaml or json)
   - **Build configuration file**: `gcp/cloudbuild-web.yaml`
   - **Substitutions**:
     ```
     _REGION: me-central1
     _API_URL: https://robost-api-ehnzr3alha-ww.a.run.app
     ```
   - **Included files** (optional):
     ```
     services/web/**/*
     gcp/cloudbuild-web.yaml
     ```
3. Click "Create"

### Step 4: Create Pull Request Trigger (Optional)
1. Click "Create Trigger"
2. Configure:
   - **Name**: `pr-test`
   - **Description**: Build and test on pull request
   - **Event**: Pull request
   - **Branch**: `^main$`
   - **Configuration**: Cloud Build configuration file (yaml or json)
   - **Build configuration file**: `gcp/cloudbuild-backend.yaml`
   - **Substitutions**:
     ```
     _REGION: me-central1
     _DEPLOY: false
     ```
   - **Require approval**: Enabled
3. Click "Create"

## Option 2: Using gcloud CLI

### First, complete the OAuth setup:
1. Visit: https://console.cloud.google.com/cloud-build/triggers/connect
2. Connect your GitHub account and select the repository

### Then run the setup script:
```bash
cd /Users/mohamedelkhawaga/Downloads/clarity
./gcp/setup-triggers.sh
```

## Verification

### List all triggers:
```bash
gcloud builds triggers list
```

### Manually run a trigger:
```bash
gcloud builds triggers run backend-deploy-main
```

### View build history:
```bash
gcloud builds list --limit=10
```

## Build Configuration Files

- **Backend**: `gcp/cloudbuild-backend.yaml` - Builds API and Consumer services
- **Web**: `gcp/cloudbuild-web.yaml` - Builds React frontend

## Workflow

1. **Development**: Push to feature branches (no triggers)
2. **Testing**: Create PR to main (triggers PR build if configured)
3. **Deployment**: Merge to main (triggers automated deployment)

## Notes

- Builds run in `me-central1` region
- Images are stored in Artifact Registry
- Cloud Run services are updated automatically
- Build logs are available in Cloud Console and GitHub

## Troubleshooting

If builds fail:
1. Check build logs in Cloud Console
2. Verify service account permissions
3. Ensure Cloud Build API is enabled
4. Check that Dockerfiles exist and are valid
