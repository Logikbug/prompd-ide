# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**IMPORTANT: Before working in this codebase, read these coordination files:**
- `~/.claude/CLAUDE.md` (at `C:\Users\sbake\.claude\CLAUDE.md`) - Overall project coordination and sprint priorities
- **`C:\git\github\Logikbug\IDE-TEAM.md`** - PRIMARY reference for this repo with implementation details, known issues, and current sprint tasks

## Project Overview
This is a VS Code fork being transformed into **Prompd IDE** - a standalone IDE for professional prompt engineering. The project provides a complete ecosystem for creating, sharing, and deploying AI workflows using the `.prompd` format.

## Essential Commands

### Build & Compilation
```bash
# Primary compilation commands
npm run compile              # Full compilation (client + extensions + media)
npm run watch               # Watch mode for development (parallel client + extensions)
npm run watch-client        # Watch client code only (src -> out)
npm run watch-extensions    # Watch extensions only

# Production builds
npm run compile-build       # Production build with mangling optimization
npm run compile-extensions-build  # Build extensions for production

# Individual compilation tasks
npm run compile-web         # Web-specific compilation
npm run compile-cli         # CLI-specific compilation
npm run gulp [task]        # Direct gulp task execution (8GB heap allocated)
```

### Testing
```bash
# Test commands
npm run test-node           # Node.js unit tests (Mocha, TDD style)
npm run test-browser        # Browser tests (Playwright)
npm run test-extension      # Extension tests (vscode-test)
npm run smoketest          # End-to-end smoke tests

# Single test file (Windows)
./scripts/test.bat [arguments]  # Runs Electron test runner

# Code quality checks
npm run eslint             # ESLint validation
npm run stylelint          # CSS/SCSS linting
npm run hygiene           # Code hygiene checks
npm run tsec-compile-check # TypeScript security analysis
npm run valid-layers-check # Validate architectural layers
npm run monaco-compile-check # Monaco editor type checking
```

### Launch Commands
```bash
# Standalone Prompd IDE (Windows primary)
prompd-ide.bat             # Full standalone with prompd-ide.exe, custom profile
launch-clean.bat           # Clean profile dev mode with extension development
./scripts/code.bat         # Standard VS Code development mode

# With workspace specification
launch-clean.bat "C:\path\to\workspace"
prompd-ide.bat "C:\path\to\file.prompd"

# Watch mode management
npm run watchd            # Start watch daemon
npm run kill-watchd       # Kill watch daemon
npm run restart-watchd    # Restart watch daemon
```

### CLI Integration
```bash
# Built-in prompd CLI (extensions/prompd/bin/prompd.exe)
extensions/prompd/bin/prompd.exe validate [file.prompd]
extensions/prompd/bin/prompd.exe execute [file.prompd] --params [params.json] --provider [openai|anthropic] --model [model]
extensions/prompd/bin/prompd.exe providers
extensions/prompd/bin/prompd.exe --help
```

## Architecture

### Core Structure
```
src/vs/
├── workbench/           # Main workbench UI and services
│   ├── contrib/prompd/  # Prompd core integration (partial)
│   └── services/prompd/ # Prompd service layer (partial)
├── platform/            # Cross-platform services
│   └── prompd/         # Platform-specific Prompd services
├── editor/             # Monaco editor core
└── base/               # Shared utilities
```

### Prompd Extension
```
extensions/prompd/
├── src/                # TypeScript source
├── out/                # Compiled JavaScript
├── bin/prompd.exe      # Embedded CLI binary
├── syntaxes/           # TextMate grammars
├── icons/              # File type icons
└── package.json        # Extension manifest (60+ commands)
```

### Build System
- **Entry**: `gulpfile.js` → `build/gulpfile.js`
- **Compilation**: `build/lib/compilation.js` (TypeScript pipeline)
- **Memory**: `--max-old-space-size=8192` for large builds
- **Extensions**: Separate build pipeline via `gulpfile.extensions.js`

## File Formats
- `.prompd` - Structured prompts (YAML frontmatter + Markdown)
- `.pdflow` - Visual workflows (JSON-based)
- `.pdproj` - Project files (YAML configuration)
- `.pdpkg` - Package bundles (ZIP archives)

## Key Configuration Files
- `product.prompd.json` - Prompd IDE branding and configuration
- `product.json` - Base VS Code configuration
- `default-settings.json` - Default IDE settings
- `.vscode/launch.json` - Debug configurations

## Development Workflow

### Extension Development
1. Edit files in `extensions/prompd/src/`
2. Run `npm run watch-extensions` for auto-rebuild
3. Launch with `launch-clean.bat` for isolated testing
4. Extension auto-reloads in development mode

