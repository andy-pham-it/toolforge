# jobscan Roadmap

## Planned Providers (50)

1. Indeed API - Job search and listing integration
2. LinkedIn Jobs API - Professional network job matching
3. Glassdoor Company Reviews - Salary and culture data
4. ZipRecruiter API - Job posting aggregation
5. CareerBuilder API - Resume and job matching
6. SimplyHired API - Job search platform
7. AngelList (Workday) - Startup job listings
8. BuiltIn - Tech company job board
9. Stack Overflow Jobs - Developer-focused roles
10. GitHub Jobs - Developer positions
11. Dice - Tech job board
12. TechCrunch Jobs - Startup and tech roles
13. Auth0 Jobs - Auth-focused positions
14. Okta Jobs - Identity security roles
15. AWS Jobs - Cloud infrastructure roles
16. Azure Jobs - Microsoft cloud roles
17. GCP Jobs - Google Cloud positions
18. Kubernetes Jobs - Container orchestration roles
19. Docker Jobs - Containerization positions
20. Terraform Jobs - Infrastructure as code roles
21. Ansible Jobs - Automation positions
22. Jenkins Jobs - CI/CD engineering roles
23. GitLab Jobs - DevOps platform roles
24. CircleCI Jobs - CI/CD provider roles
25. Travis CI Jobs - Continuous integration roles
26. CircleCI API - Pipeline automation roles
27. GitHub Actions Jobs - Workflow automation roles
28. Azure DevOps Jobs - Microsoft DevOps roles
29. GitHub Enterprise Jobs - Large-scale developer roles
30. GitLab Self-Hosted Jobs - Self-hosted DevOps roles
31. Atlassian Jobs - Tooling and collaboration roles
32. Slack Jobs - Messaging and collaboration roles
33. Notion Jobs - Documentation and knowledge roles
34. Coda Jobs - Document and workflow roles
35. Figma Jobs - Design and prototyping roles
36. Sketch Jobs - Design tool roles
37. Adobe Jobs - Creative software roles
38. Canva Jobs - Design platform roles
39. Trello Jobs - Kanban and organization roles
40. Asana Jobs - Project management roles
41. Jira Jobs - Issue tracking roles
42. Monday.com Jobs - Work OS roles
43. Smartsheet Jobs - Work management roles
44. Airtable Jobs - Database and spreadsheet roles
45. Notion API Jobs - Knowledge management roles
46. Coda API Jobs - Document automation roles
47. Zapier Jobs - Integration automation roles
48. IFTTT Jobs - Simple automation roles
49. Make (Integromat) Jobs - Workflow automation roles
50. n8n Jobs - Fair-code workflow automation roles

## Deferred Providers

### Workday

- **Status**: requires Playwright + legal review, deferred
- **Reason**: Workday integration requires headless browser automation for enterprise HR platform navigation, plus legal review of data scraping policies. This will be revisited after the core job-scan CLI stabilizes and Playwright dependencies are validated in the monorepo.

## Future Considerations

- AI-powered resume scoring and ranking
- Multi-language resume tailoring
- Integration with personal career coaching bots
- Real-time market salary data integration