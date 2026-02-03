# Agent Failure: node_modules Committed to Git History

**Date:** 2026-02-03

**Commit:** 7077dc5 (fix: optimize background effect rendering and fix shader leak)

**Agent:** GitHub Copilot Workspace Agent

**Model:** Claude 3.5 Sonnet

**Severity:** Medium

## What Happened

During the automated commit process using the `report_progress` tool, the agent accidentally committed the entire `node_modules` directory (6,699 files) and `package-lock.json` to the git repository.

## Root Cause

1. The agent ran `npm install` to install dependencies for running tests
2. When calling `report_progress`, the tool executes `git add .` which stages all untracked files
3. At that time, `.gitignore` did not contain entries for `node_modules/` or `package-lock.json`
4. The agent should have checked the staged files before committing, or added these entries to `.gitignore` before installing dependencies

## Impact

- Repository size increased significantly (temporary)
- Git history contained unnecessary dependency files in commit 7077dc5
- Required cleanup commit to remove files from git tracking

## Resolution

1. **Commit 5274244:** Added `node_modules/` and `package-lock.json` to `.gitignore`
   - However, this commit only updated .gitignore and did not actually remove the files from git
   - The `git rm --cached` command was executed but not included in the commit
2. **Follow-up commit:** Properly removed all node_modules and package-lock.json files from git tracking using `git rm -r --cached`

## Lessons Learned

1. **Always check .gitignore first:** Before installing dependencies or creating build artifacts, verify that `.gitignore` properly excludes them
2. **Review staged files:** After `git add` operations, the agent should verify what files were staged using `git status` or `git diff --cached --name-only`
3. **Validate commits:** After committing with `report_progress`, check the commit contents to ensure only intended files were included
4. **Improve report_progress workflow:** The tool should:
   - Warn about uncommonly large commits (e.g., > 100 files)
   - Show a summary of what will be committed
   - Respect .gitignore patterns even for previously committed files

## Prevention Measures

- Added to standard operating procedure: Always verify `.gitignore` contains standard patterns before installing dependencies
- Document common .gitignore patterns for JavaScript/TypeScript projects:
  ```
  node_modules/
  package-lock.json
  dist/
  build/
  *.log
  ```

## Notes

Since force push is not available in this environment, the files remain in git history in commit 7077dc5 but are removed from the working tree and future commits. The repository owner may want to perform a git history rewrite separately if needed.
