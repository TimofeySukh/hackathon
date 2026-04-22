#!/usr/bin/env bash

set -Eeuo pipefail

REPO_URL="${REPO_URL:-https://github.com/TimofeySukh/hackathon.git}"
BRANCH="${BRANCH:-main}"
BASE_DIR="${BASE_DIR:-$HOME/apps/social-datanode-live-autodeploy}"
REPO_DIR="${REPO_DIR:-$BASE_DIR/repo}"
LIVE_DIR="${LIVE_DIR:-$HOME/apps/social-datanode-live}"
LOCK_FILE="${LOCK_FILE:-$BASE_DIR/deploy.lock}"
STATE_FILE="${STATE_FILE:-$BASE_DIR/deployed.sha}"
LOG_PREFIX="[social-datanode-live-autodeploy]"

mkdir -p "$BASE_DIR"

exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  echo "$LOG_PREFIX another deploy is already running"
  exit 0
fi

remote_sha="$(git ls-remote --exit-code "$REPO_URL" "refs/heads/$BRANCH" | awk '{print $1}')"
current_sha=""

if [[ -f "$STATE_FILE" ]]; then
  current_sha="$(tr -d '\n' < "$STATE_FILE")"
fi

if [[ "$remote_sha" == "$current_sha" && -d "$LIVE_DIR" ]]; then
  echo "$LOG_PREFIX already up to date at $remote_sha"
  exit 0
fi

if [[ ! -d "$REPO_DIR/.git" ]]; then
  git clone --depth 1 --branch "$BRANCH" "$REPO_URL" "$REPO_DIR"
else
  git -C "$REPO_DIR" fetch --depth 1 origin "$BRANCH"
fi

git -C "$REPO_DIR" checkout --force "$remote_sha"
git -C "$REPO_DIR" clean -fdx

cd "$REPO_DIR"
if [[ -f "$BASE_DIR/deploy.env" ]]; then
  set -a
  source "$BASE_DIR/deploy.env"
  set +a
fi

npm ci --prefer-offline --no-audit
npm run build

tmp_dir="$(mktemp -d "$BASE_DIR/live.XXXXXX")"
trap 'rm -rf "$tmp_dir"' EXIT

cp "$REPO_DIR/deploy/social-datanode-live/Dockerfile" "$tmp_dir/"
cp "$REPO_DIR/deploy/social-datanode-live/compose.yaml" "$tmp_dir/"
cp "$REPO_DIR/deploy/social-datanode-live/nginx.conf" "$tmp_dir/"
cp -a "$REPO_DIR/dist" "$tmp_dir/dist"

mkdir -p "$LIVE_DIR"
rm -rf "$LIVE_DIR"/Dockerfile "$LIVE_DIR"/compose.yaml "$LIVE_DIR"/nginx.conf "$LIVE_DIR"/dist
cp -a "$tmp_dir"/. "$LIVE_DIR"/

docker compose -f "$LIVE_DIR/compose.yaml" up -d --build

printf '%s\n' "$remote_sha" > "$STATE_FILE"
echo "$LOG_PREFIX deployed $remote_sha"
