#!/bin/bash
set -euo pipefail

# Log everything to a file for debugging via SSM
exec > >(tee /var/log/runner-setup.log) 2>&1
echo "=== GitHub Actions Runner Setup ==="
echo "Started at: $(date -u)"

# Install dependencies
dnf update -y
dnf install -y docker git jq tar gzip curl unzip

# Install Node.js 20 (for running builds)
curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -
dnf install -y nodejs

# Install Terraform
TERRAFORM_VERSION="1.12.1"
curl -fsSL "https://releases.hashicorp.com/terraform/$${TERRAFORM_VERSION}/terraform_$${TERRAFORM_VERSION}_linux_amd64.zip" -o /tmp/terraform.zip
unzip /tmp/terraform.zip -d /usr/local/bin/
rm /tmp/terraform.zip
terraform --version

# Install AWS CLI v2
curl -fsSL "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o /tmp/awscliv2.zip
unzip /tmp/awscliv2.zip -d /tmp/
/tmp/aws/install
rm -rf /tmp/awscliv2.zip /tmp/aws
aws --version

# Start and enable Docker
systemctl start docker
systemctl enable docker

# Create runner user
useradd -m -s /bin/bash runner
usermod -aG docker runner

# Set up GitHub Actions runner
RUNNER_DIR="/home/runner/actions-runner"
mkdir -p "$RUNNER_DIR"
cd "$RUNNER_DIR"

# Download and extract runner
RUNNER_VERSION="${runner_version}"
curl -fsSL "https://github.com/actions/runner/releases/download/v$${RUNNER_VERSION}/actions-runner-linux-x64-$${RUNNER_VERSION}.tar.gz" -o runner.tar.gz
tar xzf runner.tar.gz
rm runner.tar.gz

# Install runner dependencies
./bin/installdependencies.sh

# Set ownership
chown -R runner:runner "$RUNNER_DIR"

# Configure the runner
sudo -u runner ./config.sh \
  --url "https://github.com/${github_owner}/${github_repo}" \
  --token "${github_runner_token}" \
  --name "${runner_name}" \
  --labels "${runner_labels}" \
  --unattended \
  --replace

# Install and start as a service
./svc.sh install runner
./svc.sh start

echo "=== GitHub Actions Runner Setup Complete ==="
echo "Finished at: $(date -u)"
