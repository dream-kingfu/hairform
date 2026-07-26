import assert from "node:assert/strict";
import test from "node:test";
import { describeKieResponseShape, extractKieResponseText } from "../lib/server/kie-response.ts";

const json = '{"faceShape":"oval"}';

test("extracts direct Responses API output", () => {
  assert.equal(extractKieResponseText({
    output: [{ type: "message", content: [{ type: "output_text", text: json }] }],
  }), json);
});

test("extracts Kie response.completed envelopes", () => {
  assert.equal(extractKieResponseText({
    type: "response.completed",
    response: { output: [{ content: [{ type: "output_text", text: json }] }] },
  }), json);
});

test("extracts SSE output text events", () => {
  assert.equal(extractKieResponseText({
    events: [
      { type: "response.created" },
      { type: "response.output_text.done", text: json },
      { type: "response.completed" },
    ],
  }), json);
});

test("extracts chat-completions compatible responses", () => {
  assert.equal(extractKieResponseText({ choices: [{ message: { content: json } }] }), json);
});

test("rejects envelopes without assistant text", () => {
  assert.throws(() => extractKieResponseText({ type: "response.completed" }), /analysis_output_missing/);
  assert.deepEqual(describeKieResponseShape({ type: "response.completed", response: { status: "failed" } }), {
    kind: "object",
    type: "response.completed",
    keys: ["type", "response"],
    responseKeys: ["status"],
    eventCount: undefined,
  });
});
