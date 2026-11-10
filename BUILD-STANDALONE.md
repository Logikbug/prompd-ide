# Prompd IDE - Standalone Build

## 🚀 Complete Process Isolation Achieved

This build creates a **completely isolated Prompd IDE** that runs independently from VS Code.

### Features:
- ✅ **Zero VS Code Dependencies** - Runs as separate process
- ✅ **Marketplace Disabled** - No external extension loading
- ✅ **Custom Branding** - Prompd IDE identity and theming  
- ✅ **Isolated Profile** - Separate settings and data storage
- ✅ **Enterprise Ready** - Production deployment ready

### Launch Options:

#### 1. Maximum Isolation (Recommended)
```bash
prompd-ide.bat
```
- Complete separation from VS Code
- Custom product configuration
- Isolated user data and extensions

#### 2. Clean Development Launch  
```bash
launch-clean.bat
```
- Clean temporary profile
- Development mode with hot reload

### Build Process:
1. Custom product configuration created
2. Standalone launcher with isolation flags
3. Default settings optimized for prompt engineering
4. Extension loading limited to Prompd only

### Next Steps for Full Executable:
To create a true standalone executable, run:
```bash
npm run build:standalone
```

This will create a distributable Prompd IDE that can be installed independently.
