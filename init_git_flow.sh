#!/usr/bin/env bash
set -euo pipefail

# Initializes a git repository using a simplified Git Flow workflow for the
# TrustVault project.
#
# This script creates the following branches:
#   - main: the default protected branch
#   - dev:  integration branch for ongoing development
#   - feat/initial-scaffolding: initial feature branch
#
# If GITHUB_TOKEN is set, the script will attempt to protect the main branch
# using the GitHub API for the repository Adityarajsingh2904/Walmart_Assignment.

REPO_URL="https://github.com/Adityarajsingh2904/Walmart_Assignment.git"
REPO_SLUG="Adityarajsingh2904/Walmart_Assignment"

# Initialize repo if it does not exist
if [ ! -d .git ]; then
    git init -b main
fi

# Ensure main is current branch
git checkout -B main

echo "# TrustVault" > README.md

git add README.md
git commit -m "chore: initial commit"

# Create develop branch from main
if ! git rev-parse --verify dev >/dev/null 2>&1; then
    git checkout -b dev
else
    git checkout dev
fi

# Create feature branch from develop
if ! git rev-parse --verify feat/initial-scaffolding >/dev/null 2>&1; then
    git checkout -b feat/initial-scaffolding
else
    git checkout feat/initial-scaffolding
fi

mkdir -p src
: > src/.gitkeep

git add src/.gitkeep

git commit -m "feat: add initial scaffolding"

# Set remote if not set
if ! git remote | grep -q origin; then
    git remote add origin "$REPO_URL"
fi

# Optionally push branches
# git push -u origin main dev feat/initial-scaffolding

# Protect the main branch using GitHub API if token is available
if [ -n "${GITHUB_TOKEN:-}" ]; then
    echo "Enabling branch protection for main"
    curl -L -X PUT \
        -H "Authorization: token $GITHUB_TOKEN" \
        -H "Accept: application/vnd.github+json" \
        "https://api.github.com/repos/$REPO_SLUG/branches/main/protection" \
        -d '{"required_status_checks":null,"enforce_admins":true,"required_pull_request_reviews":null,"restrictions":null}'
fi
