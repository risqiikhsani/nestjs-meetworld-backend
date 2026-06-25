 Created:
  - .github/workflows/ci.yml — lint + test + build on every PR and push to
  dev/main. Cancels in-flight runs on the same ref.
  - .github/workflows/deploy-dev.yml — auto-deploy on push to dev (plus
  workflow_dispatch). Job chain build-and-push → migrate → deploy, all under
  environment: dev.
  - .github/workflows/deploy-staging.yml — auto-deploy on push to main (plus
  workflow_dispatch). Same chain under environment: staging.
  - .github/workflows/deploy-production.yml — tag-driven. Job chain
  build-and-push (no gate) → migrate-prod (env: production-migrate) → deploy-prod
  (env: production-deploy). Concurrency cancel-in-progress: false so a re-tag
  never aborts an in-flight release.

  Deleted:
  - .github/workflows/deploy.yml (Docker Hub deploy)
  - .github/workflows/migration.yml (parallel migration runner)

  Updated:
  - CLAUDE.md CI/CD section now describes the four-workflow structure, the WIF +
  Artifact Registry setup, the two-gate production flow, the rollback command,
  and the GitHub-side one-time setup.

  One-time setup you still need to do (not code)

  These have to happen in the GCP console and GitHub UI before the new pipelines
  can run:

  GCP project — full commands in the plan file at
  C:\Users\user\.claude\plans\hi-i-want-to-abundant-torvalds.md. In short: enable
  APIs, create the meetworld Artifact Registry repo in asia-southeast3, set up
  the Workload Identity pool + provider for GitHub, create the github-deployer SA
  with roles/artifactregistry.writer, roles/run.admin,
  roles/iam.serviceAccountUser, and bind it to the pool. Then provision three
  Cloud Run services (meetworld-backend-dev, -staging, -prod) as placeholders,
  and three Postgres databases (dev / staging / prod).

  GitHub repo:
  - Set the variable GCP_PROJECT_ID.
  - Set the secrets GCP_WORKLOAD_IDENTITY_PROVIDER and GCP_SERVICE_ACCOUNT
  (shared by all envs).
  - Create four environments: dev, staging, production-migrate,
  production-deploy. Only the two production-* environments need required
  reviewers. Restrict them to tag pattern v*.*.*. The dev and staging
  environments need a DATABASE_URL secret (one per env), and so do the
  production-* environments (one prod DB connection string).

  Database connectivity from GitHub runners: GitHub-hosted runners have no static
  egress IP, so the migration job can't reach a private Cloud SQL instance
  directly. Easiest options — pick one before merging deploy-production.yml:
  - Front each Cloud SQL DB with the Cloud SQL Auth Proxy (run as a sidecar
  container in the migration job, or use Cloud Run's built-in
  --add-cloudsql-instances flag for the app itself, but that doesn't help the
  migration runner).
  - Or give Cloud SQL a public IP with authorized networks that include the
  runner IP range (rotated via GitHub's published list — fragile).

  Cleanup — after the new pipeline is verified, delete the now-unused repo
  secrets DOCKERHUB_USERNAME, DOCKERHUB_TOKEN, GCP_SA_KEY.

  Verification (in order)

  1. Open a draft PR to dev → ci.yml should run lint/test/build green.
  2. Merge to dev → deploy-dev runs build-and-push → migrate → deploy. Confirm a
  new revision on meetworld-backend-dev and the URL returns 200 on /health.
  3. PR dev → main and merge → deploy-staging runs end-to-end.
  4. From main, git tag v0.0.0-rc1 && git push origin v0.0.0-rc1. build-and-push
  runs immediately. migrate-prod blocks — approve as the data/DBA team.
  deploy-prod blocks — approve as release managers. Confirm the new revision
  serves traffic.
  5. Test rollback: pin 100% traffic to the previous revision via gcloud run
  services update-traffic meetworld-backend-prod --to-revisions=<prev>=100
  --region=asia-southeast3.