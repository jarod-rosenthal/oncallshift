import { DataSource } from 'typeorm';
import { getDbConfig } from './config';

// Import entities
import { Organization } from '../models/Organization';
import { User } from '../models/User';
import { Team } from '../models/Team';
import { TeamMembership } from '../models/TeamMembership';
import { Service } from '../models/Service';
import { Schedule } from '../models/Schedule';
import { ScheduleMember } from '../models/ScheduleMember';
import { ScheduleOverride } from '../models/ScheduleOverride';
import { ScheduleLayer } from '../models/ScheduleLayer';
import { ScheduleLayerMember } from '../models/ScheduleLayerMember';
import { UserContactMethod } from '../models/UserContactMethod';
import { UserNotificationRule } from '../models/UserNotificationRule';
import { AlertRoutingRule } from '../models/AlertRoutingRule';
import { Alert } from '../models/Alert';
import { AlertGroupingRule } from '../models/AlertGroupingRule';
import { PriorityLevel } from '../models/PriorityLevel';
import { BusinessService } from '../models/BusinessService';
import { ServiceDependency } from '../models/ServiceDependency';
import { EscalationPolicy } from '../models/EscalationPolicy';
import { EscalationStep } from '../models/EscalationStep';
import { EscalationTarget } from '../models/EscalationTarget';
import { Incident } from '../models/Incident';
import { IncidentEvent } from '../models/IncidentEvent';
import { Notification } from '../models/Notification';
import { DeviceToken } from '../models/DeviceToken';
import { Runbook } from '../models/Runbook';
import { MaintenanceWindow } from '../models/MaintenanceWindow';
import { Integration } from '../models/Integration';
import { IntegrationEvent } from '../models/IntegrationEvent';
import { IntegrationOAuthToken } from '../models/IntegrationOAuthToken';
import { ServiceIntegration } from '../models/ServiceIntegration';
import { EventTransformRule } from '../models/EventTransformRule';
import { Tag } from '../models/Tag';
import { EntityTag } from '../models/EntityTag';
import { Heartbeat } from '../models/Heartbeat';
import { ChangeEvent } from '../models/ChangeEvent';
import { WebhookRequest } from '../models/WebhookRequest';
import { ShiftHandoffNote } from '../models/ShiftHandoffNote';
import { IncidentResponder } from '../models/IncidentResponder';
import { StatusPage } from '../models/StatusPage';
import { StatusPageService } from '../models/StatusPageService';
import { StatusPageSubscriber } from '../models/StatusPageSubscriber';
import { StatusPageUpdate } from '../models/StatusPageUpdate';
import { IncidentWorkflow } from '../models/IncidentWorkflow';
import { WorkflowAction } from '../models/WorkflowAction';
import { WorkflowExecution } from '../models/WorkflowExecution';
import { TeamMemberRole } from '../models/TeamMemberRole';
import { ObjectPermission } from '../models/ObjectPermission';
import { WebhookSubscription } from '../models/WebhookSubscription';
import { IncidentReport } from '../models/IncidentReport';
import { ReportExecution } from '../models/ReportExecution';
import { IncidentSubscriber } from '../models/IncidentSubscriber';
import { IncidentStatusUpdate } from '../models/IncidentStatusUpdate';
import { ConferenceBridge } from '../models/ConferenceBridge';
import { Postmortem } from '../models/Postmortem';
import { PostmortemTemplate } from '../models/PostmortemTemplate';
import { NotificationBundle } from '../models/NotificationBundle';

export async function createDataSource(): Promise<DataSource> {
  const dbConfig = await getDbConfig();

  const dataSource = new DataSource({
    type: 'postgres',
    host: dbConfig.host,
    port: dbConfig.port,
    username: dbConfig.username,
    password: dbConfig.password,
    database: dbConfig.database,
    ssl: dbConfig.ssl ? { rejectUnauthorized: false } : false,
    synchronize: process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'dev', // Auto-create tables in dev, use migrations in production
    logging: process.env.NODE_ENV === 'development',
    entities: [
      Organization,
      User,
      Team,
      TeamMembership,
      Service,
      Schedule,
      ScheduleMember,
      ScheduleOverride,
      ScheduleLayer,
      ScheduleLayerMember,
      UserContactMethod,
      UserNotificationRule,
      AlertRoutingRule,
      Alert,
      AlertGroupingRule,
      PriorityLevel,
      BusinessService,
      ServiceDependency,
      EscalationPolicy,
      EscalationStep,
      EscalationTarget,
      Incident,
      IncidentEvent,
      Notification,
      DeviceToken,
      Runbook,
      MaintenanceWindow,
      Integration,
      IntegrationEvent,
      IntegrationOAuthToken,
      ServiceIntegration,
      EventTransformRule,
      Tag,
      EntityTag,
      Heartbeat,
      ChangeEvent,
      WebhookRequest,
      ShiftHandoffNote,
      IncidentResponder,
      StatusPage,
      StatusPageService,
      StatusPageSubscriber,
      StatusPageUpdate,
      IncidentWorkflow,
      WorkflowAction,
      WorkflowExecution,
      TeamMemberRole,
      ObjectPermission,
      WebhookSubscription,
      IncidentReport,
      ReportExecution,
      IncidentSubscriber,
      IncidentStatusUpdate,
      ConferenceBridge,
      Postmortem,
      PostmortemTemplate,
      NotificationBundle,
    ],
    migrations: ['src/shared/db/migrations/*.ts'],
    subscribers: [],
  });

  return dataSource;
}

// Global data source instance
let appDataSource: DataSource | null = null;

export async function getDataSource(): Promise<DataSource> {
  if (!appDataSource) {
    appDataSource = await createDataSource();
    await appDataSource.initialize();
  }
  return appDataSource;
}

export async function closeDataSource(): Promise<void> {
  if (appDataSource?.isInitialized) {
    await appDataSource.destroy();
    appDataSource = null;
  }
}
