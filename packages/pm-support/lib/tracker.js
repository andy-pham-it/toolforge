/**
 * TaskTracker — Time & Task Tracker for project management.
 *
 * Tracks projects, tasks, time entries. Generates reports and invoices.
 */
const { Logger } = require('@andy-toolforge/core');

class TaskTracker {
    constructor(config = {}) {
        this.logger = config.logger || new Logger('TaskTracker');
        /** @type {Map<string, object>} projectId → project */
        this.projects = new Map();
        /** @type {Array<object>} time entries log */
        this.timeEntries = [];
        /** @private Per-instance ID counters */
        this._nextProjectId = 1;
        this._nextTaskId = 1;
    }

    /**
     * Create a new project with an optional task list.
     * @param {string} name - Project name
     * @param {Array<{name: string, status?: string, assignee?: string}>} [tasks] - Task list
     * @returns {Promise<object>} Created project
     */
    async createProject(name, tasks = []) {
        if (typeof name !== 'string' || name.trim().length === 0) {
            throw new Error('Project name must be a non-empty string');
        }
        if (!Array.isArray(tasks)) {
            throw new Error('Tasks must be an array');
        }

        const id = `proj-${this._nextProjectId++}`;
        const project = {
            id,
            name: name.trim(),
            createdAt: new Date().toISOString(),
            tasks: tasks.map(t => {
                if (!t || typeof t.name !== 'string') {
                    throw new Error('Each task must have a name');
                }
                return {
                    id: `task-${this._nextTaskId++}`,
                    name: t.name,
                    status: t.status || 'todo',
                    assignee: t.assignee || null,
                };
            }),
        };

        this.projects.set(id, project);
        this.logger.info(`Created project: ${name} (${id}) with ${project.tasks.length} tasks`);
        return project;
    }

    /**
     * Add a task to an existing project.
     * @param {string} projectId
     * @param {string} taskName
     * @param {object} [options]
     * @param {string} [options.assignee]
     * @returns {Promise<object>} Created task
     */
    async addTask(projectId, taskName, options = {}) {
        const project = this.projects.get(projectId);
        if (!project) {
            throw new Error(`Project not found: ${projectId}`);
        }
        if (typeof taskName !== 'string' || taskName.trim().length === 0) {
            throw new Error('Task name must be a non-empty string');
        }

        const task = {
            id: `task-${this._nextTaskId++}`,
            name: taskName.trim(),
            status: 'todo',
            assignee: options.assignee || null,
        };

        project.tasks.push(task);
        this.logger.info(`Added task "${task.name}" to project ${project.name}`);
        return task;
    }

    /**
     * Update a task's status.
     * @param {string} taskId
     * @param {string} status - 'todo' | 'in_progress' | 'done'
     * @returns {Promise<object>} Updated task
     */
    async updateTaskStatus(taskId, status) {
        const valid = ['todo', 'in_progress', 'done'];
        if (!valid.includes(status)) {
            throw new Error(`Invalid status: ${status}. Must be one of: ${valid.join(', ')}`);
        }

        const found = this._findTask(taskId);
        if (!found) {
            throw new Error(`Task not found: ${taskId}`);
        }

        found.task.status = status;
        this.logger.info(`Task "${found.task.name}" → ${status}`);
        return found.task;
    }

    /**
     * Track time spent on a task.
     * @param {string} taskId
     * @param {number} durationMinutes - Duration in minutes (must be > 0)
     * @param {string} [note]
     * @returns {Promise<object>} Time entry
     */
    async trackTime(taskId, durationMinutes, note = '') {
        const found = this._findTask(taskId);
        if (!found) {
            throw new Error(`Task not found: ${taskId}`);
        }
        if (typeof durationMinutes !== 'number' || durationMinutes <= 0) {
            throw new Error('Duration must be a positive number (minutes)');
        }

        const entry = {
            id: `time-${this.timeEntries.length + 1}`,
            taskId,
            taskName: found.task.name,
            projectId: found.project.id,
            projectName: found.project.name,
            durationMinutes,
            note: note || '',
            timestamp: new Date().toISOString(),
        };

        this.timeEntries.push(entry);
        this.logger.info(`Tracked ${durationMinutes}min on task "${found.task.name}"`);
        return entry;
    }

