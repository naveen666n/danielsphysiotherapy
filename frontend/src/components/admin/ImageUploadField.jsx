import { useRef, useState } from 'react';

const DEFAULT_ACCEPT = 'image/jpeg,image/png,image/webp';
const ACCEPT_LABEL = 'JPG, PNG or WEBP';

export default function ImageUploadField({
  label,
  preview,
  onChange,
  onClear,
  accept = DEFAULT_ACCEPT,
  maxSizeMB = 5,
  shape = 'square',
  hint,
}) {
  const inputRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState('');

  const acceptedTypes = accept.split(',').map((type) => type.trim());

  function processFile(file) {
    if (!file) return;
    if (!acceptedTypes.includes(file.type)) {
      setError(`Unsupported file type. Please choose a ${ACCEPT_LABEL} image.`);
      return;
    }
    if (file.size > maxSizeMB * 1024 * 1024) {
      setError(`That file is too large — max size is ${maxSizeMB}MB.`);
      return;
    }
    setError('');
    onChange(file);
  }

  function handleInputChange(e) {
    processFile(e.target.files?.[0]);
    e.target.value = '';
  }

  function handleDrop(e) {
    e.preventDefault();
    setIsDragging(false);
    processFile(e.dataTransfer.files?.[0]);
  }

  function handleClear(e) {
    e.stopPropagation();
    setError('');
    onClear?.();
  }

  const shapeClass = shape === 'circle' ? 'rounded-full' : 'rounded-lg';

  return (
    <div>
      {label && <label className="mb-1.5 block text-sm font-medium text-slate-700">{label}</label>}
      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={`flex cursor-pointer items-center gap-4 rounded-lg border-2 border-dashed p-4 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ${
          isDragging ? 'border-blue-500 bg-blue-50' : 'border-slate-300 hover:border-blue-400 hover:bg-slate-50'
        }`}
      >
        <input ref={inputRef} type="file" accept={accept} className="hidden" onChange={handleInputChange} />

        <div
          className={`flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden bg-slate-100 text-slate-400 ${shapeClass}`}
        >
          {preview ? (
            <img src={preview} alt="Preview" className="h-full w-full object-cover" />
          ) : (
            <svg viewBox="0 0 24 24" fill="none" className="h-8 w-8">
              <path
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4 16.5V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v10.5M4 16.5 8.5 12a2 2 0 0 1 2.8 0l1.7 1.7a2 2 0 0 0 2.8 0L18 11.5l2 2M4 16.5V18a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-1.5"
              />
              <circle cx="9" cy="8.5" r="1.5" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-slate-700">
            {preview ? 'Change image' : 'Click to upload'}{' '}
            <span className="font-normal text-slate-500">or drag and drop</span>
          </p>
          <p className="mt-0.5 text-xs text-slate-500">{hint || `${ACCEPT_LABEL}, up to ${maxSizeMB}MB`}</p>
          {error && <p className="mt-1 text-xs font-medium text-red-600">{error}</p>}
        </div>

        {preview && onClear && (
          <button
            type="button"
            onClick={handleClear}
            className="shrink-0 rounded-full p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
            aria-label="Remove selected image"
            title="Remove selected image"
          >
            <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
              <path stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
