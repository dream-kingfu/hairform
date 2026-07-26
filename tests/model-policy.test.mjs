import assert from "node:assert/strict";
import test from "node:test";
import { MODEL_POLICY, assertProductionModelPolicy, modelFor } from "../lib/server/model-policy.ts";

test("routes each purpose to the fixed production allowlist", () => {
  assert.equal(modelFor("analysis"), "gpt-5-6-terra");
  assert.equal(modelFor("quality"), "gpt-5-6-luna");
  assert.equal(modelFor("quality_escalation"), "gpt-5-6-terra");
  assert.equal(modelFor("image_edit"), "gpt-image-2-image-to-image");
  assert.equal(MODEL_POLICY.imageEdit.perJobLimit, 2);
  assert.equal(MODEL_POLICY.analysis.perJobLimit, 1);
});

test("fails closed for providers or model overrides outside the allowlist", () => {
  assert.doesNotThrow(() => assertProductionModelPolicy({
    AI_PROVIDER: "kie",
    KIE_ANALYSIS_MODEL: "gpt-5-6-terra",
    KIE_QC_MODEL: "gpt-5-6-luna",
    KIE_IMAGE_MODEL: "gpt-image-2-image-to-image",
  }));
  assert.throws(() => assertProductionModelPolicy({ AI_PROVIDER: "openai" }), /model_policy_error/);
  assert.throws(() => assertProductionModelPolicy({ AI_PROVIDER: "kie", KIE_IMAGE_MODEL: "another-image-model" }), /model_policy_error/);
});