    /**
     * Generate a project report with task breakdown and total hours.
     * @param {string} projectId
     * @returns {Promise<object>} Report
     */
    async generateReport(projectId) {
        const project = this.projects.get(projectId);
        if (!project) {
            throw new Error(`Project not found: ${projectId}`);
        }

        const totalTasks = project.tasks.length;
        const completedTasks = project.tasks.filter(t => t.status === 'done').length;

        const taskBreakdown = project.tasks.map(task => {
            const entries = this.timeEntries.filter(e => e.taskId === task.id);
            const totalMinutes = entries.reduce((sum, e) => sum + e.durationMinutes, 0);
            return {
                taskId: task.id,
                taskName: task.name,
                status: task.status,
                assignee: task.assignee,
                totalMinutes,
                totalHours: Math.round((totalMinutes / 60) * 100) / 100,
                timeEntries: entries.length,
            };
        });

        const totalMinutes = taskBreakdown.reduce((sum, t) => sum + t.totalMinutes, 0);

        const report = {
            projectId: project.id,
            projectName: project.name,
            createdAt: project.createdAt,
            totalTasks,
            completedTasks,
            completionRate: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
            totalHours: Math.round((totalMinutes / 60) * 100) / 100,
            totalMinutes,
            taskBreakdown,
        };

        this.logger.info(`Generated report for "${project.name}": ${report.totalHours}h tracked`);
        return report;
    }

    /**
     * Calculate invoice from hours and hourly rate.
     * @param {number} hours - Total billable hours
     * @param {number} rate - Hourly rate
     * @param {string} [currency] - Currency code (default: USD)
     * @returns {Promise<object>} Invoice
     */
    async calculateInvoice(hours, rate, currency = 'USD') {
        if (typeof hours !== 'number' || hours < 0) {
            throw new Error('Hours must be a non-negative number');
        }
        if (typeof rate !== 'number' || rate <= 0) {
            throw new Error('Rate must be a positive number');
        }

        const subtotal = Math.round(hours * rate * 100) / 100;

        return {
            totalHours: hours,
            rate,
            currency: currency.toUpperCase(),
            subtotal,
            generatedAt: new Date().toISOString(),
        };
    }

    /**
     * Get time entries, optionally filtered by project or task.
     * @param {object} [filters]
     * @param {string} [filters.projectId]
     * @param {string} [filters.taskId]
     * @returns {Promise<Array<object>>} Filtered time entries
     */
    async getTimeEntries(filters = {}) {
        let entries = this.timeEntries;

        if (filters.projectId) {
            entries = entries.filter(e => e.projectId === filters.projectId);
        }
        if (filters.taskId) {
            entries = entries.filter(e => e.taskId === filters.taskId);
        }

        return entries;
    }

    /**
     * List all projects.
     * @returns {Promise<Array<object>>} Projects (without full task details)
     */
    async listProjects() {
        return Array.from(this.projects.values()).map(p => ({
            id: p.id,
            name: p.name,
            createdAt: p.createdAt,
            taskCount: p.tasks.length,
            completedCount: p.tasks.filter(t => t.status === 'done').length,
        }));
    }

    /**
     * Get a single project with full details.
     * @param {string} projectId
     * @returns {Promise<object>} Project with tasks
     */
    async getProject(projectId) {
        const project = this.projects.get(projectId);
        if (!project) {
            throw new Error(`Project not found: ${projectId}`);
        }
        return project;
    }

    /** @private Find a task across all projects */
    _findTask(taskId) {
        for (const project of this.projects.values()) {
            for (const task of project.tasks) {
                if (task.id === taskId) {
                    return { project, task };
                }
            }
        }
        return null;
    }
}

module.exports = TaskTracker;
