import { useState, useRef, useCallback } from 'react'
import { ArrowUpTrayIcon, XMarkIcon } from '@heroicons/react/24/outline'
import clsx from 'clsx'

interface FileUploadProps {
  onFilesSelected: (files: File[]) => void
  accept?: string
  multiple?: boolean
  maxFiles?: number
  maxSizeMB?: number
  label?: string
  description?: string
  files?: File[]
  onRemoveFile?: (index: number) => void
  compact?: boolean
  preview?: boolean
  currentImageUrl?: string | null
}

export function FileUpload({
  onFilesSelected,
  accept,
  multiple = false,
  maxFiles = 5,
  maxSizeMB = 10,
  label = 'Choose a file',
  description = 'or drag and drop',
  files = [],
  onRemoveFile,
  compact = false,
  preview = false,
  currentImageUrl
}: FileUploadProps) {
  const [dragOver, setDragOver] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const validateFiles = useCallback((incoming: FileList | File[]): File[] => {
    const fileArray = Array.from(incoming)
    const maxBytes = maxSizeMB * 1024 * 1024

    const valid = fileArray.filter(f => {
      if (f.size > maxBytes) {
        setError(`${f.name} exceeds ${maxSizeMB}MB limit`)
        return false
      }
      return true
    })

    if (!multiple && valid.length > 1) {
      return [valid[0]]
    }

    if (multiple && files.length + valid.length > maxFiles) {
      setError(`Maximum ${maxFiles} files allowed`)
      return valid.slice(0, maxFiles - files.length)
    }

    setError(null)
    return valid
  }, [maxSizeMB, multiple, maxFiles, files.length])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const valid = validateFiles(e.dataTransfer.files)
    if (valid.length > 0) onFilesSelected(valid)
  }, [validateFiles, onFilesSelected])

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const valid = validateFiles(e.target.files)
      if (valid.length > 0) onFilesSelected(valid)
    }
    e.target.value = ''
  }, [validateFiles, onFilesSelected])

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const hasPreviewImage = preview && (
    (files.length > 0 && files[0].type.startsWith('image/')) || currentImageUrl
  )

  return (
    <div>
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={clsx(
          'border-2 border-dashed rounded-lg text-center cursor-pointer transition-colors',
          compact ? 'p-4' : 'p-8',
          dragOver
            ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20'
            : 'border-zinc-300 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-600'
        )}
      >
        {hasPreviewImage ? (
          <div className="flex flex-col items-center gap-2">
            <img
              src={files.length > 0 ? URL.createObjectURL(files[0]) : currentImageUrl!}
              alt="Preview"
              className={clsx('object-cover rounded', compact ? 'h-16 w-16' : 'h-24 w-24')}
            />
            <span className="text-sm text-blue-600 hover:text-blue-500 font-medium">Change</span>
          </div>
        ) : (
          <>
            <ArrowUpTrayIcon className={clsx('mx-auto text-zinc-400', compact ? 'h-8 w-8' : 'h-12 w-12')} />
            <div className={compact ? 'mt-2' : 'mt-4'}>
              <span className="text-blue-600 hover:text-blue-500 font-medium">{label}</span>
              <p className="mt-1 text-sm text-zinc-500">{description}</p>
            </div>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          onChange={handleChange}
          className="sr-only"
        />
      </div>

      {error && (
        <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>
      )}

      {files.length > 0 && !preview && (
        <ul className="mt-3 space-y-2">
          {files.map((file, i) => (
            <li key={i} className="flex items-center justify-between p-2 bg-zinc-50 dark:bg-zinc-800 rounded-lg text-sm">
              <div className="flex items-center gap-2 min-w-0">
                <span className="truncate font-medium text-zinc-700 dark:text-zinc-300">{file.name}</span>
                <span className="text-zinc-400 shrink-0">{formatSize(file.size)}</span>
              </div>
              {onRemoveFile && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onRemoveFile(i) }}
                  className="p-1 text-zinc-400 hover:text-red-500"
                >
                  <XMarkIcon className="h-4 w-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
