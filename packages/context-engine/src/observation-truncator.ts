import { ToolExecutionResult } from "@hermes/shared";
import { TestFailureParser } from "./test-failure-parser.js";

export interface TruncationOptions {
  maxLines?: number;
  preserveHead?: number;
  preserveTail?: number;
}

export class ObservationTruncator {
  private static readonly DEFAULT_MAX_LINES = 50;
  private static readonly STACK_TRACE_REGEX =
    /^\s*(at\s+|File\s+".*",\s+line\s+\d+|[A-Za-z0-9_]+Error:|Exception:|panic:|Traceback \(most recent call last\):)/i;

  /**
   * Truncates long terminal outputs (>50 lines), prioritizing parsed test failure diffs,
   * preserving error stack traces, and strictly trimming compiler/test suite noise.
   */
  public static truncate(
    result: ToolExecutionResult,
    options: TruncationOptions = {}
  ): ToolExecutionResult {
    const maxLines = options.maxLines ?? this.DEFAULT_MAX_LINES;
    const combined = `${result.stdout}\n${result.stderr}`.trim();
    const lines = combined.split("\n");

    if (lines.length <= maxLines) {
      return result;
    }

    // 1. Try structured test failure extraction
    const parsedTestFailure = TestFailureParser.parse(combined);
    if (parsedTestFailure && parsedTestFailure.failedTestCount > 0) {
      const formattedFailures = parsedTestFailure.failures
        .slice(0, 3)
        .map((f, i) => {
          return [
            `Failure #${i + 1}: ${f.testName}${f.filePath ? ` (${f.filePath})` : ""}`,
            f.assertionDiff ? `Assertion Diff:\n${f.assertionDiff}` : `Error: ${f.errorMessage}`,
            `Stack:\n${f.stackTrace.slice(0, 400)}`,
          ].join("\n");
        })
        .join("\n\n");

      const reconstructedOutput = [
        `[Hermes Test Diagnostic: ${parsedTestFailure.summary}]`,
        formattedFailures,
        `\n[Omitted ${lines.length - 30} lines of passing tests & build output]`,
        ...lines.slice(-5),
      ].join("\n");

      return {
        ...result,
        stdout: reconstructedOutput,
        stderr: "",
        truncated: true,
        originalLinesCount: lines.length,
      };
    }

    // 2. Generic AST / stack trace preservation
    const preserveHead = options.preserveHead ?? 15;
    const preserveTail = options.preserveTail ?? 20;

    const headLines = lines.slice(0, preserveHead);
    const tailLines = lines.slice(-preserveTail);
    const middleLines = lines.slice(preserveHead, -preserveTail);

    const extractedTraces: string[] = [];
    for (let i = 0; i < middleLines.length; i++) {
      const line = middleLines[i];
      if (line && this.STACK_TRACE_REGEX.test(line)) {
        extractedTraces.push(line);
        if (i + 1 < middleLines.length && middleLines[i + 1]?.trim().startsWith("at ")) {
          extractedTraces.push(middleLines[i + 1]!);
          i++;
        }
      }
    }

    const trimmedCount = middleLines.length - extractedTraces.length;

    const reconstructedOutput = [
      ...headLines,
      `\n... [Hermes AST Truncator: Omitting ${trimmedCount} verbose lines of build/terminal output] ...\n`,
      ...(extractedTraces.length > 0
        ? ["[Preserved Error Stack Traces]:", ...extractedTraces.slice(0, 15), ""]
        : []),
      ...tailLines,
    ].join("\n");

    return {
      ...result,
      stdout: reconstructedOutput,
      stderr: "",
      truncated: true,
      originalLinesCount: lines.length,
    };
  }
}
