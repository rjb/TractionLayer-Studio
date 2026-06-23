'use server'

export async function runAutomation(formData: FormData, webhookUrl: string) {
  const body = Object.fromEntries(formData.entries())

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-N8N-Secret': process.env.N8N_MASTER_SECRET!,
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      throw new Error(`Webhook failed with status ${response.status}`)
    }

    return { success: true, message: '' }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Automation failed. Please try again.',
    }
  }
}
