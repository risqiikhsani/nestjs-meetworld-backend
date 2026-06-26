To get this CI/CD pipeline fully functional, you need to configure **Google Cloud Platform (GCP)** to allow GitHub Actions to securely authenticate and deploy resources, and then add those values to your **GitHub Secrets and Variables**.

Here is the step-by-step setup guide.

---

## Part 1: Google Cloud Platform (GCP) Setup

Your workflows use **Workload Identity Federation (WIF)**. This is the modern, secure way to connect GitHub to GCP because it eliminates the need for long-lived, dangerous GCP service account JSON keys.

### 1. Create a Google Cloud Project

If you haven't already, create a project in the Google Cloud Console and enable the following APIs:

* IAM Service Account Credentials API
* Artifact Registry API
* Cloud Run API

### 2. Create an Artifact Registry Repository

Your Docker images are being pushed to `asia-southeast1-docker.pkg.dev/.../meetworld/backend`.

1. Go to **Artifact Registry** in GCP.
2. Click **Create Repository**.
3. Name it **`meetworld`**.
4. Set the region to **`asia-southeast1` (Seoul)**.
5. Format: **Docker**.

### 3. Create a Deployment Service Account

Create a service account that GitHub Actions will assume to build, push, and deploy.

1. Go to **IAM & Admin** > **Service Accounts** > **Create Service Account**.
2. Name it something like `github-deployer` (e.g., `github-deployer@YOUR_PROJECT_ID.iam.gserviceaccount.com`).
3. Grant it the following roles so it can do its job:
* **Artifact Registry Writer** (To push Docker images)
* **Cloud Run Developer** (To deploy services to Cloud Run)
* **Service Account User** (Required to deploy to Cloud Run acting as the runtime identity)



### 4. Configure Workload Identity Federation (WIF)

This establishes the trust link between GitHub and GCP. Run these commands using the Cloud Shell or your local Google Cloud CLI:

```bash
# 1. Create a Workload Identity Pool
gcloud iam workload-identity-pools create "github-pool" \
    --project="YOUR_PROJECT_ID" \
    --location="global" \
    --display-name="GitHub Pool"

# 2. Create an Identity Provider inside that pool for GitHub
gcloud iam workload-identity-pools providers create-oidc "github-provider" \
    --project="YOUR_PROJECT_ID" \
    --location="global" \
    --workload-identity-pool="github-pool" \
    --display-name="GitHub Provider" \
    --attribute-mapping="google.subject=assertion.sub,attribute.actor=assertion.actor,attribute.repository=assertion.repository" \
    --issuer-uri="https://token.actions.githubusercontent.com"

# 3. Allow GitHub to assume your Service Account
# Replace YOUR_ORGANIZATION/YOUR_REPO with your actual GitHub username/repo
gcloud iam service-accounts add-iam-policy-binding "github-deployer@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
    --project="YOUR_PROJECT_ID" \
    --role="roles/iam.workloadIdentityUser" \
    --member="principalSet://iam.googleapis.com/projects/YOUR_PROJECT_NUMBER/locations/global/workloadIdentityPools/github-pool/attribute.repository/YOUR_ORGANIZATION/YOUR_REPO"

```

To get your `WORKLOAD_IDENTITY_PROVIDER` string for GitHub, run:

```bash
gcloud iam workload-identity-pools providers describe "github-provider" \
    --project="YOUR_PROJECT_ID" \
    --location="global" \
    --workload-identity-pool="github-pool" \
    --format="value(name)"

```

*It will look like: `projects/1234567890/locations/global/workloadIdentityPools/github-pool/providers/github-provider*`

---

## Part 2: What to Put in GitHub Secrets & Variables

Go to your GitHub Repository > **Settings** > **Secrets and variables** > **Actions**.

### 1. Repository Variables (Variables tab)

Click **New repository variable**. These are non-sensitive values.

| Name | Value | Description |
| --- | --- | --- |
| `GCP_PROJECT_ID` | `your-gcp-project-id` | The alphanumeric ID of your GCP project. |

### 2. Repository Secrets (Secrets tab)

Click **New repository secret**. These are highly sensitive credentials.

| Name | Value | Description |
| --- | --- | --- |
| `GCP_WORKLOAD_IDENTITY_PROVIDER` | `projects/.../providers/github-provider` | The exact path string generated at the end of step 4 above. |
| `GCP_SERVICE_ACCOUNT` | `github-deployer@...iam.gserviceaccount.com` | The full email address of the service account you created. |

### 3. Environment Secrets (Secrets tab)

Because your files utilize environment-specific configs (like `environment: dev`, `environment: staging`), you should store your database URLs in **Environment Secrets** instead of global Repository Secrets. This keeps your Dev, Staging, and Production databases completely isolated.

1. Go to **Settings** > **Environments**.
2. Click **New environment** and create three environments matching your script: `dev`, `staging`, and `production-migrate`.
3. Inside *each* environment, add an **Environment Secret**:

| Environment | Secret Name | Value Example |
| --- | --- | --- |
| **`dev`** | `DATABASE_URL` | `postgresql://user:pass@dev-db-host:5432/db` |
| **`staging`** | `DATABASE_URL` | `postgresql://user:pass@staging-db-host:5432/db` |
| **`production-migrate`** | `DATABASE_URL` | `postgresql://user:pass@prod-db-host:5432/db` |

> ⚠️ **Note on Production Gates:** In your `deploy-prod.yml`, your jobs target `production-migrate` and `production-deploy`. If you want those "Gates" (manual review approvals) your comments mentioned to actually halt the pipeline until someone clicks "Approve", make sure to check the **Required reviewers** box when configuring those environments in GitHub!