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
	'ccb64c32-0e48-4489-8106-79e9607a99c9',
	'caring_teacher',
	'YouTube Transcript',
	'Paste a YouTube video URL and get back a clean, formatted transcript you can copy in one click.',
	'## About\n\nPaste a YouTube video URL and get back a clean, formatted transcript you can copy in one click.',
	'https://n8n.tractionlayer.com/webhook/0d2e971a-6aac-4c56-b5e4-36cb12f7cc94',
	'POST',
	'x-n8n-secret',
	'Transcribe',
	JSON_ARRAY(JSON_OBJECT('name', 'url', 'placeholder', 'Paste YouTube video URL here...')),
	JSON_OBJECT('url', JSON_ARRAY(JSON_OBJECT('type', 'youtube', 'message', 'Please enter a valid YouTube URL.'))),
	true
);
