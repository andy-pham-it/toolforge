---
name: ba-requirement-gatherer
description: Thu thập và phân tích yêu cầu — từ stakeholder interview đến user stories. Dùng khi user cần xác định requirements cho dự án mới.
---

# Requirement Gatherer

Skill này hướng dẫn AI thu thập và phân tích yêu cầu từ stakeholder.

## 📥 Input

- **Project context** — mô tả dự án / vấn đề cần giải quyết
- **Stakeholder notes** — ghi chép phỏng vấn stakeholder
- **Existing docs** — (optional) tài liệu hiện có
- **Constraints** — (optional) ràng buộc kỹ thuật / business

## 📤 Output

### 1. Requirements Document

```markdown
# Requirements: [Project Name]

## 1. Business Context
- Problem statement
- Business goals
- Success metrics

## 2. Stakeholders
- Who: roles and responsibilities
- Pain points
- Expectations

## 3. Functional Requirements
- FR-1: [Mô tả]
- FR-2: [Mô tả]

## 4. Non-Functional Requirements
- NFR-1: Performance
- NFR-2: Security

## 5. Constraints
- Technical
- Business
- Timeline
```

### 2. User Stories

```gherkin
Feature: [Feature name]
  Scenario: [Scenario description]
    Given [context]
    When [action]
    Then [expected outcome]
```

### 3. Priority Matrix

| Requirement | Business Value | Effort | Priority |
|-------------|---------------|--------|----------|
| FR-1 | High | Low | P0 |
| FR-2 | Medium | High | P2 |

## 🎯 Rules

1. **Phân biệt functional vs non-functional** — không lẫn lộn
2. **Mỗi requirement có ID** — FR-1, FR-2, NFR-1, v.v.
3. **User stories** theo format: As a [role], I want [goal] so that [reason]
4. **Priority** dùng MoSCoW: Must have / Should have / Could have / Won't have
5. **Success metrics** phải measurable — không mơ hồ

## 📋 Workflow

1. Thu thập context và stakeholder notes
2. Xác định business goals và success metrics
3. Liệt kê functional requirements
4. Liệt kê non-functional requirements
5. Viết user stories cho các tính năng chính
6. Phân loại priority (MoSCoW)
7. Review với stakeholder (xác nhận)

## 📋 Template

```
## Requirements: [Project Name]

### Business Goals
1. ...
2. ...

### Functional Requirements
- FR-1: ...
- FR-2: ...

### Non-Functional Requirements
- NFR-1: ...
- NFR-2: ...

### User Stories
- As a [role], I want [goal] so that [reason]

### Priority
- P0 (Must have): ...
- P1 (Should have): ...
- P2 (Could have): ...
```
