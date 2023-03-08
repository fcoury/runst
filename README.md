# runst - Speedy Rust Test Runner

Runst is a very simple Rust test remembers your last executed tests and allow you to retrigger it with a simple key combo. It also supports `cargo watch` and can run unit and integration tests.

![runst demo](images/demo.gif)

## Keyboard shortcuts

| Function                                 | Mac Shortcut            | Linux/Windows Shortcut |
|------------------------------------------|-------------------------|------------------------|
| Run test under cursor                    | `⌘⇧A` (Cmd+Shift+A)      | `Ctrl+Shift+A`         |
| Re-run last test                         | `⌘⌃A` (Cmd+Ctrl+A)       | `Ctrl+Shift+R`         |
| Run all tests (cargo test)               | `⌘⌃T` (Cmd+Ctrl+T)       | `Ctrl+Shift+T`         |
| Toggle test run/watch mode<sup>†</sup>   | `⌥T` (Opt+T)             | `Ctrl+Shift+T`         |

† Requires `cargo-watch` to be installed.
