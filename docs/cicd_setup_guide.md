# GitHub Secrets 설정 가이드

자동 배포를 활성화하려면 GitHub 저장소에 아래 Secrets를 등록해야 합니다.

1. GitHub에서 프로젝트 저장소로 이동합니다.
2. **Settings** > **Secrets and variables** > **Actions**를 클릭합니다.
3. 아래 항목마다 **New repository secret**을 클릭하여 값을 등록합니다.

| Secret 이름 | 설명 | 입력할 값 |
| :--- | :--- | :--- |
| `DOCKER_USERNAME` | Docker Hub ID | Docker Hub ID (예: `asd1702`) |
| `DOCKER_PASSWORD` | Docker Hub 토큰 | Docker Hub 비밀번호 또는 액세스 토큰 |
| `EC2_HOST` | 서버 주소 | EC2 인스턴스의 공개 IP |
| `EC2_USER` | 서버 사용자 이름 | `ubuntu` (AMI에 따라 `ec2-user`) |
| `EC2_SSH_KEY` | SSH 개인 키 | `.pem` 키 파일의 **전체 내용**<br>(`-----BEGIN RSA PRIVATE KEY-----`로 시작) |

> [!TIP]
> **EC2 SSH Key 확인 방법**
>
> 로컬에서 키 파일의 내용을 확인한 후 복사할 수 있습니다.
> 이 키는 절대로 다른 사람과 공유하지 마세요.

## 다음 단계

Secrets 등록을 완료한 후 다음 절차를 진행합니다.

1. 변경 사항을 `main` 브랜치에 **Push**합니다.
2. GitHub의 **Actions** 탭에서 배포 진행 상황을 확인합니다.
