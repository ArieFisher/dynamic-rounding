---
trigger: always_on
---

1\. Only make changes to feature branches. 

2\. If no feature branch exists, create one before editing any files.

3\. Before creating a feature branch, always run:
   ```bash
   git checkout main
   git pull origin main
   git fetch --prune
   ```
   
   (a) This is to (a) resync from the remote main before starting work, and, 
   (b) remove references to remote branches that have been merged and deleted.

4\. After a feature branch is merged, delete it locally to avoid confusion:
   ```bash
   git branch -d feature/your-branch-name
   ```