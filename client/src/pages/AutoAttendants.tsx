import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, Plus } from 'lucide-react'

export default function AutoAttendants() {
  const { id: migrationId } = useParams<{ id: string }>()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to={`/migrations/${migrationId}`} className="p-2 hover:bg-gray-100 rounded-lg">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Auto Attendants</h1>
            <p className="text-gray-600">Configure auto attendants for this migration</p>
          </div>
        </div>
        <button className="btn btn-primary flex items-center gap-2">
          <Plus className="h-5 w-5" />
          Add Auto Attendant
        </button>
      </div>

      <div className="card">
        <div className="text-center py-12 text-gray-500">
          <p>No auto attendants configured yet.</p>
          <p className="text-sm mt-2">Create an auto attendant to get started.</p>
        </div>
      </div>
    </div>
  )
}
