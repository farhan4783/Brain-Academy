import * as fs from "fs";
import * as path from "path";
import matter from "gray-matter";

export interface SkillMetadata {
  name: string;
  description: string;
  tags?: string[];
  filePath: string;
}

export class SkillRegistry {
  private skillsDir: string;

  constructor(skillsDir?: string) {
    this.skillsDir =
      skillsDir || path.join(process.cwd(), ".hermes", "workspace", "skills");
    if (!fs.existsSync(this.skillsDir)) {
      fs.mkdirSync(this.skillsDir, { recursive: true });
    }
  }

  /**
   * Scans the workspace skills directory for all SKILL.md definitions.
   */
  public listSkills(): SkillMetadata[] {
    if (!fs.existsSync(this.skillsDir)) return [];

    const results: SkillMetadata[] = [];
    const entries = fs.readdirSync(this.skillsDir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const skillFilePath = path.join(this.skillsDir, entry.name, "SKILL.md");
        if (fs.existsSync(skillFilePath)) {
          const content = fs.readFileSync(skillFilePath, "utf-8");
          const parsed = matter(content);
          results.push({
            name: (parsed.data.name as string) || entry.name,
            description:
              (parsed.data.description as string) || "No description provided.",
            tags: (parsed.data.tags as string[]) || [],
            filePath: skillFilePath,
          });
        }
      }
    }

    return results;
  }

  /**
   * Returns a compact catalog for progressive disclosure in system prompts.
   */
  public getCatalogPrompt(): string {
    const skills = this.listSkills();
    if (skills.length === 0) {
      return "No custom procedural skills installed.";
    }

    const lines = ["### Available Procedural Skills (L4 Skills Catalog):"];
    for (const skill of skills) {
      lines.push(`- **${skill.name}**: ${skill.description} (File: ${skill.filePath})`);
    }
    return lines.join("\n");
  }

  /**
   * Reads full instructions for a specific skill when loaded.
   */
  public loadSkill(skillName: string): string | null {
    const skillPath = path.join(this.skillsDir, skillName, "SKILL.md");
    if (fs.existsSync(skillPath)) {
      return fs.readFileSync(skillPath, "utf-8");
    }
    return null;
  }

  /**
   * Saves or updates a synthesized skill.
   */
  public saveSkill(
    skillName: string,
    metadata: { description: string; tags?: string[] },
    body: string
  ): string {
    const folder = path.join(this.skillsDir, skillName);
    if (!fs.existsSync(folder)) {
      fs.mkdirSync(folder, { recursive: true });
    }

    const fullContent = [
      "---",
      `name: ${skillName}`,
      `description: ${metadata.description}`,
      metadata.tags ? `tags: [${metadata.tags.join(", ")}]` : "",
      "---",
      "",
      body.trim(),
      "",
    ].join("\n");

    const targetFile = path.join(folder, "SKILL.md");
    fs.writeFileSync(targetFile, fullContent, "utf-8");
    return targetFile;
  }
}
