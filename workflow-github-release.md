# How to push to production


When you create a GitHub Release, GitHub prompts you to choose or create a tag. Because your `deploy-production.yml` has this trigger:

```yaml
on:
  push:
    tags: ['v*.*.*']

```

As long as you type a tag name that matches that format (like `v1.0.0`, `v1.0.1`, etc.), your production pipeline will instantly kick off.

---

### Step-by-Step: Shipping to Production

Here is the exact workflow you will follow every time you are ready to push a stable build to your live users:

1. **Verify Staging:** Make sure your `main` branch has successfully built, deployed, and been verified on your staging environment.
2. **Go to Releases:** In your GitHub repository sidebar on the right, click on **Releases** > **Draft a new release**.
3. **Create the Tag:** Click **Choose a tag**, type your version number (e.g., `v1.0.0`), and select `Target: main`.
4. **Publish:** Add a release title and some release notes detailing what changed, then click **Publish release**.

---

### What Happens Next? (The Visual Flow)

The moment you click **Publish release**, GitHub Actions takes over and executes your production pipeline exactly as you designed it:

```
[Publish Release v1.0.0]
         │
         ▼
 ┌─────────────────┐
 │ Build & Push    │ ──► (Compiles Docker image and pushes to Artifact Registry)
 └─────────────────┘
         │
         ▼
 ▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒
 ▒  GATE 1:        ▒ ──► (Stops workflow. Sends an email/notification to you)
 ▒  Review Appr.   ▒     "Hey, are you ready to run database migrations?"
 ▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒
         │
  [User Approves]
         │
         ▼
 ┌─────────────────┐
 │ Migrate Database│ ──► (Runs 'pnpm typeorm migration:run' on your live DB)
 └─────────────────┘
         │
         ▼
 ▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒
 ▒  GATE 2:        ▒ ──► (Stops workflow again)
 ▒  Review Appr.   ▒     "Migrations passed! Ready to route live traffic?"
 ▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒
         │
  [User Approves]
         │
         ▼
 ┌─────────────────┐
 │ Deploy Cloud Run│ ──► (Executes gcloud run deploy to production)
 └─────────────────┘

