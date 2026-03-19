const DEBUG = import.meta.env.VITE_DEBUG === 'true';

const logger = {
  log: (...args: any[]) => { if (DEBUG) console.log(...args); },
  warn: (...args: any[]) => { if (DEBUG) console.warn(...args); },
  error: (...args: any[]) => { if (DEBUG) console.error(...args); },
};

export default logger;
