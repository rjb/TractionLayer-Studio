export type WorkflowInput = {
  name: string
  placeholder: string
}

export type Workflow = {
  id: string
  name: string
  desc: string
  webhookUrl: string
  inputs: WorkflowInput[]
}

export const WORKFLOWS: Workflow[] = [
  {
    id: 'substack-to-blog',
    name: 'Substack to Blog',
    desc: 'Converts Substack drafts to SEO blog posts.',
    webhookUrl: 'https://n8n.tractionlayer.com/webhook/d1254f5d-332f-404a-bd57-38edaea4389f',
    inputs: [
      { name: 'substackUrl', placeholder: 'Paste Substack draft URL...' },
    ],
  },
  {
    id: 'meeting-summary',
    name: 'Meeting Summarizer',
    desc: 'Transcribes audio to meeting minutes.',
    webhookUrl: 'https://n8n.tractionlayer.com/webhook/meeting-summary',
    inputs: [
      { name: 'recordingUrl', placeholder: 'Paste meeting recording URL...' },
      { name: 'attendees', placeholder: 'Comma-separated attendee names' },
      { name: 'topics', placeholder: 'Key topics to highlight' },
    ],
  },
  {
    id: 'content-distributor',
    name: 'Content Distributor',
    desc: 'Pushes content to multiple social channels.',
    webhookUrl: 'https://n8n.tractionlayer.com/webhook/content-distributor',
    inputs: [
      { name: 'contentUrl', placeholder: 'Paste content URL to distribute...' },
    ],
  },
  {
    id: 'substack-to-blog-NEW',
    name: 'Substack to Blog NEW',
    desc: 'Converts Substack drafts to SEO blog posts.',
    webhookUrl: 'https://n8n.tractionlayer.com/webhook/substack-to-blog-new',
    inputs: [
      { name: 'substackUrl', placeholder: 'Paste Substack draft URL...' },
      { name: 'tone', placeholder: 'e.g. Professional, casual, witty' },
    ],
  },
]
