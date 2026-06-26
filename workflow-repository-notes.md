

# Here is the exact configuration you should set up in your repository settings.

---

## 1. Branch & Tag Protection Rules

To enforce code quality before code can even touch your `dev` or `main` branches, go to **Settings** > **Code and automation** > **Branches**.

### A. Rule for the `main` branch

Your staging deploy triggers automatically whenever something hits `main`. You want to protect this branch so broken code doesn't auto-deploy.

* **Branch name pattern:** `main`
* **Protect matching branches:** Check the following:
* **Require a pull request before merging:** Check this. (Forces developers to use PRs instead of pushing directly to production/staging code).
* **Require status checks to pass before merging:** Check this.
* In the search bar that appears, look for and add your CI jobs: **`Lint`**, **`Test`**, and **`Build`** (from your `ci.yml`). This blocks merging if your tests or ESLint fail.





### B. Rule for the `dev` branch

Your dev deploy triggers whenever something hits `dev`.

* **Branch name pattern:** `dev`
* **Protect matching branches:**
* **Require status checks to pass before merging:** Add **`Lint`**, **`Test`**, and **`Build`**. This ensures your development environment doesn't break due to simple syntax or test failures.



### C. Rule for Version Tags (Production)

Your production deployment triggers on tags matching `v*.*.*`. Go to **Settings** > **Tags** > **Rulesets** > **New tags ruleset**.

* **Ruleset Name:** `Production Tags`
* **Target tags:** Include metadata pattern `refs/tags/v*.*.*`
* **Restrict creations:** Check this and restrict tag creation to repository administrators or specific lead developers. This prevents someone from accidentally typing `git tag v1.0.0` on a broken local branch and triggering a live production release.

---

## 2. Environment Rules (The Deployment Gates)

Your `deploy-production.yml` file defines two explicit environments: `production-migrate` and `production-deploy`. To activate the human approval gates mentioned in your file comments, you must configure them in GitHub.

Go to **Settings** > **Environments**.

### Gate 1: Configure `production-migrate`

1. Click **New environment** and name it exactly: `production-migrate`
2. Under **Deployment protection rules**:
* Check **Required reviewers**.
* Add your name (or your lead reviewers' names).
* *Result:* When a `v*.*.*` tag is pushed, the workflow will build the image, but it will **pause** and send an alert before running the database migrations until an authorized user clicks **Approve**.



### Gate 2: Configure `production-deploy`

1. Click **New environment** and name it exactly: `production-deploy`
2. Under **Deployment protection rules**:
* Check **Required reviewers** and add the reviewers.
* *Result:* Once the migration finishes, the workflow pauses *again*. This gives your team a chance to check the database logs, make sure the schema looks healthy, and explicitly click **Approve** a second time to officially route live traffic to the new Cloud Run revision.



### (Optional) Configure `staging` and `dev`

You don't need required reviewers for these, but inside the `staging` environment settings, you can check **Deployment branches** and select **Selected branches** -> add `main`. This ensures that even if someone manages to run a manual `workflow_dispatch`, the staging environment secrets (like `DATABASE_URL`) can only be accessed by code originating from `main`.