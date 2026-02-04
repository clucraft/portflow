import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { FileCode, Copy, Check } from 'lucide-react'
import { scriptsApi } from '../services/api'

export default function Scripts() {
  const [selectedScript, setSelectedScript] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const { data: scripts, isLoading } = useQuery({
    queryKey: ['scripts'],
    queryFn: () => scriptsApi.list(),
  })

  const { data: scriptDetail } = useQuery({
    queryKey: ['script', selectedScript],
    queryFn: () => scriptsApi.get(selectedScript!),
    enabled: !!selectedScript,
  })

  const copyToClipboard = async () => {
    if (scriptDetail?.script_content) {
      await navigator.clipboard.writeText(scriptDetail.script_content)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  if (isLoading) {
    return <div className="text-center py-12">Loading...</div>
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Generated Scripts</h1>
        <p className="text-gray-600">PowerShell scripts for Teams configuration</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Script List */}
        <div className="space-y-3">
          {scripts?.map((script) => (
            <button
              key={script.id}
              onClick={() => setSelectedScript(script.id)}
              className={`w-full text-left p-4 rounded-lg border transition-colors ${
                selectedScript === script.id
                  ? 'border-primary-500 bg-primary-50'
                  : 'border-gray-200 hover:border-gray-300 bg-white'
              }`}
            >
              <div className="flex items-start gap-3">
                <FileCode className="h-5 w-5 text-gray-400 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{script.name}</p>
                  <p className="text-sm text-gray-600">{script.script_type.replace('_', ' ')}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    {new Date(script.generated_at).toLocaleString()}
                  </p>
                </div>
              </div>
            </button>
          ))}

          {scripts?.length === 0 && (
            <div className="text-center py-12 text-gray-500 card">
              <FileCode className="h-12 w-12 mx-auto text-gray-300 mb-3" />
              <p>No scripts generated yet.</p>
              <p className="text-sm mt-1">Generate scripts from a migration page.</p>
            </div>
          )}
        </div>

        {/* Script Content */}
        <div className="lg:col-span-2">
          {scriptDetail ? (
            <div className="card h-full flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="font-semibold">{scriptDetail.name}</h2>
                  <p className="text-sm text-gray-600">{scriptDetail.description}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={copyToClipboard}
                    className="btn btn-secondary flex items-center gap-2"
                  >
                    {copied ? (
                      <>
                        <Check className="h-4 w-4" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4" />
                        Copy
                      </>
                    )}
                  </button>
                </div>
              </div>
              <pre className="flex-1 bg-gray-900 text-gray-100 p-4 rounded-lg overflow-auto text-sm font-mono">
                {scriptDetail.script_content}
              </pre>
            </div>
          ) : (
            <div className="card h-full flex items-center justify-center text-gray-500">
              Select a script to view its contents
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
