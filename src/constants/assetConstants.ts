/**
 * Shared asset taxonomy and metadata templates.
 *
 * Single source of truth — imported by AssetForm, AssetUpload, and any
 * future component that needs asset type/category/field definitions.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Asset type → category mapping (CMDB CI class hierarchy equivalent)
// ─────────────────────────────────────────────────────────────────────────────
export const ASSET_CATEGORIES: Record<string, string[]> = {
  application: [
    'Web Application',
    'Mobile Application',
    'SaaS Product',
    'Legacy Application',
    'Mainframe Application',
    'Desktop Application',
    'API/Microservice',
    'Enterprise Application',
    'COTS Package',          // explicitly for packaged COTS like SAP, Oracle EBS, Salesforce on-prem
  ],
  database: [
    'RDBMS (MySQL/PostgreSQL)',
    'RDBMS (SQL Server)',
    'RDBMS (Oracle)',
    'NoSQL (MongoDB)',
    'NoSQL (Cassandra)',
    'NoSQL (Redis)',
    'Block Storage',
    'S3 Block Storage',
    'Data Warehouse',
    'Time Series Database',
  ],
  infrastructure: [
    'Physical Server',
    'Virtual Machine',
    'Container Platform',
    'Load Balancer',
    'Network Equipment',
    'Storage System',
    'Backup System',
    'Security Appliance',
  ],
  middleware: [
    'Application Server',    // Tomcat, WebLogic, JBoss, IIS
    'Message Queue',         // RabbitMQ, ActiveMQ, IBM MQ
    'Messaging Platform',    // Kafka, Azure Service Bus, AWS SQS (event streaming scale)
    'API Gateway',           // Kong, AWS API GW, Apigee
    'File Gateway',          // MFT servers, SFTP gateways
    'Service Bus',           // WSO2, MuleSoft, Azure Service Bus ESB mode
    'Workflow Engine',       // Camunda, Activiti, Airflow
    'Integration Platform',  // MuleSoft, BizTalk, Dell Boomi
    'Cache Server',          // Redis, Memcached
    'Proxy Server',          // Nginx, HAProxy
  ],
  'cloud-service': [
    'AWS EC2',
    'AWS RDS',
    'AWS S3',
    'AWS Lambda',
    'Azure VM',
    'Azure SQL',
    'Azure Storage',
    'Google Cloud Compute',
    'Google Cloud Storage',
    'Kubernetes Service',
  ],
  'third-party-service': [
    'SaaS Platform',
    'Payment Gateway',
    'Authentication Service',
    'Monitoring Service',
    'Analytics Platform',
    'Communication Service',
    'Security Service',
    'Backup Service',
  ],
};

export const VALID_ASSET_TYPES = Object.keys(ASSET_CATEGORIES);

/** Asset types where hostname / ip_address / serial_number / location are meaningful */
export const INFRA_ASSET_TYPES = ['infrastructure', 'cloud-service'];

// ─────────────────────────────────────────────────────────────────────────────
// Enum value lists for validation
// ─────────────────────────────────────────────────────────────────────────────
export const VALID_STATUSES = ['active', 'inactive', 'deprecated', 'planned'] as const;
export const VALID_CRITICALITIES = ['high', 'medium', 'low'] as const;
export const VALID_ENVIRONMENTS = ['production', 'staging', 'development', 'test', 'dr'] as const;
export const VALID_SOURCING_TYPES = ['cots', 'custom_built', 'open_source', 'saas'] as const;
export const VALID_DATA_CLASSIFICATIONS = ['public', 'internal', 'confidential', 'restricted'] as const;

// ─────────────────────────────────────────────────────────────────────────────
// Type-specific technical specification metadata templates
//
// These define STRUCTURED fields shown in AssetForm "Technical Specs" section.
// They write to the metadata JSONB column (not new typed columns) because they
// are class-specific — a server has no "framework" and an app has no "CPU cores".
//
// Format: Record<type, Record<category | '__default__', MetadataField[]>>
// '__default__' applies to all categories of that type unless a specific
// category entry overrides it.
// ─────────────────────────────────────────────────────────────────────────────
export interface MetadataField {
  key: string;          // DB key stored in metadata JSONB
  label: string;        // Display label
  placeholder: string;
  inputType: 'text' | 'number' | 'select';
  options?: string[];   // for inputType = 'select'
  helpText?: string;
}

