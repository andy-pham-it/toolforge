const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };

class Logger {
    constructor(name, level = 'info') {
        this.name = name;
        this.level = LEVELS[level] ?? 2;
    }

    _log(level, msg, ...args) {
        if (LEVELS[level] > this.level) return;
        const ts = new Date().toISOString();
        const prefix = `[${ts}] [${level.toUpperCase()}] [${this.name}]`;
        const line = args.length ? `${prefix} ${msg} ${args.join(' ')}` : `${prefix} ${msg}`;
        if (level === 'error') console.error(line);
        else if (level === 'warn') console.warn(line);
        else console.log(line);
    }

    error(msg, ...args) { this._log('error', msg, ...args); }
    warn(msg, ...args) { this._log('warn', msg, ...args); }
    info(msg, ...args) { this._log('info', msg, ...args); }
    debug(msg, ...args) { this._log('debug', msg, ...args); }
}

module.exports = Logger;
