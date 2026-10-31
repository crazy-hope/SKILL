#!/bin/zsh
# Finder launches this file in Terminal. Resolve paths relative to this file.
setopt NO_UNSET
task_root="${0:A:h}"

fail() {
  print -r -- "$1"
  print -r -- '按回车关闭此窗口。'
  read -r reply
  exit 1
}

[[ -f "$task_root/web/server.mjs" ]] || fail '找不到 web/server.mjs，请把启动文件留在项目根目录。'

# Finder may not inherit the PATH configured in an interactive shell.
typeset -a candidates
candidates=( "${commands[node]:-}" /opt/homebrew/bin/node /usr/local/bin/node
  "$HOME"/.nvm/versions/node/*/bin/node(NOn) "$HOME"/.volta/bin/node )
task_node=''
for candidate in "${candidates[@]}"; do
  [[ -n "$candidate" && -x "$candidate" ]] || continue
  if "$candidate" -e 'const [major,minor]=process.versions.node.split(".").map(Number);process.exit(major>22||(major===22&&minor>=13)?0:1)' >/dev/null 2>&1; then
    task_node="$candidate"
    break
  fi
done
[[ -n "$task_node" ]] || fail '需要 Node.js 22.13 或更新版本。请安装后再次双击；此脚本不会自动安装软件。'

cd "$task_root/web" || fail '无法进入工作台目录。'
print -r -- '正在启动成镜工作台，服务就绪后将自动打开浏览器…'
"$task_node" --env-file-if-exists=.env server.mjs --open
task_exit=$?
if (( task_exit != 0 && task_exit != 130 )); then
  fail '工作台未能启动，请查看上方提示。'
fi