export const METADATA_TEMPLATES: Record<string, Record<string, MetadataField[]>> = {
  // ── Application ───────────────────────────────────────────────────────────
  application: {
    __default__: [
      { key: 'version',         label: 'Version',                    placeholder: 'e.g. 2.1.0',               inputType: 'text' },
      { key: 'language',        label: 'Primary Language',           placeholder: 'e.g. Java, Python, Node.js', inputType: 'text' },
      { key: 'framework',       label: 'Framework / Platform',       placeholder: 'e.g. Spring Boot, React, .NET 8', inputType: 'text' },
      { key: 'hosting',         label: 'Hosting / Deployment',       placeholder: 'e.g. AWS ECS, on-prem, Azure App Service', inputType: 'text' },
      { key: 'active_users',    label: 'Active Users',               placeholder: 'e.g. 500',                 inputType: 'number' },
      { key: 'url',             label: 'Application URL',            placeholder: 'https://app.example.com',  inputType: 'text' },
    ],
    'Enterprise Application': [
      { key: 'version',         label: 'Product Version',            placeholder: 'e.g. SAP ECC 6.0',         inputType: 'text' },
      { key: 'language',        label: 'Tech Stack',                 placeholder: 'e.g. ABAP, Java',          inputType: 'text' },
      { key: 'framework',       label: 'Framework / Module',         placeholder: 'e.g. SAP FI, SD, MM',      inputType: 'text' },
      { key: 'hosting',         label: 'Deployment',                 placeholder: 'e.g. on-prem, private cloud', inputType: 'text' },
      { key: 'active_users',    label: 'Named / Active Users',       placeholder: 'e.g. 300',                 inputType: 'number' },
      { key: 'customisation',   label: 'Customisation Level',        placeholder: 'e.g. High — 200+ custom ABAP reports', inputType: 'text' },
      { key: 'integration_count', label: 'Integration Count',        placeholder: 'Number of downstream integrations', inputType: 'number' },
    ],
    'COTS Package': [
      { key: 'version',         label: 'Product Version',            placeholder: 'e.g. 2024.1',              inputType: 'text' },
      { key: 'language',        label: 'Tech Stack',                 placeholder: 'Vendor-provided',          inputType: 'text' },
      { key: 'hosting',         label: 'Deployment',                 placeholder: 'e.g. on-prem, SaaS, private cloud', inputType: 'text' },
      { key: 'active_users',    label: 'Active Users',               placeholder: 'e.g. 100',                 inputType: 'number' },
      { key: 'customisation',   label: 'Customisation Level',        placeholder: 'Low / Medium / High',      inputType: 'select', options: ['Low','Medium','High','None'] },
      { key: 'integration_count', label: 'Integration Count',        placeholder: 'Number of downstream integrations', inputType: 'number' },
    ],
    'API/Microservice': [
      { key: 'version',         label: 'API Version',                placeholder: 'e.g. v3',                  inputType: 'text' },
      { key: 'language',        label: 'Language',                   placeholder: 'e.g. Node.js, Go',         inputType: 'text' },
      { key: 'framework',       label: 'Framework',                  placeholder: 'e.g. Express, FastAPI',    inputType: 'text' },
      { key: 'endpoints',       label: 'Endpoint Count',             placeholder: 'e.g. 45',                  inputType: 'number' },
      { key: 'requests_per_day', label: 'Requests / Day',            placeholder: 'e.g. 500000',              inputType: 'number' },
      { key: 'protocol',        label: 'Protocol',                   placeholder: 'REST / GraphQL / gRPC',    inputType: 'select', options: ['REST','GraphQL','gRPC','SOAP','WebSocket'] },
    ],
  },

  // ── Database ──────────────────────────────────────────────────────────────
  database: {
    __default__: [
      { key: 'db_engine',       label: 'DB Engine',                  placeholder: 'e.g. PostgreSQL, MySQL',   inputType: 'text' },
      { key: 'version',         label: 'Engine Version',             placeholder: 'e.g. 14.2',                inputType: 'text' },
      { key: 'size_gb',         label: 'Database Size (GB)',         placeholder: 'e.g. 2560',                inputType: 'number' },
      { key: 'schema_count',    label: 'Schema / Database Count',    placeholder: 'e.g. 12',                  inputType: 'number' },
      { key: 'connection_string', label: 'Host / Connection String', placeholder: 'e.g. db.prod.internal:5432', inputType: 'text' },
      { key: 'backup_frequency', label: 'Backup Frequency',          placeholder: 'e.g. daily, hourly',       inputType: 'text' },
      { key: 'replication',     label: 'Replication',                placeholder: 'e.g. primary-replica, no', inputType: 'text' },
    ],
    'Data Warehouse': [
      { key: 'db_engine',       label: 'Platform',                   placeholder: 'e.g. Snowflake, Redshift', inputType: 'text' },
      { key: 'version',         label: 'Version',                    placeholder: 'e.g. 3.x',                 inputType: 'text' },
      { key: 'size_gb',         label: 'Data Volume (GB)',           placeholder: 'e.g. 50000',               inputType: 'number' },
      { key: 'table_count',     label: 'Table Count',                placeholder: 'e.g. 850',                 inputType: 'number' },
      { key: 'daily_queries',   label: 'Avg Daily Queries',          placeholder: 'e.g. 10000',               inputType: 'number' },
    ],
  },

  // ── Infrastructure ────────────────────────────────────────────────────────
  infrastructure: {
    __default__: [
      { key: 'manufacturer',    label: 'Manufacturer',               placeholder: 'e.g. Dell, HP, Lenovo',    inputType: 'text' },
      { key: 'model',           label: 'Model',                      placeholder: 'e.g. PowerEdge R750',      inputType: 'text' },
      { key: 'os',              label: 'Operating System',           placeholder: 'e.g. RHEL 8, Windows Server 2022', inputType: 'text' },
      { key: 'os_version',      label: 'OS Version',                 placeholder: 'e.g. 8.6',                 inputType: 'text' },
      { key: 'cpu_cores',       label: 'CPU Cores',                  placeholder: 'e.g. 32',                  inputType: 'number' },
      { key: 'ram_gb',          label: 'RAM (GB)',                   placeholder: 'e.g. 128',                 inputType: 'number' },
      { key: 'storage_gb',      label: 'Storage (GB)',               placeholder: 'e.g. 4096',                inputType: 'number' },
    ],
    'Virtual Machine': [
      { key: 'hypervisor',      label: 'Hypervisor',                 placeholder: 'e.g. VMware ESXi, Hyper-V, KVM', inputType: 'text' },
      { key: 'os',              label: 'Guest OS',                   placeholder: 'e.g. Ubuntu 22.04 LTS',    inputType: 'text' },
      { key: 'os_version',      label: 'OS Version',                 placeholder: 'e.g. 22.04',               inputType: 'text' },
      { key: 'cpu_cores',       label: 'vCPU Count',                 placeholder: 'e.g. 8',                   inputType: 'number' },
      { key: 'ram_gb',          label: 'RAM (GB)',                   placeholder: 'e.g. 32',                  inputType: 'number' },
      { key: 'storage_gb',      label: 'Storage (GB)',               placeholder: 'e.g. 500',                 inputType: 'number' },
    ],
    'Container Platform': [
      { key: 'platform',        label: 'Platform',                   placeholder: 'e.g. Kubernetes, Docker Swarm', inputType: 'text' },
      { key: 'version',         label: 'Version',                    placeholder: 'e.g. 1.28',                inputType: 'text' },
      { key: 'node_count',      label: 'Node Count',                 placeholder: 'e.g. 12',                  inputType: 'number' },
      { key: 'cpu_cores',       label: 'Total CPU Cores',            placeholder: 'e.g. 96',                  inputType: 'number' },
      { key: 'ram_gb',          label: 'Total RAM (GB)',             placeholder: 'e.g. 384',                 inputType: 'number' },
      { key: 'namespace_count', label: 'Namespace Count',            placeholder: 'e.g. 20',                  inputType: 'number' },
    ],
    'Network Equipment': [
      { key: 'manufacturer',    label: 'Manufacturer',               placeholder: 'e.g. Cisco, Juniper, Palo Alto', inputType: 'text' },
      { key: 'model',           label: 'Model',                      placeholder: 'e.g. Cisco ASR 1001',      inputType: 'text' },
      { key: 'firmware_version', label: 'Firmware Version',          placeholder: 'e.g. 17.3.5',              inputType: 'text' },
      { key: 'port_count',      label: 'Port Count',                 placeholder: 'e.g. 48',                  inputType: 'number' },
      { key: 'throughput_gbps', label: 'Throughput (Gbps)',          placeholder: 'e.g. 100',                 inputType: 'number' },
    ],
    'Storage System': [
      { key: 'manufacturer',    label: 'Manufacturer',               placeholder: 'e.g. NetApp, Pure Storage', inputType: 'text' },
      { key: 'model',           label: 'Model',                      placeholder: 'e.g. AFF A400',            inputType: 'text' },
      { key: 'storage_gb',      label: 'Raw Capacity (GB)',          placeholder: 'e.g. 102400',              inputType: 'number' },
      { key: 'protocol',        label: 'Protocol',                   placeholder: 'e.g. NFS, iSCSI, FC',      inputType: 'text' },
    ],
    'Security Appliance': [
      { key: 'manufacturer',    label: 'Manufacturer',               placeholder: 'e.g. Palo Alto, Fortinet', inputType: 'text' },
      { key: 'model',           label: 'Model',                      placeholder: 'e.g. PA-5220',             inputType: 'text' },
      { key: 'firmware_version', label: 'Firmware Version',          placeholder: 'e.g. 10.2.4',              inputType: 'text' },
      { key: 'throughput_gbps', label: 'Throughput (Gbps)',          placeholder: 'e.g. 10',                  inputType: 'number' },
      { key: 'ha_mode',         label: 'HA Mode',                    placeholder: 'Active-Passive / Active-Active / None', inputType: 'select', options: ['Active-Passive','Active-Active','None'] },
    ],
  },

  // ── Middleware ────────────────────────────────────────────────────────────
  middleware: {
    __default__: [
      { key: 'version',         label: 'Version',                    placeholder: 'e.g. 3.9.1',               inputType: 'text' },
      { key: 'vendor',          label: 'Vendor / Distribution',      placeholder: 'e.g. Apache, Red Hat',     inputType: 'text' },
      { key: 'protocol',        label: 'Protocol',                   placeholder: 'e.g. AMQP, HTTP/2, JMS',   inputType: 'text' },
      { key: 'instances',       label: 'Running Instances',          placeholder: 'e.g. 3',                   inputType: 'number' },
    ],
    'Application Server': [
      { key: 'product',         label: 'Product',                    placeholder: 'e.g. Apache Tomcat, JBoss EAP, WebLogic, IIS', inputType: 'text' },
      { key: 'version',         label: 'Version',                    placeholder: 'e.g. 10.1.13',             inputType: 'text' },
      { key: 'java_version',    label: 'JDK / Runtime Version',      placeholder: 'e.g. JDK 17, .NET 8',     inputType: 'text' },
      { key: 'deployed_apps',   label: 'Deployed Applications',      placeholder: 'e.g. 8',                   inputType: 'number' },
      { key: 'instances',       label: 'Running Instances',          placeholder: 'e.g. 4',                   inputType: 'number' },
      { key: 'heap_gb',         label: 'Heap / Memory Alloc (GB)',   placeholder: 'e.g. 8',                   inputType: 'number' },
    ],
    'Message Queue': [
      { key: 'product',         label: 'Product',                    placeholder: 'e.g. RabbitMQ, IBM MQ, ActiveMQ', inputType: 'text' },
      { key: 'version',         label: 'Version',                    placeholder: 'e.g. 3.12',                inputType: 'text' },
      { key: 'queue_count',     label: 'Queue Count',                placeholder: 'e.g. 45',                  inputType: 'number' },
      { key: 'msg_per_second',  label: 'Throughput (msg/sec)',       placeholder: 'e.g. 10000',               inputType: 'number' },
      { key: 'protocol',        label: 'Protocol',                   placeholder: 'AMQP / JMS / MQTT',        inputType: 'select', options: ['AMQP','JMS','MQTT','STOMP','OpenWire'] },
    ],
    'Messaging Platform': [
      { key: 'product',         label: 'Product',                    placeholder: 'e.g. Apache Kafka, Azure Event Hub', inputType: 'text' },
      { key: 'version',         label: 'Version',                    placeholder: 'e.g. 3.6.0',               inputType: 'text' },
      { key: 'broker_count',    label: 'Broker / Partition Count',   placeholder: 'e.g. 6',                   inputType: 'number' },
      { key: 'msg_per_second',  label: 'Throughput (msg/sec)',       placeholder: 'e.g. 500000',              inputType: 'number' },
      { key: 'retention_days',  label: 'Retention (days)',           placeholder: 'e.g. 7',                   inputType: 'number' },
    ],
    'API Gateway': [
      { key: 'product',         label: 'Product',                    placeholder: 'e.g. Kong, AWS API Gateway, Apigee', inputType: 'text' },
      { key: 'version',         label: 'Version',                    placeholder: 'e.g. 3.4',                 inputType: 'text' },
      { key: 'endpoints',       label: 'Endpoint Count',             placeholder: 'e.g. 120',                 inputType: 'number' },
      { key: 'requests_per_day', label: 'Requests / Day',            placeholder: 'e.g. 5000000',             inputType: 'number' },
      { key: 'auth_method',     label: 'Auth Method',                placeholder: 'OAuth2 / API Key / mTLS',  inputType: 'select', options: ['OAuth2','API Key','mTLS','JWT','Basic Auth','None'] },
    ],
    'File Gateway': [
      { key: 'product',         label: 'Product',                    placeholder: 'e.g. IBM Sterling MFT, Axway, GoAnywhere', inputType: 'text' },
      { key: 'version',         label: 'Version',                    placeholder: 'e.g. 6.1',                 inputType: 'text' },
      { key: 'protocol',        label: 'Protocol',                   placeholder: 'SFTP / FTPS / AS2 / HTTPS', inputType: 'select', options: ['SFTP','FTPS','AS2','HTTPS','SCP'] },
      { key: 'partner_count',   label: 'Trading Partner Count',      placeholder: 'e.g. 35',                  inputType: 'number' },
      { key: 'transfers_per_day', label: 'File Transfers / Day',     placeholder: 'e.g. 200',                 inputType: 'number' },
    ],
    'Integration Platform': [
      { key: 'product',         label: 'Product',                    placeholder: 'e.g. MuleSoft, BizTalk, Dell Boomi', inputType: 'text' },
      { key: 'version',         label: 'Version',                    placeholder: 'e.g. 4.6',                 inputType: 'text' },
      { key: 'integration_flows', label: 'Active Integration Flows', placeholder: 'e.g. 85',                  inputType: 'number' },
      { key: 'msg_per_day',     label: 'Messages / Day',             placeholder: 'e.g. 250000',              inputType: 'number' },
    ],
    'Cache Server': [
      { key: 'product',         label: 'Product',                    placeholder: 'e.g. Redis, Memcached',    inputType: 'text' },
      { key: 'version',         label: 'Version',                    placeholder: 'e.g. 7.2',                 inputType: 'text' },
      { key: 'ram_gb',          label: 'Cache Memory (GB)',          placeholder: 'e.g. 16',                  inputType: 'number' },
      { key: 'hit_rate_pct',    label: 'Cache Hit Rate (%)',         placeholder: 'e.g. 95',                  inputType: 'number' },
    ],
  },

  // ── Cloud Service ─────────────────────────────────────────────────────────
  'cloud-service': {
    __default__: [
      { key: 'account_id',      label: 'Cloud Account / Subscription ID', placeholder: 'e.g. 123456789012', inputType: 'text' },
      { key: 'region',          label: 'Region',                     placeholder: 'e.g. us-east-1, australiaeast', inputType: 'text' },
      { key: 'instance_type',   label: 'Instance / Service Tier',    placeholder: 'e.g. t3.large, Standard_D4s_v5', inputType: 'text' },
      { key: 'instance_count',  label: 'Instance Count',             placeholder: 'e.g. 6',                   inputType: 'number' },
    ],
    'AWS Lambda': [
      { key: 'account_id',      label: 'AWS Account ID',             placeholder: 'e.g. 123456789012',        inputType: 'text' },
      { key: 'region',          label: 'Region',                     placeholder: 'e.g. ap-southeast-2',      inputType: 'text' },
      { key: 'function_count',  label: 'Function Count',             placeholder: 'e.g. 40',                  inputType: 'number' },
      { key: 'runtime',         label: 'Primary Runtime',            placeholder: 'e.g. Node.js 20, Python 3.12', inputType: 'text' },
      { key: 'invocations_day', label: 'Invocations / Day',          placeholder: 'e.g. 1000000',             inputType: 'number' },
    ],
    'Kubernetes Service': [
      { key: 'platform',        label: 'Platform',                   placeholder: 'e.g. EKS, AKS, GKE',      inputType: 'text' },
      { key: 'version',         label: 'k8s Version',                placeholder: 'e.g. 1.29',                inputType: 'text' },
      { key: 'node_count',      label: 'Node Count',                 placeholder: 'e.g. 18',                  inputType: 'number' },
      { key: 'namespace_count', label: 'Namespace Count',            placeholder: 'e.g. 12',                  inputType: 'number' },
      { key: 'region',          label: 'Region',                     placeholder: 'e.g. us-east-1',           inputType: 'text' },
    ],
  },

  // ── Third-party service ───────────────────────────────────────────────────
  'third-party-service': {
    __default__: [
      { key: 'plan',            label: 'Subscription Plan / Tier',   placeholder: 'e.g. Enterprise, Pro',     inputType: 'text' },
      { key: 'seat_count',      label: 'Licensed Seats / Users',     placeholder: 'e.g. 250',                 inputType: 'number' },
      { key: 'retention',       label: 'Data Retention',             placeholder: 'e.g. 90 days, 1 year',     inputType: 'text' },
      { key: 'api_enabled',     label: 'API Integration Enabled',    placeholder: 'Yes / No',                 inputType: 'select', options: ['Yes','No'] },
    ],
    'Monitoring Service': [
      { key: 'plan',            label: 'Plan / Tier',                placeholder: 'e.g. DataDog Pro, New Relic Full Stack', inputType: 'text' },
      { key: 'host_count',      label: 'Monitored Hosts',            placeholder: 'e.g. 120',                 inputType: 'number' },
      { key: 'retention',       label: 'Metrics Retention',          placeholder: 'e.g. 13 months',           inputType: 'text' },
      { key: 'alert_channels',  label: 'Alert Channels',             placeholder: 'e.g. PagerDuty, Slack, Email', inputType: 'text' },
    ],
    'Authentication Service': [
      { key: 'product',         label: 'Product',                    placeholder: 'e.g. Okta, Azure AD, Auth0', inputType: 'text' },
      { key: 'plan',            label: 'Plan',                       placeholder: 'e.g. Business, Enterprise', inputType: 'text' },
      { key: 'seat_count',      label: 'Licensed Users / MAU',      placeholder: 'e.g. 1000',                inputType: 'number' },
      { key: 'mfa_enabled',     label: 'MFA Enforced',               placeholder: 'Yes / No',                 inputType: 'select', options: ['Yes','No'] },
      { key: 'sso_applications', label: 'SSO-Connected Apps',        placeholder: 'e.g. 30',                  inputType: 'number' },
    ],
    'Payment Gateway': [
      { key: 'product',         label: 'Product',                    placeholder: 'e.g. Stripe, Adyen, PayPal', inputType: 'text' },
      { key: 'plan',            label: 'Contract Tier',              placeholder: 'e.g. Enterprise',          inputType: 'text' },
      { key: 'transaction_volume', label: 'Monthly Transactions',    placeholder: 'e.g. 50000',               inputType: 'number' },
      { key: 'currencies',      label: 'Supported Currencies',       placeholder: 'e.g. AUD, USD, EUR',       inputType: 'text' },
      { key: 'pci_certified',   label: 'PCI-DSS Certified',          placeholder: 'Yes / No',                 inputType: 'select', options: ['Yes','No'] },
    ],
  },
};

/**
 * Get the metadata template fields for a given asset type + category combo.
 * Falls back to `__default__` for the type if no category-specific template exists.
 */
export function getMetadataTemplate(type: string, category: string): MetadataField[] {
  const typeTemplates = METADATA_TEMPLATES[type];
  if (!typeTemplates) return [];
  return typeTemplates[category] ?? typeTemplates['__default__'] ?? [];
}

// ─────────────────────────────────────────────────────────────────────────────
// UI helpers
// ─────────────────────────────────────────────────────────────────────────────
export const ASSET_TYPE_ICONS: Record<string, string> = {
  application: '🌐',
  database: '🗄️',
  infrastructure: '🖥️',
  middleware: '⚙️',
  'cloud-service': '☁️',
  'third-party-service': '🔗',
};

export const ASSET_TYPE_LABELS: Record<string, string> = {
  application: 'Application',
  database: 'Database',
  infrastructure: 'Infrastructure',
  middleware: 'Middleware',
  'cloud-service': 'Cloud Service',
  'third-party-service': 'Third-Party Service',
};
