import * as pulumi from "@pulumi/pulumi";
import * as gcp from "@pulumi/gcp";

const gcpConfig = new pulumi.Config("gcp");
const appConfig = new pulumi.Config("mediagent");

const project = gcpConfig.require("project");
const region = gcpConfig.require("region");
const stack = pulumi.getStack();

const geminiApiKey = appConfig.requireSecret("geminiApiKey");
const postgresPassword = appConfig.requireSecret("postgresPassword");
const telegramBotToken = appConfig.getSecret("telegramBotToken") ?? "";

// ---------------------------------------------------------------------------
// Enable required GCP APIs
// ---------------------------------------------------------------------------

const apiServices = [
    "compute.googleapis.com",
    "run.googleapis.com",
    "sqladmin.googleapis.com",
    "artifactregistry.googleapis.com",
    "storage.googleapis.com",
];

const enabledApis = apiServices.map(
    (api) =>
        new gcp.projects.Service(`enable-${api}`, {
            project,
            service: api,
            disableOnDestroy: false,
        }),
);

// ---------------------------------------------------------------------------
// 1. Google Cloud Storage — medical file uploads
// ---------------------------------------------------------------------------

const uploadsBucket = new gcp.storage.Bucket("uploads-bucket", {
    name: `mediagent-uploads-${stack}`,
    location: region,
    project,
    uniformBucketLevelAccess: true,
    forceDestroy: true,
});

// ---------------------------------------------------------------------------
// 2. Cloud SQL PostgreSQL — pgvector enabled
// ---------------------------------------------------------------------------

const sqlInstance = new gcp.sql.DatabaseInstance(
    "postgres-instance",
    {
        name: `mediagent-pg-${stack}`,
        project,
        region,
        databaseVersion: "POSTGRES_15",
        deletionProtection: false,
        settings: {
            tier: "db-custom-1-3840",
            ipConfiguration: {
                ipv4Enabled: true,
                authorizedNetworks: [
                    { name: "allow-all", value: "0.0.0.0/0" },
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

const postgresHost = sqlInstance.publicIpAddress;

// ---------------------------------------------------------------------------
// 3. Artifact Registry — Docker images
// ---------------------------------------------------------------------------

const artifactRepo = new gcp.artifactregistry.Repository(
    "docker-repo",
    {
        repositoryId: `mediagent-${stack}`,
        project,
        location: region,
        format: "DOCKER",
    },
    { dependsOn: enabledApis },
);

const artifactRegistryUrl = pulumi.interpolate`${region}-docker.pkg.dev/${project}/${artifactRepo.repositoryId}`;

// ---------------------------------------------------------------------------
// 4. Cloud Run — Backend (FastAPI + LangGraph + Telegram Bot)
// ---------------------------------------------------------------------------

// Use custom backend image if provided in config, otherwise default to hello-world placeholder for bootstrapping
const backendImage = appConfig.get("backendImage") ?? "us-docker.pkg.dev/cloudrun/container/hello:latest";
const containerPort = backendImage.includes("container/hello") ? 8080 : 8000;

const backendEnvs: gcp.types.input.cloudrunv2.ServiceTemplateContainerEnv[] = [
    { name: "GEMINI_API_KEY", value: geminiApiKey },
    { name: "POSTGRES_HOST", value: postgresHost },
    { name: "POSTGRES_PORT", value: "5432" },
    { name: "POSTGRES_DB", value: "mediagent" },
    { name: "POSTGRES_USER", value: "mediagent" },
    { name: "POSTGRES_PASSWORD", value: postgresPassword },
    { name: "GCS_BUCKET_NAME", value: uploadsBucket.name },
];

// Telegram token is optional — only add if configured
if (telegramBotToken) {
    backendEnvs.push({ name: "TELEGRAM_BOT_TOKEN", value: telegramBotToken });
}

const backendService = new gcp.cloudrunv2.Service(
    "backend-service",
    {
        name: `mediagent-api-${stack}`,
        project,
        location: region,
        ingress: "INGRESS_TRAFFIC_ALL",
        template: {
            containers: [
                {
                    image: backendImage,
                    ports: { containerPort: containerPort },
                    envs: backendEnvs,
                    resources: {
                        limits: { cpu: "1", memory: "1Gi" },
                    },
                },
            ],
            scaling: { minInstanceCount: 0, maxInstanceCount: 3 },
        },
    },
    { dependsOn: enabledApis },
);

// ---------------------------------------------------------------------------
// Stack Outputs
// ---------------------------------------------------------------------------

export const backendUrl = backendService.uri;
export const gcsBucketName = uploadsBucket.name;
export const postgresConnectionString = pulumi.interpolate`postgresql://mediagent:${postgresPassword}@${postgresHost}:5432/mediagent`;
export const artifactRegistryRepository = artifactRegistryUrl;
export const postgresIp = postgresHost;
