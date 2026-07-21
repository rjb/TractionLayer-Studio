-- Custom SQL migration file, put your code below! --
INSERT INTO `workflows` (
	`id`,
	`client_tag`,
	`name`,
	`short_description`,
	`long_description`,
	`webhook_url`,
	`http_method`,
	`auth_type`,
	`action_verb`,
	`inputs`,
	`validations`,
	`is_active`
) VALUES (
	'c630a404-4af9-4283-b9fb-771792d9443f',
	'caring_teacher',
	'Linear Backlog Triage',
	'An autonomous PM agent that triages your Linear backlog—writing technical specs, assigning priorities, and moving dev-ready issues to Todo while flagging vague ideas for clarification.',
	'## About\n\nThis workflow acts as a strict, automated gatekeeper for your engineering pipeline:\n\n- **Engineers Specs:** Scans raw backlog ideas and generates structured Markdown comments containing technical breakdowns, edge cases, and copy-pasteable prompts optimized for AI coding agents (like Claude Code).\n- **Automates Status Routing:** If an issue is fleshed out and ready to build, it assigns an integer priority (1–4) and promotes the ticket to Todo.\n- **Flags Vague Ideas:** If a ticket lacks essential context, it keeps the issue safely in the Backlog and posts precise follow-up questions asking the creator to fill in the gaps before development begins.',
	'https://n8n.tractionlayer.com/webhook/ade40161-dfdb-491d-b9e8-6b74a11456ba',
	'POST',
	'x-n8n-secret',
	'Run',
	JSON_ARRAY(),
	JSON_OBJECT(),
	true
);
