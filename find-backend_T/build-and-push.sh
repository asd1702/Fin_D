#!/bin/bash

# Docker Hub에 이미지 빌드 및 푸시 스크립트

DOCKER_USERNAME="${1:-asd1702}"
IMAGE_NAME="find-backend"
TAG="latest"

echo "🐳 Docker 이미지 빌드 시작..."
docker build -t ${DOCKER_USERNAME}/${IMAGE_NAME}:${TAG} .

if [ $? -ne 0 ]; then
    echo "❌ 빌드 실패"
    exit 1
fi

echo "📤 Docker Hub에 푸시..."
docker push ${DOCKER_USERNAME}/${IMAGE_NAME}:${TAG}

if [ $? -eq 0 ]; then
    echo "✅ 푸시 완료: ${DOCKER_USERNAME}/${IMAGE_NAME}:${TAG}"
else
    echo "❌ 푸시 실패. docker login을 먼저 실행하세요."
    exit 1
fi
