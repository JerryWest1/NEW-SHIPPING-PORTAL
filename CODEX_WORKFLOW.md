# Codex Workflow For Shipping Portal

This project is currently working, so changes should be made carefully and methodically.

## Golden Rule

Do not make experimental changes directly on `main`.

Use this flow every time:

```text
local branch -> test locally -> commit -> push branch -> review -> merge to main -> deploy
```

## Local Setup

Open the project folder in VS Code:

```powershell
C:\Users\yeruchem\CODE\NEW-SHIPPING-PORTAL
```

Install dependencies:

```powershell
npm install
```

Run the app locally:

```powershell
npm run dev
```

The local app should run at:

```text
http://localhost:3000
```

## Safe Branch Workflow

Before changing anything, check the repo state:

```powershell
git status
```

The ideal starting point is:

```text
nothing to commit, working tree clean
```

Create a new branch for each change:

```powershell
git checkout main
git pull origin main
git checkout -b codex/short-change-name
```

Examples:

```text
codex/add-shipment-filter
codex/fix-login-message
codex/update-settings-page
```

## Making Changes With Codex

For each change:

1. Describe one clear change.
2. Let Codex inspect the relevant files.
3. Make the smallest safe edit.
4. Run the app locally.
5. Check the browser.
6. Run a build if available.
7. Commit only after the change is verified.

## Testing Before Push

Run the local app:

```powershell
npm run dev
```

If the project supports a production build, run:

```powershell
npm run build
```

Do not run broad dependency repair commands like this unless we plan it carefully:

```powershell
npm audit fix --force
```

That command can make large package changes and break a working app.

## Commit And Push

After the change is tested:

```powershell
git status
git add .
git commit -m "Describe the change"
git push origin your-branch-name
```

Example:

```powershell
git push origin codex/add-shipment-filter
```

## GitHub Review

After pushing the branch:

1. Open GitHub.
2. Create a pull request from the branch into `main`.
3. Review the changed files.
4. Merge only after the local app still works.

## Deployment

Deployment depends on the hosting service.

Common patterns:

- Vercel or Netlify: merging to `main` often deploys automatically.
- Firebase: deployment may require `firebase deploy`.
- Render or Railway: GitHub pushes may trigger deploys automatically.

Before relying on automatic deployment, confirm which service is connected to this repo.

## Important AI Studio Note

Do not commit the `migrated_prompt_history` folder.

AI Studio created filenames with colons, such as:

```text
prompt_2026-02-18T18:30:22.236Z.json
```

Those filenames break Windows checkout and pull operations.
