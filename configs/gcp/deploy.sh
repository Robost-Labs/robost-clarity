#!/bin/bash
# Robost Clarity - GCP Deployment Script
# Deploys the application to Google Cloud Platform

set -e

# Configuration (override with environment variables)
PROJECT_ID="${GCP_PROJECT_ID:-your-project-id}"
REGION="${GCP_REGION:-us-central1}"
DB_INSTANCE="${CLOUD_SQL_INSTANCE:-robost-postgres}"

echo "=========================================="
echo "Robost Clarity - GCP Deployment"
echo "=========================================="
echo "Project: $PROJECT_ID"
echo "Region: $REGION"
echo ""

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo "ERROR: gcloud CLI is not installed. Please install it first."
    exit 1
fi

# Set the project
gcloud config set project $PROJECT_ID

# Function to create Cloud SQL instance
create_cloud_sql() {
    echo "Creating Cloud SQL instance..."
    
    gcloud sql instances create $DB_INSTANCE \
        --database-version=POSTGRES_15 \
        --tier=db-f1-micro \
        --region=$REGION \
        --storage-type=SSD \
        --storage-size=10GB \
        --backup-start-time=03:00 \
        --maintenance-window-day=SUN \
        --maintenance-window-hour=04 \
        --availability-type=zonal \
        || echo "Cloud SQL instance may already exist"
    
    # Create database
    gcloud sql databases create robost_clarity \
        --instance=$DB_INSTANCE \
        || echo "Database may already exist"
    
    # Create user (password should be set via Secret Manager in production)
    # Create user (password should be set via Secret Manager in production)
    if [ -z "$DB_PASSWORD" ]; then
        echo "Set the database user password:"
        read -s DB_PASSWORD
    fi
    gcloud sql users create robost_user \
        --instance=$DB_INSTANCE \
        --password=$DB_PASSWORD \
        || echo "User may already exist"
    
    echo "Cloud SQL setup complete"
}

# Function to create Pub/Sub topic
create_pubsub() {
    echo "Creating Pub/Sub topic..."
    
    gcloud pubsub topics create llm-traffic-logs \
        || echo "Topic may already exist"
    
    gcloud pubsub subscriptions create robost-consumer-sub \
        --topic=llm-traffic-logs \
        --ack-deadline=60 \
        || echo "Subscription may already exist"
    
    echo "Pub/Sub setup complete"
}

# Function to build and push images
build_backend() {
    echo "Building and pushing Backend (API + Consumer) images..."
    
    gcloud builds submit \
        --config gcp/cloudbuild-backend.yaml \
        .
    
    echo "Backend images built and pushed"
}

build_web() {
    local API_URL=$1
    echo "Building and pushing Web image with API_URL=$API_URL..."
    
    gcloud builds submit \
        --config gcp/cloudbuild-web.yaml \
        --substitutions=_API_URL=$API_URL \
        .
    
    echo "Web image built and pushed"
}

# Function to deploy to Cloud Run
deploy_cloud_run() {
    echo "Deploying to Cloud Run..."
    
    CLOUD_SQL_CONNECTION="$PROJECT_ID:$REGION:$DB_INSTANCE"
    
    # Deploy API
    gcloud run deploy robost-api \
        --image gcr.io/$PROJECT_ID/robost-api:latest \
        --region $REGION \
        --platform managed \
        --allow-unauthenticated \
        --add-cloudsql-instances $CLOUD_SQL_CONNECTION \
        --set-env-vars "POSTGRES_HOST=/cloudsql/$CLOUD_SQL_CONNECTION,POSTGRES_USER=robost_user,POSTGRES_PASSWORD=$DB_PASSWORD,POSTGRES_DB=robost_clarity,JWT_SECRET_KEY=${JWT_SECRET_KEY:-changeme},ENCRYPTION_KEY=${ENCRYPTION_KEY:-changeme}" \
        --memory 1Gi \
        --cpu 1 \
        --min-instances 0 \
        --max-instances 10
    
    # Get API URL
    API_URL=$(gcloud run services describe robost-api --region=$REGION --format='value(status.url)')
    echo "API deployed at: $API_URL"
    
    # Build Web (now that we have API URL)
    build_web "$API_URL"
    
    # Deploy Web
    gcloud run deploy robost-web \
        --image gcr.io/$PROJECT_ID/robost-web:latest \
        --region $REGION \
        --platform managed \
        --allow-unauthenticated \
        --set-env-vars "REACT_APP_API_URL=$API_URL" \
        --memory 512Mi \
        --cpu 1 \
        --min-instances 0 \
        --max-instances 5
    
    WEB_URL=$(gcloud run services describe robost-web --region=$REGION --format='value(status.url)')
    echo "Web deployed at: $WEB_URL"
    
    echo "Cloud Run deployment complete"
}

# Function to set up custom domain
setup_domain() {
    DOMAIN="${DOMAIN:-clarity.robostai.com}"
    
    echo "Setting up custom domain: $DOMAIN"
    
    gcloud run domain-mappings create \
        --service robost-web \
        --domain $DOMAIN \
        --region $REGION \
        || echo "Domain mapping may already exist"
    
    echo "Domain setup complete. Update your DNS records as shown above."
}

# Main menu
echo ""
echo "Select deployment option:"
echo "1) Full deployment (recommended for first time)"
echo "2) Create Cloud SQL instance only"
echo "3) Create Pub/Sub resources only"
echo "4) Build and push images only"
echo "5) Deploy to Cloud Run only"
echo "6) Setup custom domain"
echo "7) Exit"
echo ""
read -p "Enter option (1-7): " option

case $option in
    1)
        create_cloud_sql
        create_pubsub
        build_backend
        deploy_cloud_run
        echo ""
        echo "=========================================="
        echo "Deployment complete!"
        echo "=========================================="
        ;;
    2)
        create_cloud_sql
        ;;
    3)
        create_pubsub
        ;;
    4)
        build_backend
        echo "Web build skipped (requires API URL from deployment)"
        ;;
    5)
        deploy_cloud_run
        ;;
    6)
        setup_domain
        ;;
    7)
        echo "Exiting..."
        exit 0
        ;;
    *)
        echo "Invalid option"
        exit 1
        ;;
esac
