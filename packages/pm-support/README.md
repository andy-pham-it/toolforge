# @andy-toolforge/pm-support

[![npm](https://img.shields.io/npm/v/@andy-toolforge/pm-support)](https://npmjs.com/package/@andy-toolforge/pm-support)
[![License](https://img.shields.io/npm/l/@andy-toolforge/pm-support)](https://github.com/andy-pham-it/toolforge)

**Project management: task tracking, time logging, reports, invoices.** Thuộc hệ sinh thái [toolforge](https://github.com/andy-pham-it/toolforge).

Package này giúp bạn:
- Tạo và quản lý projects với task lists
- Log thời gian cho từng task
- Sinh reports và invoices

## Installation

```bash
npm install @andy-toolforge/pm-support
```

Yêu cầu `@andy-toolforge/core` (tự động cài kèm).

## API Reference

```javascript
const { TaskTracker } = require('@andy-toolforge/pm-support');
```

---

### TaskTracker

Quản lý projects, tasks, time entries, và sinh reports.

**Constructor:** `new TaskTracker({ logger? })`

---

#### createProject(name, tasks)

Tạo project mới với optional task list.

| Param | Type | Default | Mô tả |
|-------|------|---------|-------|
| `name` | string | required | Project name |
| `tasks` | Array | `[]` | Array of `{ name, status?, assignee? }` |

**Return:** `{ id, name, createdAt, tasks[] }`

```javascript
const { TaskTracker } = require('@andy-toolforge/pm-support');

const tracker = new TaskTracker();
const project = await tracker.createProject('Content Q3 2026', [
    { name: 'Viết bài SEO', assignee: 'An' },
    { name: 'Thiết kế thumbnail' },
]);
console.log(`Project ${project.id}: ${project.name} (${project.tasks.length} tasks)`);
```

---

#### Thêm tasks sau khi tạo project

```javascript
const task = await tracker.addTask(project.id, {
    name: 'Quay video podcast',
    priority: 'high',
    assignee: 'Bình',
});
```

---

#### Log time

```javascript
await tracker.logTime(task.id, 2.5); // 2.5 hours
await tracker.logTime(task.id, 1.0, '2026-07-05'); // với date cụ thể
```

---

#### Generate reports

```javascript
// Weekly report
const report = await tracker.generateReport({ period: 'weekly' });
console.log(report);

// Project-specific report
const projectReport = await tracker.generateReport({
    projectId: project.id,
    format: 'markdown'
});
```

---

#### Generate invoices

```javascript
const invoice = await tracker.generateInvoice({
    projectId: project.id,
    rate: 50, // $50/hour
    currency: 'USD',
});
// → Invoice với tổng thời gian * rate
```

---

## Integration

- **+ [@andy-toolforge/core](https://npmjs.com/package/@andy-toolforge/core):** Logger + LLMClient cho report/invoice generation
- **+ [@andy-toolforge/coding-support](https://npmjs.com/package/@andy-toolforge/coding-support):** Theo dõi thời gian cho code tasks

## Related

- [@andy-toolforge/core](https://npmjs.com/package/@andy-toolforge/core)
- [@andy-toolforge/coding-support](https://npmjs.com/package/@andy-toolforge/coding-support)
