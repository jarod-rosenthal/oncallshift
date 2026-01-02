# VPC Consolidation Plan

**Date:** January 2, 2026
**Status:** DRAFT - Awaiting Approval
**Estimated Savings:** ~$53/month ($636/year)

## Problem Summary

OnCallShift has **2 VPCs** with identical names and configurations:

| VPC ID | Status | Resources | Terraform State |
|--------|--------|-----------|-----------------|
| `vpc-0372f77950a1aabef` | **ACTIVE** | ALB, RDS, ECS, 6 VPC Endpoints | ❌ NOT MANAGED |
| `vpc-08282fa721995e7e8` | **ORPHANED** | Empty (no workloads) | ✅ In State |

### Root Cause
Terraform state became desynchronized from AWS reality. The active VPC was likely created outside of Terraform or the state was corrupted/replaced.

### Impact
- **Cost:** ~$53/month wasted on duplicate NAT Gateway + VPC Endpoints
- **Risk:** `terraform apply` could destroy production resources or create conflicts
- **Confusion:** Duplicate resources make debugging difficult

---

## Resources to Delete (Orphaned VPC)

All resources in `vpc-08282fa721995e7e8`:

| Resource Type | Resource ID | Monthly Cost |
|---------------|-------------|--------------|
| NAT Gateway | `nat-094b485531bd4a668` | ~$32 |
| VPC Endpoint (ECR API) | `vpce-07e2ff40fadd4f603` | ~$7 |
| VPC Endpoint (ECR DKR) | `vpce-044ed9ada99ee51a5` | ~$7 |
| VPC Endpoint (Logs) | `vpce-0f76c602ad25205ad` | ~$7 |
| VPC Endpoint (S3) | `vpce-032dfe7b8db5a726b` | Free |
| Internet Gateway | `igw-0c5966fa0f4baf3a7` | Free |
| Subnets (4) | subnet-09b32328c516f6c25, etc. | Free |
| Security Groups (5) | sg-042379676eeb8f86c, etc. | Free |
| Route Tables | (associated with subnets) | Free |
| Elastic IP | (associated with NAT) | Free if attached |
| VPC | `vpc-08282fa721995e7e8` | Free |

**Total Monthly Savings: ~$53**

---

## Consolidation Steps

### Phase 1: Preparation (No Changes Yet)

#### Step 1.1: Take Snapshots
```bash
# Create RDS snapshot (safety backup)
aws rds create-db-snapshot \
  --db-instance-identifier pagerduty-lite-dev \
  --db-snapshot-identifier pre-vpc-consolidation-$(date +%Y%m%d) \
  --region us-east-1
```

#### Step 1.2: Document Current State
```bash
# Export current Terraform state
cd infrastructure/terraform/environments/dev
terraform state pull > terraform-state-backup-$(date +%Y%m%d).json

# List all resources in both VPCs
aws ec2 describe-vpc-attribute --vpc-id vpc-0372f77950a1aabef --attribute enableDnsHostnames
aws ec2 describe-vpc-attribute --vpc-id vpc-08282fa721995e7e8 --attribute enableDnsHostnames
```

#### Step 1.3: Verify No Active Workloads in Orphaned VPC
```bash
# Check for any ENIs (would indicate active resources)
aws ec2 describe-network-interfaces \
  --filters "Name=vpc-id,Values=vpc-08282fa721995e7e8" \
  --query 'NetworkInterfaces[*].{ENI:NetworkInterfaceId,Type:InterfaceType,Description:Description}' \
  --output table
```

---

### Phase 2: Fix Terraform State

#### Step 2.1: Remove Orphaned VPC from State

First, remove all resources pointing to the orphaned VPC from Terraform state:

```bash
cd infrastructure/terraform/environments/dev

# Remove networking module resources from state (orphaned VPC)
terraform state rm module.networking.aws_vpc.main
terraform state rm module.networking.aws_internet_gateway.main
terraform state rm module.networking.aws_nat_gateway.main[0]
terraform state rm module.networking.aws_eip.nat[0]
terraform state rm module.networking.aws_subnet.public[0]
terraform state rm module.networking.aws_subnet.public[1]
terraform state rm module.networking.aws_subnet.private[0]
terraform state rm module.networking.aws_subnet.private[1]
terraform state rm module.networking.aws_route_table.public
terraform state rm module.networking.aws_route_table.private[0]
terraform state rm module.networking.aws_route_table.private[1]
terraform state rm module.networking.aws_route_table_association.public[0]
terraform state rm module.networking.aws_route_table_association.public[1]
terraform state rm module.networking.aws_route_table_association.private[0]
terraform state rm module.networking.aws_route_table_association.private[1]
terraform state rm module.networking.aws_vpc_endpoint.s3[0]
terraform state rm module.networking.aws_vpc_endpoint.ecr_api[0]
terraform state rm module.networking.aws_vpc_endpoint.ecr_dkr[0]
terraform state rm module.networking.aws_vpc_endpoint.logs[0]
terraform state rm module.networking.aws_security_group.vpc_endpoints[0]
terraform state rm module.networking.aws_security_group.alb
terraform state rm module.networking.aws_security_group.ecs_tasks
terraform state rm module.networking.aws_security_group.rds
```

