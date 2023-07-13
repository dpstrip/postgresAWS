/*
 *
 * SENSITIVE BUT UNCLASSIFIED-SOURCE CODE - This entire document is considered sensitive but unclassified.
 *
 * Copyright 2022 Federal Reserve Bank of St. Louis. All Rights Reserved.
 *
 */

/**
 * This class defines all the custom parameter needed for the RDS parameter group
 */

export const parameters = {
    'application_name': 'TCMM',
    'auto_explain.log_analyze': '1',
    'auto_explain.log_format': 'text',
    'auto_explain.log_nested_statements': '1',
    'auto_explain.log_verbose': '1',
    'autovacuum': '1',
    'deadlock_timeout': '1000',
    'log_connections': '1',
    'log_disconnections': '1',
    'log_duration': '1',
    'log_lock_waits': 'on',
    'log_temp_files': '0',
    'log_replication_commands': '0',
    'log_rotation_size': '10240',
    'log_statement': 'none',
    'pgaudit.log': 'all',
    'pgaudit.log_parameter': '1',
    'pgaudit.role': 'rds_pgaudit',
    'shared_preload_libraries': 'pg_stat_statements,pgaudit',
    'rds.force_ssl': '0',
    'rds.log_retention_period': '10080',
    'ssl': '1',
    'timezone': 'America/New_York',
    'work_mem': '10240'
  }