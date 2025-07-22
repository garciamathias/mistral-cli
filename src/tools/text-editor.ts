import * as fs from "fs-extra";
import * as path from "path";
import { ToolResult, EditorCommand } from "../types";
import { ConfirmationService } from "../utils/confirmation-service";

export class TextEditorTool {
  private editHistory: EditorCommand[] = [];
  private confirmationService = ConfirmationService.getInstance();

  async view(
    filePath: string,
    viewRange?: [number, number]
  ): Promise<ToolResult> {
    try {
      const resolvedPath = path.resolve(filePath);

      if (await fs.pathExists(resolvedPath)) {
        const stats = await fs.stat(resolvedPath);

        if (stats.isDirectory()) {
          const files = await fs.readdir(resolvedPath);
          return {
            success: true,
            output: `Directory contents of ${filePath}:\n${files.join("\n")}`,
          };
        }

        const content = await fs.readFile(resolvedPath, "utf-8");
        const lines = content.split("\n");

        if (viewRange) {
          const [start, end] = viewRange;
          const selectedLines = lines.slice(start - 1, end);
          const numberedLines = selectedLines
            .map((line, idx) => `${start + idx}: ${line}`)
            .join("\n");

          return {
            success: true,
            output: `Lines ${start}-${end} of ${filePath}:\n${numberedLines}`,
          };
        }

        const totalLines = lines.length;
        const displayLines = totalLines > 10 ? lines.slice(0, 10) : lines;
        const numberedLines = displayLines
          .map((line, idx) => `${idx + 1}: ${line}`)
          .join("\n");
        const additionalLinesMessage =
          totalLines > 10 ? `\n... +${totalLines - 10} lines` : "";

        return {
          success: true,
          output: `Contents of ${filePath}:\n${numberedLines}${additionalLinesMessage}`,
        };
      } else {
        return {
          success: false,
          error: `File or directory not found: ${filePath}`,
        };
      }
    } catch (error: any) {
      return {
        success: false,
        error: `Error viewing ${filePath}: ${error.message}`,
      };
    }
  }

  async strReplace(
    filePath: string,
    oldStr: string,
    newStr: string
  ): Promise<ToolResult> {
    try {
      const resolvedPath = path.resolve(filePath);

      if (!(await fs.pathExists(resolvedPath))) {
        return {
          success: false,
          error: `File not found: ${filePath}`,
        };
      }

      const content = await fs.readFile(resolvedPath, "utf-8");

      if (!content.includes(oldStr)) {
        return {
          success: false,
          error: `String not found in file: "${oldStr}"`,
        };
      }

      // Check if user has already accepted file operations for this session
      const sessionFlags = this.confirmationService.getSessionFlags();
      if (!sessionFlags.fileOperations && !sessionFlags.allOperations) {
        // Create a proper diff preview showing the change
        const newContent = content.replace(oldStr, newStr);
        const oldLines = content.split("\n");
        const newLines = newContent.split("\n");
        const diffContent = this.generateDiff(oldLines, newLines, filePath);

        const confirmationResult =
          await this.confirmationService.requestConfirmation(
            {
              operation: "Edit file",
              filename: filePath,
              showVSCodeOpen: false,
              content: diffContent,
            },
            "file"
          );

        if (!confirmationResult.confirmed) {
          return {
            success: false,
            error: confirmationResult.feedback || "File edit cancelled by user",
          };
        }
      }

      const newContent = content.replace(oldStr, newStr);
      await fs.writeFile(resolvedPath, newContent, "utf-8");

      this.editHistory.push({
        command: "str_replace",
        path: filePath,
        old_str: oldStr,
        new_str: newStr,
      });

      // Generate diff output
      const oldLines = content.split("\n");
      const newLines = newContent.split("\n");
      const diff = this.generateDiff(oldLines, newLines, filePath);

      return {
        success: true,
        output: diff,
      };
    } catch (error: any) {
      return {
        success: false,
        error: `Error replacing text in ${filePath}: ${error.message}`,
      };
    }
  }

  async create(filePath: string, content: string): Promise<ToolResult> {
    try {
      const resolvedPath = path.resolve(filePath);

      // Check if user has already accepted file operations for this session
      const sessionFlags = this.confirmationService.getSessionFlags();
      if (!sessionFlags.fileOperations && !sessionFlags.allOperations) {
        // Create a diff-style preview for file creation
        const contentLines = content.split("\n");
        const diffContent = [
          `Created ${filePath}`,
          `--- /dev/null`,
          `+++ b/${filePath}`,
          `@@ -0,0 +1,${contentLines.length} @@`,
          ...contentLines.map((line) => `+${line}`),
        ].join("\n");

        const confirmationResult =
          await this.confirmationService.requestConfirmation(
            {
              operation: "Write",
              filename: filePath,
              showVSCodeOpen: false,
              content: diffContent,
            },
            "file"
          );

        if (!confirmationResult.confirmed) {
          return {
            success: false,
            error:
              confirmationResult.feedback || "File creation cancelled by user",
          };
        }
      }

      const dir = path.dirname(resolvedPath);
      await fs.ensureDir(dir);
      await fs.writeFile(resolvedPath, content, "utf-8");

      this.editHistory.push({
        command: "create",
        path: filePath,
        content,
      });

      // Generate diff output using the same method as str_replace
      const oldLines: string[] = []; // Empty for new files
      const newLines = content.split("\n");
      const diff = this.generateDiff(oldLines, newLines, filePath);

      return {
        success: true,
        output: diff,
      };
    } catch (error: any) {
      return {
        success: false,
        error: `Error creating ${filePath}: ${error.message}`,
      };
    }
  }