#### Step 2.2: Import Active VPC Resources

Import the ACTIVE VPC (`vpc-0372f77950a1aabef`) and its resources:

```bash
# Import VPC
terraform import module.networking.aws_vpc.main vpc-0372f77950a1aabef

# Import Internet Gateway
terraform import module.networking.aws_internet_gateway.main igw-0dc6bb921948e6837

# Import NAT Gateway and EIP
terraform import module.networking.aws_nat_gateway.main[0] nat-016c1b34cb9b8a131
# Get EIP allocation ID first:
aws ec2 describe-addresses --filters "Name=tag:Name,Values=pagerduty-lite-dev-nat-eip-1" --query 'Addresses[?AssociationId!=null].AllocationId' --output text
terraform import module.networking.aws_eip.nat[0] <ALLOCATION_ID>

# Import Subnets (get IDs from active VPC)
terraform import module.networking.aws_subnet.public[0] subnet-0ea203a8421d7d0b5
terraform import module.networking.aws_subnet.public[1] subnet-0eef257776df38f01
terraform import module.networking.aws_subnet.private[0] subnet-0e8291b64fe3aa422
terraform import module.networking.aws_subnet.private[1] subnet-0363d44b434d7a20d

# Import Route Tables (need to find IDs)
aws ec2 describe-route-tables --filters "Name=vpc-id,Values=vpc-0372f77950a1aabef" --query 'RouteTables[*].{RouteTableId:RouteTableId,Name:Tags[?Key==`Name`].Value|[0]}' --output table
# Then import each:
terraform import module.networking.aws_route_table.public <PUBLIC_RT_ID>
terraform import module.networking.aws_route_table.private[0] <PRIVATE_RT_1_ID>
terraform import module.networking.aws_route_table.private[1] <PRIVATE_RT_2_ID>

# Import Route Table Associations (get association IDs)
# terraform import module.networking.aws_route_table_association.public[0] <SUBNET_ID>/<RT_ID>

# Import VPC Endpoints
terraform import module.networking.aws_vpc_endpoint.s3[0] vpce-09693d93ba59eb719
terraform import module.networking.aws_vpc_endpoint.ecr_api[0] vpce-0e2e5dee8b3dab015
terraform import module.networking.aws_vpc_endpoint.ecr_dkr[0] vpce-033a6bc6a1cc23acc
terraform import module.networking.aws_vpc_endpoint.logs[0] vpce-0471da8794bc6223c

# Import Security Groups
aws ec2 describe-security-groups --filters "Name=vpc-id,Values=vpc-0372f77950a1aabef" --query 'SecurityGroups[*].{GroupId:GroupId,GroupName:GroupName}' --output table
terraform import module.networking.aws_security_group.alb <ALB_SG_ID>
terraform import module.networking.aws_security_group.ecs_tasks <ECS_SG_ID>
terraform import module.networking.aws_security_group.rds <RDS_SG_ID>
terraform import module.networking.aws_security_group.vpc_endpoints[0] <VPCE_SG_ID>
```

#### Step 2.3: Verify State is Correct
```bash
terraform plan
# Should show minimal or no changes if imports are correct
```

---

### Phase 3: Delete Orphaned Resources

Once Terraform state is correct, delete the orphaned VPC resources:

