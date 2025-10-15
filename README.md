# Welcome to your Lovable project

## Project info

**URL**: https://lovable.dev/projects/d8e52863-f7db-4118-a636-1de5db9c95b3

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/d8e52863-f7db-4118-a636-1de5db9c95b3) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## Documentation

Consulta el [índice de documentación](docs/README.md) para ver los archivos disponibles y las convenciones de nombres.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/d8e52863-f7db-4118-a636-1de5db9c95b3) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/tips-tricks/custom-domain#step-by-step-guide)

## CI & Branch Protection

This repo includes a GitHub Actions workflow named `ci` at `.github/workflows/ci.yml` that runs on pushes to `main` and on pull requests. It performs:
- Checkout, Node 20 setup with npm cache
- `npm ci`
- Typecheck: `tsc --noEmit`
- Lint (if present): `npm run lint --if-present`
- Tests: `vitest --run`
- Build: `npm run build`

Recommended branch protection for `main`:
- Require 1 approval review
- Require status check `ci` to pass before merging
- Optionally require up-to-date branch
