# RealEstateStack Deletion Runbook (Drift + Broken CDK/CFN Role)

**Last verified:** 2025-12-29  
**Use case:** You need to delete a CloudFormation stack created by CDK (here: `RealEstateStack`) but deletion fails due to **major drift** and/or the stack’s configured **CloudFormation service role** (`RoleARN`) has been deleted or is no longer assumable.

This runbook documents the exact procedure used in this repo to successfully delete the stack.

---

## Executive summary

When a CloudFormation stack has a `RoleARN` set (a service role CloudFormation assumes to create/update/delete resources) and that role is missing/invalid, **CloudFormation can’t do anything with the stack—including delete**. CDK destruction (`cdk destroy`) typically fails with errors like:

- `Role arn:aws:iam::<account>:role/<role-name> is invalid or cannot be assumed`

The fix is:

1. Confirm the stack’s `RoleARN` and whether termination protection is enabled.
2. Recreate the missing role with a trust policy for `cloudformation.amazonaws.com`.
3. Attach permissions sufficient to delete all stack resources (we used `AdministratorAccess` to unblock quickly).
4. Delete the stack via CloudFormation and wait for completion.
5. Optionally remove the recreated role.

---

## Preconditions

- You are logged into AWS CLI with credentials for the **correct account**.
- You have permission to manage:
  - CloudFormation stacks
  - IAM roles and role policies
- You know the target region (this case was `us-east-1`).

Recommended to set region explicitly:

```bash
export AWS_REGION=us-east-1
```

(Or pass `--region us-east-1` to each AWS CLI command.)

---

## Step 1 — Confirm the stack’s RoleARN and termination protection

Check the stack configuration:

```bash
aws cloudformation describe-stacks \
  --stack-name RealEstateStack \
  --query 'Stacks[0].{StackName:StackName,Status:StackStatus,RoleARN:RoleARN,TerminationProtection:EnableTerminationProtection}' \
  --output table
```

**What you’re looking for**

- `RoleARN` is set (non-empty). In our incident it was:

  - `arn:aws:iam::898751738669:role/cdk-hnb659fds-cfn-exec-role-898751738669-us-east-1`

- `TerminationProtection` is `False`. If it’s `True`, disable it:

```bash
aws cloudformation update-termination-protection \
  --stack-name RealEstateStack \
  --no-enable-termination-protection
```

---

## Step 2 — Confirm the referenced role is missing (or broken)

If `RoleARN` points to an IAM role, verify it exists:

```bash
aws iam get-role \
  --role-name cdk-hnb659fds-cfn-exec-role-898751738669-us-east-1
```

In this incident, it returned:

- `NoSuchEntity` (role was deleted)

If the role exists but deletion still fails, the trust policy may be wrong or permissions insufficient. See **Troubleshooting**.

---

## Step 3 — Recreate the missing CloudFormation execution role

### 3.1 Create the trust policy for CloudFormation

```bash
cat > /tmp/cdk-cfn-exec-trust.json <<'EOF'
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": { "Service": "cloudformation.amazonaws.com" },
      "Action": "sts:AssumeRole"
    }
  ]
}
EOF
```

### 3.2 Create the role (must match the exact role name in RoleARN)

```bash
aws iam create-role \
  --role-name cdk-hnb659fds-cfn-exec-role-898751738669-us-east-1 \
  --assume-role-policy-document file:///tmp/cdk-cfn-exec-trust.json \
  --description "Recreated for CloudFormation to delete drifted CDK stack"
```

### 3.3 Attach permissions

To reliably delete a drifted stack, we attached admin permissions:

```bash
aws iam attach-role-policy \
  --role-name cdk-hnb659fds-cfn-exec-role-898751738669-us-east-1 \
  --policy-arn arn:aws:iam::aws:policy/AdministratorAccess
```

Verify attachment:

```bash
aws iam list-attached-role-policies \
  --role-name cdk-hnb659fds-cfn-exec-role-898751738669-us-east-1 \
  --query 'AttachedPolicies[].PolicyArn' \
  --output table
```

**Note on IAM propagation**

IAM changes can take a short time to propagate. If the next step fails immediately, wait ~30–90 seconds and retry.

---

## Step 4 — Delete the stack via CloudFormation

Start deletion:

```bash
aws cloudformation delete-stack --stack-name RealEstateStack
```

Wait for completion:

```bash
aws cloudformation wait stack-delete-complete --stack-name RealEstateStack
```

---

## Step 5 — Verify deletion

Confirm it no longer exists:

```bash
aws cloudformation describe-stacks --stack-name RealEstateStack
```

Expected output after deletion:

- `ValidationError: Stack with id RealEstateStack does not exist`

---

## Troubleshooting

### A) `cdk destroy` fails, and CloudFormation delete fails too

This usually happens when `RoleARN` is invalid/unassumable. The procedure above is the fix.

### B) Stack delete fails due to a resource-level blocker

Common examples:

- S3 bucket not empty (CloudFormation won’t delete non-empty buckets)
- Deletion protection enabled (RDS, OpenSearch, etc.)
- Manual changes created drift that now blocks deletion

Get recent stack events:

```bash
aws cloudformation describe-stack-events \
  --stack-name RealEstateStack \
  --max-items 30
```

Then handle the specific resource issue and re-run:

```bash
aws cloudformation delete-stack --stack-name RealEstateStack
```

### C) Role exists but still “cannot be assumed”

Check trust relationship:

```bash
aws iam get-role \
  --role-name cdk-hnb659fds-cfn-exec-role-898751738669-us-east-1 \
  --query 'Role.AssumeRolePolicyDocument'
```

Ensure it includes:

- Principal: `cloudformation.amazonaws.com`
- Action: `sts:AssumeRole`

### D) Region/account mismatch

Make sure you’re operating in the same account/region as the stack. If you have multiple profiles:

```bash
aws sts get-caller-identity
```

---

## Optional cleanup (recommended)

We created a high-privilege role to unblock deletion. After the stack is gone, you can remove it:

```bash
aws iam detach-role-policy \
  --role-name cdk-hnb659fds-cfn-exec-role-898751738669-us-east-1 \
  --policy-arn arn:aws:iam::aws:policy/AdministratorAccess

aws iam delete-role \
  --role-name cdk-hnb659fds-cfn-exec-role-898751738669-us-east-1
```

If you expect to redeploy via CDK frequently, you may prefer to keep CDK bootstrap roles managed by `cdk bootstrap` rather than manually recreating them.
