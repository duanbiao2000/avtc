#!/usr/bin/env bash
#
# 一条命令把本仓库准备好并推到 GitHub。
#
#   scripts/git-push.sh --name "你的名字" --email "you@example.com" \
#                       --remote git@github.com:<账号>/avtc.git
#
# 为什么需要这个脚本：
#   工作区快照不会保留 .git/config（那里存放 git 身份与 remote 地址），
#   因此这两项在下一次会话里会丢失。本脚本做成幂等，重复执行安全。
#
# 它会依次做四件事：
#   1. 写入 git 身份（仅在传了 --name / --email 时）
#   2. 把仍是占位身份的历史提交改成你的身份（--amend --reset-author）
#   3. 设置 origin（仅在传了 --remote 时；已存在则替换）
#   4. 跑 npm run verify 自检，然后 git push -u origin <分支>
#
# 可选参数：
#   --branch <名称>     默认 main
#   --skip-verify       跳过自检（仅在你已确认 verify 通过时使用）
#   --no-push           只做准备与自检，不推送
#   -h | --help         显示帮助
#
set -euo pipefail

NAME=""
EMAIL=""
REMOTE=""
BRANCH="main"
SKIP_VERIFY=0
DO_PUSH=1

die() { printf '\n\033[1;31m错误：\033[0m%s\n' "$1" >&2; exit 1; }
step() { printf '\n\033[1;34m▸\033[0m %s\n' "$1"; }
ok() { printf '  \033[1;32m✓\033[0m %s\n' "$1"; }
info() { printf '  · %s\n' "$1"; }

usage() {
  sed -n '2,24p' "$0" | sed 's/^# \{0,1\}//'
  exit 0
}

while [ $# -gt 0 ]; do
  case "$1" in
    --name) NAME="${2:-}"; shift 2 ;;
    --email) EMAIL="${2:-}"; shift 2 ;;
    --remote) REMOTE="${2:-}"; shift 2 ;;
    --branch) BRANCH="${2:-}"; shift 2 ;;
    --skip-verify) SKIP_VERIFY=1; shift ;;
    --no-push) DO_PUSH=0; shift ;;
    -h | --help) usage ;;
    *) die "未知参数：$1（用 --help 查看用法）" ;;
  esac
done

# 脚本位于 <repo>/scripts/，仓库根在上一层
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

command -v git >/dev/null || die "找不到 git"
git rev-parse --git-dir >/dev/null 2>&1 || die "$REPO_ROOT 不是 git 仓库"

step "检查仓库状态"
info "路径：$REPO_ROOT"
info "分支：$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo '(无提交)')"
if [ -n "$(git status --porcelain)" ]; then
  printf '  \033[1;33m!\033[0m 有未提交的改动：\n'
  git status --short | sed 's/^/      /'
  printf '  \033[1;33m!\033[0m 这些改动不会进入推送。先提交，或用 git stash 暂存。\n'
else
  ok "工作区干净"
fi

if [ -n "$NAME" ] || [ -n "$EMAIL" ]; then
  step "写入 git 身份"
  [ -n "$NAME" ] && git config user.name "$NAME" && ok "user.name = $NAME"
  [ -n "$EMAIL" ] && git config user.email "$EMAIL" && ok "user.email = $EMAIL"
fi

step "检查提交作者"
if ! git rev-parse HEAD >/dev/null 2>&1; then
  info "还没有任何提交，将在推送前保留现状（如需首次提交请自行 git add/commit）"
else
  CURRENT_EMAIL="$(git log -1 --format='%ae')"
  if [ "$CURRENT_EMAIL" = "you@example.com" ]; then
    if [ -n "$NAME" ] && [ -n "$EMAIL" ]; then
      git commit --amend --reset-author --no-edit -q
      ok "占位作者已改为 $(git log -1 --format='%an <%ae>')"
    else
      printf '  \033[1;33m!\033[0m 提交作者仍是占位身份 AVTC <you@example.com>\n'
      info "修掉它：加上 --name 与 --email 重跑本脚本，或手动执行"
      info "  git commit --amend --reset-author --no-edit"
    fi
  else
    ok "作者：$(git log -1 --format='%an <%ae>')"
  fi
fi

step "检查远程仓库"
if [ -n "$REMOTE" ]; then
  if git remote get-url origin >/dev/null 2>&1; then
    git remote set-url origin "$REMOTE"
    ok "origin 已更新为 $REMOTE"
  else
    git remote add origin "$REMOTE"
    ok "origin = $REMOTE"
  fi
else
  if git remote get-url origin >/dev/null 2>&1; then
    ok "origin = $(git remote get-url origin)"
  else
    printf '  \033[1;33m!\033[0m 未设置 origin（.git/config 不在快照内，可能已丢失）\n'
    info "补上它：重跑本脚本并加 --remote git@github.com:<账号>/<仓库>.git"
    [ "$DO_PUSH" = "1" ] && die "没有远程地址，无法推送"
  fi
fi

if [ "$SKIP_VERIFY" = "0" ]; then
  step "自检（typecheck · lint · 覆盖率 · 构建 · 产物体检）"
  command -v npm >/dev/null || die "找不到 npm，无法自检（可用 --skip-verify 跳过）"
  if [ ! -d node_modules ]; then
    info "未安装依赖，先跑 npm ci（跳过 puppeteer 的 Chrome 下载）"
    PUPPETEER_SKIP_DOWNLOAD=true npm ci --no-audit --no-fund >/dev/null
  fi
  if npm run verify >/tmp/avtc-verify.log 2>&1; then
    ok "verify 通过"
    grep -E "Tests +[0-9]+ passed" /tmp/avtc-verify.log | tail -1 | sed 's/^/      /' || true
    grep -E "size \(no icons\)" /tmp/avtc-verify.log | tail -1 | sed 's/^/      /' || true
  else
    tail -30 /tmp/avtc-verify.log | sed 's/^/      /'
    die "自检失败（日志：/tmp/avtc-verify.log）。修好后重跑，或加 --skip-verify 强行推送"
  fi
else
  step "已跳过自检（--skip-verify）"
fi

if [ "$DO_PUSH" = "0" ]; then
  step "准备完成（--no-push，未推送）"
  info "推送：git push -u origin $BRANCH"
  exit 0
fi

step "推送到 origin/$BRANCH"
git push -u origin "$BRANCH"

step "完成"
ok "已推送。若要用 GitHub Pages 托管隐私政策："
info "仓库 → Settings → Pages → Source: Deploy from a branch → Branch: $BRANCH, Folder: /docs → Save"
info "约 1 分钟后访问 https://<账号>.github.io/<仓库名>/privacy.html"
info "注意：GitHub Free 个人账号的 Pages 只能从公开仓库发布，详见 README"
info "把这个地址填进 Chrome 网上应用店后台的「隐私政策网址」"
