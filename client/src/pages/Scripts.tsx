import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { FileCode, Copy, Check, Search, Download, Trash2 } from 'lucide-react'
import { scriptsApi } from '../services/api'

export default function Scripts() {
  const queryClient = useQueryClient()
  const [selectedScript, setSelectedScript] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  const { data: scripts, isLoading } = useQuery({
    queryKey: ['scripts'],
    queryFn: () => scriptsApi.list(),
  })

  const { data: scriptDetail } = useQuery({
    queryKey: ['script', selectedScript],
    queryFn: () => scriptsApi.get(selectedScript!),
    enabled: !!selectedScript,
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => scriptsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scripts'] })
      setSelectedScript(null)
    },
  })

  // Filter scripts by search query
  const filteredScripts = scripts?.filter((script) => {
    if (!searchQuery.trim()) return true
    const query = searchQuery.toLowerCase()
    return script.name.toLowerCase().includes(query) || script.script_type.toLowerCase().includes(query)
  })

  const copyToClipboard = async () => {
    if (!scriptDetail?.script_content) return

    try {
      // Try the modern clipboard API first
      await navigator.clipboard.writeText(scriptDetail.script_content)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback for older browsers or when clipboard API fails
      try {
        const textArea = document.createElement('textarea')
        textArea.value = scriptDetail.script_content
        textArea.style.position = 'fixed'
        textArea.style.left = '-999999px'
        textArea.style.top = '-999999px'
        document.body.appendChild(textArea)
        textArea.focus()
        textArea.select()
        document.execCommand('copy')
        textArea.remove()
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      } catch {
        console.error('Failed to copy to clipboard')
      }
    }
  }

  const downloadScript = () => {
    if (!scriptDetail?.script_content || !scriptDetail?.name) return

    const blob = new Blob([scriptDetail.script_content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${scriptDetail.name.replace(/[^a-z0-9]/gi, '_')}.ps1`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handleDelete = () => {
    if (!selectedScript) return
    if (confirm('Are you sure you want to delete this script?')) {
      deleteMutation.mutate(selectedScript)
    }
  }

  if (isLoading) {
    return <div className="text-center py-12 text-zinc-500">Loading...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">Generated Scripts</h1>
          <p className="text-zinc-500">PowerShell scripts for Teams configuration</p>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
          <input
            type="text"
            placeholder="Search scripts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input pl-9 w-64"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Script List */}
        <div className="space-y-3">
          {filteredScripts?.map((script) => (
            <button
              key={script.id}
              onClick={() => setSelectedScript(script.id)}
              className={`w-full text-left p-4 rounded-lg border transition-colors ${
                selectedScript === script.id
                  ? 'border-primary-500 bg-primary-500/10'
                  : 'border-surface-600 hover:border-surface-500 bg-surface-800'
              }`}
            >
              <div className="flex items-start gap-3">
                <FileCode className="h-5 w-5 text-zinc-400 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-zinc-200 truncate">{script.name}</p>
                  <p className="text-sm text-zinc-500">{script.script_type.replace('_', ' ')}</p>
                  <p className="text-xs text-zinc-600 mt-1">
                    {new Date(script.generated_at).toLocaleString()}
                  </p>
                </div>
              </div>
            </button>
          ))}

          {filteredScripts?.length === 0 && (
            <div className="text-center py-12 text-zinc-500 card">
              <FileCode className="h-12 w-12 mx-auto text-zinc-600 mb-3" />
              {searchQuery ? (
                <p>No scripts match "{searchQuery}"</p>
              ) : (
                <>
                  <p>No scripts generated yet.</p>
                  <p className="text-sm mt-1">Generate scripts from a migration page.</p>
                </>
              )}
            </div>
          )}
        </div>

        {/* Script Content */}
        <div className="lg:col-span-2">
          {scriptDetail ? (
            <div className="card h-full flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="font-semibold text-zinc-100">{scriptDetail.name}</h2>
                  <p className="text-sm text-zinc-500">{scriptDetail.description}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={copyToClipboard}
                    className="btn btn-secondary flex items-center gap-2"
                    title="Copy to clipboard"
                  >
                    {copied ? (
                      <>
                        <Check className="h-4 w-4 text-green-400" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4" />
                        Copy
                      </>
                    )}
                  </button>
                  <button
                    onClick={downloadScript}
                    className="btn btn-secondary flex items-center gap-2"
                    title="Download as .ps1 file"
                  >
                    <Download className="h-4 w-4" />
                    Download
                  </button>
                  <button
                    onClick={handleDelete}
                    className="btn btn-secondary flex items-center gap-2 text-red-400 hover:text-red-300 hover:border-red-500/50"
                    title="Delete script"
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <pre className="flex-1 bg-surface-900 text-zinc-100 p-4 rounded-lg overflow-auto text-sm font-mono border border-surface-600">
                {scriptDetail.script_content}
              </pre>
            </div>
          ) : (
            <div className="card h-full flex items-center justify-center text-zinc-500 min-h-[300px]">
              Select a script to view its contents
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
