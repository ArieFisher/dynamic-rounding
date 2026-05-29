---
trigger: always_on
---

# Git Workflow

## **1\. Branching & Staging**

* **Feature branches only.** Never edit main.  
* **Trigger:** If on main or no branch exists, create one.  
* **Safety:** Before switching, if the tree is "dirty," **stash** changes first.  
* **Commit Command:** When told to "commit all," use git add \-A && git commit \-m "...".

## **2\. Sync & Cleanup**

Run this to refresh main and force-delete local branches already merged/gone on origin:

Bash  
git checkout main && git pull \--prune \--ff-only origin main  
git for-each-ref \--format='%(refname:short) %(upstream:track)' refs/heads/ \\  
  | awk '$2 \== "\[gone\]" {print $1}' \\  
  | xargs \-r git branch \-D

## **3\. Quick Reference**

| Phase | Command |
| :---- | :---- |
| **Start** | git checkout main && git pull origin main && git checkout \-b \<name\> |
| **Work** | git add \-A && git commit \-m "..." && git push \-u origin \<name\> |
| **Ship** | gh pr create \--fill && gh pr merge \--auto \--squash \--delete-branch |
| **Reset** | Run the **Cleanup** script in Section 2\. |