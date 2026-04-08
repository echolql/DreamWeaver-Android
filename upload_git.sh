#!/bin/bash

# Configuration
REMOTE="origin"
BRANCH="main"      # Change to 'master' if using the old naming convention
BATCH_SIZE=50      # Number of commits per push

# Get the total number of commits
TOTAL_COMMITS=$(git rev-list --count HEAD)
echo "Total commits to push: $TOTAL_COMMITS"

# Loop through the commits in chunks
for (( i=$BATCH_SIZE; i<=$TOTAL_COMMITS; i+=$BATCH_SIZE )); do
    # Get the hash of the commit at the current index
    COMMIT_HASH=$(git log --reverse --pretty=format:%H | sed -n "${i}p")
    
    echo "Pushing up to commit $i: $COMMIT_HASH..."
    git push $REMOTE $COMMIT_HASH:refs/heads/$BRANCH
done

# Final push to ensure the very last remaining commits and tags are sent
echo "Performing final push..."
git push $REMOTE $BRANCH
