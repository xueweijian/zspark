import { spawn } from 'child_process';
import { IDEInfo } from './ideDetector';

/**
 * 使用选定的 IDE 打开指定的项目目录
 * @param ide 选择的 IDE 信息
 * @param projectPath 项目绝对路径
 */
export async function openInIDE(ide: IDEInfo, projectPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      let command = ide.executable;
      let args: string[] = [projectPath];

      // 针对 macOS 特殊处理：如果路径是 .app 结尾，使用 open -a 启动
      if (ide.executable.endsWith('.app')) {
        command = 'open';
        args = ['-a', ide.executable, projectPath];
      } else if (ide.id === 'explorer') {
        // 针对 Windows File Explorer 特殊处理路径
        args = [projectPath.replace(/\//g, '\\')];
      }

      // 使用脱离主进程的方式启动，并忽略标准输入输出
      const options: any = {
        detached: true,
        stdio: 'ignore'
      };

      // 启动子进程
      // 注意：shell: false 可以避免很多转义问题，spawn 会自动处理带空格的参数
      const child = spawn(command, args, options);

      child.on('error', (err) => {
        reject(new Error(`Failed to launch ${ide.name}: ${err.message}`));
      });

      // 调用 unref 允许父进程独立退出
      child.unref();

      // 启动成功立即 resolve
      resolve();
    } catch (error) {
      reject(error);
    }
  });
}
