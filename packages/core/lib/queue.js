const { v4: uuidv4 } = require('uuid');

class JobQueue {
    constructor() {
        this.jobs = {};
    }

    create(params) {
        const id = uuidv4();
        const job = {
            id,
            state: 'pending',
            currentStep: null,
            completedSteps: [],
            params,
            error: null,
            startTime: Date.now(),
        };
        this.jobs[id] = job;
        return job;
    }

    get(id) {
        return this.jobs[id];
    }

    update(id, updates) {
        if (this.jobs[id]) {
            Object.assign(this.jobs[id], updates);
        }
    }

    list(filter = {}) {
        return Object.values(this.jobs).filter(j => {
            for (const [k, v] of Object.entries(filter)) {
                if (j[k] !== v) return false;
            }
            return true;
        });
    }

    remove(id) {
        delete this.jobs[id];
    }
}

module.exports = JobQueue;
