/*
 *
 * SENSITIVE BUT UNCLASSIFIED-SOURCE CODE - This entire document is considered sensitive but unclassified.
 *
 * Copyright 2022 Federal Reserve Bank of St. Louis. All Rights Reserved.
 *
 * Author: H1SXF01
 */
import { aws_ec2 as ec2, Stack, CfnOutput } from 'aws-cdk-lib';
import { Construct } from 'constructs';

export interface ContextProps {
    readonly internalIp: string[],
    readonly name: string,
    readonly port: number,
    readonly multiAz: boolean,
    readonly allocatedStorage: number,
    readonly backupRetention: number,
    readonly deleteAutomatedBackups: boolean,
    readonly deletionProtection: boolean,
    readonly removalPolicy: string,
    readonly log_min_error_statement: string,
    readonly log_min_messages: string,
    readonly pgaudit_log_level: string,
    readonly rds_force_admin_logging_level: string
}

/**
 *
 * @param {Construct} scope used to find context
 * @param {string} key used to find context
 * @return {any} lookup context variable
 */
export function getRequiredContext (scope: Construct, key: string): any {
  return scope.node.tryGetContext(key);
}

/**
 * Looks up existing Vpc, cannot create a new one
 * @param {Stack} stack used to lookup vpc
 * @return {ec2.IVpc} existing vpc
 */
export function lookupVpc (stack: Stack): ec2.IVpc {
  return ec2.Vpc.fromLookup(stack, 'Vpc', {
    isDefault: false
  });
}

/**
 * This creates a security group attached to the load balancer allowing
 * internal FRB network connection
 * @param {Stack} stack passed for lib directory
 * @param {ec2.IVpc} vpc existing vpc passed
 * @param {ContextProps} context that contains port and ingress rules
 * @return {ec2.SecurityGroup} with appropriate rules
 */
export function createSecurityGroup (stack: Stack, vpc: ec2.IVpc,
  context: ContextProps): ec2.SecurityGroup {
  const securityGroup = new ec2.SecurityGroup(stack, stack.stackName + 'SecurityGroup', {
    vpc: vpc
  });

  context.internalIp.forEach((cidrBlock: string) =>
    securityGroup.addIngressRule(ec2.Peer.ipv4(cidrBlock), ec2.Port.tcp(context.port))
  );

  securityGroup.addIngressRule(
    ec2.Peer.ipv4(vpc.vpcCidrBlock),
    ec2.Port.tcp(context.port),
    'allow traffic from VPC'
  );

  new CfnOutput(stack, 'SecurityGroup', {
    value: securityGroup.securityGroupId,
    exportName: `${stack.stackName}-SecurityGroup`
  });
  return securityGroup;
}

/**
 *
 * @param {Stack} stack passed in
 * @param {string} context environment variable lookup
 * @return {string} env variable
 */
export function lookupEnvVariable (stack: Stack, context: string): string {
  const contextEnv = stack.node.tryGetContext(context);
  if (contextEnv === undefined || contextEnv === null) {
    throw Error(context + ' is null.')
  } else {
    return context === 'awsEnv' ? formatAwsEnv(contextEnv) : contextEnv;
  }
}

/**
 * This formats the AWS Environment variable to match to the gitlab runners
 * @param {string} awsEnv that stack is running
 * @return {string} environment matching to gitlab runner
 */
export function formatAwsEnv (awsEnv: string): string {
  return (awsEnv === 'dev') ? awsEnv : awsEnv.replace('tcmm', '');
}


