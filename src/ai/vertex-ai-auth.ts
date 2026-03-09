import { getVercelOidcToken } from '@vercel/oidc';
import {
  ExternalAccountClient,
  type BaseExternalAccountClient,
  type ExternalAccountClientOptions,
  type GoogleAuthOptions,
} from 'google-auth-library';

const CLOUD_PLATFORM_SCOPE = 'https://www.googleapis.com/auth/cloud-platform';
const STS_TOKEN_URL = 'https://sts.googleapis.com/v1/token';

let cachedVercelAuthClient: BaseExternalAccountClient | null = null;

const isVercelEnvironment = (): boolean => Boolean(process.env.VERCEL);

const getRequiredEnv = (name: string): string => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
};

const getVertexProjectId = (): string =>
  process.env.GOOGLE_CLOUD_PROJECT || process.env.GCP_PROJECT_ID || getRequiredEnv('GOOGLE_CLOUD_PROJECT');

const createVercelWifAuthClient = (): BaseExternalAccountClient => {
  if (cachedVercelAuthClient) {
    return cachedVercelAuthClient;
  }

  const projectNumber = getRequiredEnv('GCP_PROJECT_NUMBER');
  const poolId = getRequiredEnv('GCP_WORKLOAD_IDENTITY_POOL_ID');
  const providerId = getRequiredEnv('GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID');
  const serviceAccountEmail = getRequiredEnv('GCP_SERVICE_ACCOUNT_EMAIL');

  const audience =
    `//iam.googleapis.com/projects/${projectNumber}/locations/global/` +
    `workloadIdentityPools/${poolId}/providers/${providerId}`;
  const serviceAccountImpersonationUrl =
    `https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/` +
    `${encodeURIComponent(serviceAccountEmail)}:generateAccessToken`;

  const options: ExternalAccountClientOptions = {
    type: 'external_account',
    audience,
    subject_token_type: 'urn:ietf:params:oauth:token-type:id_token',
    token_url: STS_TOKEN_URL,
    service_account_impersonation_url: serviceAccountImpersonationUrl,
    subject_token_supplier: {
      getSubjectToken: async () => getVercelOidcToken(),
    },
    scopes: [CLOUD_PLATFORM_SCOPE],
  };

  const authClient = ExternalAccountClient.fromJSON(options);
  if (!authClient) {
    throw new Error('Failed to initialize Workload Identity auth client.');
  }

  authClient.scopes = [CLOUD_PLATFORM_SCOPE];
  cachedVercelAuthClient = authClient;
  return authClient;
};

export const createVertexAIPluginOptions = () => {
  const projectId = getVertexProjectId();
  const location = process.env.GOOGLE_CLOUD_LOCATION || 'global';

  if (!isVercelEnvironment()) {
    return {
      projectId,
      location,
      apiKey: false as const,
    };
  }

  const authClient = createVercelWifAuthClient();
  const googleAuth: GoogleAuthOptions = {
    authClient,
    projectId: process.env.GCP_PROJECT_ID || projectId,
    scopes: [CLOUD_PLATFORM_SCOPE],
  };

  return {
    projectId,
    location,
    googleAuth,
    apiKey: false as const,
  };
};
