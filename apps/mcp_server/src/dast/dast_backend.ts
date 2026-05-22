/**
 * DAST 백엔드 연동 MCP 툴.
 *
 * AI Engine → MCP Server → Backend HTTP → Docker SDK 방향의 내부 호출만 담당한다.
 * targetUrl, params 는 절대 로그에 출력하지 않는다.
 */

const DAST_EXECUTE_PATH = "/api/v1/internal/dast/execute";
const DAST_TIMEOUT_MS = 350_000;

export const runDastInSandboxToolDef = {
  name: "run_dast_in_sandbox",
  description:
    "Execute DAST exploit in Docker sandbox via backend internal API. " +
    "Returns exploit result including success flag, payload, evidence, and response_snippet.",
  inputSchema: {
    type: "object",
    properties: {
      sessionId: { type: "string", description: "Analysis session ID" },
      vulnId: { type: "string", description: "Vulnerability identifier" },
      vulnType: { type: "string", description: "Vulnerability type (e.g. SQL_INJECTION, XSS)" },
      targetUrl: { type: "string", description: "Target URL — never logged" },
      endpoint: { type: "string", description: "Specific endpoint path to exploit" },
      params: {
        type: "object",
        additionalProperties: true,
        description: "Exploit parameters — never logged",
      },
    },
    required: ["sessionId", "vulnId", "vulnType", "targetUrl", "endpoint", "params"],
  },
};

export async function handleRunDastInSandbox(
  args: Record<string, unknown>
): Promise<{ content: { type: string; text: string }[]; isError?: boolean }> {
  const backendUrl = process.env["BACKEND_INTERNAL_URL"];
  const internalKey = process.env["INTERNAL_API_KEY"];

  if (!backendUrl || !internalKey) {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            success: false,
            payload: "",
            evidence: "",
            response_snippet: "",
            error: "DAST backend not configured: missing BACKEND_INTERNAL_URL or INTERNAL_API_KEY",
          }),
        },
      ],
      isError: true,
    };
  }

  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), DAST_TIMEOUT_MS);

  // sessionId, vulnId, vulnType, endpoint 만 로그 허용 — targetUrl, params 출력 금지
  const logSafeId = String(args["sessionId"] ?? "unknown");
  const logSafeVulnId = String(args["vulnId"] ?? "unknown");

  try {
    const resp = await fetch(`${backendUrl}${DAST_EXECUTE_PATH}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Internal-Key": internalKey,
      },
      body: JSON.stringify(args),
      signal: controller.signal,
    });

    if (!resp.ok) {
      const errText = await resp.text();
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              success: false,
              payload: "",
              evidence: "",
              response_snippet: "",
              error: `Backend responded with HTTP ${resp.status}: ${errText}`,
            }),
          },
        ],
        isError: true,
      };
    }

    const data = await resp.json() as Record<string, unknown>;
    return { content: [{ type: "text", text: JSON.stringify(data) }] };
  } catch (err: unknown) {
    const isTimeout = err instanceof Error && err.name === "AbortError";
    const errMsg = isTimeout
      ? `DAST sandbox timed out after ${DAST_TIMEOUT_MS / 1000}s`
      : `DAST sandbox call failed: ${err instanceof Error ? err.message : String(err)}`;

    // vulnId 만 로그에 남긴다 — sessionId, vulnId 는 비밀이 아님
    console.error(`[dast_backend] session=${logSafeId} vuln_id=${logSafeVulnId} error=${errMsg}`);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            success: false,
            payload: "",
            evidence: "",
            response_snippet: "",
            error: errMsg,
          }),
        },
      ],
      isError: true,
    };
  } finally {
    clearTimeout(timeoutHandle);
  }
}
