#!/bin/zsh
set -e
cd -- "$(dirname -- "$0")"
if ! command -v node >/dev/null || ! command -v npm >/dev/null; then
  print '请先安装 Node.js 22 或更高版本，再打开工作台。'
  read '?按回车退出…'
  exit 1
fi
node -e 'if(Number(process.versions.node.split(".")[0])<22){console.error("需要 Node.js 22 或更高版本");process.exit(1)}'
if [[ ! -d node_modules ]]; then npm ci --no-audit --no-fund; fi
(
  for attempt in {1..30}; do
    if curl -fsS http://127.0.0.1:4317/api/rules >/dev/null 2>&1; then
      open http://127.0.0.1:4317
      exit
    fi
    sleep 1
  done
) &
npm run dev
