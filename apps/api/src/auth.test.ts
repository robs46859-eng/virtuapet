import { describe, expect, it } from "vitest";
import { principalFromOidcPayload } from "./auth.js";

const user = "54cb74e3-eb73-4762-8ff5-d884e393d4e5";
const organization = "62335dff-756b-47a7-ba94-95e240c3680d";

describe("principalFromOidcPayload", () => {
  it("uses the verified Entra oid and a selected UUID organization", () => {
    expect(principalFromOidcPayload({ oid: user, sub: "pairwise-subject", roles: ["reader"] }, organization)).toEqual({
      userId: user,
      organizationId: organization,
      roles: ["reader"]
    });
  });

  it("rejects non-UUID identities and organizations", () => {
    expect(principalFromOidcPayload({ sub: "pairwise-subject" }, organization)).toBeUndefined();
    expect(principalFromOidcPayload({ oid: user }, "not-an-organization")).toEqual({ userId: user, roles: [] });
  });

  it("rejects a selected organization that conflicts with a signed organization", () => {
    expect(principalFromOidcPayload({ oid: user, org_id: organization }, "6d8bed91-b840-4884-9ecb-907b4cf0c65f")).toBeUndefined();
  });
});
