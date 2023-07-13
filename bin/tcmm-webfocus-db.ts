/*
 *
 * SENSITIVE BUT UNCLASSIFIED-SOURCE CODE - This entire document is considered sensitive but unclassified.
 *
 * Copyright 2022 Federal Reserve Bank of St. Louis. All Rights Reserved.
 *
 */
import { DbStack } from '../lib/db-stack';
import { App } from 'aws-cdk-lib';

const app = new App();

const env = {
  region: process.env.CDK_DEFAULT_REGION,
  account: process.env.CDK_DEFAULT_ACCOUNT
};

// Pull in the instance name supplied in the .gitlab-ci.yml file.
const instanceName = app.node.tryGetContext('instance');

/*
 * Create a DbStack. The 2nd arg (stackId) must match the name provided in
 * the deploy/destroy commands in .gitlab-ci.yml file. The 3rd arg (stackName)
 * provides the unique name of the stack deployed to AWS.
 */

new DbStack(app, 'tcmm-webfocus-database', {
  stackName: 'tcmm-webfocus-database' + instanceName,
  env
});