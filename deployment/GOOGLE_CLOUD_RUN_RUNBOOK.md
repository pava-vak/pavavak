# Google Cloud Run Only Deployment

This project is now configured for Google Cloud Run only (no Oracle standby, no DNS failover).

## 1) Push your code

From local repo:

```bash
git add .
git commit -m "Google Cloud Run only deployment setup"
git push origin main
```

## 2) One-time setup (local machine or Cloud Shell)

```bash
gcloud auth login
gcloud config set project <PROJECT_ID>
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com
```

## 3) Deploy

From repo root:

```bash
PROJECT_ID=<PROJECT_ID> REGION=asia-south1 SERVICE_NAME=pavavak bash deployment/deploy-google.sh
```

## 4) Set environment variables on Cloud Run

```bash
gcloud run services update pavavak \
  --region asia-south1 \
  --update-env-vars NODE_ENV=production,DOMAIN=https://pavavak-750508954318.asia-south1.run.app
```

Add remaining required backend env vars in the same command (DB, secrets, email, etc).

## 5) Verify health

```bash
curl -fsS https://pavavak-750508954318.asia-south1.run.app/api/health
```
