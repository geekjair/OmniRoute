#!/bin/bash
set -euo pipefail

# 阿里云 ACR 个人版推送脚本
# 用法：./scripts/docker-push-aliyun.sh [base|web|all]

REGISTRY="crpi-vt792787r1mllnzl.cn-hangzhou.personal.cr.aliyuncs.com"
NAMESPACE="memos-wj"
REPO="omniroute"
TARGET="${1:-all}"

login() {
  echo "==> 登录阿里云镜像仓库..."
  docker login --username=py_wj@163.com "${REGISTRY}"
}

build_and_push() {
  local target="$1"
  local tag="$2"
  local full_tag="${REGISTRY}/${NAMESPACE}/${REPO}:${tag}"

  echo "==> 构建 ${target} -> ${full_tag}"
  docker build --target "${target}" -t "${full_tag}" .

  echo "==> 推送 ${full_tag}"
  docker push "${full_tag}"
}

main() {
  login

  case "${TARGET}" in
    base)
      build_and_push runner-base base
      build_and_push runner-base latest
      ;;
    web)
      build_and_push runner-web web
      ;;
    all)
      build_and_push runner-base base
      build_and_push runner-base latest
      build_and_push runner-web web
      ;;
    *)
      echo "用法: $0 [base|web|all]"
      exit 1
      ;;
  esac

  echo "==> 推送完成"
}

main
