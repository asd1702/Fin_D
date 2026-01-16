#!/bin/bash

# EC2 배포 스크립트

COMPOSE_FILE="docker-compose.ec2.yml"

echo "🔄 Docker 이미지 최신 버전 가져오기..."
docker compose -f ${COMPOSE_FILE} pull

echo "🚀 컨테이너 시작..."
docker compose -f ${COMPOSE_FILE} up -d

echo "📊 컨테이너 상태 확인..."
docker compose -f ${COMPOSE_FILE} ps

echo ""
echo "로그 확인: docker compose -f ${COMPOSE_FILE} logs -f"
