export interface ParsedTestFailure {
  framework: "jest/vitest" | "pytest" | "gotest" | "cargo" | "unknown";
  failedTestCount: number;
  failures: Array<{
    testName: string;
    filePath?: string;
    errorMessage: string;
    stackTrace: string;
    assertionDiff?: string;
  }>;
  summary: string;
}

export class TestFailureParser {
  public static parse(output: string): ParsedTestFailure | null {
    if (output.includes("FAIL ") || output.includes("Tests: ") || output.includes("Vitest")) {
      return this.parseJestVitest(output);
    }
    if (output.includes("=== FAILURES ===") || output.includes("FAILED ") || output.includes("pytest")) {
      return this.parsePytest(output);
    }
    if (output.includes("--- FAIL:") || output.includes("=== RUN")) {
      return this.parseGoTest(output);
    }
    if (output.includes("test result: FAILED") || output.includes("failures:")) {
      return this.parseCargoTest(output);
    }
    return null;
  }

  private static parseJestVitest(output: string): ParsedTestFailure {
    const lines = output.split("\n");
    const failures: ParsedTestFailure["failures"] = [];
    let currentTest = "";
    let currentFile = "";
    let diffLines: string[] = [];
    let traceLines: string[] = [];
    let capturingDiff = false;

    for (const line of lines) {
      if (line.includes("FAIL ")) {
        currentFile = line.replace(/.*FAIL\s+/, "").trim();
      } else if (line.includes("● ")) {
        if (currentTest) {
          failures.push({
            testName: currentTest,
            filePath: currentFile,
            errorMessage: traceLines[0] || "Assertion failure",
            stackTrace: traceLines.slice(0, 10).join("\n"),
            assertionDiff: diffLines.join("\n"),
          });
          diffLines = [];
          traceLines = [];
        }
        currentTest = line.replace(/.*●\s+/, "").trim();
      } else if (line.includes("Expected:") || line.includes("Received:") || line.includes("- Expected") || line.includes("+ Received")) {
        capturingDiff = true;
        diffLines.push(line);
      } else if (capturingDiff && line.trim().startsWith("+") || line.trim().startsWith("-")) {
        diffLines.push(line);
      } else if (line.trim().startsWith("at ")) {
        capturingDiff = false;
        traceLines.push(line);
      }
    }

    if (currentTest) {
      failures.push({
        testName: currentTest,
        filePath: currentFile,
        errorMessage: traceLines[0] || "Assertion failure",
        stackTrace: traceLines.slice(0, 10).join("\n"),
        assertionDiff: diffLines.join("\n"),
      });
    }

    return {
      framework: "jest/vitest",
      failedTestCount: failures.length,
      failures,
      summary: `Jest/Vitest: Detected ${failures.length} failed tests.`,
    };
  }

  private static parsePytest(output: string): ParsedTestFailure {
    const lines = output.split("\n");
    const failures: ParsedTestFailure["failures"] = [];
    let currentTest = "";
    let errorMsg = "";

    for (const line of lines) {
      if (line.startsWith("FAILED ")) {
        const parts = line.split(" ");
        currentTest = parts[1] || "";
      } else if (line.startsWith("E   ")) {
        errorMsg = line.slice(4);
        if (currentTest) {
          failures.push({
            testName: currentTest,
            errorMessage: errorMsg,
            stackTrace: line,
          });
          currentTest = "";
        }
      }
    }

    return {
      framework: "pytest",
      failedTestCount: failures.length,
      failures,
      summary: `Pytest: Detected ${failures.length} test failures.`,
    };
  }

  private static parseGoTest(output: string): ParsedTestFailure {
    const lines = output.split("\n");
    const failures: ParsedTestFailure["failures"] = [];

    for (const line of lines) {
      if (line.includes("--- FAIL:")) {
        const match = line.match(/--- FAIL:\s+([a-zA-Z0-9_]+)/);
        if (match) {
          failures.push({
            testName: match[1]!,
            errorMessage: line,
            stackTrace: line,
          });
        }
      }
    }

    return {
      framework: "gotest",
      failedTestCount: failures.length,
      failures,
      summary: `Go Test: Detected ${failures.length} test failures.`,
    };
  }

  private static parseCargoTest(output: string): ParsedTestFailure {
    const lines = output.split("\n");
    const failures: ParsedTestFailure["failures"] = [];

    for (const line of lines) {
      if (line.includes("FAILED") && line.startsWith("test ")) {
        const testName = line.replace(/^test\s+/, "").replace(/\s+\.\.\.\s+FAILED.*$/, "");
        failures.push({
          testName,
          errorMessage: "Test assertion failure",
          stackTrace: line,
        });
      }
    }

    return {
      framework: "cargo",
      failedTestCount: failures.length,
      failures,
      summary: `Cargo: Detected ${failures.length} failed unit tests.`,
    };
  }
}

