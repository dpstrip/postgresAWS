/*
 *
 * SENSITIVE BUT UNCLASSIFIED-SOURCE CODE - This entire document is considered sensitive but unclassified.
 *
 * Copyright 2022 Federal Reserve Bank of St. Louis. All Rights Reserved.
 *
 */
import {
    aws_ec2 as ec2,
    aws_kms as kms,
    aws_rds as rds,
    aws_logs as logs,
    aws_secretsmanager as secretsmanager,
    Duration, RemovalPolicy, Stack, StackProps
  } from 'aws-cdk-lib';
  import { Construct } from 'constructs';
  import * as utils from './utils';
  import { parameters } from './parameters';
  
  /**
   * This creates the DBStack that includes the RDS instance and enables rotation on the master pwd
   */
  export class DbStack extends Stack {
    constructor (scope: Construct, id: string, props?: StackProps) {
      super(scope, id, props);
      const env = utils.lookupEnvVariable(this, 'awsEnv');
      const context: utils.ContextProps = utils.getRequiredContext(this, env);
  
      const instance = utils.lookupEnvVariable(this, 'instance');
      const vpc = utils.lookupVpc(this);
      const securityGroup = utils.createSecurityGroup(this, vpc, context)
      this.createRdsInstance(vpc, context, securityGroup, env, instance);
    }
  
    /**
     * @param {ec2.IVpc} vpc - existing vpc from lookup
     * @param {utils.ContextProps} context - values that are brought from cdk.json depending on the environment
     * @param {ec2.SecurityGroup} securityGroup - security group allowing access for internal frb
     * @param {string} awsEnv - aws env passed from gitlab-ci.yml
     * @param {string} instance - the instance namespace used to build the database name
     * @return {void}
     */
    private createRdsInstance (vpc: ec2.IVpc, context: utils.ContextProps, securityGroup: ec2.SecurityGroup,
      awsEnv: string, instance: string): void {
      const excludeCharacters = '/\'"@';
      const secret = this.createSysDbaSecret(awsEnv, context, instance, excludeCharacters);
      const version = rds.PostgresEngineVersion.VER_13_4;
      const parameterGroup = this.createParameterGroup(instance, version, context);
      const key = this.createKey(instance);
  
      const databaseInstance = new rds.DatabaseInstance(this, 'PGdatabase-' + instance, {
        engine: rds.DatabaseInstanceEngine.postgres({ version: rds.PostgresEngineVersion.VER_13_4 }),
        parameterGroup: parameterGroup,
        instanceType: ec2.InstanceType.of(ec2.InstanceClass.M5, ec2.InstanceSize.XLARGE4),
        databaseName: `${context.name}${awsEnv}${instance}`,
        instanceIdentifier: `${context.name}${awsEnv}${instance}`,
        allowMajorVersionUpgrade: false,
        autoMinorVersionUpgrade: false,
        vpc: vpc,
        vpcSubnets: {
          subnetType: ec2.SubnetType.ISOLATED
        },
        securityGroups: [securityGroup],
        allocatedStorage: context.allocatedStorage,
        maxAllocatedStorage: 200,
        preferredBackupWindow: '07:00-08:00',
        preferredMaintenanceWindow: 'Sun:11:00-Sun:12:00',
        publiclyAccessible: false,
        storageEncrypted: true,
        multiAz: context.multiAz,
        cloudwatchLogsRetention: logs.RetentionDays.ONE_WEEK,
        backupRetention: Duration.days(context.backupRetention),
        deleteAutomatedBackups: context.deleteAutomatedBackups,
        deletionProtection: context.deletionProtection,
        storageEncryptionKey: key,
        port: context.port,
        credentials: rds.Credentials.fromSecret(secret, 'sysdba'),
        removalPolicy: this.configureRemovalPolicy(context),
        storageType: rds.StorageType.GP2,
        cloudwatchLogsExports: [
          'postgresql'
        ]
      });
  
      databaseInstance.connections.allowFrom(ec2.Peer.ipv4(vpc.vpcCidrBlock), ec2.Port.tcp(context.port));
    }
  
    /**
     *
     * @param {utils.ContextProps} context passed from cdk.json
     * @return {RemovalPolicy} defined for db
     */
    private configureRemovalPolicy (context: utils.ContextProps): RemovalPolicy {
      if (context.removalPolicy === 'SNAPSHOT') {
        return RemovalPolicy.SNAPSHOT;
      } else if (context.removalPolicy === 'RETAIN') {
        return RemovalPolicy.RETAIN;
      } else {
        return RemovalPolicy.DESTROY;
      }
    }
  
    /**
     *
     * @param {string} instance passed from gitlab-ci.yml
     * @param {rds.PostgresEngineVersion} version of Postgres
     * @param {utils.ContextProps} context defined in cdk.json
     * @return {rds.ParameterGroup} with custom parameters defined
     */
    private createParameterGroup (instance: string, version: rds.PostgresEngineVersion,
      context: utils.ContextProps): rds.ParameterGroup {
      const parameterGroup = new rds.ParameterGroup(this, `parameterGroup-${instance}`, {
        engine: rds.DatabaseInstanceEngine.postgres({ version: version }),
        description: 'custom parameter group',
        parameters: parameters
      });
  
      /**
       * The original {parameters} object that's above is pulling a list of constant parameters throughout all envs.
       * Below are parameters added individually because it is different per env and the value for the parameter is
       * determined per env from cdk.json
       */
  
      parameterGroup.addParameter('log_min_error_statement', context.log_min_error_statement);
      parameterGroup.addParameter('log_min_messages', context.log_min_messages);
      parameterGroup.addParameter('pgaudit.log_level', context.pgaudit_log_level);
      parameterGroup.addParameter('rds.force_admin_logging_level', context.rds_force_admin_logging_level);
  
      return parameterGroup;
    }
  
    /**
     * @param {string} awsEnv of deployment
     * @param {utils.ContextProps} context from cdk.json
     * @param {string} instance name passed from gitlab-ci.yml
     * @param {string} excludedCharacters that shouldn't be included in pwd
     * @return {secretsmanager.Secret} secret with configured password and db info
     */
    private createSysDbaSecret (awsEnv: string, context: utils.ContextProps,
      instance: string, excludedCharacters: string): secretsmanager.Secret {
      return new secretsmanager.Secret(this, `${awsEnv}-${instance}-DatabaseSecret`, {
        secretName: `${awsEnv}/${context.name}${instance}/sysdba`,
        generateSecretString: {
          passwordLength: 14,
          secretStringTemplate: JSON.stringify({ username: 'sysdba' }),
          excludeCharacters: excludedCharacters,
          excludeNumbers: false,
          excludeUppercase: false,
          excludeLowercase: false,
          excludePunctuation: false,
          generateStringKey: 'password',
          requireEachIncludedType: true
        }
      });
    }
  
    /**
     * Create custom key for DB storage encryption
     * @param {string} instance passed from gitlab-ci.yml
     * @return {kms.Key} with key rotation enabled
     */
    private createKey (instance: string): kms.Key {
      return new kms.Key(this, `encryptionKey-${instance}`, {
        enableKeyRotation: true
      });
    }
  }