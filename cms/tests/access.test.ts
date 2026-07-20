import { describe, expect, it, vi } from "vitest";

import {
  AccessDeniedError,
  authenticateAccess,
  type AccessVerifier,
  type Env,
} from "../src/access";

const env: Env = {
  POLICY_AUD: "production-audience, preview-audience",
  TEAM_DOMAIN: "https://team.cloudflareaccess.com",
  WRITE_HOST: "cms.example.test",
};

function accessRequest(token = "signed-token"): Request {
  return new Request("https://cms.example.test/", {
    headers: { "cf-access-jwt-assertion": token },
  });
}

describe("Cloudflare Access authentication", () => {
  it("accepts a signed identity for one of the configured audiences", async () => {
    const verify = vi.fn<AccessVerifier>().mockResolvedValue({
      email: "owner@example.com",
    });

    const identity = await authenticateAccess(accessRequest(), env, verify);

    expect(identity).toEqual({ email: "owner@example.com" });
    expect(verify).toHaveBeenCalledWith("signed-token", {
      issuer: "https://team.cloudflareaccess.com",
      audience: ["production-audience", "preview-audience"],
    });
  });

  it("rejects a request without an Access JWT", async () => {
    const request = new Request("https://cms.example.test/");

    await expect(authenticateAccess(request, env)).rejects.toBeInstanceOf(
      AccessDeniedError,
    );
  });

  it("rejects a token without an email identity", async () => {
    const verify = vi.fn<AccessVerifier>().mockResolvedValue({});

    await expect(
      authenticateAccess(accessRequest(), env, verify),
    ).rejects.toBeInstanceOf(AccessDeniedError);
  });

  it("rejects an invalid team domain before token verification", async () => {
    const verify = vi.fn<AccessVerifier>();

    await expect(
      authenticateAccess(
        accessRequest(),
        { ...env, TEAM_DOMAIN: "http://team.cloudflareaccess.com" },
        verify,
      ),
    ).rejects.toBeInstanceOf(AccessDeniedError);
    expect(verify).not.toHaveBeenCalled();
  });

});
