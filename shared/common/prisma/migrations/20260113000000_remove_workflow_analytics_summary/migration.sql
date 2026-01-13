-- RemoveWorkflowAnalyticsSummary
-- Removes the workflow_analytics_summaries table as we compute analytics on-demand
-- from the workflow_blockers table instead of pre-aggregating.

DROP TABLE IF EXISTS `workflow_analytics_summaries`;
