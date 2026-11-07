import * as diff from "diff";

export interface FilePatchRecord {
  filePath: string;
  patch: string;
  addedLines: number;
  removedLines: number;
  lastUpdated: string;
}

export class GitPatchMemory {
  private patches: Map<string, FilePatchRecord> = new Map();

  /**
   * Records or updates a file diff from git or direct before/after content.
   */
  public recordDiff(filePath: string, oldContent: string, newContent: string): string {
    const patch = diff.createPatch(filePath, oldContent, newContent, "original", "modified");
    const parsed = diff.parsePatch(patch);
    
    let added = 0;
    let removed = 0;

    for (const p of parsed) {
      for (const hunk of p.hunks) {
        for (const line of hunk.lines) {
          if (line.startsWith("+") && !line.startsWith("+++")) added++;
          if (line.startsWith("-") && !line.startsWith("---")) removed++;
        }
      }
    }

    this.patches.set(filePath, {
      filePath,
      patch,
      addedLines: added,
      removedLines: removed,
      lastUpdated: new Date().toISOString(),
    });

    return patch;
  }

  /**
   * Ingest raw git diff output from the sandbox.
   */
  public ingestRawGitDiff(rawDiff: string): void {
    if (!rawDiff.trim()) return;
    const parsed = diff.parsePatch(rawDiff);
    for (const p of parsed) {
      const fileName = p.newFileName || p.oldFileName || "unknown";
      this.patches.set(fileName, {
        filePath: fileName,
        patch: diff.formatPatch(p),
        addedLines: 0,
        removedLines: 0,
        lastUpdated: new Date().toISOString(),
      });
    }
  }

  /**
   * Returns formatted summary of active patches for LLM context injection.
   */
  public getMemoryContextPrompt(): string {
    if (this.patches.size === 0) {
      return "No active file modifications recorded in git memory.";
    }

    const lines: string[] = ["### Active Code Modifications (Git Patch Memory):"];
    for (const [file, record] of this.patches.entries()) {
      lines.push(`\n#### ${file}`);
      lines.push("```diff");
      lines.push(record.patch.trim());
      lines.push("```");
    }
    return lines.join("\n");
  }

  public getPatches(): Record<string, string> {
    const result: Record<string, string> = {};
    for (const [file, record] of this.patches.entries()) {
      result[file] = record.patch;
    }
    return result;
  }
}

