function getModulePath(filePath) {
  const srcIndex = filePath.indexOf("/src/");
  if (srcIndex === -1) {
    return null;
  }

  let modulePath = filePath.substring(srcIndex + 5);
  const parts = modulePath
    .split("/")
    .filter((part) => part !== "mod.rs" && part !== "lib.rs");
  parts.push("tests");
  modulePath = parts.join("::");
  modulePath = modulePath.replace(".rs", "");

  return modulePath;
}

module.exports = { getModulePath };
