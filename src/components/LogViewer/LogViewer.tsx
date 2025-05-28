import React, { useState, useEffect, useRef } from 'react';
import './LogViewer.css';

interface LogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  component: string;
  message: string;
  details?: any;
}

interface LogViewerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const LogViewer: React.FC<LogViewerProps> = ({ isOpen, onClose }) => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [filter, setFilter] = useState<string>('');
  const [levelFilter, setLevelFilter] = useState<'all' | 'info' | 'warn' | 'error'>('all');
  const logContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    // 拦截console方法来捕获日志
    const originalConsole = {
      log: console.log,
      warn: console.warn,
      error: console.error
    };

    const addLog = (level: 'info' | 'warn' | 'error', args: any[]) => {
      const message = args.join(' ');
      
      // 只捕获我们的应用日志（包含特定标识符）
      if (message.includes('[') && (
        message.includes('Whiteboard') ||
        message.includes('AIGeneration') ||
        message.includes('Aihubmix') ||
        message.includes('aihubmix-')
      )) {
        const componentMatch = message.match(/\[([^\]]+)\]/);
        const component = componentMatch ? componentMatch[1] : 'Unknown';
        
        const logEntry: LogEntry = {
          timestamp: new Date().toISOString(),
          level,
          component,
          message,
          details: args.length > 1 ? args.slice(1) : undefined
        };

        setLogs(prev => [...prev, logEntry].slice(-100)); // 保留最近100条日志
      }
    };

    console.log = (...args) => {
      originalConsole.log(...args);
      addLog('info', args);
    };

    console.warn = (...args) => {
      originalConsole.warn(...args);
      addLog('warn', args);
    };

    console.error = (...args) => {
      originalConsole.error(...args);
      addLog('error', args);
    };

    // 清理函数
    return () => {
      console.log = originalConsole.log;
      console.warn = originalConsole.warn;
      console.error = originalConsole.error;
    };
  }, [isOpen]);

  // 自动滚动到底部
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  const filteredLogs = logs.filter(log => {
    const matchesText = filter === '' || 
      log.message.toLowerCase().includes(filter.toLowerCase()) ||
      log.component.toLowerCase().includes(filter.toLowerCase());
    
    const matchesLevel = levelFilter === 'all' || log.level === levelFilter;
    
    return matchesText && matchesLevel;
  });

  const clearLogs = () => {
    setLogs([]);
  };

  const exportLogs = () => {
    const logText = filteredLogs.map(log => 
      `[${log.timestamp}] [${log.level.toUpperCase()}] [${log.component}] ${log.message}`
    ).join('\n');
    
    const blob = new Blob([logText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `whiteboard-logs-${new Date().toISOString().replace(/[:.]/g, '-')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!isOpen) return null;

  return (
    <div className="log-viewer-overlay">
      <div className="log-viewer-panel">
        <div className="log-viewer-header">
          <h3>📊 系统日志查看器</h3>
          <button className="close-button" onClick={onClose}>×</button>
        </div>

        <div className="log-viewer-controls">
          <div className="filter-group">
            <input
              type="text"
              placeholder="搜索日志..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="log-filter-input"
            />
            <select
              value={levelFilter}
              onChange={(e) => setLevelFilter(e.target.value as any)}
              className="log-level-filter"
            >
              <option value="all">所有级别</option>
              <option value="info">信息</option>
              <option value="warn">警告</option>
              <option value="error">错误</option>
            </select>
          </div>
          
          <div className="action-group">
            <button onClick={clearLogs} className="clear-button">清空日志</button>
            <button onClick={exportLogs} className="export-button">导出日志</button>
          </div>
        </div>

        <div className="log-stats">
          <span>总计: {logs.length} 条</span>
          <span>筛选后: {filteredLogs.length} 条</span>
          <span>信息: {logs.filter(l => l.level === 'info').length}</span>
          <span>警告: {logs.filter(l => l.level === 'warn').length}</span>
          <span>错误: {logs.filter(l => l.level === 'error').length}</span>
        </div>

        <div className="log-container" ref={logContainerRef}>
          {filteredLogs.map((log, index) => (
            <div key={index} className={`log-entry log-${log.level}`}>
              <div className="log-header">
                <span className="log-timestamp">{new Date(log.timestamp).toLocaleTimeString()}</span>
                <span className={`log-level log-level-${log.level}`}>
                  {log.level === 'info' && '📝'}
                  {log.level === 'warn' && '⚠️'}
                  {log.level === 'error' && '❌'}
                  {log.level.toUpperCase()}
                </span>
                <span className="log-component">[{log.component}]</span>
              </div>
              <div className="log-message">{log.message}</div>
              {log.details && (
                <div className="log-details">
                  <pre>{JSON.stringify(log.details, null, 2)}</pre>
                </div>
              )}
            </div>
          ))}
          
          {filteredLogs.length === 0 && (
            <div className="no-logs">
              {logs.length === 0 ? '暂无日志记录' : '没有匹配的日志'}
            </div>
          )}
        </div>

        <div className="log-viewer-footer">
          <p>💡 提示：使用AI生成功能时会自动记录详细日志</p>
        </div>
      </div>
    </div>
  );
}; 