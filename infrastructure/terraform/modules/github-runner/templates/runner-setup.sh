#!/bin/bash
set -euo pipefail

# =============================================================================
# GitHub Actions Self-Hosted Runner Setup Script
# Project: ${project} | Environment: ${environment}
# =============================================================================

export DEBIAN_FRONTEND=noninteractive

# Log all output
exec > >(tee /var/log/runner-setup.log) 2>&1
echo "=== Runner setup started at $(date) ==="

# -----------------------------------------------------------------------------
# System packages
# -----------------------------------------------------------------------------
apt-get update -y
apt-get install -y \
  curl \
  jq \
  unzip \
  git \
  docker.io \
  awscli \
  build-essential \
  apt-transport-https \
  ca-certificates \
  gnupg \
  lsb-release \
  software-properties-common

# Enable and start Docker
systemctl enable docker
systemctl start docker

# Install Docker Compose plugin
mkdir -p /usr/local/lib/docker/cli-plugins
curl -sL "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" \
  -o /usr/local/lib/docker/cli-plugins/docker-compose
chmod +x /usr/local/lib/docker/cli-plugins/docker-compose

# Install Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

# Install Terraform
curl -fsSL https://apt.releases.hashicorp.com/gpg | gpg --dearmor -o /usr/share/keyrings/hashicorp-archive-keyring.gpg
echo "deb [signed-by=/usr/share/keyrings/hashicorp-archive-keyring.gpg] https://apt.releases.hashicorp.com $(lsb_release -cs) main" \
  > /etc/apt/sources.list.d/hashicorp.list
apt-get update -y
apt-get install -y terraform

# -----------------------------------------------------------------------------
# Create runner user
# -----------------------------------------------------------------------------
useradd -m -s /bin/bash runner
usermod -aG docker runner

# -----------------------------------------------------------------------------
# Install GitHub Actions Runner
# -----------------------------------------------------------------------------
RUNNER_DIR="/home/runner/actions-runner"
mkdir -p "$RUNNER_DIR"
cd "$RUNNER_DIR"

curl -sL "https://github.com/actions/runner/releases/download/v${runner_version}/actions-runner-linux-x64-${runner_version}.tar.gz" \
  -o actions-runner.tar.gz
tar xzf actions-runner.tar.gz
rm actions-runner.tar.gz
chown -R runner:runner "$RUNNER_DIR"

# -----------------------------------------------------------------------------
# Retrieve runner registration token from Secrets Manager
# -----------------------------------------------------------------------------
echo "=== Retrieving runner token from Secrets Manager ==="
RUNNER_TOKEN=$(aws secretsmanager get-secret-value \
  --secret-id "${secret_arn}" \
  --region "${aws_region}" \
  --query 'SecretString' \
  --output text)

# -----------------------------------------------------------------------------
# Configure the runner
# -----------------------------------------------------------------------------
echo "=== Configuring GitHub Actions runner ==="
su - runner -c "cd $RUNNER_DIR && ./config.sh \
  --url 'https://github.com/${github_owner}/${github_repo}' \
  --token '$RUNNER_TOKEN' \
  --name '${runner_name}' \
  --labels '${runner_labels}' \
  --work '_work' \
  --unattended \
  --replace"

# -----------------------------------------------------------------------------
# Install and start the runner as a systemd service
# -----------------------------------------------------------------------------
cd "$RUNNER_DIR"
./svc.sh install runner
./svc.sh start

echo "=== Runner setup completed at $(date) ==="
echo "Runner name: ${runner_name}"
echo "Labels: ${runner_labels}"
