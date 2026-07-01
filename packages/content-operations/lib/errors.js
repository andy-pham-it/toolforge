class ContentOperationsError extends Error {
    constructor(message, code = 'CONTENT_OPERATIONS_ERROR', details = {}) {
        super(message);
        this.name = 'ContentOperationsError';
        this.code = code;
        this.details = details;
    }
}

class ContentResearcherError extends ContentOperationsError {
    constructor(message, details = {}) {
        super(message, 'RESEARCHER_ERROR', details);
        this.name = 'ContentResearcherError';
    }
}

class ContentPlannerError extends ContentOperationsError {
    constructor(message, details = {}) {
        super(message, 'PLANNER_ERROR', details);
        this.name = 'ContentPlannerError';
    }
}

class ContentCreatorError extends ContentOperationsError {
    constructor(message, details = {}) {
        super(message, 'CREATOR_ERROR', details);
        this.name = 'ContentCreatorError';
    }
}

class ContentDistributorError extends ContentOperationsError {
    constructor(message, details = {}) {
        super(message, 'DISTRIBUTOR_ERROR', details);
        this.name = 'ContentDistributorError';
    }
}

class ContentAnalyticsError extends ContentOperationsError {
    constructor(message, details = {}) {
        super(message, 'ANALYTICS_ERROR', details);
        this.name = 'ContentAnalyticsError';
    }
}

module.exports = {
    ContentOperationsError,
    ContentResearcherError,
    ContentPlannerError,
    ContentCreatorError,
    ContentDistributorError,
    ContentAnalyticsError,
};