```bash
# Order matters - delete dependencies first

# 1. Delete NAT Gateway (takes 1-2 min)
aws ec2 delete-nat-gateway --nat-gateway-id nat-094b485531bd4a668 --region us-east-1
echo "Waiting for NAT Gateway deletion..."
aws ec2 wait nat-gateway-deleted --nat-gateway-ids nat-094b485531bd4a668 --region us-east-1 2>/dev/null || sleep 60

# 2. Delete VPC Endpoints
aws ec2 delete-vpc-endpoints --vpc-endpoint-ids \
  vpce-07e2ff40fadd4f603 \
  vpce-044ed9ada99ee51a5 \
  vpce-0f76c602ad25205ad \
  vpce-032dfe7b8db5a726b \
  --region us-east-1

# 3. Release Elastic IP (get allocation ID first)
aws ec2 describe-addresses --filters "Name=domain,Values=vpc" --query 'Addresses[?AssociationId==null].AllocationId' --output text
# aws ec2 release-address --allocation-id <ORPHANED_EIP_ALLOCATION_ID>

# 4. Delete Subnets
aws ec2 delete-subnet --subnet-id subnet-09b32328c516f6c25 --region us-east-1
aws ec2 delete-subnet --subnet-id subnet-0ac029065f2bce59e --region us-east-1
aws ec2 delete-subnet --subnet-id subnet-05611b6787f662350 --region us-east-1
aws ec2 delete-subnet --subnet-id subnet-00c17dd721af50453 --region us-east-1

# 5. Delete Route Tables (non-main only)
aws ec2 describe-route-tables --filters "Name=vpc-id,Values=vpc-08282fa721995e7e8" --query 'RouteTables[?Associations[0].Main!=`true`].RouteTableId' --output text
# aws ec2 delete-route-table --route-table-id <RT_ID>

# 6. Detach and Delete Internet Gateway
aws ec2 detach-internet-gateway --internet-gateway-id igw-0c5966fa0f4baf3a7 --vpc-id vpc-08282fa721995e7e8 --region us-east-1
aws ec2 delete-internet-gateway --internet-gateway-id igw-0c5966fa0f4baf3a7 --region us-east-1

# 7. Delete Security Groups (non-default)
aws ec2 delete-security-group --group-id sg-042379676eeb8f86c --region us-east-1
aws ec2 delete-security-group --group-id sg-06bbc76f9d69c62b1 --region us-east-1
aws ec2 delete-security-group --group-id sg-0ce89d0788d2aee7d --region us-east-1
aws ec2 delete-security-group --group-id sg-00e9a8ecc950d8fbe --region us-east-1
# Note: Cannot delete default SG (sg-0a3c7b407db83958d)

# 8. Delete VPC
aws ec2 delete-vpc --vpc-id vpc-08282fa721995e7e8 --region us-east-1
```

---

### Phase 4: Verify & Test

#### Step 4.1: Verify Only One VPC Remains
```bash
aws ec2 describe-vpcs --region us-east-1 \
  --query 'Vpcs[*].{VpcId:VpcId,Name:Tags[?Key==`Name`].Value|[0]}' \
  --output table

# Expected: Only vpc-0372f77950a1aabef
```

#### Step 4.2: Verify Terraform State
```bash
terraform plan
# Should show no changes
```

#### Step 4.3: Test Application
```bash
# Test API endpoint
curl -I https://oncallshift.com/api/v1/health

# Check ECS service health
aws ecs describe-services --cluster pagerduty-lite-dev \
  --services pagerduty-lite-dev-api --region us-east-1 \
  --query 'services[0].{Status:status,Running:runningCount,Desired:desiredCount}'

# Check RDS connectivity (via ECS exec)
aws ecs list-tasks --cluster pagerduty-lite-dev --service-name pagerduty-lite-dev-api --query 'taskArns[0]' --output text
# Then: aws ecs execute-command ... psql test
```

---

## Rollback Plan

If issues occur during Phase 3 (resource deletion), the orphaned VPC is independent and won't affect production. Simply stop deletion.

If issues occur during Phase 2 (state manipulation):
1. Restore Terraform state from backup:
   ```bash
   terraform state push terraform-state-backup-YYYYMMDD.json
   ```
2. RDS can be restored from pre-consolidation snapshot if needed

---

## Post-Consolidation Checklist

- [ ] Only 1 VPC exists (`vpc-0372f77950a1aabef`)
- [ ] `terraform plan` shows no changes
- [ ] API responds at https://oncallshift.com
- [ ] ECS services healthy
- [ ] RDS accessible from ECS
- [ ] CloudWatch logs flowing
- [ ] Push notifications working

---

## Additional Terraform State Issues to Address

The active VPC has **2 extra VPC endpoints** not in Terraform config:
- `vpce-0ffcb6f3fd94887a1` - Secrets Manager
- `vpce-06aff05bbf130d974` - SQS

These should be either:
1. **Imported** into Terraform (add to `modules/networking/main.tf`)
2. **Deleted** if not needed

Recommendation: Keep them and add to Terraform config for proper management.
