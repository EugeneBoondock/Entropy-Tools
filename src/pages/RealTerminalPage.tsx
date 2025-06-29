import React, { useState, useEffect, useRef, useCallback } from 'react';
import { RealFileSystem, FileSystemItem } from '../services/realTerminal/fileSystem';
import { PythonEngine, PythonREPL } from '../services/realTerminal/pythonEngine';
import { GitEngine } from '../services/realTerminal/gitEngine';
import { NodeEngine, NodeREPL } from '../services/realTerminal/nodeEngine';
import TextEditor from '../components/TextEditor';
import { AIProviderService, AIMessage, AIResponse, AITools, AI_PROVIDERS } from '../services/aiProviders';

interface TerminalOutput {
  id: string;
  type: 'command' | 'output' | 'error' | 'system' | 'ai-response';
  content: string;
  timestamp: Date;
}

interface ActiveSession {
  type: 'python' | 'node' | 'ai' | null;
  repl: PythonREPL | NodeREPL | null;
}

interface AISession {
  messages: AIMessage[];
  isActive: boolean;
  provider?: string;
  model?: string;
}

export default function RealTerminalPage() {
  const [output, setOutput] = useState<TerminalOutput[]>([
    {
      id: '1',
      type: 'system',
      content: '🚀 Entropy Real Terminal v2.0 - AI-Native Development Environment\n' +
               '📁 OPFS File System | 🐍 Python (Pyodide) | 📦 Node.js (WebContainers) | 🔧 Git Operations | 🤖 AI Agent\n' +
               '🆓 AI Ready: Google Gemini 2.0 Flash Lite (Free Tier)\n' +
               'Type "help" for available commands or "ai" to start AI session.\n',
      timestamp: new Date()
    }
  ]);
  
  const [currentCommand, setCurrentCommand] = useState('');
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [isLoading, setIsLoading] = useState(false);
  const [currentPath, setCurrentPath] = useState('/home/user');
  const [activeSession, setActiveSession] = useState<ActiveSession>({ type: null, repl: null });
  const [aiSession, setAiSession] = useState<AISession>({ messages: [], isActive: false });
  const [showEditor, setShowEditor] = useState(false);
  const [editorFile, setEditorFile] = useState<{ filename: string; content: string; mode: 'vim' | 'nano' | 'emacs' }>({ filename: '', content: '', mode: 'vim' });
  const [showAIConfig, setShowAIConfig] = useState(false);
  const [showFileSystem, setShowFileSystem] = useState(false);
  const [fileSystemFiles, setFileSystemFiles] = useState<Array<{name: string, type: string, content?: string}>>([]);
  
  // Engine instances
  const [fileSystem] = useState(() => new RealFileSystem());
  const [pythonEngine] = useState(() => new PythonEngine());
  const [gitEngine] = useState(() => new GitEngine(fileSystem));
  const [nodeEngine] = useState(() => new NodeEngine());
  const [tools] = useState<AITools>(() => ({
    executeCode: async (code: string, language: string) => {
      if (language === 'python') {
        const result = await pythonEngine.executeCode(code);
        return result.output || result.error || 'Code executed';
      } else if (language === 'javascript' || language === 'js') {
        // Note: NodeEngine uses WebContainers which doesn't have direct executeCode
        // We'll implement this when we add the AI execution
        return 'JavaScript execution will be implemented with WebContainer integration';
      }
      return 'Unsupported language';
    },
    editFile: async (filename: string, content: string) => {
      await fileSystem.writeFile(filename, content);
    },
    readFile: async (filename: string) => {
      const content = await fileSystem.readFile(filename);
      return typeof content === 'string' ? content : new TextDecoder().decode(content);
    },
    listFiles: async (path?: string) => {
      const items = await fileSystem.listDirectory(path || currentPath);
      return items.map(item => `${item.type === 'directory' ? '📁' : '📄'} ${item.name}`);
    },
    runCommand: async (command: string) => {
      // This would execute the command and return the result
      return `Command executed: ${command}`;
    }
  }));
  
  const [aiService] = useState(() => new AIProviderService(tools));
  
  const [engineStatus, setEngineStatus] = useState({
    filesystem: false,
    python: false,
    node: false,
    git: false,
    ai: false
  });

  const terminalRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Initialize engines
  useEffect(() => {
    const initializeEngines = async () => {
      try {
        // Initialize file system
        await fileSystem.initialize();
        fileSystem.setCurrentPath('/home/user');
        setEngineStatus(prev => ({ ...prev, filesystem: true }));
        
        // Create initial directory structure
        await fileSystem.createDirectory('/home/user/projects');
        await fileSystem.createDirectory('/home/user/downloads');
        await fileSystem.writeFile('/home/user/welcome.txt', 
          'Welcome to Entropy Real Terminal!\n\n' +
          'This is a fully functional development environment running in your browser.\n' +
          'You can:\n' +
          '- Create and edit files that persist across sessions\n' +
          '- Run Python scripts with NumPy, Pandas, Matplotlib\n' +
          '- Execute Node.js applications and install npm packages\n' +
          '- Use Git for version control\n' +
          '- Build and deploy projects\n\n' +
          'Try: cat welcome.txt, python3, node, git status\n'
        );

        addOutput('system', '✅ File system initialized with OPFS');
        addOutput('system', '✅ Git engine ready');
        setEngineStatus(prev => ({ ...prev, git: true }));

        // Initialize AI with default Gemini (always available)
        const currentProvider = aiService.getCurrentProvider();
        addOutput('system', `✅ AI ready: ${currentProvider?.name || 'Google'} (${currentProvider?.model || 'gemini-2.0-flash-lite'}) - Free Tier`);
        setEngineStatus(prev => ({ ...prev, ai: true }));

      } catch (error) {
        addOutput('error', `❌ Initialization failed: ${error}`);
      }
    };

    initializeEngines();
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [output]);

  // Focus input
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  const addOutput = useCallback((type: TerminalOutput['type'], content: string) => {
    setOutput(prev => [...prev, {
      id: Date.now().toString(),
      type,
      content,
      timestamp: new Date()
    }]);
  }, []);

  const getCurrentPrompt = useCallback(() => {
    if (activeSession.type === 'python') {
      return '>>> ';
    } else if (activeSession.type === 'node') {
      return '> ';
    } else if (activeSession.type === 'ai') {
      const provider = aiService.getCurrentProvider();
      return `🤖 ${provider?.name || 'AI'}:${provider?.model || 'unknown'}$ `;
    }
    return `entropy:${currentPath}$ `;
  }, [currentPath, activeSession.type, aiService]);

  const executeCommand = async (command: string) => {
    if (!command.trim()) return;

    const fullCommand = getCurrentPrompt() + command;
    addOutput('command', fullCommand);
    
    setIsLoading(true);

    try {
      // Handle active REPL sessions
      if (activeSession.repl && activeSession.type) {
        if (command.trim() === 'exit' || command.trim() === 'quit') {
          if (activeSession.type === 'node' && 'close' in activeSession.repl) {
            await (activeSession.repl as NodeREPL).close();
          }
          setActiveSession({ type: null, repl: null });
          addOutput('system', `Exited ${activeSession.type} REPL`);
        } else {
          const result = await activeSession.repl.execute(command);
          if (result.output) addOutput('output', result.output);
          if (result.error) addOutput('error', result.error);
        }
        return;
      }

      // Handle AI session
      if (activeSession.type === 'ai') {
        if (command.trim() === 'exit' || command.trim() === 'quit') {
          setActiveSession({ type: null, repl: null });
          setAiSession({ messages: [], isActive: false });
          addOutput('system', 'Exited AI session');
        } else {
          await handleAIMessage(command);
        }
        return;
      }

      // Parse command
      const parts = command.trim().split(/\s+/);
      const cmd = parts[0];
      const args = parts.slice(1);

      // Built-in commands
      switch (cmd) {
        case 'help':
          addOutput('output', getHelpText());
          break;

        case 'engines':
          addOutput('output', getEngineStatus());
          break;

        case 'clear':
          setOutput([]);
          break;

        case 'pwd':
          addOutput('output', currentPath);
          break;

        case 'cd':
          await handleCd(args[0] || '/home/user');
          break;

        case 'ls':
        case 'dir':
          await handleLs(args[0]);
          break;

        case 'mkdir':
          if (args[0]) {
            try {
              await fileSystem.createDirectory(args[0]);
              addOutput('output', `Created directory: ${args[0]}`);
            } catch (error) {
              addOutput('error', `mkdir: ${error}`);
            }
          } else {
            addOutput('error', 'mkdir: missing directory name');
          }
          break;

        case 'touch':
          if (args[0]) {
            try {
              await fileSystem.writeFile(args[0], '');
              addOutput('output', `Created file: ${args[0]}`);
            } catch (error) {
              addOutput('error', `touch: ${error}`);
            }
          } else {
            addOutput('error', 'touch: missing file name');
          }
          break;

        case 'cat':
          if (args[0]) {
            try {
              const content = await fileSystem.readFile(args[0]);
              addOutput('output', typeof content === 'string' ? content : '[Binary file]');
            } catch (error) {
              addOutput('error', `cat: ${error}`);
            }
          } else {
            addOutput('error', 'cat: missing file name');
          }
          break;

        case 'rm':
          if (args[0]) {
            try {
              await fileSystem.deleteFile(args[0]);
              addOutput('output', `Removed: ${args[0]}`);
            } catch (error) {
              addOutput('error', `rm: ${error}`);
            }
          } else {
            addOutput('error', 'rm: missing file name');
          }
          break;

        case 'echo':
          addOutput('output', args.join(' '));
          break;

        case 'python':
        case 'python3':
          await handlePython(args);
          break;

        case 'node':
          await handleNode(args);
          break;

        case 'npm':
          await handleNpm(args);
          break;

        case 'git':
          await handleGit(args);
          break;

        case 'ai':
          await handleAICommand(args);
          break;

        case 'ai-config':
          setShowAIConfig(true);
          break;

        case 'ai-providers':
          await handleAIProviders(args);
          break;

        case 'ai-models':
          await handleAIModels(args);
          break;

        case 'files':
        case 'filesystem':
          setShowFileSystem(true);
          await refreshFileSystem();
          break;

        case 'code':
        case 'edit':
          if (args[0]) {
            addOutput('system', `Opening ${args[0]} in editor... (Would open code editor in real implementation)`);
          } else {
            addOutput('error', 'edit: missing file name');
          }
          break;

        case 'wget':
        case 'curl':
          addOutput('system', `${cmd}: Network requests available in real implementation`);
          break;

        case 'ps':
          addOutput('output', 'PID  COMMAND\n1    entropy-terminal\n2    browser-engine');
          break;

        case 'whoami':
          addOutput('output', 'entropy-user');
          break;

        case 'uname':
          addOutput('output', 'Entropy-OS Browser x86_64');
          break;

        case 'date':
          addOutput('output', new Date().toString());
          break;

        case 'history':
          addOutput('output', commandHistory.map((cmd, i) => `${i + 1}  ${cmd}`).join('\n'));
          break;

        case 'expr':
          if (args.length > 0) {
            try {
              const expression = args.join(' ');
              // Simple math evaluation (basic arithmetic)
              const result = Function(`"use strict"; return (${expression.replace(/[^0-9+\-*/().\s]/g, '')})`)();
              addOutput('output', result.toString());
            } catch (error) {
              addOutput('error', `expr: invalid expression`);
            }
          } else {
            addOutput('error', 'expr: missing expression');
          }
          break;

        case 'bc':
          if (args.length > 0) {
            try {
              const expression = args.join(' ');
              const result = Function(`"use strict"; return (${expression.replace(/[^0-9+\-*/().\s]/g, '')})`)();
              addOutput('output', result.toString());
            } catch (error) {
              addOutput('error', `bc: syntax error`);
            }
          } else {
            addOutput('output', 'Basic calculator - enter expressions like: bc 5+3*2');
          }
          break;

        case 'wc':
          if (args[0]) {
            try {
              const content = await fileSystem.readFile(args[0]);
              if (typeof content === 'string') {
                const lines = content.split('\n').length;
                const words = content.trim().split(/\s+/).length;
                const chars = content.length;
                addOutput('output', `${lines} ${words} ${chars} ${args[0]}`);
              } else {
                addOutput('error', `wc: ${args[0]}: binary file`);
              }
            } catch (error) {
              addOutput('error', `wc: ${args[0]}: No such file`);
            }
          } else {
            addOutput('error', 'wc: missing file name');
          }
          break;

        case 'head':
          if (args[0]) {
            try {
              const content = await fileSystem.readFile(args[0]);
              if (typeof content === 'string') {
                const lines = content.split('\n').slice(0, 10);
                addOutput('output', lines.join('\n'));
              } else {
                addOutput('error', `head: ${args[0]}: binary file`);
              }
            } catch (error) {
              addOutput('error', `head: ${args[0]}: No such file`);
            }
          } else {
            addOutput('error', 'head: missing file name');
          }
          break;

        case 'tail':
          if (args[0]) {
            try {
              const content = await fileSystem.readFile(args[0]);
              if (typeof content === 'string') {
                const lines = content.split('\n').slice(-10);
                addOutput('output', lines.join('\n'));
              } else {
                addOutput('error', `tail: ${args[0]}: binary file`);
              }
            } catch (error) {
              addOutput('error', `tail: ${args[0]}: No such file`);
            }
          } else {
            addOutput('error', 'tail: missing file name');
          }
          break;

        case 'grep':
          if (args.length >= 2) {
            const pattern = args[0];
            const filename = args[1];
            try {
              const content = await fileSystem.readFile(filename);
              if (typeof content === 'string') {
                const lines = content.split('\n');
                const matches = lines.filter(line => line.includes(pattern));
                addOutput('output', matches.join('\n') || 'No matches found');
              } else {
                addOutput('error', `grep: ${filename}: binary file`);
              }
            } catch (error) {
              addOutput('error', `grep: ${filename}: No such file`);
            }
          } else {
            addOutput('error', 'grep: usage: grep pattern file');
          }
          break;

        case 'find':
          if (args[0]) {
            const searchPath = args[0];
            const pattern = args[2] || '*';
            try {
              const findFiles = async (path: string): Promise<string[]> => {
                const items = await fileSystem.listDirectory(path);
                let results: string[] = [];
                for (const item of items) {
                  const fullPath = path === '/' ? `/${item.name}` : `${path}/${item.name}`;
                  if (pattern === '*' || item.name.includes(pattern.replace('*', ''))) {
                    results.push(fullPath);
                  }
                  if (item.type === 'directory') {
                    const subResults = await findFiles(fullPath);
                    results = results.concat(subResults);
                  }
                }
                return results;
              };
              
              const results = await findFiles(searchPath);
              addOutput('output', results.join('\n') || 'No files found');
            } catch (error) {
              addOutput('error', `find: ${searchPath}: No such directory`);
            }
          } else {
            addOutput('error', 'find: usage: find path [-name pattern]');
          }
          break;

        case 'sort':
          if (args[0]) {
            try {
              const content = await fileSystem.readFile(args[0]);
              if (typeof content === 'string') {
                const lines = content.split('\n').sort();
                addOutput('output', lines.join('\n'));
              } else {
                addOutput('error', `sort: ${args[0]}: binary file`);
              }
            } catch (error) {
              addOutput('error', `sort: ${args[0]}: No such file`);
            }
          } else {
            addOutput('error', 'sort: missing file name');
          }
          break;

        case 'uniq':
          if (args[0]) {
            try {
              const content = await fileSystem.readFile(args[0]);
              if (typeof content === 'string') {
                const lines = content.split('\n');
                const unique = lines.filter((line, index) => lines.indexOf(line) === index);
                addOutput('output', unique.join('\n'));
              } else {
                addOutput('error', `uniq: ${args[0]}: binary file`);
              }
            } catch (error) {
              addOutput('error', `uniq: ${args[0]}: No such file`);
            }
          } else {
            addOutput('error', 'uniq: missing file name');
          }
          break;

        case 'cp':
          if (args.length >= 2) {
            try {
              await fileSystem.copyFile(args[0], args[1]);
              addOutput('output', `Copied ${args[0]} to ${args[1]}`);
            } catch (error) {
              addOutput('error', `cp: ${error}`);
            }
          } else {
            addOutput('error', 'cp: usage: cp source destination');
          }
          break;

        case 'mv':
          if (args.length >= 2) {
            try {
              await fileSystem.moveFile(args[0], args[1]);
              addOutput('output', `Moved ${args[0]} to ${args[1]}`);
            } catch (error) {
              addOutput('error', `mv: ${error}`);
            }
          } else {
            addOutput('error', 'mv: usage: mv source destination');
          }
          break;

        case 'chmod':
          if (args.length >= 2) {
            addOutput('output', `Changed permissions of ${args[1]} to ${args[0]}`);
          } else {
            addOutput('error', 'chmod: usage: chmod mode file');
          }
          break;

        case 'chown':
          if (args.length >= 2) {
            addOutput('output', `Changed ownership of ${args[1]} to ${args[0]}`);
          } else {
            addOutput('error', 'chown: usage: chown user:group file');
          }
          break;

        case 'ln':
          if (args.length >= 2) {
            try {
              await fileSystem.copyFile(args[0], args[1]);
              addOutput('output', `Created link ${args[1]} -> ${args[0]}`);
            } catch (error) {
              addOutput('error', `ln: ${error}`);
            }
          } else {
            addOutput('error', 'ln: usage: ln target linkname');
          }
          break;

        case 'du':
          try {
            const calculateSize = async (path: string): Promise<number> => {
              let totalSize = 0;
              const items = await fileSystem.listDirectory(path);
              for (const item of items) {
                if (item.type === 'file') {
                  totalSize += item.size || 0;
                } else if (item.type === 'directory') {
                  const subPath = path === '/' ? `/${item.name}` : `${path}/${item.name}`;
                  totalSize += await calculateSize(subPath);
                }
              }
              return totalSize;
            };
            
            const size = await calculateSize(args[0] || currentPath);
            addOutput('output', `${Math.ceil(size / 1024)}K\t${args[0] || '.'}`);
          } catch (error) {
            addOutput('error', `du: ${error}`);
          }
          break;

        case 'df':
          // Simulate disk usage
          addOutput('output', 'Filesystem     1K-blocks    Used Available Use% Mounted on\nOPFS              100000   25000     75000  25% /');
          break;

        case 'free':
          // Simulate memory info
          addOutput('output', '              total        used        free      shared  buff/cache   available\nMem:        8000000     2000000     6000000           0           0     6000000\nSwap:             0           0           0');
          break;

        case 'uptime':
          const uptime = Date.now() - new Date().setHours(0, 0, 0, 0);
          const hours = Math.floor(uptime / (1000 * 60 * 60));
          const minutes = Math.floor((uptime % (1000 * 60 * 60)) / (1000 * 60));
          addOutput('output', ` ${new Date().toTimeString().slice(0, 8)}  up ${hours}:${minutes.toString().padStart(2, '0')},  1 user,  load average: 0.00, 0.01, 0.05`);
          break;

        case 'top':
        case 'htop':
          addOutput('output', 'PID    USER      PR  NI    VIRT    RES    SHR S  %CPU %MEM     TIME+ COMMAND\n1      entropy   20   0  123456   7890   5432 S   1.0  0.1   0:00.10 entropy-terminal\n2      entropy   20   0   98765   4321   2109 S   0.5  0.1   0:00.05 python-engine\n3      entropy   20   0   87654   3210   1098 S   0.3  0.0   0:00.02 node-engine');
          break;

        case 'kill':
          if (args[0]) {
            addOutput('output', `Terminated process ${args[0]}`);
          } else {
            addOutput('error', 'kill: usage: kill PID');
          }
          break;

        case 'killall':
          if (args[0]) {
            addOutput('output', `Terminated all ${args[0]} processes`);
          } else {
            addOutput('error', 'killall: usage: killall process-name');
          }
          break;

        case 'jobs':
          addOutput('output', 'No active jobs');
          break;

        case 'nohup':
          if (args[0]) {
            addOutput('output', `nohup: ignoring input and appending output to 'nohup.out'`);
          } else {
            addOutput('error', 'nohup: usage: nohup command');
          }
          break;

        case 'which':
          if (args[0]) {
            const commonCommands = ['python', 'node', 'npm', 'git', 'ls', 'cat', 'echo', 'pwd', 'cd'];
            if (commonCommands.includes(args[0])) {
              addOutput('output', `/usr/bin/${args[0]}`);
            } else {
              addOutput('error', `which: no ${args[0]} in (/usr/bin:/bin:/usr/local/bin)`);
            }
          } else {
            addOutput('error', 'which: usage: which command');
          }
          break;

        case 'whereis':
          if (args[0]) {
            addOutput('output', `${args[0]}: /usr/bin/${args[0]} /usr/share/man/man1/${args[0]}.1.gz`);
          } else {
            addOutput('error', 'whereis: usage: whereis command');
          }
          break;

        case 'type':
          if (args[0]) {
            addOutput('output', `${args[0]} is a shell builtin`);
          } else {
            addOutput('error', 'type: usage: type command');
          }
          break;

        case 'alias':
          if (args.length === 0) {
            addOutput('output', 'alias ll=\'ls -la\'\nalias la=\'ls -A\'\nalias l=\'ls -CF\'');
          } else {
            addOutput('output', `alias ${args.join(' ')}`);
          }
          break;

        case 'env':
          addOutput('output', 'PATH=/usr/local/bin:/usr/bin:/bin\nHOME=/home/user\nUSER=entropy\nSHELL=/bin/bash\nTERM=entropy-terminal\nPWD=' + currentPath);
          break;

        case 'printenv':
          if (args[0]) {
            const envVars: Record<string, string> = {
              'PATH': '/usr/local/bin:/usr/bin:/bin',
              'HOME': '/home/user',
              'USER': 'entropy',
              'SHELL': '/bin/bash',
              'TERM': 'entropy-terminal',
              'PWD': currentPath
            };
            addOutput('output', envVars[args[0]] || '');
          } else {
            addOutput('output', 'PATH=/usr/local/bin:/usr/bin:/bin\nHOME=/home/user\nUSER=entropy\nSHELL=/bin/bash\nTERM=entropy-terminal\nPWD=' + currentPath);
          }
          break;

        case 'export':
          if (args[0]) {
            addOutput('output', `export ${args[0]}`);
          } else {
            addOutput('error', 'export: usage: export VAR=value');
          }
          break;

        case 'unset':
          if (args[0]) {
            addOutput('output', `unset ${args[0]}`);
          } else {
            addOutput('error', 'unset: usage: unset variable');
          }
          break;

        case 'source':
        case '.':
          if (args[0]) {
            try {
              const content = await fileSystem.readFile(args[0]);
              if (typeof content === 'string') {
                addOutput('output', `Sourced ${args[0]}`);
              } else {
                addOutput('error', `source: ${args[0]}: binary file`);
              }
            } catch (error) {
              addOutput('error', `source: ${args[0]}: No such file`);
            }
          } else {
            addOutput('error', 'source: usage: source filename');
          }
          break;

        case 'basename':
          if (args[0]) {
            const path = args[0];
            const name = path.split('/').pop() || path;
            addOutput('output', name);
          } else {
            addOutput('error', 'basename: usage: basename path');
          }
          break;

        case 'dirname':
          if (args[0]) {
            const path = args[0];
            const dir = path.substring(0, path.lastIndexOf('/')) || '.';
            addOutput('output', dir === '' ? '/' : dir);
          } else {
            addOutput('error', 'dirname: usage: dirname path');
          }
          break;

        case 'realpath':
          if (args[0]) {
            addOutput('output', fileSystem.getCurrentPath() + '/' + args[0]);
          } else {
            addOutput('error', 'realpath: usage: realpath path');
          }
          break;

        case 'stat':
          if (args[0]) {
            try {
              const info = await fileSystem.getFileInfo(args[0]);
              addOutput('output', 
                `  File: ${args[0]}\n` +
                `  Size: ${info.size || 0}\tBlocks: 8\tIO Block: 4096\t${info.type === 'directory' ? 'directory' : 'regular file'}\n` +
                `Device: 801h/2049d\tInode: 123456\tLinks: 1\n` +
                `Access: (0755/${info.type === 'directory' ? 'd' : '-'}rwxr-xr-x)\tUid: (1000/ entropy)\tGid: (1000/ entropy)\n` +
                `Access: ${info.lastModified?.toISOString() || new Date().toISOString()}\n` +
                `Modify: ${info.lastModified?.toISOString() || new Date().toISOString()}\n` +
                `Change: ${info.lastModified?.toISOString() || new Date().toISOString()}`
              );
            } catch (error) {
              addOutput('error', `stat: ${args[0]}: No such file or directory`);
            }
          } else {
            addOutput('error', 'stat: usage: stat file');
          }
          break;

        case 'file':
          if (args[0]) {
            try {
              const content = await fileSystem.readFile(args[0]);
              if (typeof content === 'string') {
                if (args[0].endsWith('.py')) {
                  addOutput('output', `${args[0]}: Python script text executable`);
                } else if (args[0].endsWith('.js')) {
                  addOutput('output', `${args[0]}: JavaScript source text`);
                } else if (args[0].endsWith('.json')) {
                  addOutput('output', `${args[0]}: JSON data`);
                } else {
                  addOutput('output', `${args[0]}: ASCII text`);
                }
              } else {
                addOutput('output', `${args[0]}: data`);
              }
            } catch (error) {
              addOutput('error', `file: ${args[0]}: No such file`);
            }
          } else {
            addOutput('error', 'file: usage: file filename');
          }
          break;

        case 'tree':
          const printTree = async (path: string, prefix: string = ''): Promise<string[]> => {
            try {
              const items = await fileSystem.listDirectory(path);
              const output: string[] = [];
              
              for (let i = 0; i < items.length; i++) {
                const item = items[i];
                const isLast = i === items.length - 1;
                const connector = isLast ? '└── ' : '├── ';
                const itemPath = path === '/' ? `/${item.name}` : `${path}/${item.name}`;
                
                output.push(prefix + connector + item.name + (item.type === 'directory' ? '/' : ''));
                
                if (item.type === 'directory') {
                  const nextPrefix = prefix + (isLast ? '    ' : '│   ');
                  const subTree = await printTree(itemPath, nextPrefix);
                  output.push(...subTree);
                }
              }
              return output;
            } catch {
              return [];
            }
          };
          
          const treePath = args[0] || currentPath;
          addOutput('output', treePath);
          const treeOutput = await printTree(treePath);
          if (treeOutput.length > 0) {
            addOutput('output', treeOutput.join('\n'));
          }
          break;

        case 'man':
          if (args[0]) {
            addOutput('output', `Manual page for ${args[0]} - Use 'help' for built-in command reference`);
          } else {
            addOutput('output', 'What manual page do you want?');
          }
          break;

        case 'info':
          if (args[0]) {
            addOutput('output', `Info page for ${args[0]} - Use 'help' for built-in command reference`);
          } else {
            addOutput('output', 'Usage: info [command]');
          }
          break;

        case 'apropos':
          if (args[0]) {
            addOutput('output', `${args[0]}: nothing appropriate`);
          } else {
            addOutput('error', 'apropos: usage: apropos keyword');
          }
          break;

        case 'ping':
          if (args[0]) {
            addOutput('output', `PING ${args[0]} (127.0.0.1): 56 data bytes\n64 bytes from 127.0.0.1: icmp_seq=0 ttl=64 time=0.123 ms\n--- ${args[0]} ping statistics ---\n1 packets transmitted, 1 packets received, 0.0% packet loss`);
          } else {
            addOutput('error', 'ping: usage: ping hostname');
          }
          break;

        case 'ssh':
          if (args[0]) {
            addOutput('output', `ssh: Browser security prevents direct SSH connections. Use web-based SSH clients.`);
          } else {
            addOutput('error', 'ssh: usage: ssh user@hostname');
          }
          break;

        case 'scp':
          if (args.length >= 2) {
            addOutput('output', `scp: Browser security prevents direct SCP transfers. Use file upload/download.`);
          } else {
            addOutput('error', 'scp: usage: scp source destination');
          }
          break;

        case 'rsync':
          if (args.length >= 2) {
            addOutput('output', `rsync: Browser security prevents direct rsync. Use file synchronization APIs.`);
          } else {
            addOutput('error', 'rsync: usage: rsync source destination');
          }
          break;

        case 'netstat':
          addOutput('output', 'Active Internet connections (w/o servers)\nProto Recv-Q Send-Q Local Address           Foreign Address         State\ntcp        0      0 localhost:8080         localhost:54321         ESTABLISHED');
          break;

        case 'lsof':
          addOutput('output', 'COMMAND  PID    USER   FD   TYPE DEVICE SIZE/OFF NODE NAME\nentropy  123  entropy  txt    REG    8,1     1024  456 /usr/bin/entropy\nentropy  123  entropy    0u   CHR    1,3      0t0    7 /dev/null');
          break;

        case 'ifconfig':
        case 'ip':
          addOutput('output', 'lo: flags=73<UP,LOOPBACK,RUNNING>  mtu 65536\n        inet 127.0.0.1  netmask 255.0.0.0\n        inet6 ::1  prefixlen 128  scopeid 0x10<host>\n        loop  txqueuelen 1000  (Local Loopback)\n        RX packets 0  bytes 0 (0.0 B)\n        TX packets 0  bytes 0 (0.0 B)');
          break;

        case 'awk':
          if (args.length >= 1) {
            addOutput('output', `awk: processing with pattern '${args[0]}' - basic text processing simulated`);
          } else {
            addOutput('error', 'awk: usage: awk pattern [file]');
          }
          break;

        case 'sed':
          if (args.length >= 1) {
            addOutput('output', `sed: stream editing with '${args[0]}' - basic substitution simulated`);
          } else {
            addOutput('error', 'sed: usage: sed expression [file]');
          }
          break;

        case 'cut':
          if (args.includes('-d') && args.includes('-f')) {
            addOutput('output', 'cut: field extraction simulated');
          } else {
            addOutput('error', 'cut: usage: cut -d delimiter -f fields [file]');
          }
          break;

        case 'tr':
          if (args.length >= 2) {
            addOutput('output', `tr: character translation '${args[0]}' -> '${args[1]}' simulated`);
          } else {
            addOutput('error', 'tr: usage: tr set1 set2');
          }
          break;

        case 'xargs':
          if (args.length >= 1) {
            addOutput('output', `xargs: executing '${args.join(' ')}' with input arguments`);
          } else {
            addOutput('error', 'xargs: usage: xargs command');
          }
          break;

        case 'diff':
          if (args.length >= 2) {
            addOutput('output', `--- ${args[0]}\t2024-01-01 12:00:00.000000000 +0000\n+++ ${args[1]}\t2024-01-01 12:00:01.000000000 +0000\n@@ -1,3 +1,3 @@\n line 1\n-line 2\n+line 2 modified\n line 3`);
          } else {
            addOutput('error', 'diff: usage: diff file1 file2');
          }
          break;

        case 'patch':
          if (args[0]) {
            addOutput('output', `patching file ${args[0]}`);
          } else {
            addOutput('error', 'patch: usage: patch [file]');
          }
          break;

        case 'tar':
          if (args.includes('-czf') && args.length >= 3) {
            addOutput('output', `tar: creating archive ${args[args.indexOf('-czf') + 1]}`);
          } else if (args.includes('-xzf') && args.length >= 2) {
            addOutput('output', `tar: extracting archive ${args[args.indexOf('-xzf') + 1]}`);
          } else {
            addOutput('error', 'tar: usage: tar -czf archive.tar.gz files... OR tar -xzf archive.tar.gz');
          }
          break;

        case 'zip':
          if (args.length >= 2) {
            addOutput('output', `adding: ${args.slice(1).join(', ')} (deflated 65%)`);
          } else {
            addOutput('error', 'zip: usage: zip archive.zip files...');
          }
          break;

        case 'unzip':
          if (args[0]) {
            addOutput('output', `Archive:  ${args[0]}\n  inflating: file1.txt\n  inflating: file2.txt`);
          } else {
            addOutput('error', 'unzip: usage: unzip archive.zip');
          }
          break;

        case 'gzip':
          if (args[0]) {
            addOutput('output', `gzip: ${args[0]} compressed`);
          } else {
            addOutput('error', 'gzip: usage: gzip file');
          }
          break;

        case 'gunzip':
          if (args[0]) {
            addOutput('output', `gunzip: ${args[0]} decompressed`);
          } else {
            addOutput('error', 'gunzip: usage: gunzip file.gz');
          }
          break;

        case 'mount':
          addOutput('output', '/dev/sda1 on / type ext4 (rw,relatime)\nOPFS on /home/user type opfs (rw,user)');
          break;

        case 'umount':
          if (args[0]) {
            addOutput('output', `umount: ${args[0]} unmounted`);
          } else {
            addOutput('error', 'umount: usage: umount mount-point');
          }
          break;

        case 'fdisk':
          addOutput('output', 'Disk /dev/sda: 100 GiB, 107374182400 bytes, 209715200 sectors\nUnits: sectors of 1 * 512 = 512 bytes\nSector size (logical/physical): 512 bytes / 512 bytes');
          break;

        case 'lsblk':
          addOutput('output', 'NAME   MAJ:MIN RM  SIZE RO TYPE MOUNTPOINT\nsda      8:0    0  100G  0 disk\n└─sda1   8:1    0  100G  0 part /');
          break;

        case 'systemctl':
          if (args[0] === 'status') {
            addOutput('output', '● entropy-terminal.service - Entropy Terminal Service\n   Loaded: loaded (/etc/systemd/system/entropy-terminal.service; enabled)\n   Active: active (running) since Mon 2024-01-01 12:00:00 UTC; 1h 23min ago');
          } else {
            addOutput('output', `systemctl: ${args.join(' ')} executed`);
          }
          break;

        case 'service':
          if (args.length >= 2) {
            addOutput('output', `${args[0]}: ${args[1]} operation completed`);
          } else {
            addOutput('error', 'service: usage: service name action');
          }
          break;

        case 'crontab':
          if (args[0] === '-l') {
            addOutput('output', '# m h  dom mon dow   command\n0 2 * * * /usr/bin/backup.sh');
          } else if (args[0] === '-e') {
            addOutput('output', 'crontab: editing crontab (use nano/vim in real terminal)');
          } else {
            addOutput('error', 'crontab: usage: crontab [-l|-e]');
          }
          break;

        case 'nano':
        case 'vim':
        case 'vi':
        case 'emacs':
          if (args[0]) {
            try {
              // Try to read existing file, create empty if doesn't exist
              let content = '';
              try {
                const fileContent = await fileSystem.readFile(args[0]);
                content = typeof fileContent === 'string' ? fileContent : '';
              } catch {
                // File doesn't exist, will create new
              }
              
              // Determine editor mode
              let mode: 'vim' | 'nano' | 'emacs' = 'vim';
              if (cmd === 'nano') mode = 'nano';
              else if (cmd === 'emacs') mode = 'emacs';
              
              setEditorFile({ filename: args[0], content, mode });
              setShowEditor(true);
              addOutput('system', `Opening ${args[0]} in ${mode.toUpperCase()} editor...`);
            } catch (error) {
              addOutput('error', `${cmd}: ${error}`);
            }
          } else {
            addOutput('error', `${cmd}: usage: ${cmd} filename`);
          }
          break;

        case 'less':
        case 'more':
          if (args[0]) {
            try {
              const content = await fileSystem.readFile(args[0]);
              if (typeof content === 'string') {
                const lines = content.split('\n');
                const pageSize = 20;
                for (let i = 0; i < Math.min(lines.length, pageSize); i++) {
                  addOutput('output', lines[i]);
                }
                if (lines.length > pageSize) {
                  addOutput('output', `-- More (${lines.length - pageSize} lines remaining) --`);
                }
              } else {
                addOutput('error', `${cmd}: ${args[0]}: binary file`);
              }
            } catch (error) {
              addOutput('error', `${cmd}: ${args[0]}: No such file`);
            }
          } else {
            addOutput('error', `${cmd}: usage: ${cmd} filename`);
          }
          break;

        case 'bg':
          addOutput('output', 'No stopped jobs to background');
          break;

        case 'fg':
          addOutput('output', 'No background jobs to foreground');
          break;

        case 'screen':
          addOutput('output', 'screen: Virtual terminal multiplexer simulation\nNo screen sessions running');
          break;

        case 'tmux':
          addOutput('output', 'tmux: Terminal multiplexer simulation\nNo tmux sessions running');
          break;

        case 'sudo':
          if (args.length > 0) {
            addOutput('output', `[sudo] password for entropy: (password simulation)\nExecuting: ${args.join(' ')} as root`);
          } else {
            addOutput('error', 'sudo: usage: sudo command');
          }
          break;

        case 'su':
          if (args[0]) {
            addOutput('output', `Password: (password simulation)\nSwitched to user: ${args[0]}`);
          } else {
            addOutput('output', 'Password: (password simulation)\nSwitched to root');
          }
          break;

        case 'passwd':
          addOutput('output', 'Changing password for entropy.\nCurrent password: (password simulation)\nNew password: (password simulation)\nRetype new password: (password simulation)\npasswd: password updated successfully');
          break;

        case 'chgrp':
          if (args.length >= 2) {
            addOutput('output', `Changed group of ${args[1]} to ${args[0]}`);
          } else {
            addOutput('error', 'chgrp: usage: chgrp group file');
          }
          break;

        case 'groups':
          if (args[0]) {
            addOutput('output', `${args[0]} : entropy admin users`);
          } else {
            addOutput('output', 'entropy admin users');
          }
          break;

        case 'id':
          if (args[0]) {
            addOutput('output', `uid=1000(${args[0]}) gid=1000(${args[0]}) groups=1000(${args[0]}),27(sudo),1001(admin)`);
          } else {
            addOutput('output', 'uid=1000(entropy) gid=1000(entropy) groups=1000(entropy),27(sudo),1001(admin)');
          }
          break;

        case 'finger':
          if (args[0]) {
            addOutput('output', `Login: ${args[0]}           Name: ${args[0]}\nDirectory: /home/${args[0]}      Shell: /bin/bash\nLast login: Mon Jan  1 12:00 (UTC) on entropy-terminal`);
          } else {
            addOutput('output', 'Login     Name       Tty      Idle  Login Time   Office     Office Phone\nentropy   entropy    pts/0          Jan  1 12:00 (entropy-terminal)');
          }
          break;

        case 'w':
          addOutput('output', ' 12:00:00 up 1 day,  1:23,  1 user,  load average: 0.00, 0.01, 0.05\nUSER     TTY      FROM             LOGIN@   IDLE   JCPU   PCPU WHAT\nentropy  pts/0    entropy-terminal 12:00    0.00s  0.01s  0.00s entropy-terminal');
          break;

        case 'last':
          addOutput('output', 'entropy  pts/0        entropy-terminal Mon Jan  1 12:00   still logged in\nentropy  pts/0        entropy-terminal Sun Dec 31 11:30 - 12:00  (00:30)\n\nwtmp begins Mon Jan  1 12:00:00 2024');
          break;



        case 'fc':
          addOutput('output', 'fc: command history editor - use "history" to view commands');
          break;

        case 'logout':
        case 'exit':
          addOutput('output', 'logout\n\nConnection to entropy-terminal closed.');
          break;

        default:
          // Try to execute as a script file
          if (await fileSystem.exists(cmd)) {
            const content = await fileSystem.readFile(cmd);
            if (typeof content === 'string') {
              if (cmd.endsWith('.py')) {
                const result = await pythonEngine.executeCode(content, currentPath);
                if (result.output) addOutput('output', result.output);
                if (result.error) addOutput('error', result.error);
              } else if (cmd.endsWith('.js')) {
                const result = await nodeEngine.runScript(content, cmd);
                if (result.output) addOutput('output', result.output);
                if (result.error) addOutput('error', result.error);
              } else {
                addOutput('output', content);
              }
            }
          } else {
            addOutput('error', `Command not found: ${cmd}\nType 'help' for available commands`);
          }
          break;
      }

    } catch (error) {
      addOutput('error', `Error: ${error}`);
    } finally {
      setIsLoading(false);
      // Re-focus the input after command execution
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
        }
      }, 100);
    }
  };

  const handleCd = async (path: string) => {
    try {
      // Handle special cases
      if (path === '~' || path === '') {
        fileSystem.setCurrentPath('/home/user');
        setCurrentPath(fileSystem.getCurrentPath());
        return;
      }
      
      if (path === '..') {
        const currentDir = fileSystem.getCurrentPath();
        const parentPath = currentDir === '/' ? '/' : currentDir.substring(0, currentDir.lastIndexOf('/')) || '/';
        fileSystem.setCurrentPath(parentPath);
        setCurrentPath(fileSystem.getCurrentPath());
        return;
      }

      // Store current path for rollback
      const currentDir = fileSystem.getCurrentPath();
      
      // Resolve relative/absolute path
      let targetPath: string;
      if (path.startsWith('/')) {
        targetPath = path;
      } else {
        targetPath = currentDir === '/' ? `/${path}` : `${currentDir}/${path}`;
      }
      
      // Check if directory exists before changing
      if (await fileSystem.exists(targetPath)) {
        const items = await fileSystem.listDirectory(targetPath);
        // If we can list it, it's a valid directory
        fileSystem.setCurrentPath(targetPath);
        setCurrentPath(fileSystem.getCurrentPath());
      } else {
        addOutput('error', `cd: ${path}: No such file or directory`);
      }
    } catch (error) {
      addOutput('error', `cd: ${path}: No such file or directory`);
    }
  };

  const handleLs = async (path?: string) => {
    try {
      const items = await fileSystem.listDirectory(path || currentPath);
      const formatted = items.map(item => {
        const prefix = item.type === 'directory' ? 'd' : '-';
        const name = item.type === 'directory' ? `${item.name}/` : item.name;
        const size = item.size ? item.size.toString().padStart(8) : '       -';
        const date = item.lastModified?.toLocaleDateString() || 'unknown';
        return `${prefix}rwxr-xr-x 1 user user ${size} ${date} ${name}`;
      }).join('\n');
      
      addOutput('output', formatted || 'Directory is empty');
    } catch (error) {
      addOutput('error', `ls: ${error}`);
    }
  };

  const handlePython = async (args: string[]) => {
    try {
      if (!engineStatus.python) {
        addOutput('system', '🐍 Initializing Python engine...');
        await pythonEngine.initialize();
        setEngineStatus(prev => ({ ...prev, python: true }));
        addOutput('system', '✅ Python engine ready');
      }

      if (args.length === 0) {
        // Start Python REPL
        const repl = await pythonEngine.startREPL();
        setActiveSession({ type: 'python', repl });
        const version = await pythonEngine.getVersion();
        addOutput('output', `Python ${version} (Pyodide) on WebAssembly\nType "exit" or "quit" to exit the REPL.`);
      } else if (args[0] === '-c') {
        // Execute Python code
        let code = args.slice(1).join(' ');
        code = cleanPythonCode(code);
        const result = await pythonEngine.executeCode(code, currentPath);
        if (result.output) addOutput('output', result.output);
        if (result.error) addOutput('error', result.error);
      } else if (args[0] === '-m') {
        // Module execution
        const module = args[1];
        if (module === 'pip') {
          const subArgs = args.slice(2);
          if (subArgs[0] === 'install') {
            for (const pkg of subArgs.slice(1)) {
              const result = await pythonEngine.installPackage(pkg);
              addOutput('output', result);
            }
          } else if (subArgs[0] === 'list') {
            const packages = await pythonEngine.listPackages();
            addOutput('output', packages.join('\n'));
          }
        }
      } else {
        // Execute Python file (read from OPFS, clean code, and run)
        try {
          const filePath = args[0];
          const fileContent = await fileSystem.readFile(filePath);
          if (typeof fileContent === 'string') {
            // Write the file to the Pyodide FS before running
            await pythonEngine.saveToFile(filePath, fileContent);
            const cleaned = cleanPythonCode(fileContent);
            const result = await pythonEngine.executeCode(cleaned, currentPath);
            if (result.output) addOutput('output', result.output);
            if (result.error) addOutput('error', result.error);
          } else {
            addOutput('error', `${filePath}: binary file or unreadable`);
          }
        } catch (error) {
          addOutput('error', `python: ${error}`);
        }
      }
    } catch (error) {
      addOutput('error', `Python error: ${error}`);
    }
  };

  const handleNode = async (args: string[]) => {
    try {
      if (!engineStatus.node) {
        addOutput('system', '📦 Initializing Node.js engine...');
        await nodeEngine.initialize();
        setEngineStatus(prev => ({ ...prev, node: true }));
        addOutput('system', '✅ Node.js engine ready');
      }

      if (args.length === 0) {
        // Start Node REPL
        const repl = await nodeEngine.startREPL();
        if (repl) {
          setActiveSession({ type: 'node', repl });
          const version = await nodeEngine.getNodeVersion();
          addOutput('output', `Node.js ${version} (WebContainers)\nType "exit" or "quit" to exit the REPL.`);
        } else {
          addOutput('error', 'Failed to start Node.js REPL');
        }
      } else if (args[0] === '--version') {
        const version = await nodeEngine.getNodeVersion();
        addOutput('output', `v${version}`);
      } else {
        // Execute Node.js file
        try {
          const content = await fileSystem.readFile(args[0]);
          if (typeof content === 'string') {
            const result = await nodeEngine.runScript(content, args[0]);
            if (result.output) addOutput('output', result.output);
            if (result.error) addOutput('error', result.error);
          }
        } catch (error) {
          addOutput('error', `node: ${error}`);
        }
      }
    } catch (error) {
      addOutput('error', `Node error: ${error}`);
    }
  };

  const handleNpm = async (args: string[]) => {
    try {
      if (!engineStatus.node) {
        await nodeEngine.initialize();
        setEngineStatus(prev => ({ ...prev, node: true }));
      }

      const subcommand = args[0];
      
      switch (subcommand) {
        case 'install':
        case 'i':
          if (args[1]) {
            const isDev = args.includes('--save-dev') || args.includes('-D');
            const result = await nodeEngine.installPackage(args[1], isDev);
            addOutput('output', result);
          } else {
            // Install all dependencies from package.json
            const result = await nodeEngine.executeCommand('npm', ['install']);
            addOutput('output', result.output);
            if (result.error) addOutput('error', result.error);
          }
          break;

        case 'run':
          if (args[1]) {
            const result = await nodeEngine.runNpmScript(args[1]);
            if (result.output) addOutput('output', result.output);
            if (result.error) addOutput('error', result.error);
          } else {
            addOutput('error', 'npm run: missing script name');
          }
          break;

        case 'list':
        case 'ls':
          const result = await nodeEngine.listInstalledPackages();
          if (result.output) addOutput('output', result.output);
          if (result.error) addOutput('error', result.error);
          break;

        case 'init':
          const initResult = await nodeEngine.createPackageJson({
            name: 'my-project',
            version: '1.0.0',
            description: '',
            main: 'index.js'
          });
          addOutput('output', initResult);
          break;

        case '--version':
          const version = await nodeEngine.getNpmVersion();
          addOutput('output', version);
          break;

        default:
          const cmdResult = await nodeEngine.executeCommand('npm', args);
          if (cmdResult.output) addOutput('output', cmdResult.output);
          if (cmdResult.error) addOutput('error', cmdResult.error);
          break;
      }
    } catch (error) {
      addOutput('error', `npm error: ${error}`);
    }
  };

  const handleEditorSave = async (content: string) => {
    try {
      await fileSystem.writeFile(editorFile.filename, content);
      addOutput('system', `✅ File saved: ${editorFile.filename}`);
    } catch (error) {
      addOutput('error', `Failed to save file: ${error}`);
    }
  };

  const handleEditorClose = () => {
    setShowEditor(false);
    addOutput('system', `Editor closed: ${editorFile.filename}`);
    setEditorFile({ filename: '', content: '', mode: 'vim' });
  };

  const handleGit = async (args: string[]) => {
    const subcommand = args[0];
    
    try {
      switch (subcommand) {
        case 'clone':
          if (args[1]) {
            const url = args[1];
            const dir = args[2] || url.split('/').pop()?.replace('.git', '') || 'repo';
            addOutput('system', `Cloning ${url}...`);
            const result = await gitEngine.clone(url, dir);
            addOutput('output', result);
          } else {
            addOutput('error', 'git clone: missing repository URL');
          }
          break;

        case 'init':
          const result = await gitEngine.init(args[1]);
          addOutput('output', result);
          break;

        case 'add':
          if (args[1]) {
            const result = await gitEngine.add(args.slice(1));
            addOutput('output', result);
          } else {
            addOutput('error', 'git add: missing file specification');
          }
          break;

        case 'commit':
          if (args.includes('-m') && args[args.indexOf('-m') + 1]) {
            const messageIndex = args.indexOf('-m') + 1;
            const message = args.slice(messageIndex).join(' ');
            const result = await gitEngine.commit(message, { all: args.includes('-a') });
            addOutput('output', result);
          } else {
            addOutput('error', 'git commit: missing commit message (-m)');
          }
          break;

        case 'status':
          const status = await gitEngine.status();
          addOutput('output', status);
          break;

        case 'log':
          const log = await gitEngine.log({ 
            oneline: args.includes('--oneline'),
            max: args.includes('-n') ? parseInt(args[args.indexOf('-n') + 1]) : 10
          });
          addOutput('output', log);
          break;

        case 'branch':
          if (args[1]) {
            const result = await gitEngine.branch(args[1]);
            addOutput('output', result);
          } else {
            const branches = await gitEngine.branch();
            addOutput('output', branches);
          }
          break;

        case 'checkout':
          if (args[1]) {
            const result = await gitEngine.checkout(args[1], { 
              create: args.includes('-b') 
            });
            addOutput('output', result);
          } else {
            addOutput('error', 'git checkout: missing branch name');
          }
          break;

        case 'remote':
          const action = args[1] as 'add' | 'remove' | 'show' | undefined;
          const name = args[2];
          const url = args[3];
          const remoteResult = await gitEngine.remote(action, name, url);
          addOutput('output', remoteResult);
          break;

        case 'push':
          const pushResult = await gitEngine.push(args[1], args[2]);
          addOutput('output', pushResult);
          break;

        case 'pull':
          const pullResult = await gitEngine.pull(args[1], args[2]);
          addOutput('output', pullResult);
          break;

        case 'diff':
          const diff = await gitEngine.diff(args[1]);
          addOutput('output', diff);
          break;

        case 'config':
          if (args[1] === 'user.name' && args[2]) {
            gitEngine.setConfig(args[2], gitEngine.getConfig().email);
            addOutput('output', `Set user.name to ${args[2]}`);
          } else if (args[1] === 'user.email' && args[2]) {
            gitEngine.setConfig(gitEngine.getConfig().name, args[2]);
            addOutput('output', `Set user.email to ${args[2]}`);
          } else {
            const config = gitEngine.getConfig();
            addOutput('output', `user.name=${config.name}\nuser.email=${config.email}`);
          }
          break;

        default:
          addOutput('error', `git: '${subcommand}' is not a git command. See 'git help'`);
          break;
      }
    } catch (error) {
      addOutput('error', `git error: ${error}`);
    }
  };

  const handleAICommand = async (args: string[]) => {
    if (args.length === 0) {
      // Start AI session
      const currentProvider = aiService.getCurrentProvider();
      if (!currentProvider) {
        addOutput('error', 'No AI provider configured. Use "ai-config" to set up providers.');
        return;
      }
      
      setActiveSession({ type: 'ai', repl: null });
      setAiSession({ messages: [], isActive: true, provider: currentProvider.id, model: currentProvider.model });
      addOutput('system', `🤖 AI session started with ${currentProvider.name} (${currentProvider.model})`);
      addOutput('system', 'AI Agent has access to file system, code execution, and terminal commands.');
      addOutput('system', 'Type your message or "exit" to quit.');
    } else if (args[0] === 'set-provider') {
      if (args.length < 2) {
        addOutput('error', 'Usage: ai set-provider <provider> [model]');
        return;
      }
      
      try {
        aiService.setProvider(args[1], args[2]);
        const provider = aiService.getCurrentProvider();
        addOutput('output', `AI provider set to ${provider?.name} (${provider?.model})`);
      } catch (error) {
        addOutput('error', `Failed to set provider: ${error}`);
      }
    } else if (args[0] === 'add-key') {
      if (args.length < 3) {
        addOutput('error', 'Usage: ai add-key <provider> <api-key>');
        return;
      }
      
      try {
        aiService.addProvider(args[1], args[2]);
        addOutput('output', `API key added for ${args[1]}`);
      } catch (error) {
        addOutput('error', `Failed to add API key: ${error}`);
      }
    } else {
      // Direct AI message
      const message = args.join(' ');
      await handleAIMessage(message);
    }
  };

  const refreshFileSystem = async () => {
    try {
      const items = await fileSystem.listDirectory(currentPath);
      const filesWithContent = await Promise.all(
        items.map(async (item) => {
          if (item.type === 'file') {
            try {
              const content = await fileSystem.readFile(`${currentPath}/${item.name}`);
              return {
                name: item.name,
                type: item.type,
                content: typeof content === 'string' ? content : new TextDecoder().decode(content)
              };
            } catch (error) {
              return { name: item.name, type: item.type, content: 'Error reading file' };
            }
          }
          return { name: item.name, type: item.type };
        })
      );
      setFileSystemFiles(filesWithContent);
    } catch (error) {
      addOutput('error', `Failed to refresh file system: ${error}`);
    }
  };

  const parseAndExecuteAITools = async (aiResponse: string, toolsInstance: AITools) => {
    // Enhanced parsing for file creation and code execution
    const pythonFileRegex = /```python:([^\s]+)\s*\n(.*?)```/gs;
    const jsFileRegex = /```(?:javascript|js):([^\s]+)\s*\n(.*?)```/gs;
    const pythonCodeRegex = /```python\s*\n(.*?)```/gs;
    const jsCodeRegex = /```(?:javascript|js)\s*\n(.*?)```/gs;
    const toolCallRegex = /```tool_code\s*\n(.*?)\n```/gs;
    const executeCodeRegex = /executeCode\(code=['"`](.*?)['"`],\s*language=['"`](.*?)['"`]\)/gs;
    const editFileRegex = /editFile\(['"`]([^'"`]+)['"`],\s*['"`](.*?)['"`]\)/gs;
    const deleteFileRegex = /deleteFile\(['"`]([^'"`]+)['"`]\)/gs;
    
    interface ExecutionResult {
      filename?: string;
      type?: string;
      language?: string;
      result: string;
      error?: string;
    }
    
    let match;
    let executionResults: ExecutionResult[] = [];
    
    // Handle Python files (code with filename)
    while ((match = pythonFileRegex.exec(aiResponse)) !== null) {
      const filename = match[1];
      const code = match[2];
      
      addOutput('system', `📝 Creating Python file: ${filename}`);
      
      try {
        const cleanedCode = cleanPythonCode(code);
        await toolsInstance.editFile(filename, cleanedCode);
        addOutput('output', `✅ File ${filename} created successfully`);
        
        // Directly execute the full content of the file
        if (filename.endsWith('.py')) {
          addOutput('system', `🔧 Executing ${filename}...`);
          const result = await toolsInstance.executeCode(cleanedCode, 'python');
          addOutput('output', result);
          executionResults.push({ filename, result });
        }
      } catch (error) {
        const errorMsg = `Failed to create/execute ${filename}: ${error}`;
        addOutput('error', errorMsg);
        executionResults.push({ filename, result: '', error: errorMsg });
      }
    }
    
    // Handle JavaScript files (code with filename)
    while ((match = jsFileRegex.exec(aiResponse)) !== null) {
      const filename = match[1];
      const code = match[2];
      
      addOutput('system', `📝 Creating JavaScript file: ${filename}`);
      
      try {
        await toolsInstance.editFile(filename, code);
        addOutput('output', `✅ File ${filename} created successfully`);
        
        // If it's a JS file, also execute it
        if (filename.endsWith('.js')) {
          addOutput('system', `🔧 Executing ${filename}...`);
          const result = await toolsInstance.executeCode(code, 'javascript');
          addOutput('output', result);
          executionResults.push({ filename, result });
        }
      } catch (error) {
        const errorMsg = `Failed to create ${filename}: ${error}`;
        addOutput('error', errorMsg);
        executionResults.push({ filename, result: '', error: errorMsg });
      }
    }
    
    // Handle explicit editFile calls
    while ((match = editFileRegex.exec(aiResponse)) !== null) {
      const filename = match[1];
      const content = match[2].replace(/\\n/g, '\n').replace(/\\'/g, "'");
      
      addOutput('system', `📝 Creating/editing file: ${filename}`);
      
      try {
        await toolsInstance.editFile(filename, content);
        addOutput('output', `✅ File ${filename} saved successfully`);
        executionResults.push({ filename, result: 'File saved successfully' });
      } catch (error) {
        const errorMsg = `Failed to save ${filename}: ${error}`;
        addOutput('error', errorMsg);
        executionResults.push({ filename, result: '', error: errorMsg });
      }
    }
    
    // Handle Python code blocks (execute only, don't save)
    pythonCodeRegex.lastIndex = 0;
    while ((match = pythonCodeRegex.exec(aiResponse)) !== null) {
      const code = match[1];
      
      // Check if code starts with a filename comment (e.g., # filename.py)
      const filenameMatch = code.match(/^#\s*([a-zA-Z0-9_-]+\.py)/);
      
      if (filenameMatch && code.trim().length > 20) {
        // This looks like a file that should be saved
        const filename = filenameMatch[1];
        addOutput('system', `📝 Creating Python file: ${filename}`);
        
        try {
          const cleanedCode = cleanPythonCode(code);
          await toolsInstance.editFile(filename, cleanedCode);
          addOutput('output', `✅ File ${filename} created successfully`);
          
          // Also execute the file
          addOutput('system', `🔧 Executing ${filename}...`);
          const result = await toolsInstance.executeCode(cleanedCode, 'python');
          addOutput('output', result);
          executionResults.push({ filename, result });
        } catch (error) {
          const errorMsg = `Failed to create/execute ${filename}: ${error}`;
          addOutput('error', errorMsg);
          executionResults.push({ filename, result: '', error: errorMsg });
        }
      } else if (code.trim().length > 10 && (!pythonFileRegex.test(aiResponse) || !aiResponse.includes(code))) {
        // Regular code execution
        addOutput('system', `🔧 Executing Python code...`);
        
        try {
          const cleanedCode = cleanPythonCode(code);
          const result = await toolsInstance.executeCode(cleanedCode, 'python');
          addOutput('output', result);
          executionResults.push({ type: 'execution', result });
        } catch (error) {
          const errorMsg = `Execution error: ${error}`;
          addOutput('error', errorMsg);
          executionResults.push({ type: 'execution', result: '', error: errorMsg });
        }
      }
    }
    
    // Handle executeCode calls
    while ((match = executeCodeRegex.exec(aiResponse)) !== null) {
      const code = match[1].replace(/\\n/g, '\n').replace(/\\'/g, "'");
      const language = match[2];
      
      addOutput('system', `🔧 Executing ${language} code...`);
      
      try {
        const result = await toolsInstance.executeCode(code, language);
        addOutput('output', result);
        executionResults.push({ type: 'tool_call', language, result });
      } catch (error) {
        const errorMsg = `Execution error: ${error}`;
        addOutput('error', errorMsg);
        executionResults.push({ type: 'tool_call', language, result: '', error: errorMsg });
      }
    }
    
    // Handle tool_code blocks
    while ((match = toolCallRegex.exec(aiResponse)) !== null) {
      const toolCall = match[1];
      
      // Parse the tool call
      const executeMatch = toolCall.match(/executeCode\(code=['"`](.*?)['"`],\s*language=['"`](.*?)['"`]\)/s);
      if (executeMatch) {
        const code = executeMatch[1].replace(/\\n/g, '\n').replace(/\\'/g, "'");
        const language = executeMatch[2];
        
        addOutput('system', `🔧 Executing ${language} code...`);
        
        try {
          const result = await toolsInstance.executeCode(code, language);
          addOutput('output', result);
          executionResults.push({ type: 'tool_block', language, result });
        } catch (error) {
          const errorMsg = `Execution error: ${error}`;
          addOutput('error', errorMsg);
          executionResults.push({ type: 'tool_block', language, result: '', error: errorMsg });
        }
      }
    }
    
    // Handle explicit deleteFile calls
    while ((match = deleteFileRegex.exec(aiResponse)) !== null) {
      const filename = match[1];
      addOutput('system', `🗑️ Deleting file: ${filename}`);
      try {
        await fileSystem.deleteFile(filename);
        addOutput('output', `✅ File ${filename} deleted`);
        executionResults.push({ filename, result: 'File deleted' });
      } catch (error) {
        const errorMsg = `Failed to delete ${filename}: ${error}`;
        addOutput('error', errorMsg);
        executionResults.push({ filename, result: '', error: errorMsg });
      }
    }
    
    return executionResults;
  };

  const handleAIMessage = async (message: string) => {
    try {
      const currentProvider = aiService.getCurrentProvider();
      if (!currentProvider) {
        addOutput('error', 'No AI provider configured');
        return;
      }

      addOutput('system', '🤖 Processing...');
      
      // Add context about current directory and recent files
      const currentFiles = await tools.listFiles(currentPath);
      const contextMessage = `${message}\n\nContext:\n- Current directory: ${currentPath}\n- Files: ${currentFiles.slice(0, 10).join(', ')}${currentFiles.length > 10 ? '...' : ''}`;
      
      const newMessage: AIMessage = { role: 'user', content: contextMessage };
      let updatedMessages = [...aiSession.messages, newMessage];
      
      let attemptCount = 0;
      const maxAttempts = 3;
      let hasErrors = false;
      
      do {
        attemptCount++;
        hasErrors = false;
        
        if (attemptCount > 1) {
          addOutput('system', `🔄 AI Auto-correction attempt ${attemptCount}/${maxAttempts}...`);
        }
        
        const response = await aiService.sendMessage(updatedMessages);
        
        // Parse and execute AI commands
        const aiResponse = response.content;
        const executionResults = await parseAndExecuteAITools(aiResponse, tools);
        
        // Check for errors in execution results
        const errorResults = executionResults.filter(r => r.error);
        hasErrors = errorResults.length > 0;
        
        // Prepare assistant message with execution context
        let enhancedAssistantContent = response.content;
        if (executionResults.length > 0) {
          enhancedAssistantContent += '\n\n--- EXECUTION RESULTS ---\n';
          executionResults.forEach((result, index) => {
            if (result.filename) {
              if (result.error) {
                enhancedAssistantContent += `File ${result.filename} creation failed:\nERROR: ${result.error}\n\n`;
              } else {
                enhancedAssistantContent += `File ${result.filename} created and executed:\n${result.result}\n\n`;
              }
            } else {
              if (result.error) {
                enhancedAssistantContent += `Execution ${index + 1} failed:\nERROR: ${result.error}\n\n`;
              } else {
                enhancedAssistantContent += `Execution ${index + 1}:\n${result.result}\n\n`;
              }
            }
          });
        }
        
        // Add assistant message to conversation
        const assistantMessage: AIMessage = { role: 'assistant', content: enhancedAssistantContent };
        updatedMessages = [...updatedMessages, assistantMessage];
        
        // If there are errors and we haven't reached max attempts, try to fix them
        if (hasErrors && attemptCount < maxAttempts) {
          const errorSummary = errorResults.map(r => r.error).join('\n');
          const fixMessage = `The previous code had execution errors. Please fix these issues and provide corrected code:\n\nErrors:\n${errorSummary}\n\nPlease provide the fixed code. Focus only on fixing the errors, don't repeat the entire conversation.`;
          
          updatedMessages.push({ role: 'user', content: fixMessage });
        } else {
          // No errors or max attempts reached - display results
          
          // Extract just the conversational part (remove code blocks for display)
          const displayContent = aiResponse
            .replace(/```[\s\S]*?```/g, '') // Remove code blocks
            .replace(/^\s*#[^\n]*$/gm, '') // Remove single-line comments
            .replace(/^\s*\/\/[^\n]*$/gm, '') // Remove JS comments
            .trim();
          
          // Display AI response in a nice format
          if (displayContent) {
            addOutput('ai-response', `🤖 ${currentProvider.name}:\n\n${displayContent}`);
          }
          
          // Show file system status if files were created
          const successfulFiles = executionResults.filter(r => r.filename && !r.error);
          if (successfulFiles.length > 0) {
            const fileCount = await tools.listFiles(currentPath);
            addOutput('system', `📁 Current directory now has ${fileCount.length} files`);
            // Auto-refresh file system if modal is open
            if (showFileSystem) {
              await refreshFileSystem();
            }
          }
          
          // Show final status
          if (hasErrors) {
            addOutput('system', `⚠️ Some operations failed after ${maxAttempts} attempts. Check the errors above.`);
          } else if (attemptCount > 1) {
            addOutput('system', `✅ AI successfully fixed issues in ${attemptCount} attempts.`);
          }
        }
        
        // Show cost information
        addOutput('system', `💰 Cost: $${response.usage.cost.toFixed(6)} (${response.usage.input_tokens} in, ${response.usage.output_tokens} out)`);
        
      } while (hasErrors && attemptCount < maxAttempts);
      
      // Update final conversation history
      setAiSession(prev => ({
        ...prev,
        messages: updatedMessages
      }));

    } catch (error) {
      addOutput('error', `AI Error: ${error}`);
    }
  };

  const handleAIProviders = async (args: string[]) => {
    if (args.length === 0) {
      // List available providers
      const providers = aiService.getAvailableProviders();
      const current = aiService.getCurrentProvider();
      
      addOutput('output', 'Available AI Providers:');
      providers.forEach(provider => {
        const status = current?.id === provider.id ? ' (current)' : '';
        addOutput('output', `  ${provider.id}: ${provider.name}${status}`);
        provider.models.forEach(model => {
          const modelStatus = current?.model === model ? ' (active)' : '';
          addOutput('output', `    - ${model}${modelStatus}`);
        });
      });
      
      if (providers.length === 0) {
        addOutput('output', 'No providers configured. Use "ai add-key <provider> <api-key>" to add providers.');
      }
    } else if (args[0] === 'pricing') {
      addOutput('output', '💰 AI Provider Pricing (per million tokens):');
      Object.entries(AI_PROVIDERS).forEach(([id, config]) => {
        addOutput('output', `${config.name}: $${config.pricing.input} input, $${config.pricing.output} output`);
      });
    }
  };

  const handleAIModels = async (args: string[]) => {
    const currentProvider = aiService.getCurrentProvider();
    if (!currentProvider) {
      addOutput('error', 'No AI provider configured');
      return;
    }

    const providers = aiService.getAvailableProviders();
    const provider = providers.find(p => p.id === currentProvider.id);
    
    if (provider) {
      addOutput('output', `Available models for ${provider.name}:`);
      provider.models.forEach(model => {
        const status = currentProvider.model === model ? ' (current)' : '';
        addOutput('output', `  ${model}${status}`);
      });
    }
  };

  const getHelpText = () => {
    return `
🚀 Entropy Real Terminal - Professional Grade Terminal (100+ Commands)

📁 FILE SYSTEM:
  ls, dir          - List directory contents
  cd <path>        - Change directory
  pwd              - Print working directory
  mkdir <name>     - Create directory
  touch <file>     - Create empty file
  cat <file>       - Display file contents
  rm <file>        - Remove file
  echo <text>      - Print text

🐍 PYTHON (Pyodide):
  python           - Start Python REPL
  python <file>    - Execute Python file
  python -c <code> - Execute Python code
  python -m pip install <pkg> - Install Python package

📦 NODE.JS (WebContainers):
  node             - Start Node.js REPL
  node <file>      - Execute JavaScript file
  npm install <pkg> - Install npm package
  npm run <script> - Run npm script
  npm init         - Initialize package.json

🔧 GIT:
  git init         - Initialize repository
  git clone <url>  - Clone repository
  git add <files>  - Stage files
  git commit -m "msg" - Commit changes
  git status       - Show status
  git log          - Show commit history
  git branch       - List/create branches
  git checkout <branch> - Switch branches
  git remote       - Manage remotes
  git push/pull    - Sync with remote

🤖 AI INTEGRATION:
  ai               - Start AI chat session
  ai <message>     - Send message to AI
  ai add-key <provider> <key> - Add API key
  ai set-provider <provider>  - Switch AI provider
  ai-providers     - List available providers
  ai-models        - List available models
  ai-config        - Open AI configuration
  
  Supported providers: OpenAI, Anthropic, Google, xAI, DeepSeek, Mistral

📁 FILE MANAGEMENT:
  files, filesystem - Open file system browser
  tree             - Show directory tree structure

📝 TEXT EDITORS:
  vim <file>       - Full vim editor with all keybindings
  nano <file>      - User-friendly nano editor
  emacs <file>     - Emacs editor with key commands
  (Features: syntax highlighting, search/replace, undo/redo)

🛠️ SYSTEM:
  help             - Show this help
  engines          - Show engine status
  clear            - Clear terminal
  history          - Show command history
  ps               - List processes
  whoami           - Current user
  date             - Current date/time
  uname            - System information

💡 FEATURES:
  - Files are stored persistently in your browser
  - Python includes NumPy, Pandas, Matplotlib
  - Node.js supports full npm ecosystem
  - Git works with real repositories
  - Use arrow keys for command history
  - Full-featured text editors: vim, nano, emacs
  - Real vim keybindings, syntax highlighting, search/replace
  - Professional development environment in browser
`;
  };

  const getEngineStatus = () => {
    return `
🔧 Engine Status:

📁 File System (OPFS): ${engineStatus.filesystem ? '✅ Ready' : '❌ Not initialized'}
🐍 Python (Pyodide): ${engineStatus.python ? '✅ Ready' : '⏳ Initialize with: python'}
📦 Node.js (WebContainers): ${engineStatus.node ? '✅ Ready' : '⏳ Initialize with: node'}
🔧 Git (isomorphic-git): ${engineStatus.git ? '✅ Ready' : '❌ Not initialized'}
🤖 AI Providers: ${engineStatus.ai ? '✅ Ready' : '⏳ Configure with: ai-config'}

💾 Storage: Browser OPFS (Origin Private File System)
🌐 Network: Git clone/push/pull, npm packages, AI APIs
⚡ Performance: WebAssembly + native browser APIs
`;
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (currentCommand.trim()) {
        setCommandHistory(prev => [...prev, currentCommand]);
        executeCommand(currentCommand);
        setCurrentCommand('');
        setHistoryIndex(-1);
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (historyIndex < commandHistory.length - 1) {
        const newIndex = historyIndex + 1;
        setHistoryIndex(newIndex);
        setCurrentCommand(commandHistory[commandHistory.length - 1 - newIndex]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex > 0) {
        const newIndex = historyIndex - 1;
        setHistoryIndex(newIndex);
        setCurrentCommand(commandHistory[commandHistory.length - 1 - newIndex]);
      } else if (historyIndex === 0) {
        setHistoryIndex(-1);
        setCurrentCommand('');
      }
    } else if (e.key === 'Tab') {
      e.preventDefault();
      // TODO: Implement tab completion
    }
  };

  // Brute force approach to fixing Python code indentation
  const cleanPythonCode = (code: string): string => {
    // First, normalize the code by removing empty lines at beginning and end
    let cleanedCode = code.trim();
    
    // Add pass statements to any function definitions without a body
    cleanedCode = cleanedCode.replace(/def\s+\w+\s*\([^)]*\)\s*:/g, 
      (match) => `${match}\n    pass`);
    
    // Add pass statements to any class definitions without a body
    cleanedCode = cleanedCode.replace(/class\s+\w+(\s*\([^)]*\))?\s*:/g, 
      (match) => `${match}\n    pass`);
    
    // Add except blocks to any try statements without an except or finally
    cleanedCode = cleanedCode.replace(/try\s*:/g, 
      (match) => `${match}\n    pass\nexcept Exception:\n    pass`);
    
    // Add pass statements to if/else/elif without a body
    cleanedCode = cleanedCode.replace(/if\s+.+:/g, 
      (match) => `${match}\n    pass`);
    cleanedCode = cleanedCode.replace(/else\s*:/g, 
      (match) => `${match}\n    pass`);
    cleanedCode = cleanedCode.replace(/elif\s+.+:/g, 
      (match) => `${match}\n    pass`);
    
    // Add pass statements to for/while loops without a body
    cleanedCode = cleanedCode.replace(/for\s+.+:/g, 
      (match) => `${match}\n    pass`);
    cleanedCode = cleanedCode.replace(/while\s+.+:/g, 
      (match) => `${match}\n    pass`);
    
    return cleanedCode;
  };

  return (
    <div className="min-h-screen bg-gray-900 text-green-400 font-mono overflow-hidden">
      {/* Text Editor Overlay */}
      {showEditor && (
        <TextEditor
          filename={editorFile.filename}
          initialContent={editorFile.content}
          onSave={handleEditorSave}
          onClose={handleEditorClose}
          mode={editorFile.mode}
        />
      )}

      {/* File System Modal */}
      {showFileSystem && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-gray-800 border border-green-400 rounded-lg p-6 max-w-6xl w-full max-h-[90vh] overflow-y-auto text-green-400 font-mono">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold">📁 File System - {currentPath}</h2>
              <div className="flex gap-2">
                <button
                  onClick={refreshFileSystem}
                  className="bg-blue-600 hover:bg-blue-700 px-3 py-1 rounded text-sm"
                >
                  🔄 Refresh
                </button>
                <button
                  onClick={() => setShowFileSystem(false)}
                  className="text-red-400 hover:text-red-300"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* File List */}
              <div>
                <h3 className="text-lg font-semibold mb-3">Files & Directories</h3>
                <div className="bg-gray-700 rounded p-4 max-h-96 overflow-y-auto">
                  {fileSystemFiles.length === 0 ? (
                    <p className="text-gray-400">No files in current directory</p>
                  ) : (
                    fileSystemFiles.map((file, index) => (
                      <div key={index} className="flex items-center gap-2 py-1 hover:bg-gray-600 px-2 rounded">
                        <span className="text-blue-400">
                          {file.type === 'directory' ? '📁' : '📄'}
                        </span>
                        <span className="flex-1">{file.name}</span>
                        {file.type === 'file' && (
                          <span className="text-xs text-gray-400">
                            {file.content ? `${file.content.length} chars` : 'binary'}
                          </span>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* File Content Preview */}
              <div>
                <h3 className="text-lg font-semibold mb-3">File Contents</h3>
                <div className="bg-gray-700 rounded p-4 max-h-96 overflow-y-auto">
                  {fileSystemFiles.filter(f => f.type === 'file' && f.content).map((file, index) => (
                    <div key={index} className="mb-4 border-b border-gray-600 pb-4">
                      <h4 className="font-medium text-yellow-400 mb-2">{file.name}</h4>
                      <pre className="text-xs text-gray-300 whitespace-pre-wrap bg-gray-800 p-3 rounded max-h-40 overflow-y-auto">
                        {file.content}
                      </pre>
                    </div>
                  ))}
                  {fileSystemFiles.filter(f => f.type === 'file' && f.content).length === 0 && (
                    <p className="text-gray-400">No readable files to preview</p>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-6 text-sm text-gray-400">
              <p>💡 Use commands like <code>cat filename</code>, <code>vim filename</code>, or ask the AI to create files</p>
            </div>
          </div>
        </div>
      )}

      {/* AI Configuration Modal */}
      {showAIConfig && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-gray-800 border border-green-400 rounded-lg p-6 max-w-4xl w-full max-h-[80vh] overflow-y-auto text-green-400 font-mono">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold">🤖 AI Configuration</h2>
              <button
                onClick={() => setShowAIConfig(false)}
                className="text-red-400 hover:text-red-300"
              >
                ✕
              </button>
            </div>

            <div className="space-y-6">
              {/* Current Provider */}
              <div>
                <h3 className="text-lg font-semibold mb-3">Current Provider</h3>
                {(() => {
                  const current = aiService.getCurrentProvider();
                  return current ? (
                    <div className="bg-gray-700 p-3 rounded">
                      <p>Provider: {current.name}</p>
                      <p>Model: {current.model}</p>
                    </div>
                  ) : (
                    <p className="text-yellow-400">No provider configured</p>
                  );
                })()}
              </div>

              {/* Add API Keys */}
              <div>
                <h3 className="text-lg font-semibold mb-3">Add API Keys</h3>
                <div className="space-y-4">
                                     {Object.entries(AI_PROVIDERS).map(([id, config]) => (
                     <div key={id} className="bg-gray-700 p-4 rounded">
                       <div className="flex justify-between items-center mb-2">
                         <h4 className="font-medium">
                           {config.name}
                           {id === 'google' && (
                             <span className="ml-2 text-xs bg-green-600 px-2 py-1 rounded">
                               FREE TIER AVAILABLE
                             </span>
                           )}
                         </h4>
                         <span className="text-sm text-gray-400">
                           {id === 'google' 
                             ? 'Free for gemini-2.0-flash-lite'
                             : `$${config.pricing.input}/$${config.pricing.output} per M tokens`
                           }
                         </span>
                       </div>
                      <div className="flex gap-2">
                                                 <input
                           type="password"
                           placeholder={id === 'google' 
                             ? `${config.name} API Key (optional for free tier)`
                             : `${config.name} API Key`
                           }
                           className="flex-1 bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              const input = e.target as HTMLInputElement;
                              if (input.value.trim()) {
                                try {
                                  aiService.addProvider(id, input.value.trim());
                                  input.value = '';
                                  addOutput('system', `✅ API key added for ${config.name}`);
                                } catch (error) {
                                  addOutput('error', `❌ Failed to add key: ${error}`);
                                }
                              }
                            }
                          }}
                        />
                        <button
                          onClick={(e) => {
                            const input = (e.target as HTMLElement).previousElementSibling as HTMLInputElement;
                            if (input.value.trim()) {
                              try {
                                aiService.addProvider(id, input.value.trim());
                                input.value = '';
                                addOutput('system', `✅ API key added for ${config.name}`);
                              } catch (error) {
                                addOutput('error', `❌ Failed to add key: ${error}`);
                              }
                            }
                          }}
                          className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded text-white"
                        >
                          Add
                        </button>
                      </div>
                                             <div className="mt-2 text-sm text-gray-400">
                         Models: {config.models.join(', ')}
                         {id === 'google' && (
                           <div className="mt-1 text-green-400">
                             ✅ gemini-2.0-flash-lite is free without API key
                           </div>
                         )}
                       </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Available Providers */}
              <div>
                <h3 className="text-lg font-semibold mb-3">Configured Providers</h3>
                {(() => {
                  const providers = aiService.getAvailableProviders();
                  return providers.length > 0 ? (
                    <div className="space-y-2">
                      {providers.map(provider => (
                        <div key={provider.id} className="bg-gray-700 p-3 rounded flex justify-between items-center">
                          <div>
                            <span className="font-medium">{provider.name}</span>
                            <div className="text-sm text-gray-400">
                              Models: {provider.models.join(', ')}
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <select
                              className="bg-gray-800 border border-gray-600 rounded px-2 py-1"
                              onChange={(e) => {
                                if (e.target.value) {
                                  aiService.setProvider(provider.id, e.target.value);
                                  addOutput('system', `✅ Switched to ${provider.name} (${e.target.value})`);
                                }
                              }}
                            >
                              <option value="">Select Model</option>
                              {provider.models.map(model => (
                                <option key={model} value={model}>{model}</option>
                              ))}
                            </select>
                            <button
                              onClick={() => {
                                aiService.removeProvider(provider.id);
                                addOutput('system', `🗑️ Removed ${provider.name}`);
                              }}
                              className="px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-white"
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-400">No providers configured</p>
                  );
                })()}
              </div>

              {/* Usage Instructions */}
              <div>
                <h3 className="text-lg font-semibold mb-3">Usage Instructions</h3>
                                 <div className="bg-gray-700 p-4 rounded text-sm space-y-2">
                   <p><code className="bg-gray-800 px-2 py-1 rounded">ai</code> - Start interactive AI session</p>
                   <p><code className="bg-gray-800 px-2 py-1 rounded">ai "write a python script"</code> - Direct AI command</p>
                   <p><code className="bg-gray-800 px-2 py-1 rounded">ai set-provider openai gpt-4o</code> - Switch provider</p>
                   <p><code className="bg-gray-800 px-2 py-1 rounded">ai-providers pricing</code> - View pricing</p>
                   <p className="text-green-400 mt-3">🆓 <strong>Free:</strong> Google Gemini 2.0 Flash Lite (no API key needed)</p>
                   <p className="text-yellow-400">💡 The AI can execute code, edit files, and run terminal commands!</p>
                 </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setShowAIConfig(false)}
                className="px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded text-white"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Terminal Header */}
      <div className="bg-gray-800 border-b border-gray-700 p-3 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="flex space-x-2">
            <div className="w-3 h-3 bg-red-500 rounded-full"></div>
            <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
          </div>
          <span className="text-gray-300 font-semibold">
            Entropy Real Terminal
          </span>
        </div>
        <div className="flex items-center space-x-4 text-sm text-gray-400">
          <span className={`flex items-center ${engineStatus.filesystem ? 'text-green-400' : 'text-red-400'}`}>
            📁 FS
          </span>
          <span className={`flex items-center ${engineStatus.python ? 'text-green-400' : 'text-gray-500'}`}>
            🐍 Py
          </span>
          <span className={`flex items-center ${engineStatus.node ? 'text-green-400' : 'text-gray-500'}`}>
            📦 Node
          </span>
          <span className={`flex items-center ${engineStatus.git ? 'text-green-400' : 'text-gray-500'}`}>
            🔧 Git
          </span>
        </div>
      </div>

      {/* Terminal Content */}
      <div 
        ref={terminalRef}
        className="h-[calc(100vh-140px)] overflow-y-auto p-4 bg-gray-900"
        onClick={() => inputRef.current?.focus()}
      >
        {output.map((item) => (
          <div key={item.id} className="mb-1">
            {item.type === 'ai-response' ? (
              <div className="bg-gray-800 border-l-4 border-blue-500 p-4 rounded-r-lg my-3">
                <pre className="whitespace-pre-wrap font-mono text-sm text-cyan-300 leading-relaxed">
                  {item.content}
                </pre>
              </div>
            ) : (
              <pre className={`whitespace-pre-wrap font-mono text-sm ${
                item.type === 'command' ? 'text-white' :
                item.type === 'error' ? 'text-red-400' :
                item.type === 'system' ? 'text-blue-400' :
                'text-green-400'
              }`}>
                {item.content}
              </pre>
            )}
          </div>
        ))}
        
        {/* Loading indicator */}
        {isLoading && (
          <div className="text-yellow-400 text-sm animate-pulse">
            ⏳ Processing...
          </div>
        )}
      </div>

      {/* Command Input */}
      <div className="bg-gray-800 border-t border-gray-700 p-4">
        <div className="flex items-center">
          <span className="text-green-400 font-bold mr-2">
            {getCurrentPrompt()}
          </span>
          <input
            ref={inputRef}
            type="text"
            value={currentCommand}
            onChange={(e) => setCurrentCommand(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 bg-transparent text-white outline-none font-mono"
            placeholder={
              activeSession.type ? 
              `Enter ${activeSession.type} code...` : 
              'Enter command...'
            }
            disabled={isLoading}
            autoComplete="off"
            spellCheck="false"
          />
        </div>
      </div>
    </div>
  );
} 