#!/bin/zsh
setopt NO_UNSET
task_root="${0:A:h}"

fail() {
  print -r -- "$1"
  if [[ -t 0 ]]; then
    print -r -- '按回车关闭此窗口。'
    read -r task_reply
  fi
  exit 1
}

[[ -f "$task_root/workbench/CURRENT" ]] || fail '找不到工作台 CURRENT 文件，请保留完整项目目录。'
task_version="${1:-$(<"$task_root/workbench/CURRENT")}"
[[ "$task_version" =~ '^v[1-9][0-9]*$' ]] || fail '工作台版本无效，应为 v1、v2、v3 等。'
task_dir="$task_root/workbench/$task_version"
[[ -f "$task_dir/server.mjs" && -f "$task_dir/package-lock.json" ]] || fail "找不到 $task_version 的完整程序和依赖锁文件。"

# Finder does not necessarily inherit the interactive shell PATH.
typeset -a task_candidates
task_candidates=( "${commands[node]:-}" /opt/homebrew/bin/node /usr/local/bin/node
  "$HOME"/.nvm/versions/node/*/bin/node(NOn) "$HOME"/.volta/bin/node
  "$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node" )
task_node=''
for task_candidate in "${task_candidates[@]}"; do
  [[ -n "$task_candidate" && -x "$task_candidate" ]] || continue
  if "$task_candidate" -e 'const [a,b]=process.versions.node.split(".").map(Number);process.exit(a>22||(a===22&&b>=13)?0:1)' >/dev/null 2>&1; then
    task_node="$task_candidate"
    break
  fi
done
[[ -n "$task_node" ]] || fail '需要 Node.js 22.13 或更新版本，请安装后再次双击。'
export PATH="${task_node:h}:$PATH"
task_npm="${task_node:h}/npm"
[[ -x "$task_npm" ]] || fail '当前 Node.js 安装中找不到 npm，请安装完整 Node.js。'
cd "$task_dir" || fail '无法进入工作台目录。'
print -r -- "正在准备画语工作台 $task_version …"

task_lock_hash=$("$task_node" --input-type=module -e 'import{readFileSync}from"node:fs";import{createHash}from"node:crypto";console.log(createHash("sha256").update(readFileSync("package-lock.json")).digest("hex"))') || fail '无法读取依赖锁文件。'
task_installed_hash=''
[[ -f node_modules/.workbench-lock ]] && task_installed_hash="$(<node_modules/.workbench-lock)"
if [[ "$task_installed_hash" != "$task_lock_hash" || ! -d node_modules/antd || ! -d node_modules/sharp ]]; then
  print -r -- '首次启动或依赖已变化，正在安装依赖（需要联网）…'
  "$task_npm" ci --no-audit --no-fund || fail '依赖安装失败，请检查网络后重新启动。'
  print -r -- "$task_lock_hash" > node_modules/.workbench-lock
fi

print -r -- '正在构建界面…'
"$task_npm" run build || fail '界面构建失败，请查看上方错误。'
print -r -- '服务就绪后会自动打开浏览器。保留此窗口即可持续使用；按 Control+C 停止。'
"$task_node" server.mjs --open
task_exit=$?
if (( task_exit != 0 && task_exit != 130 )); then fail '工作台未能启动，请查看上方错误。'; fi
