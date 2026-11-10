import * as vscode from 'vscode';
import * as path from 'path';
import * as https from 'https';
import * as http from 'http';

interface Package {
    name: string;
    description: string;
    version: string;
    author: string;
    tags: string[];
    downloads: number;
    createdAt: Date;
    downloadUrl?: string;
}

interface PackageSearchResponse {
    packages: Package[];
    total: number;
    hasMore: boolean;
}

// Helper function to make HTTP requests using Node.js built-in modules
function makeHttpRequest(url: string): Promise<any> {
    return new Promise((resolve, reject) => {
        const parsedUrl = new URL(url);
        const module = parsedUrl.protocol === 'https:' ? https : http;
        
        const req = module.request(url, (res) => {
            let data = '';
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                try {
                    if (res.statusCode! >= 200 && res.statusCode! < 300) {
                        resolve(JSON.parse(data));
                    } else {
                        reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
                    }
                } catch (error) {
                    reject(error);
                }
            });
        });
        
        req.on('error', reject);
        req.end();
    });
}

// Helper function to download content as text
function downloadContent(url: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const parsedUrl = new URL(url);
        const module = parsedUrl.protocol === 'https:' ? https : http;
        
        const req = module.request(url, (res) => {
            let data = '';
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                if (res.statusCode! >= 200 && res.statusCode! < 300) {
                    resolve(data);
                } else {
                    reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
                }
            });
        });
        
        req.on('error', reject);
        req.end();
    });
}

