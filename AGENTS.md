# Agent Instructions for fmiddleware

This is the source repository for the `@loupeat/fmiddleware` npm package - a framework-agnostic HTTP middleware for Express and AWS Lambda.

## Project Structure

- `src/` - TypeScript source files
- `dist/` - Compiled JavaScript (generated, gitignored)
- `examples/` - Usage examples

## Development Commands

```bash
# Build the project
npm run build

# Type check without emitting
npm run type-check

# Run tests
npm test
```

## Local Testing with npm link

To test changes locally in another project (e.g., the API project):

### 1. Link the package globally

```bash
# In fmiddleware directory
npm link
```

### 2. Link in the consuming project

```bash
# In the consuming project (e.g., api/api)
npm link @loupeat/fmiddleware
```

### 3. Make changes and rebuild

```bash
# In fmiddleware directory - rebuild after changes
npm run build
```

The consuming project will automatically use the updated code.

### 4. Unlink when done

```bash
# In the consuming project
npm unlink @loupeat/fmiddleware

# In fmiddleware directory (optional, removes global link)
npm unlink
```

## Creating a Release

### 1. Make and commit your changes

```bash
git add <files>
git commit -m "fix: Description of the fix"
```

### 2. Bump version in package.json

Edit `package.json` and update the `version` field following semver:
- Patch (1.0.x): Bug fixes
- Minor (1.x.0): New features, backwards compatible
- Major (x.0.0): Breaking changes

### 3. Commit the version bump

```bash
git add package.json
git commit -m "chore: Bump version to x.y.z"
```

Or combine with step 1 if appropriate.

### 4. Create and push the tag

```bash
git tag vX.Y.Z
git push origin main --tags
```

### 5. Create GitHub release

```bash
gh release create vX.Y.Z --title "vX.Y.Z" --notes "## Changes

- Description of changes

Refs loupeat/app#ISSUE_NUMBER"
```

### 6. Publish to npm

```bash
npm publish
```

Note: You need to be logged in to npm with appropriate permissions.

### 7. Update consuming projects

In projects that use this package:

```bash
npm install @loupeat/fmiddleware@X.Y.Z
```

## Key Files

- `src/middleware.ts` - Core FMiddleware base class
- `src/express-impl.ts` - Express.js implementation
- `src/aws-lambda-impl.ts` - AWS Lambda implementation
- `src/types.ts` - TypeScript type definitions
- `src/default-impl.ts` - Default processors (validation, error handling, stats)

## Important Notes

- Always run `npm run build` before publishing - the `prepublishOnly` script handles this automatically
- The `dist/` folder is gitignored but included in the npm package via the `files` field in package.json
- Both Express and Lambda implementations should pass default CORS headers via their constructors