  async insert(
    filePath: string,
    insertLine: number,
    content: string
  ): Promise<ToolResult> {
    try {
      const resolvedPath = path.resolve(filePath);

      if (!(await fs.pathExists(resolvedPath))) {
        return {
          success: false,
          error: `File not found: ${filePath}`,
        };
      }

      const fileContent = await fs.readFile(resolvedPath, "utf-8");
      const lines = fileContent.split("\n");

      lines.splice(insertLine - 1, 0, content);
      const newContent = lines.join("\n");

      await fs.writeFile(resolvedPath, newContent, "utf-8");

      this.editHistory.push({
        command: "insert",
        path: filePath,
        insert_line: insertLine,
        content,
      });

      return {
        success: true,
        output: `Successfully inserted content at line ${insertLine} in ${filePath}`,
      };
    } catch (error: any) {
      return {
        success: false,
        error: `Error inserting content in ${filePath}: ${error.message}`,
      };
    }
  }

  async undoEdit(): Promise<ToolResult> {
    if (this.editHistory.length === 0) {
      return {
        success: false,
        error: "No edits to undo",
      };
    }

    const lastEdit = this.editHistory.pop()!;

    try {
      switch (lastEdit.command) {
        case "str_replace":
          if (lastEdit.path && lastEdit.old_str && lastEdit.new_str) {
            const content = await fs.readFile(lastEdit.path, "utf-8");
            const revertedContent = content.replace(
              lastEdit.new_str,
              lastEdit.old_str
            );
            await fs.writeFile(lastEdit.path, revertedContent, "utf-8");
          }
          break;

        case "create":
          if (lastEdit.path) {
            await fs.remove(lastEdit.path);
          }
          break;

        case "insert":
          if (lastEdit.path && lastEdit.insert_line) {
            const content = await fs.readFile(lastEdit.path, "utf-8");
            const lines = content.split("\n");
            lines.splice(lastEdit.insert_line - 1, 1);
            await fs.writeFile(lastEdit.path, lines.join("\n"), "utf-8");
          }
          break;
      }

      return {
        success: true,
        output: `Successfully undid ${lastEdit.command} operation`,
      };
    } catch (error: any) {
      return {
        success: false,
        error: `Error undoing edit: ${error.message}`,
      };
    }
  }

  private generateDiff(
    oldLines: string[],
    newLines: string[],
    filePath: string
  ): string {
    // Count actual changes
    let addedLines = 0;
    let removedLines = 0;
    let i = 0,
      j = 0;

    // Simple algorithm to detect changes
    while (i < oldLines.length || j < newLines.length) {
      if (
        i < oldLines.length &&
        j < newLines.length &&
        oldLines[i] === newLines[j]
      ) {
        i++;
        j++;
      } else if (
        i < oldLines.length &&
        (j >= newLines.length || oldLines[i] !== newLines[j])
      ) {
        removedLines++;
        i++;
      } else if (j < newLines.length) {
        addedLines++;
        j++;
      }
    }

    let summary = `Updated ${filePath}`;
    if (addedLines > 0 && removedLines > 0) {
      summary += ` with ${addedLines} addition${
        addedLines !== 1 ? "s" : ""
      } and ${removedLines} removal${removedLines !== 1 ? "s" : ""}`;
    } else if (addedLines > 0) {
      summary += ` with ${addedLines} addition${addedLines !== 1 ? "s" : ""}`;
    } else if (removedLines > 0) {
      summary += ` with ${removedLines} removal${
        removedLines !== 1 ? "s" : ""
      }`;
    } else {
      summary += " with changes";
    }

    // Generate proper git-style diff format
    let diff = summary + "\n";
    diff += `--- a/${filePath}\n`;
    diff += `+++ b/${filePath}\n`;
    diff += `@@ -1,${oldLines.length} +1,${newLines.length} @@\n`;

    // Generate unified diff
    i = 0;
    j = 0;
    const CONTEXT_LINES = 3;

    while (i < oldLines.length || j < newLines.length) {
      const oldLine = i < oldLines.length ? oldLines[i] : null;
      const newLine = j < newLines.length ? newLines[j] : null;

      if (oldLine === newLine && oldLine !== null) {
        // Context line
        diff += ` ${oldLine}\n`;
        i++;
        j++;
      } else {
        // Show removed lines
        if (oldLine !== null) {
          diff += `-${oldLine}\n`;
          i++;
        }
        // Show added lines
        if (newLine !== null) {
          diff += `+${newLine}\n`;
          j++;
        }
      }
    }

    return diff.trim();
  }

  getEditHistory(): EditorCommand[] {
    return [...this.editHistory];
  }
}
