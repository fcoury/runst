import assert from "node:assert";
import describe from "node:test";
import { getModulePath } from "./util.js";

describe("removes lib.rs", () => {
  assert.equal(getModulePath("/src/lib.rs"), "tests", "removes lib.rs");
});

describe("removes mod.rs", () => {
  assert.equal(
    "tool::tests",
    getModulePath("/src/tool/mod.rs"),
    "removes mod.rs"
  );
});

describe("concatenates folders mod.rs", () => {
  assert.equal(
    "tool::some::other::tests",
    getModulePath("/src/tool/some/other/mod.rs"),
    "removes mod.rs"
  );
});
