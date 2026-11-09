export interface SecurityScanResult {
  safe: boolean;
  threatLevel: "NONE" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  flags: string[];
}

export class PromptSecurityScanner {
  private static readonly INJECTION_PATTERNS = [
    { pattern: /ignore\s+(all\s+)?(previous|prior)\s+instructions/i, flag: "INSTRUCTION_OVERRIDE", severity: "HIGH" },
    { pattern: /you\s+are\s+now\s+in\s+(developer|unrestricted|god)\s+mode/i, flag: "JAILBREAK_ATTEMPT", severity: "HIGH" },
    { pattern: /system\s+prompt\s+leak|print\s+(your\s+)?system\s+prompt/i, flag: "SYSTEM_PROMPT_EXTRACTION", severity: "MEDIUM" },
    { pattern: /cat\s+\/etc\/(passwd|shadow)|whoami|id\s*;\s*uname/i, flag: "HOST_PROBING", severity: "HIGH" },
    { pattern: /curl.*\|.*(bash|sh)|wget.*\|.*(bash|sh)/i, flag: "UNTRUSTED_EXECUTION", severity: "CRITICAL" },
    { pattern: /rm\s+-rf\s+(\/|~|\$HOME|\*)/i, flag: "DESTRUCTIVE_COMMAND", severity: "CRITICAL" },
    { pattern: /base64\s+-d\s*\|.*(bash|sh)/i, flag: "OBFUSCATED_PAYLOAD", severity: "HIGH" },
  ];

  public static scan(input: string): SecurityScanResult {
    const flags: string[] = [];
    let maxSeverity: SecurityScanResult["threatLevel"] = "NONE";

    for (const rule of this.INJECTION_PATTERNS) {
      if (rule.pattern.test(input)) {
        flags.push(rule.flag);
        if (rule.severity === "CRITICAL") maxSeverity = "CRITICAL";
        else if (rule.severity === "HIGH" && maxSeverity !== "CRITICAL") maxSeverity = "HIGH";
        else if (rule.severity === "MEDIUM" && maxSeverity === "NONE") maxSeverity = "MEDIUM";
      }
    }

    return {
      safe: maxSeverity !== "CRITICAL" && maxSeverity !== "HIGH",
      threatLevel: maxSeverity,
      flags,
    };
  }
}

