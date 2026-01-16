# GitHub Secrets Setup Guide

To enable automated deployment, you need to add the following secrets to your GitHub repository.

1. Go to your repository on GitHub.
2. Click **Settings** > **Secrets and variables** > **Actions**.
3. Click **New repository secret** for each item below.

| Secret Name | Description | Value to Enter |
| :--- | :--- | :--- |
| `DOCKER_USERNAME` | Docker Hub ID | Your Docker Hub ID (e.g., `asd1702`) |
| `DOCKER_PASSWORD` | Docker Hub Token | Your Docker Hub Password or Access Token |
| `EC2_HOST` | Server Address | The Public IP of your EC2 instance |
| `EC2_USER` | Server Username | `ubuntu` (or `ec2-user` depending on AMI) |
| `EC2_SSH_KEY` | SSH Private Key | The **entire** content of your `.pem` key file<br>(Starts with `-----BEGIN RSA PRIVATE KEY-----`) |

> [!TIP]
> **To check your EC2 SSH Key:**
> You can view the content of your key file locally to copy it.
> Do NOT share this key with anyone.

## Next Steps
Once these are saved:
1. **Push** your changes to the `main` branch.
2. The **Actions** tab in GitHub will show the deployment progress.
