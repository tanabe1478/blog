import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";

export interface Env {
  POLICY_AUD: string;
  TEAM_DOMAIN: string;
  ACCESS_BYPASS?: string | boolean;
  GITHUB_TOKEN?: string;
  WRITE_HOST: string;
}

export interface AccessIdentity {
  email: string;
}

export class AccessDeniedError extends Error {}

export type AccessVerifier = (
  token: string,
  options: { issuer: string; audience: string[] },
) => Promise<JWTPayload>;

const jwksByTeamDomain = new Map<
  string,
  ReturnType<typeof createRemoteJWKSet>
>();

function audiences(value: string): string[] {
  return value
    .split(",")
    .map((audience) => audience.trim())
    .filter(Boolean);
}

function jwksFor(teamDomain: string) {
  let jwks = jwksByTeamDomain.get(teamDomain);
  if (!jwks) {
    jwks = createRemoteJWKSet(
      new URL("/cdn-cgi/access/certs", `${teamDomain}/`),
    );
    jwksByTeamDomain.set(teamDomain, jwks);
  }
  return jwks;
}

const verifyWithCloudflare: AccessVerifier = async (token, options) => {
  const { payload } = await jwtVerify(token, jwksFor(options.issuer), options);
  return payload;
};

export async function authenticateAccess(
  request: Request,
  env: Env,
  verify: AccessVerifier = verifyWithCloudflare,
): Promise<AccessIdentity> {
  const token = request.headers.get("cf-access-jwt-assertion");
  const allowedAudiences = audiences(env.POLICY_AUD ?? "");

  if (!env.TEAM_DOMAIN || allowedAudiences.length === 0 || !token) {
    throw new AccessDeniedError("Access configuration or token is missing");
  }

  let teamDomain: URL;
  try {
    teamDomain = new URL(env.TEAM_DOMAIN);
  } catch {
    throw new AccessDeniedError("Access team domain is invalid");
  }
  if (teamDomain.protocol !== "https:") {
    throw new AccessDeniedError("Access team domain must use HTTPS");
  }

  try {
    const payload = await verify(token, {
      issuer: teamDomain.origin,
      audience: allowedAudiences,
    });
    if (typeof payload.email !== "string" || payload.email.length === 0) {
      throw new AccessDeniedError("Access identity is missing");
    }
    return { email: payload.email };
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      throw error;
    }
    throw new AccessDeniedError("Access token validation failed");
  }
}
