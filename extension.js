const vscode = require("vscode");
const path = require("path");
const fs = require("fs");
const { getModulePath } = require("./util");

/**
 * @param {vscode.ExtensionContext} context
 */
async function activate(context) {
  function initStatusBarItem() {
    const statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left,
      100
    );
    let currentTask = context.workspaceState.get("currentTask") || "Test";
    statusBarItem.text = `Runst: ${currentTask}`;
    statusBarItem.command = "runst.toggleTask";
    statusBarItem.show();

    return statusBarItem;
  }

  const statusBarItem = initStatusBarItem();

  const toggleTaskDisposable = vscode.commands.registerCommand(
    "runst.toggleTask",
    function () {
      const currentTask = context.workspaceState.get("currentTask") || "Test";
      const newTask = currentTask === "Test" ? "Watch" : "Test";
      context.workspaceState.update("currentTask", newTask);
      statusBarItem.text = `Runst: ${newTask}`;
    }
  );

  const runAllTestsDisposable = vscode.commands.registerCommand(
    "runst.runAllTests",
    function () {
      const data = {
        command: "",
        title: "Runst: All Tests",
      };
      context.workspaceState.update("lastTestInfo", data);
      runCommandInTerminal(data);
    }
  );

  const runCurrentTestDisposable = vscode.commands.registerCommand(
    "runst.runCurrentTest",
    function () {
      const editor = vscode.window.activeTextEditor;
      const document = editor.document;

      const fileName = document.fileName;
      const filePath = fileName.substring(0, fileName.lastIndexOf("/"));
      const fileUnit = path.parse(fileName).name;

      if (!fileName.includes(".rs")) {
        console.log("Not a rust file");
        return;
      }

      // Get the current cursor position
      const position = editor.selection.active;

      // Find the range of the function surrounding the cursor
      const functionRange = getSurroundingFunctionRange(document, position);

      if (functionRange === null) {
        return;
      }

      // Check if the function is a test function
      const functionText = document.getText(functionRange);
      const testRegex =
        /#\[(tokio::)?test(\([^)]*\))?\]\s*(async\s)?fn\s+(\w+)\s*\(/;
      const match = testRegex.exec(functionText);

      if (match === null) {
        console.log("Not a test function:", functionText);
        return;
      }

      const functionName = match[4];
      console.log("Found test function:", functionName);

      // check if the file is in a mod tests
      const src = document.getText();
      const isModTest = checkModTest(src, position.line);

      const data = {};

      const result = isInCargoWorkspace(filePath);
      let pkg = "";
      if (result.isInWorkspace) {
        console.log(`Module name: ${result.moduleName}`);
        pkg = `--package ${result.moduleName} `;
      } else {
        console.log("Not in cargo workspace");
      }

      // cargo test --package mflow --test postgres_entity -- entity_operations --exact --nocapture

      if (isModTest) {
        const qualifiedName = getModulePath(fileName);
        data.command = `${pkg}--lib -- ${qualifiedName}::${functionName} --exact --nocapture`;
        data.title = `Runst: ${functionName}`;
      } else {
        data.command = `${pkg}--test ${fileUnit} -- ${functionName} --exact --nocapture`;
        data.title = `Runst: ${fileUnit}:${functionName}`;
      }

      console.log("Running command:", data.command);
      context.workspaceState.update("lastTestInfo", data);
      runCommandInTerminal(data);
    }
  );

  // re-runs the last test that was run
  const runLastTestDisposable = vscode.commands.registerCommand(
    "runst.runLastTest",
    function () {
      const data = context.workspaceState.get("lastTestInfo");
      if (data) {
        runCommandInTerminal(data);
      }
    }
  );

  context.subscriptions.push(runCurrentTestDisposable);
  context.subscriptions.push(runLastTestDisposable);
  context.subscriptions.push(toggleTaskDisposable);
  context.subscriptions.push(runAllTestsDisposable);

  // runs a given command on the terminal and gives it a title
  async function runCommandInTerminal(data) {
    const { command, title } = data;
    const terminals = vscode.window.terminals;
    let terminal;
    if (terminals.length > 0) {
      // Reuse the first terminal if one is available
      terminal = terminals.find(
        (terminal) => terminal.name && terminal.name.startsWith("Runst: ")
      );
    }

    if (terminal) {
      terminal.dispose();
    }

    // Create a new terminal if no terminals are available
    terminal = vscode.window.createTerminal({
      name: title,
      isTransient: true,
    });

    terminal.show(true);

    const currentTask = context.workspaceState.get("currentTask") || "Test";
    const cmd =
      currentTask === "Test"
        ? `cargo test ${command}`
        : `cargo watch -x 'test ${command}'`;
    terminal.sendText(cmd);
    // doesn't keep the terminal focused
  }
}

function deactivate() {}

