'use client'

interface Option {
  value: string
  label: string
}

export default function SegmentedControl({
  options,
  value,
  onChange,
}: {
  options: Option[]
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div className="coach-segmented">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          className={`coach-seg-btn ${value === opt.value ? 'coach-active' : ''}`}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}
