#!/bin/zsh
cd -- "${0:A:h}" || exit 1
if ! command -v python3 >/dev/null 2>&1; then
  print '请先安装 Python 3.9 或以上版本，再打开工作台。'
  read -r '?按回车关闭…'
  exit 1
fi
python3 tools/prompt-builder/versions/v15/输出/server.py --open