// Helper function to get the range of the function surrounding the given position
function getSurroundingFunctionRange(document, position) {
  // Check if the cursor is inside a function definition
  const currentLine = document.lineAt(position.line).text;
  const currentFunctionNameMatch = currentLine.match(/fn\s+(\w+)\s*\(/);
  if (currentFunctionNameMatch) {
    const currentFunctionName = currentFunctionNameMatch[1];
    const currentFunctionDefinition = document.getText().split(currentLine)[1];
    const startLine = document.lineAt(position.line - 1).lineNumber;
    const endLine = document.lineCount - 1;
    const endChar = document.lineAt(endLine).range.end.character;
    const functionRange = new vscode.Range(startLine, 0, endLine, endChar);
    const functionText = document.getText(functionRange);
    const regex = new RegExp(
      `(#\\[(tokio::)?test(\\([^)]*\\))?\\]\\s*fn\\s+${currentFunctionName}\\s*\\()|(fn\\s+${currentFunctionName}\\s*\\()`
    );
    const match = regex.exec(functionText);
    if (match !== null) {
      // Return the function range if the function is a test function
      return functionRange;
    }
  }

  // Search for the nearest function definition above the cursor position
  let currentLineNumber = position.line - 1;
  if (currentLineNumber < 0) {
    // No function definition found
    return null;
  }
  let currentLineText = document.lineAt(currentLineNumber).text;

  while (currentLineNumber >= 0 && !currentLineText.includes("fn ")) {
    currentLineNumber--;
    currentLineText = document.lineAt(currentLineNumber).text;
  }

  if (currentLineNumber < 0) {
    // No function definition found
    return null;
  }

  // finds the first non-empty line above the function definition
  let functionQualifierLine = currentLineNumber;
  while (functionQualifierLine >= 0) {
    functionQualifierLine--;
    currentLineText = document.lineAt(functionQualifierLine).text;
    if (currentLineText.trim() !== "") {
      break;
    }
  }

  // Checks if the non-empty line is either #[test] or #[tokio::test]
  const testRegex = /#\[(tokio::)?test(\([^)]*\))?\]/;
  const match = testRegex.exec(currentLineText);
  if (match === null) {
    // No test function found
    return null;
  } else {
    currentLineNumber = functionQualifierLine + 1;
    currentLineText = document.lineAt(currentLineNumber).text;
  }

  // Find the end of the function definition
  const startLine = functionQualifierLine;
  let endLine = currentLineNumber + 1;

  while (endLine < document.lineCount && !currentLineText.includes("{")) {
    endLine++;
    currentLineText += document.lineAt(endLine).text;
  }

  if (endLine >= document.lineCount) {
    // No end of function definition found
    return null;
  }

  // Return the function range
  const endChar = document.lineAt(endLine).range.end.character;
  const functionRange = new vscode.Range(startLine, 0, endLine, endChar);
  return functionRange;
}

function findWorkspaceCargoToml(directory) {
  const cargoTomlPath = path.join(directory, "Cargo.toml");
  if (fs.existsSync(cargoTomlPath)) {
    const cargoTomlContents = fs.readFileSync(cargoTomlPath, "utf8");
    if (cargoTomlContents.includes("[workspace]")) {
      return cargoTomlPath;
    }
  }
  const parentDirectory = path.dirname(directory);
  if (parentDirectory === directory) {
    return null;
  }
  return findWorkspaceCargoToml(parentDirectory);
}

function findModuleName(workspaceCargoTomlPath, filePath) {
  const cargoTomlContents = fs.readFileSync(workspaceCargoTomlPath, "utf8");
  const matches = cargoTomlContents.match(/members\s*=\s*\[([\s\S]*?)\]/);
  if (matches && matches[1]) {
    const membersList = matches[1];
    const modules = membersList
      .split(",")
      .map((module) => module.trim().replace(/["']/g, ""));
    let rootModulePath = null;

    for (const module of modules) {
      const modulePath = path.join(
        path.dirname(workspaceCargoTomlPath),
        module
      );
      if (module === ".") {
        rootModulePath = modulePath;
        continue; // Skip the root module for now.
      }
      if (filePath.startsWith(modulePath)) {
        return module;
      }
    }

    // If no module matched and the file is under the root module, return '.'.
    if (rootModulePath && filePath.startsWith(rootModulePath)) {
      return ".";
    }
  }
  return null;
}

function isInCargoWorkspace(filePath) {
  const directory = path.dirname(filePath);
  const workspaceCargoTomlPath = findWorkspaceCargoToml(directory);
  if (workspaceCargoTomlPath) {
    const moduleName = findModuleName(workspaceCargoTomlPath, filePath);
    if (moduleName) {
      return { isInWorkspace: true, moduleName: moduleName };
    }
  }
  return { isInWorkspace: false, moduleName: null };
}

function checkModTest(src, currentLine) {
  let allLines = src.split("\n");
  const lines = allLines
    .slice(0, currentLine)
    .filter((l) => l.trim().length > 0);
  const modTestsLine = lines.findIndex((l) => l.includes("mod tests"));
  if (modTestsLine < 0) {
    return false;
  }

  const cfgTestLine = lines[modTestsLine - 1];
  return cfgTestLine.includes("#[cfg(test)]");
}

module.exports = {
  activate,
  deactivate,
};