### Core IDE Changes
1. Edit files in `src/vs/workbench/contrib/prompd/` or `src/vs/platform/prompd/`
2. Run `npm run watch-client` for incremental builds
3. Launch with `./scripts/code.bat` for development
4. Use "Launch VS Code Internal" debug configuration

### Production Build
1. `npm run compile-build` (optimized compilation)
2. `npm run compile-extensions-build` (extension build)
3. Run `build-prompd-ide.cjs` to generate executable
4. Test with `prompd-ide.bat` for standalone operation

## Platform Notes
- **Primary Platform**: Windows (all launchers are .bat files)
- **Node.js**: Requires 8GB heap allocation for builds
- **Electron**: Version 37.2.3
- **TypeScript**: Uses typescript@next for latest features
- **Build Target**: VS Code fork based on version 1.104.0
- **Package Manager**: npm (uses package-lock.json for deterministic builds)

## Common Issues

### Build Issues
```bash
# TypeScript compilation errors
npm run compile              # Full rebuild
npm run tsec-compile-check   # Security check

# Memory issues
# Increase heap in package.json scripts if needed
```

### Extension Not Loading
1. Check `extensions/prompd/out/` contains compiled files
2. Run `npm run compile-extensions` to rebuild extension
3. Verify `package.json` main points to correct entry
4. Confirm extension path in launch scripts
5. Check console for extension loading errors

### Memory Issues
- Build fails with out-of-memory: Scripts already allocate 8GB heap (`--max-old-space-size=8192`)
- Increase heap further if needed by modifying package.json scripts
- Use `npm run compile` instead of `npm run watch` for one-time builds

### TypeScript Compilation Errors
- Check TypeScript version: Uses `typescript@next` for latest features
- Run `npm run tsec-compile-check` for security violations
- Individual layer validation: `npm run valid-layers-check`
- Monaco editor check: `npm run monaco-compile-check`

### Standalone Mode Issues
- Missing executable: Run `build-prompd-ide.cjs`
- Extension not bundled: Check `product.prompd.json` configuration
- File associations: Verify both extension and product configurations
- Profile isolation: Ensure separate user data directory (`%USERPROFILE%\.prompd-ide`)

## Validation Commands

### Validate Prompd Files
```bash
# Validate individual files
extensions/prompd/bin/prompd.exe validate "C:\path\to\file.prompd"

# Validate project files
extensions/prompd/bin/prompd.exe validate "C:\path\to\project.pdproj"

# Execute with parameters
extensions/prompd/bin/prompd.exe execute "file.prompd" --params "params.json" --provider openai --model gpt-4o-mini
```

## Important Architecture Decisions

### Standalone Isolation
- Prompd IDE runs completely isolated from VS Code installations
- Custom product configuration (`product.prompd.json`) ensures no conflicts
- User data stored in `%USERPROFILE%\.prompd-ide` (separate from VS Code)
- Marketplace and telemetry completely disabled for enterprise security

### Extension System
- Only bundled Prompd extension loads (no external extensions)
- Extension development uses `--extensionDevelopmentPath` flag
- Built-in CLI binary at `extensions/prompd/bin/prompd.exe`

### Build Pipeline
- Gulp-based build system with TypeScript compilation
- Entry point: `gulpfile.js` → `build/gulpfile.js` → loads `gulpfile.*.js` modules
- Separate compilation for client (`src/`) and extensions
- Watch mode runs client and extensions in parallel
- Production builds use mangling optimization
- Memory allocation: 8GB heap for large builds
- Extension compilation via separate `gulpfile.extensions.js` pipeline

### VS Code Fork Architecture
This is a complete VS Code fork with these customizations:
- **Layered architecture**: base → platform → editor → workbench (following original VS Code patterns)
- **Dependency injection**: Services injected through constructor parameters  
- **Contribution model**: Features contribute to registries and extension points
- **Cross-platform compatibility**: Platform-specific abstractions
- **Custom product configuration**: Separate branding and marketplace settings

### Important Coding Standards (from .github/copilot-instructions.md)
- Use **tabs** for indentation (not spaces)
- PascalCase for types/enums, camelCase for functions/properties
- Use "double quotes" for user-facing strings, 'single quotes' otherwise
- Arrow functions `=>` over anonymous functions
- Always use curly braces for loops/conditionals
- All user-facing messages must be localized
- Microsoft copyright header required in all files
- Prefer `async/await` over `Promise.then()` chains
- Use JSDoc style comments for functions, interfaces, enums, and classes
- Export functions with `export function` rather than `export const` for better stack traces

### TypeScript Version Notes
- **TypeScript**: Uses `typescript@next` (v6.0.0-dev) for cutting-edge features
- **Native support**: Uses `@typescript/native-preview` for performance optimizations
- **Build target**: ES2022 with modern JavaScript features enabled