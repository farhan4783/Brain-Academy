import { ToolExecutionResult } from "@hermes/shared";

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
   * Truncates long terminal outputs (>50 lines), preserving stack traces,
   * critical test failure summaries, and trimming intermediate repetitive noise.
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

    const preserveHead = options.preserveHead ?? 15;
    const preserveTail = options.preserveTail ?? 25;

    const headLines = lines.slice(0, preserveHead);
    const tailLines = lines.slice(-preserveTail);
    const middleLines = lines.slice(preserveHead, -preserveTail);

    // Extract any critical stack traces or errors from the middle section
    const extractedTraces: string[] = [];
    for (let i = 0; i < middleLines.length; i++) {
      const line = middleLines[i];
      if (line && this.STACK_TRACE_REGEX.test(line)) {
        extractedTraces.push(line);
        // Include adjacent context lines for the stack trace
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
        ? ["[Preserved Error Stack Traces]:", ...extractedTraces.slice(0, 20), ""]
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
