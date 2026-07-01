const { describe, it, before } = require('node:test');
const assert = require('node:assert/strict');
const TaskTracker = require('./tracker');

function makeMockLogger() {
    return { info: () => {}, warn: () => {}, error: () => {} };
}

describe('TaskTracker', async () => {
    describe('createProject', async () => {
        const tracker = new TaskTracker({ logger: makeMockLogger() });

        await it('should create a project with a name', async () => {
            const project = await tracker.createProject('Test Project');
            assert.ok(project.id.startsWith('proj-'));
            assert.equal(project.name, 'Test Project');
            assert.ok(project.createdAt);
            assert.deepEqual(project.tasks, []);
        });

        await it('should create a project with tasks', async () => {
            const project = await tracker.createProject('Web App', [
                { name: 'Design UI' },
                { name: 'Build API', status: 'in_progress', assignee: 'Alice' },
                { name: 'Write tests', status: 'todo' },
            ]);

            assert.equal(project.tasks.length, 3);
            assert.equal(project.tasks[0].name, 'Design UI');
            assert.equal(project.tasks[0].status, 'todo');
            assert.equal(project.tasks[1].status, 'in_progress');
            assert.equal(project.tasks[1].assignee, 'Alice');
            assert.ok(project.tasks[2].id.startsWith('task-'));
        });

        await it('should throw for empty name', async () => {
            await assert.rejects(
                () => tracker.createProject(''),
                { message: 'Project name must be a non-empty string' },
            );
        });

        await it('should throw for non-string name', async () => {
            await assert.rejects(
                () => tracker.createProject(123),
                { message: 'Project name must be a non-empty string' },
            );
        });

        await it('should throw for non-array tasks', async () => {
            await assert.rejects(
                () => tracker.createProject('X', 'not-an-array'),
                { message: 'Tasks must be an array' },
            );
        });

        await it('should throw when a task has no name', async () => {
            await assert.rejects(
                () => tracker.createProject('X', [{ noName: true }]),
                { message: 'Each task must have a name' },
            );
        });
    });

    describe('addTask', async () => {
        const tracker = new TaskTracker({ logger: makeMockLogger() });
        let project;

        before(async () => {
            project = await tracker.createProject('Dev Project');
        });

        await it('should add a task to an existing project', async () => {
            const task = await tracker.addTask(project.id, 'Implement login');
            assert.ok(task.id.startsWith('task-'));
            assert.equal(task.name, 'Implement login');
            assert.equal(task.status, 'todo');
            assert.equal(task.assignee, null);
        });

        await it('should add a task with assignee', async () => {
            const task = await tracker.addTask(project.id, 'Setup CI', { assignee: 'Bob' });
            assert.equal(task.assignee, 'Bob');
        });

        await it('should reject addTask for non-existent project', async () => {
            await assert.rejects(
                () => tracker.addTask('proj-nonexistent', 'Task'),
                { message: 'Project not found: proj-nonexistent' },
            );
        });

        await it('should reject addTask with empty name', async () => {
            await assert.rejects(
                () => tracker.addTask(project.id, ''),
                { message: 'Task name must be a non-empty string' },
            );
        });
    });

    describe('updateTaskStatus', async () => {
        const tracker = new TaskTracker({ logger: makeMockLogger() });
        let task;

        before(async () => {
            const proj = await tracker.createProject('Status Test', [{ name: 'Task A' }]);
            task = proj.tasks[0];
        });

        await it('should update task status', async () => {
            const updated = await tracker.updateTaskStatus(task.id, 'in_progress');
            assert.equal(updated.status, 'in_progress');
        });

        await it('should reject invalid status', async () => {
            await assert.rejects(
                () => tracker.updateTaskStatus(task.id, 'invalid'),
                { message: /Invalid status: invalid/ },
            );
        });

        await it('should reject for non-existent task', async () => {
            await assert.rejects(
                () => tracker.updateTaskStatus('task-nonexistent', 'done'),
                { message: 'Task not found: task-nonexistent' },
            );
        });
    });

    describe('trackTime', async () => {
        const tracker = new TaskTracker({ logger: makeMockLogger() });
        let task;

        before(async () => {
            const proj = await tracker.createProject('Time Test', [{ name: 'Task T' }]);
            task = proj.tasks[0];
        });

        await it('should track time on a task', async () => {
            const entry = await tracker.trackTime(task.id, 120, 'Worked on feature');
            assert.equal(entry.taskId, task.id);
            assert.equal(entry.durationMinutes, 120);
            assert.equal(entry.note, 'Worked on feature');
            assert.ok(entry.timestamp);
            assert.equal(entry.projectName, 'Time Test');
        });

        await it('should track time without a note', async () => {
            const entry = await tracker.trackTime(task.id, 45);
            assert.equal(entry.durationMinutes, 45);
            assert.equal(entry.note, '');
        });

        await it('should reject tracking for non-existent task', async () => {
            await assert.rejects(
                () => tracker.trackTime('task-nonexistent', 30),
                { message: 'Task not found: task-nonexistent' },
            );
        });

        await it('should reject non-positive duration', async () => {
            await assert.rejects(
                () => tracker.trackTime(task.id, 0),
                { message: 'Duration must be a positive number (minutes)' },
            );
        });

        await it('should reject non-numeric duration', async () => {
            await assert.rejects(
                () => tracker.trackTime(task.id, '30'),
                { message: 'Duration must be a positive number (minutes)' },
            );
        });
    });

    describe('generateReport', async () => {
        const tracker = new TaskTracker({ logger: makeMockLogger() });
        let project;

        before(async () => {
            project = await tracker.createProject('Report Test', [
                { name: 'Task 1' },
                { name: 'Task 2' },
                { name: 'Task 3' },
            ]);

            await tracker.updateTaskStatus(project.tasks[0].id, 'done');
            await tracker.updateTaskStatus(project.tasks[1].id, 'in_progress');
            await tracker.trackTime(project.tasks[0].id, 60, 'Finished quickly');
            await tracker.trackTime(project.tasks[0].id, 30, 'Review');
            await tracker.trackTime(project.tasks[1].id, 120, 'Still working');
        });

        await it('should generate a complete report', async () => {
            const report = await tracker.generateReport(project.id);

            assert.equal(report.projectName, 'Report Test');
            assert.equal(report.totalTasks, 3);
            assert.equal(report.completedTasks, 1);
            assert.equal(report.completionRate, 33);
            assert.equal(report.totalHours, 3.5);
        });

        await it('should include task-level breakdown', async () => {
            const report = await tracker.generateReport(project.id);

            assert.equal(report.taskBreakdown.length, 3);
            const t1 = report.taskBreakdown.find(t => t.taskName === 'Task 1');
            assert.equal(t1.totalMinutes, 90);
            assert.equal(t1.totalHours, 1.5);
            assert.equal(t1.timeEntries, 2);
        });

        await it('should reject for non-existent project', async () => {
            await assert.rejects(
                () => tracker.generateReport('proj-nonexistent'),
                { message: 'Project not found: proj-nonexistent' },
            );
        });
    });

    describe('calculateInvoice', async () => {
        const tracker = new TaskTracker({ logger: makeMockLogger() });

        await it('should calculate invoice correctly', async () => {
            const inv = await tracker.calculateInvoice(40, 50, 'USD');
            assert.equal(inv.totalHours, 40);
            assert.equal(inv.rate, 50);
            assert.equal(inv.subtotal, 2000);
            assert.equal(inv.currency, 'USD');
            assert.ok(inv.generatedAt);
        });

        await it('should default to USD', async () => {
            const inv = await tracker.calculateInvoice(10, 75);
            assert.equal(inv.currency, 'USD');
        });

        await it('should handle zero hours', async () => {
            const inv = await tracker.calculateInvoice(0, 100);
            assert.equal(inv.subtotal, 0);
        });

        await it('should reject negative hours', async () => {
            await assert.rejects(
                () => tracker.calculateInvoice(-1, 50),
                { message: 'Hours must be a non-negative number' },
            );
        });

        await it('should reject non-positive rate', async () => {
            await assert.rejects(
                () => tracker.calculateInvoice(10, 0),
                { message: 'Rate must be a positive number' },
            );
        });
    });

    describe('getTimeEntries', async () => {
        const tracker = new TaskTracker({ logger: makeMockLogger() });
        let taskId;

        before(async () => {
            const proj = await tracker.createProject('Entry Test', [{ name: 'Sample' }]);
            taskId = proj.tasks[0].id;
            await tracker.trackTime(taskId, 60, 'Setup');
            await tracker.trackTime(taskId, 30, 'Review');
        });

        await it('should return all entries with no filter', async () => {
            const entries = await tracker.getTimeEntries();
            assert.equal(entries.length, 2);
        });

        await it('should filter by projectId', async () => {
            const entries = await tracker.getTimeEntries({ projectId: 'proj-nonexistent' });
            assert.equal(entries.length, 0);
        });

        await it('should filter by taskId', async () => {
            const entries = await tracker.getTimeEntries({ taskId });
            assert.equal(entries.length, 2);
        });
    });

    describe('listProjects', async () => {
        const tracker = new TaskTracker({ logger: makeMockLogger() });

        before(async () => {
            await tracker.createProject('Alpha');
            await tracker.createProject('Beta', [{ name: 'Task B' }]);
        });

        await it('should return all projects with summaries', async () => {
            const projects = await tracker.listProjects();
            assert.equal(projects.length, 2);
            assert.ok(projects[0].taskCount !== undefined);
            assert.ok(projects[0].completedCount !== undefined);
        });
    });

    describe('getProject', async () => {
        const tracker = new TaskTracker({ logger: makeMockLogger() });
        let projectId;

        before(async () => {
            const proj = await tracker.createProject('Detail Test', [
                { name: 'Task X', status: 'done' },
                { name: 'Task Y' },
            ]);
            projectId = proj.id;
        });

        await it('should return project with full details', async () => {
            const project = await tracker.getProject(projectId);
            assert.equal(project.name, 'Detail Test');
            assert.equal(project.tasks.length, 2);
            assert.ok(project.createdAt);
        });

        await it('should reject for non-existent project', async () => {
            await assert.rejects(
                () => tracker.getProject('proj-nonexistent'),
                { message: 'Project not found: proj-nonexistent' },
            );
        });
    });
});
