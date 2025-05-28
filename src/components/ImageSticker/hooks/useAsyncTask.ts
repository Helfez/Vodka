import { useState, useCallback } from 'react';

export interface AsyncTaskState<T> {
  isLoading: boolean;
  data: T | null;
  error: string | null;
  progress: number;
}

export interface UseAsyncTaskReturn<T> {
  state: AsyncTaskState<T>;
  execute: (taskFn: () => Promise<T>) => Promise<T | null>;
  reset: () => void;
  setProgress: (progress: number) => void;
}

/**
 * 用于管理异步任务状态的自定义Hook
 */
export function useAsyncTask<T = any>(): UseAsyncTaskReturn<T> {
  const [state, setState] = useState<AsyncTaskState<T>>({
    isLoading: false,
    data: null,
    error: null,
    progress: 0,
  });

  const execute = useCallback(async (taskFn: () => Promise<T>): Promise<T | null> => {
    setState(prev => ({
      ...prev,
      isLoading: true,
      error: null,
      progress: 0,
    }));

    try {
      const result = await taskFn();
      setState(prev => ({
        ...prev,
        isLoading: false,
        data: result,
        progress: 100,
      }));
      return result;
    } catch (error: any) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error.message || '未知错误',
        progress: 0,
      }));
      return null;
    }
  }, []);

  const reset = useCallback(() => {
    setState({
      isLoading: false,
      data: null,
      error: null,
      progress: 0,
    });
  }, []);

  const setProgress = useCallback((progress: number) => {
    setState(prev => ({
      ...prev,
      progress: Math.max(0, Math.min(100, progress)),
    }));
  }, []);

  return {
    state,
    execute,
    reset,
    setProgress,
  };
} 