export class PrompdMarketplaceProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'prompd.marketplaceView';
    private _view?: vscode.WebviewView;
    private readonly registryBaseUrl = 'http://localhost:4000'; // Will be configurable

    constructor(private readonly extensionUri: vscode.Uri) {}

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this.extensionUri]
        };

        webviewView.webview.html = this.getHtmlForWebview(webviewView.webview);

        // Handle messages from the webview
        webviewView.webview.onDidReceiveMessage(async data => {
            switch (data.type) {
                case 'search':
                    await this.searchPackages(data.query, data.tags);
                    break;
                case 'install':
                    await this.installPackage(data.package);
                    break;
                case 'showDetails':
                    await this.showPackageDetails(data.package);
                    break;
            }
        });

        // Load initial packages
        this.loadFeaturedPackages();
    }

    private async searchPackages(query?: string, tags?: string[]) {
        try {
            const searchParams = new URLSearchParams();
            if (query) searchParams.set('search', query);
            if (tags && tags.length > 0) searchParams.set('tags', tags.join(','));
            searchParams.set('limit', '20');

            const data: PackageSearchResponse = await makeHttpRequest(`${this.registryBaseUrl}/v1/packages?${searchParams}`);
            
            this._view?.webview.postMessage({
                type: 'searchResults',
                packages: data.packages,
                total: data.total,
                hasMore: data.hasMore
            });
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to search packages: ${error}`);
        }
    }

    private async installPackage(pkg: Package) {
        try {
            // Show progress
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: `Installing ${pkg.name}...`,
                cancellable: false
            }, async (progress) => {
                progress.report({ increment: 0 });

                // Get the download URL
                const downloadUrl = `${this.registryBaseUrl}/v1/packages/${pkg.name}/download/${pkg.version}`;
                
                progress.report({ increment: 30, message: 'Downloading package...' });

                const content = await downloadContent(downloadUrl);
                progress.report({ increment: 60, message: 'Installing to workspace...' });

                // Get current workspace
                const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
                if (!workspaceFolder) {
                    throw new Error('No workspace folder open');
                }

                // Create prompts directory if it doesn't exist
                const promptsDir = vscode.Uri.joinPath(workspaceFolder.uri, 'prompts');
                try {
                    await vscode.workspace.fs.stat(promptsDir);
                } catch {
                    await vscode.workspace.fs.createDirectory(promptsDir);
                }

                // Save the prompt file
                const fileName = `${pkg.name.replace('/', '_')}_${pkg.version}.prompd`;
                const filePath = vscode.Uri.joinPath(promptsDir, fileName);
                
                await vscode.workspace.fs.writeFile(filePath, Buffer.from(content, 'utf8'));
                
                progress.report({ increment: 100, message: 'Installation complete!' });

                // Open the installed file
                const document = await vscode.workspace.openTextDocument(filePath);
                await vscode.window.showTextDocument(document);
            });

            vscode.window.showInformationMessage(`Successfully installed ${pkg.name}!`);
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to install package: ${error}`);
        }
    }

    private async showPackageDetails(pkg: Package) {
        const panel = vscode.window.createWebviewPanel(
            'packageDetails',
            `Package: ${pkg.name}`,
            vscode.ViewColumn.Beside,
            {
                enableScripts: true
            }
        );

        panel.webview.html = this.getPackageDetailsHtml(pkg);
    }

    private async loadFeaturedPackages() {
        // Load some featured/popular packages on initial load
        await this.searchPackages('', ['featured', 'popular']);
    }

    private getHtmlForWebview(webview: vscode.Webview): string {
        return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Prompd Marketplace</title>
            <style>
                body {
                    font-family: var(--vscode-font-family);
                    color: var(--vscode-foreground);
                    background-color: var(--vscode-editor-background);
                    margin: 0;
                    padding: 16px;
                }
                
                .search-container {
                    margin-bottom: 16px;
                }
                
                .search-box {
                    width: 100%;
                    padding: 8px;
                    background-color: var(--vscode-input-background);
                    color: var(--vscode-input-foreground);
                    border: 1px solid var(--vscode-input-border);
                    border-radius: 4px;
                    font-size: 14px;
                }
                
                .package-list {
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                }
                
                .package-item {
                    border: 1px solid var(--vscode-widget-border);
                    border-radius: 6px;
                    padding: 12px;
                    background-color: var(--vscode-editor-background);
                    cursor: pointer;
                    transition: background-color 0.2s;
                }
                
                .package-item:hover {
                    background-color: var(--vscode-list-hoverBackground);
                }
                
                .package-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    margin-bottom: 8px;
                }
                
                .package-name {
                    font-weight: 600;
                    color: var(--vscode-textLink-foreground);
                    font-size: 15px;
                }
                
                .package-version {
                    background-color: var(--vscode-badge-background);
                    color: var(--vscode-badge-foreground);
                    padding: 2px 6px;
                    border-radius: 3px;
                    font-size: 11px;
                    font-weight: 500;
                }
                
                .package-author {
                    color: var(--vscode-descriptionForeground);
                    font-size: 12px;
                    margin-bottom: 4px;
                }
                
                .package-description {
                    color: var(--vscode-foreground);
                    font-size: 13px;
                    line-height: 1.4;
                    margin-bottom: 8px;
                }
                
                .package-tags {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 4px;
                    margin-bottom: 8px;
                }
                
                .tag {
                    background-color: var(--vscode-textBlockQuote-background);
                    color: var(--vscode-textBlockQuote-foreground);
                    padding: 2px 6px;
                    border-radius: 3px;
                    font-size: 10px;
                    border: 1px solid var(--vscode-textBlockQuote-border);
                }
                
                .package-stats {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    font-size: 11px;
                    color: var(--vscode-descriptionForeground);
                }
                
                .install-btn {
                    background-color: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                    border: none;
                    padding: 6px 12px;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 12px;
                    font-weight: 500;
                }
                
                .install-btn:hover {
                    background-color: var(--vscode-button-hoverBackground);
                }
                
                .loading {
                    text-align: center;
                    padding: 20px;
                    color: var(--vscode-descriptionForeground);
                }
                
                .empty-state {
                    text-align: center;
                    padding: 40px 20px;
                    color: var(--vscode-descriptionForeground);
                }
            </style>
        </head>
        <body>
            <div class="search-container">
                <input 
                    type="text" 
                    class="search-box" 
                    placeholder="Search packages..." 
                    id="searchInput"
                />
            </div>
            
            <div id="packageList" class="package-list">
                <div class="loading">Loading featured packages...</div>
            </div>
            
            <script>
                const vscode = acquireVsCodeApi();
                
                document.getElementById('searchInput').addEventListener('input', (e) => {
                    const query = e.target.value;
                    vscode.postMessage({
                        type: 'search',
                        query: query
                    });
                });
                
                function formatDate(dateString) {
                    const date = new Date(dateString);
                    return date.toLocaleDateString();
                }
                
                function renderPackages(packages) {
                    const packageList = document.getElementById('packageList');
                    
                    if (packages.length === 0) {
                        packageList.innerHTML = '<div class="empty-state">No packages found</div>';
                        return;
                    }
                    
                    packageList.innerHTML = packages.map(pkg => \`
                        <div class="package-item" onclick="showDetails('\${pkg.name}')">
                            <div class="package-header">
                                <div class="package-name">\${pkg.name}</div>
                                <div class="package-version">v\${pkg.version}</div>
                            </div>
                            <div class="package-author">by \${pkg.author}</div>
                            <div class="package-description">\${pkg.description}</div>
                            <div class="package-tags">
                                \${pkg.tags.map(tag => \`<span class="tag">\${tag}</span>\`).join('')}
                            </div>
                            <div class="package-stats">
                                <span>\${pkg.downloads} downloads</span>
                                <button class="install-btn" onclick="event.stopPropagation(); installPackage('\${pkg.name}', '\${pkg.version}')">
                                    Install
                                </button>
                            </div>
                        </div>
                    \`).join('');
                }
                
                function installPackage(name, version) {
                    vscode.postMessage({
                        type: 'install',
                        package: { name, version }
                    });
                }
                
                function showDetails(name) {
                    // Find the package in our current list
                    const pkg = currentPackages.find(p => p.name === name);
                    if (pkg) {
                        vscode.postMessage({
                            type: 'showDetails',
                            package: pkg
                        });
                    }
                }
                
                let currentPackages = [];
                
                // Handle messages from the extension
                window.addEventListener('message', event => {
                    const message = event.data;
                    
                    switch (message.type) {
                        case 'searchResults':
                            currentPackages = message.packages;
                            renderPackages(message.packages);
                            break;
                    }
                });
            </script>
        </body>
        </html>`;
    }

    private getPackageDetailsHtml(pkg: Package): string {
        return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Package Details</title>
            <style>
                body {
                    font-family: var(--vscode-font-family);
                    color: var(--vscode-foreground);
                    background-color: var(--vscode-editor-background);
                    margin: 0;
                    padding: 24px;
                    line-height: 1.6;
                }
                
                .package-header {
                    border-bottom: 1px solid var(--vscode-widget-border);
                    padding-bottom: 16px;
                    margin-bottom: 24px;
                }
                
                .package-name {
                    font-size: 24px;
                    font-weight: 600;
                    color: var(--vscode-textLink-foreground);
                    margin-bottom: 8px;
                }
                
                .package-meta {
                    color: var(--vscode-descriptionForeground);
                    font-size: 14px;
                }
                
                .section {
                    margin-bottom: 24px;
                }
                
                .section-title {
                    font-size: 16px;
                    font-weight: 600;
                    margin-bottom: 8px;
                    color: var(--vscode-foreground);
                }
                
                .tags {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 6px;
                }
                
                .tag {
                    background-color: var(--vscode-textBlockQuote-background);
                    color: var(--vscode-textBlockQuote-foreground);
                    padding: 4px 8px;
                    border-radius: 4px;
                    font-size: 12px;
                    border: 1px solid var(--vscode-textBlockQuote-border);
                }
                
                .install-section {
                    background-color: var(--vscode-textBlockQuote-background);
                    border: 1px solid var(--vscode-textBlockQuote-border);
                    border-radius: 6px;
                    padding: 16px;
                    margin-top: 24px;
                }
                
                .install-btn {
                    background-color: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                    border: none;
                    padding: 10px 20px;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 14px;
                    font-weight: 500;
                    margin-right: 12px;
                }
                
                .install-btn:hover {
                    background-color: var(--vscode-button-hoverBackground);
                }
            </style>
        </head>
        <body>
            <div class="package-header">
                <div class="package-name">${pkg.name}</div>
                <div class="package-meta">
                    Version ${pkg.version} • by ${pkg.author} • ${pkg.downloads} downloads
                </div>
            </div>
            
            <div class="section">
                <div class="section-title">Description</div>
                <div>${pkg.description}</div>
            </div>
            
            <div class="section">
                <div class="section-title">Tags</div>
                <div class="tags">
                    ${pkg.tags.map(tag => `<span class="tag">${tag}</span>`).join('')}
                </div>
            </div>
            
            <div class="install-section">
                <div class="section-title">Installation</div>
                <p>Click the button below to install this package into your current workspace:</p>
                <button class="install-btn" onclick="installPackage()">
                    Install ${pkg.name} v${pkg.version}
                </button>
            </div>
            
            <script>
                function installPackage() {
                    // This would communicate back to VS Code
                    console.log('Install package clicked');
                }
            </script>
        </body>
        </html>`;
    }
}