import * as pulumi from "@pulumi/pulumi";
import * as gcp from "@pulumi/gcp";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const config = new pulumi.Config();
const gcpConfig = new pulumi.Config("gcp");
const appConfig = new pulumi.Config("mediagent");

const project = gcpConfig.require("project");
const region = gcpConfig.require("region");
const stack = pulumi.getStack();

const geminiApiKey = appConfig.requireSecret("geminiApiKey");
const postgresPassword = appConfig.requireSecret("postgresPassword");
const telegramBotToken = appConfig.requireSecret("telegramBotToken");

// ---------------------------------------------------------------------------
// Enable required GCP APIs
// ---------------------------------------------------------------------------

const enabledApis = [
    "run.googleapis.com",
    "sqladmin.googleapis.com",
    "artifactregistry.googleapis.com",
    "storage.googleapis.com",
    "iam.googleapis.com",
].map(
    (api) =>
        new gcp.projects.Service(`enable-${api}`, {
            project,
            service: api,
            disableOnDestroy: false,
        }),
);

// ---------------------------------------------------------------------------
// 1. Google Cloud Storage bucket — medical file uploads
// ---------------------------------------------------------------------------

const uploadsBucket = new gcp.storage.Bucket("uploads-bucket", {
    name: `mediagent-uploads-${stack}`,
    location: region,
    project,
    uniformBucketLevelAccess: true,
    forceDestroy: true, // hackathon convenience
});

// ---------------------------------------------------------------------------
// 2. Cloud SQL PostgreSQL instance — with pgvector
// ---------------------------------------------------------------------------

const sqlInstance = new gcp.sql.DatabaseInstance(
    "postgres-instance",
    {
        name: `mediagent-pg-${stack}`,
        project,
        region,
        databaseVersion: "POSTGRES_15",
        deletionProtection: false, // hackathon convenience
        settings: {
            tier: "db-f1-micro",
            databaseFlags: [
                {
                    name: "cloudsql.enable_pgvector",
                    value: "on",
                },
            ],
            ipConfiguration: {
                ipv4Enabled: true,
                authorizedNetworks: [
                    {
                        name: "allow-all",
                        value: "0.0.0.0/0",
                    },
                ],
            },
        },
    },
    { dependsOn: enabledApis },
);

const sqlDatabase = new gcp.sql.Database("app-database", {
    name: "mediagent",
    instance: sqlInstance.name,
    project,
});

const sqlUser = new gcp.sql.User("app-user", {
    name: "mediagent",
    instance: sqlInstance.name,
    password: postgresPassword,
    project,
});

// Build the connection string from Cloud SQL outputs
const postgresHost = sqlInstance.publicIpAddress;
const postgresConnectionString = pulumi.interpolate`postgresql://mediagent:${postgresPassword}@${postgresHost}:5432/mediagent`;

// ---------------------------------------------------------------------------
// 3. Artifact Registry repository — Docker images
// ---------------------------------------------------------------------------

const artifactRepo = new gcp.artifactregistry.Repository(
    "docker-repo",
    {
        repositoryId: `mediagent-${stack}`,
        project,
        location: region,
        format: "DOCKER",
        description: "MediAgent container images",
    },
    { dependsOn: enabledApis },
);

const artifactRegistryUrl = pulumi.interpolate`${region}-docker.pkg.dev/${project}/${artifactRepo.repositoryId}`;

// ---------------------------------------------------------------------------
// 4. Cloud Run service — Backend (FastAPI)
// ---------------------------------------------------------------------------

const backendImage = pulumi.interpolate`${artifactRegistryUrl}/backend:latest`;

const backendService = new gcp.cloudrunv2.Service(
    "backend-service",
    {
        name: `mediagent-backend-${stack}`,
        project,
        location: region,
        ingress: "INGRESS_TRAFFIC_ALL",
        template: {
            containers: [
                {
                    image: backendImage,
                    ports: [{ containerPort: 8000 }],
                    envs: [
                        { name: "GEMINI_API_KEY", value: geminiApiKey },
                        { name: "POSTGRES_HOST", value: postgresHost },
                        { name: "POSTGRES_PORT", value: "5432" },
                        { name: "POSTGRES_DB", value: "mediagent" },
                        { name: "POSTGRES_USER", value: "mediagent" },
                        { name: "POSTGRES_PASSWORD", value: postgresPassword },
                        {
                            name: "GCS_BUCKET_NAME",
                            value: uploadsBucket.name,
                        },
                        {
                            name: "TELEGRAM_BOT_TOKEN",
                            value: telegramBotToken,
                        },
                    ],
                    resources: {
                        limits: {
                            cpu: "1",
                            memory: "512Mi",
                        },
                    },
                },
            ],
            scaling: {
                minInstanceCount: 0,
                maxInstanceCount: 2,
            },
        },
    },
    { dependsOn: enabledApis },
);

// Public access for backend
const backendIamBinding = new gcp.cloudrunv2.ServiceIamBinding(
    "backend-public-access",
    {
        name: backendService.name,
        project,
        location: region,
        role: "roles/run.invoker",
        members: ["allUsers"],
    },
);

const backendUrl = backendService.uri;

// ---------------------------------------------------------------------------
// 5. Cloud Run service — Frontend (Next.js)
// ---------------------------------------------------------------------------

const frontendImage = pulumi.interpolate`${artifactRegistryUrl}/frontend:latest`;

const frontendService = new gcp.cloudrunv2.Service(
    "frontend-service",
    {
        name: `mediagent-frontend-${stack}`,
        project,
        location: region,
        ingress: "INGRESS_TRAFFIC_ALL",
        template: {
            containers: [
                {
                    image: frontendImage,
                    ports: [{ containerPort: 3000 }],
                    envs: [
                        {
                            name: "NEXT_PUBLIC_API_URL",
                            value: backendUrl,
                        },
                    ],
                    resources: {
                        limits: {
                            cpu: "1",
                            memory: "512Mi",
                        },
                    },
                },
            ],
            scaling: {
                minInstanceCount: 0,
                maxInstanceCount: 2,
            },
        },
    },
    { dependsOn: enabledApis },
);

// Public access for frontend
const frontendIamBinding = new gcp.cloudrunv2.ServiceIamBinding(
    "frontend-public-access",
    {
        name: frontendService.name,
        project,
        location: region,
        role: "roles/run.invoker",
        members: ["allUsers"],
    },
);

const frontendUrl = frontendService.uri;

// ---------------------------------------------------------------------------
// Stack outputs
// ---------------------------------------------------------------------------

export const backendServiceUrl = backendUrl;
export const frontendServiceUrl = frontendUrl;
export const gcsBucketName = uploadsBucket.name;
export const cloudSqlConnectionString = postgresConnectionString;
export const artifactRegistryRepository = artifactRegistryUrl;
