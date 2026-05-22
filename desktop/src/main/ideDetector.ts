import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

const execAsync = promisify(exec);
const platform = os.platform();

export interface IDEInfo {
  id: string;
  name: string;
  executable: string;
  icon: string; // 用于前端渲染对应的图标
}

// 缓存检测结果
let cachedIDEs: IDEInfo[] | null = null;

/**
 * 检查路径是否存在
 */
async function pathExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

/**
 * 在系统 PATH 中查找可执行文件
 */
async function findInPath(command: string): Promise<string | null> {
  try {
    const cmd = platform === 'win32' ? `where ${command}` : `which ${command}`;
    const { stdout } = await execAsync(cmd);
    const paths = stdout.split('\n').filter(Boolean);
    return paths.length > 0 ? paths[0].trim() : null;
  } catch {
    return null;
  }
}

/**
 * 跨平台检测已安装的 IDE 和工具
 */
export async function detectInstalledIDEs(forceRefresh = false): Promise<IDEInfo[]> {
  if (cachedIDEs && !forceRefresh) {
    return cachedIDEs;
  }

  const detected: IDEInfo[] = [];
  const localAppData = process.env.LOCALAPPDATA || '';
  const programFiles = process.env.ProgramFiles || '';

  // 1. VS Code
  let vscodePath: string | null = null;
  if (platform === 'win32') {
    const paths = [
      path.join(localAppData, 'Programs', 'Microsoft VS Code', 'Code.exe'),
      path.join(programFiles, 'Microsoft VS Code', 'Code.exe'),
    ];
    for (const p of paths) {
      if (await pathExists(p)) {
        vscodePath = p;
        break;
      }
    }
    if (!vscodePath) vscodePath = await findInPath('code.cmd');
  } else if (platform === 'darwin') {
    vscodePath = await pathExists('/Applications/Visual Studio Code.app') 
      ? '/Applications/Visual Studio Code.app' 
      : await findInPath('code');
  } else {
    vscodePath = await findInPath('code');
  }
  if (vscodePath) detected.push({ id: 'vscode', name: 'VS Code', executable: vscodePath, icon: 'vscode' });

  // 2. Cursor
  let cursorPath: string | null = null;
  if (platform === 'win32') {
    const p = path.join(localAppData, 'Programs', 'cursor', 'Cursor.exe');
    cursorPath = await pathExists(p) ? p : await findInPath('cursor.cmd');
  } else if (platform === 'darwin') {
    cursorPath = await pathExists('/Applications/Cursor.app') 
      ? '/Applications/Cursor.app' 
      : await findInPath('cursor');
  } else {
    cursorPath = await findInPath('cursor');
  }
  if (cursorPath) detected.push({ id: 'cursor', name: 'Cursor', executable: cursorPath, icon: 'cursor' });

  // 3. Zed
  let zedPath: string | null = null;
  if (platform === 'win32') {
    const p = path.join(localAppData, 'Programs', 'Zed', 'zed.exe');
    zedPath = await pathExists(p) ? p : await findInPath('zed.exe');
  } else if (platform === 'darwin') {
    zedPath = await pathExists('/Applications/Zed.app') 
      ? '/Applications/Zed.app' 
      : await findInPath('zed');
  } else {
    zedPath = await findInPath('zed');
  }
  if (zedPath) detected.push({ id: 'zed', name: 'Zed', executable: zedPath, icon: 'zed' });

  // 4. Visual Studio
  if (platform === 'win32') {
    const vsPaths = [
      path.join(programFiles, 'Microsoft Visual Studio', '2022', 'Community', 'Common7', 'IDE', 'devenv.exe'),
      path.join(programFiles, 'Microsoft Visual Studio', '2022', 'Professional', 'Common7', 'IDE', 'devenv.exe'),
      path.join(programFiles, 'Microsoft Visual Studio', '2022', 'Enterprise', 'Common7', 'IDE', 'devenv.exe'),
    ];
    let vsPath: string | null = null;
    for (const p of vsPaths) {
      if (await pathExists(p)) {
        vsPath = p;
        break;
      }
    }
    if (vsPath) {
      detected.push({ id: 'visualstudio', name: 'Visual Studio', executable: vsPath, icon: 'visualstudio' });
    }
  }

  // 5. File Explorer (系统自带，通常无需检测直接可用)
  if (platform === 'win32') {
    detected.push({ id: 'explorer', name: 'File Explorer', executable: 'explorer.exe', icon: 'folder' });
  } else if (platform === 'darwin') {
    detected.push({ id: 'finder', name: 'Finder', executable: 'open', icon: 'folder' });
  } else {
    detected.push({ id: 'filemanager', name: 'File Manager', executable: 'xdg-open', icon: 'folder' });
  }

  cachedIDEs = detected;
  return detected;
}
