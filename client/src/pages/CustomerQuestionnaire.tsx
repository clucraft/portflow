import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { Phone, Zap, Check, AlertCircle, Save, Send } from 'lucide-react'
import { publicApi } from '../services/api'
import { QUESTIONNAIRE_SECTIONS, type QuestionnaireData } from '../constants/questionnaireSchema'

export default function CustomerQuestionnaire() {
  const { token } = useParams<{ token: string }>()
  const [formData, setFormData] = useState<QuestionnaireData>({})
  const [draftSaved, setDraftSaved] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const { data, isLoading, error } = useQuery({
    queryKey: ['questionnaire', token],
    queryFn: () => publicApi.getQuestionnaire(token!),
    enabled: !!token,
    retry: false,
  })

  // Initialize form data from server
  useEffect(() => {
    if (data?.migration?.site_questionnaire) {
      setFormData(data.migration.site_questionnaire as QuestionnaireData)
    }
  }, [data])

  const saveMutation = useMutation({
    mutationFn: (submit: boolean) => publicApi.submitQuestionnaire(token!, formData, submit),
    onSuccess: (_, submit) => {
      if (submit) {
        setSubmitted(true)
      } else {
        setDraftSaved(true)
        setTimeout(() => setDraftSaved(false), 5000)
      }
    },
  })

  const updateField = (key: string, value: string | number | boolean | null) => {
    setFormData((prev) => ({ ...prev, [key]: value }))
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-surface-900 flex items-center justify-center">
        <div className="text-center">
          <Zap className="h-8 w-8 text-primary-500 mx-auto animate-pulse" />
          <p className="mt-2 text-zinc-500">Loading questionnaire...</p>
        </div>
      </div>
    )
  }

  if (error) {
    const errorMessage = (error as { response?: { data?: { message?: string } } })?.response?.data?.message
      || (error as Error)?.message
      || 'Unknown error'

    return (
      <div className="min-h-screen bg-surface-900 flex items-center justify-center p-4">
        <div className="card max-w-md text-center">
          <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-zinc-100 mb-2">Link Invalid or Expired</h1>
          <p className="text-zinc-400 mb-4">
            This questionnaire link is no longer valid. Please contact your administrator for a new link.
          </p>
          <p className="text-xs text-zinc-600 font-mono bg-surface-800 p-2 rounded">
            {errorMessage}
          </p>
        </div>
      </div>
    )
  }

  const migration = data?.migration
  const alreadySubmitted = !!migration?.questionnaire_submitted_at

  if (submitted || alreadySubmitted) {
    return (
      <div className="min-h-screen bg-surface-900 flex items-center justify-center p-4">
        <div className="card max-w-md text-center">
          <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4 border border-green-500/30">
            <Check className="h-8 w-8 text-green-400" />
          </div>
          <h1 className="text-xl font-bold text-zinc-100 mb-2">Questionnaire Submitted</h1>
          <p className="text-zinc-400 mb-4">
            {alreadySubmitted && !submitted
              ? 'This questionnaire has already been submitted.'
              : 'Thank you for completing the site questionnaire. Your responses have been recorded.'}
          </p>
          <p className="text-sm text-zinc-500">
            You can close this window.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-surface-900 p-4 md:p-8">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="relative">
            <Phone className="h-8 w-8 text-primary-400" />
            <Zap className="h-3 w-3 text-primary-300 absolute -top-1 -right-1" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-primary-400 text-glow">PortFlow</h1>
            <p className="text-xs text-zinc-500 tracking-wider">SITE QUESTIONNAIRE</p>
          </div>
        </div>

        {/* Project info */}
        <div className="card mb-6">
          <div className="flex items-center gap-4">
            <div>
              <p className="text-sm text-zinc-500">Project</p>
              <p className="text-zinc-200 font-medium">{migration?.name}</p>
            </div>
            <div>
              <p className="text-sm text-zinc-500">Site</p>
              <p className="text-zinc-200">{migration?.site_name}</p>
            </div>
          </div>
        </div>

        {/* Draft saved banner */}
        {draftSaved && (
          <div className="mb-6 p-3 bg-green-500/10 border border-green-500/30 rounded-lg flex items-center gap-2">
            <Check className="h-4 w-4 text-green-400 flex-shrink-0" />
            <span className="text-sm text-green-300">Draft saved successfully</span>
          </div>
        )}

        {/* Sections */}
        {QUESTIONNAIRE_SECTIONS.map((section) => (
          <div key={section.title} className="card mb-6">
            <h2 className="text-lg font-semibold text-zinc-100 mb-4">{section.title}</h2>
            <div className="space-y-4">
              {section.fields.map((field) => (
                <div key={field.key}>
                  <label className="label">{field.label}</label>
                  {field.type === 'boolean' ? (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => updateField(field.key, true)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                          formData[field.key] === true
                            ? 'bg-primary-500/20 border border-primary-500 text-primary-400'
                            : 'bg-surface-700 border border-surface-600 text-zinc-400 hover:text-zinc-200'
                        }`}
                      >
                        Yes
                      </button>
                      <button
                        type="button"
                        onClick={() => updateField(field.key, false)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                          formData[field.key] === false
                            ? 'bg-primary-500/20 border border-primary-500 text-primary-400'
                            : 'bg-surface-700 border border-surface-600 text-zinc-400 hover:text-zinc-200'
                        }`}
                      >
                        No
                      </button>
                    </div>
                  ) : field.type === 'textarea' ? (
                    <textarea
                      className="input min-h-[80px]"
                      value={(formData[field.key] as string) || ''}
                      onChange={(e) => updateField(field.key, e.target.value)}
                      placeholder={field.placeholder}
                    />
                  ) : field.type === 'number' ? (
                    <input
                      type="number"
                      className="input"
                      value={(formData[field.key] as number) ?? ''}
                      onChange={(e) => updateField(field.key, e.target.value ? Number(e.target.value) : null)}
                      placeholder={field.placeholder}
                    />
                  ) : field.type === 'date' ? (
                    <input
                      type="date"
                      className="input"
                      value={(formData[field.key] as string) || ''}
                      onChange={(e) => updateField(field.key, e.target.value)}
                    />
                  ) : (
                    <input
                      type="text"
                      className="input"
                      value={(formData[field.key] as string) || ''}
                      onChange={(e) => updateField(field.key, e.target.value)}
                      placeholder={field.placeholder}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* Actions */}
        <div className="flex gap-3 mb-8">
          <button
            onClick={() => saveMutation.mutate(false)}
            disabled={saveMutation.isPending}
            className="btn btn-secondary flex items-center gap-2 text-green-400 border-green-500/30 hover:border-green-500/50"
          >
            <Save className="h-4 w-4" />
            {saveMutation.isPending && !saveMutation.variables ? 'Saving...' : 'Save Draft'}
          </button>
          <button
            onClick={() => saveMutation.mutate(true)}
            disabled={saveMutation.isPending}
            className="btn btn-primary flex items-center gap-2"
          >
            <Send className="h-4 w-4" />
            {saveMutation.isPending && saveMutation.variables ? 'Submitting...' : 'Submit'}
          </button>
        </div>

        {saveMutation.isError && (
          <p className="text-red-400 text-sm mb-4 text-center">
            Failed to save. Please try again.
          </p>
        )}

        <p className="text-center text-xs text-zinc-600 mt-6">
          Powered by PortFlow - Enterprise Voice Migration Manager
        </p>
      </div>
    </div>
  )
}
