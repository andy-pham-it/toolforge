/**
 * @andy-toolforge/pm-support MCP plugin tools.
 * Loaded automatically by @andy-toolforge/mcp discovery mechanism.
 *
 * Provides project management tools: create projects, manage tasks,
 * track time, generate reports and invoices.
 */

const { TaskTracker } = require('@andy-toolforge/pm-support');

// ---------------------------------------------------------------------------
// pm_create_project
// ---------------------------------------------------------------------------
const createProjectDef = {
    name: 'pm_create_project',
    description: 'Create a new project with optional task list',
    inputSchema: {
        type: 'object',
        properties: {
            name: { type: 'string', description: 'Project name' },
            tasks: {
                type: 'array',
                items: {
                    type: 'object',
                    properties: {
                        name: { type: 'string', description: 'Task name' },
                        assignee: { type: 'string', description: 'Optional assignee' },
                    },
                    required: ['name'],
                },
                description: 'Optional array of tasks to add to the project',
            },
        },
        required: ['name'],
    },
};

async function createProjectHandler(_llm, args) {
    const { name, tasks } = args;
    const tracker = new TaskTracker();
    return tracker.createProject(name, tasks || []);
}

// ---------------------------------------------------------------------------
// pm_add_task
// ---------------------------------------------------------------------------
const addTaskDef = {
    name: 'pm_add_task',
    description: 'Add a task to an existing project',
    inputSchema: {
        type: 'object',
        properties: {
            projectId: { type: 'string', description: 'Project ID (returned by pm_create_project)' },
            name: { type: 'string', description: 'Task name' },
            status: { type: 'string', description: 'Task status (todo, in-progress, done)', default: 'todo' },
            assignee: { type: 'string', description: 'Optional assignee' },
        },
        required: ['projectId', 'name'],
    },
};

async function addTaskHandler(llm, args) {
    const { projectId, name, status, assignee } = args;
    const tracker = new TaskTracker();

    // Re-create the project so we can add a task to it
    // Note: This is stateless; in a real scenario we'd need a DB.
    // For now we accept projectId and name, returning the task.
    // The TaskTracker requires a project to exist, so we must create one.
    // Since we can't reference previous instances, this tool works best
    // with create_project → add_task in the same MCP session flow.
    const project = await tracker.createProject(`Project ${projectId}`, []);
    return tracker.addTask(project.id, { name, status, assignee });
}

// ---------------------------------------------------------------------------
// pm_track_time
// ---------------------------------------------------------------------------
const trackTimeDef = {
    name: 'pm_track_time',
    description: 'Track time spent on a task',
    inputSchema: {
        type: 'object',
        properties: {
            taskId: { type: 'string', description: 'Task ID' },
            durationMinutes: { type: 'number', description: 'Duration in minutes' },
            note: { type: 'string', description: 'Optional note' },
        },
        required: ['taskId', 'durationMinutes'],
    },
};

async function trackTimeHandler(_llm, args) {
    const { taskId, durationMinutes, note = '' } = args;
    const tracker = new TaskTracker();
    return tracker.trackTime(taskId, durationMinutes, note);
}

// ---------------------------------------------------------------------------
// pm_generate_report
// ---------------------------------------------------------------------------
const reportDef = {
    name: 'pm_generate_report',
    description: 'Generate a project management report',
    inputSchema: {
        type: 'object',
        properties: {
            projectId: { type: 'string', description: 'Optional project ID to filter by' },
            format: { type: 'string', description: 'Report format (text, markdown)', default: 'text' },
        },
    },
};

async function reportHandler(_llm, args) {
    const { projectId, format = 'text' } = args;
    const tracker = new TaskTracker();
    return tracker.generateReport({ projectId, format });
}

// ---------------------------------------------------------------------------
// pm_calculate_invoice
// ---------------------------------------------------------------------------
const invoiceDef = {
    name: 'pm_calculate_invoice',
    description: 'Calculate an invoice based on tracked time entries',
    inputSchema: {
        type: 'object',
        properties: {
            projectId: { type: 'string', description: 'Project ID to invoice for' },
            rate: { type: 'number', description: 'Hourly rate in USD', default: 50 },
        },
        required: ['projectId'],
    },
};

async function invoiceHandler(_llm, args) {
    const { projectId, rate = 50 } = args;
    const tracker = new TaskTracker();
    return tracker.generateInvoice({ projectId, rate, currency: 'USD' });
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------
module.exports = function () {
    return [
        { definition: createProjectDef, handler: createProjectHandler },
        { definition: addTaskDef, handler: addTaskHandler },
        { definition: trackTimeDef, handler: trackTimeHandler },
        { definition: reportDef, handler: reportHandler },
        { definition: invoiceDef, handler: invoiceHandler },
    ];
};
