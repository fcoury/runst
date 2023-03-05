// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require("vscode");
const path = require("path");

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
  // Use the console to output diagnostic information (console.log) and errors (console.error)
  // This line of code will only be executed once when your extension is activated
  console.log('Congratulations, your extension "runst" is now active!');

  // The command has been defined in the package.json file
  // Now provide the implementation of the command with  registerCommand
  // The commandId parameter must match the command field in package.json
  let disposable = vscode.commands.registerCommand(
    "runst.helloWorld",
    function () {
      // Get the current editor and document
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
      const testRegex = /#\[(tokio::)?test\]\s*fn\s+(\w+)\s*\(/;
      const match = testRegex.exec(functionText);

      if (match === null) {
        console.log("Not a test function:", functionText);
        return;
      }

      const functionName = match[2];
      console.log("Found test function:", functionName);

      const terminal = vscode.window.createTerminal("Runst");
      terminal.show();
      terminal.sendText(
        `cargo test --test ${fileUnit} -- ${functionName} --exact --nocapture`
      );
    }
  );

  context.subscriptions.push(disposable);
}

// This method is called when your extension is deactivated
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
      `(#\\[(tokio::)?test\\]\\s*fn\\s+${currentFunctionName}\\s*\\()|(fn\\s+${currentFunctionName}\\s*\\()`
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
  const testRegex = /#\[(tokio::)?test\]/;
  const match = testRegex.exec(currentLineText);
  if (match === null) {
    // No test function found
    return null;
  } else {
    currentLineNumber = functionQualifierLine;
  }

  // Find the end of the function definition
  const startLine = currentLineNumber;
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

module.exports = {
  activate,
  deactivate,
};
