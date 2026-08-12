# 1) Set paths
SRC="/Users/admin/Desktop/files/programming/programming_business/MyplanMybudget/MyplanMybudget-dev/"
DST="/Users/admin/Desktop/files/programming/programming_business/proj33/MyplanMybudget-repo-git/"

# 2) Verify paths exist
ls -la "$SRC"
ls -la "$DST"

# 3) Dry run first (shows what will change)
rsync -avhn --delete \
  --exclude ".git/" \
  --exclude "node_modules/" \
  --exclude ".next/" \
  --exclude ".pnpm-store/" \
  --exclude ".env" \
  --exclude ".env.local" \
  --exclude ".DS_Store" \
  "$SRC" "$DST"

# 4) Real sync (overwrite git repo with dev repo content)
rsync -avh --delete \
  --exclude ".git/" \
  --exclude "node_modules/" \
  --exclude ".next/" \
  --exclude ".pnpm-store/" \
  --exclude ".env" \
  --exclude ".env.local" \
  --exclude ".DS_Store" \
  "$SRC" "$DST"

# 5) Install + lockfile refresh in git repo
cd "$DST"
pnpm install

# 6) Final build check
pnpm run build
