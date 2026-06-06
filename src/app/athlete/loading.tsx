// src/app/athlete/loading.tsx
const C = { navy: '#0D1B2A', offWhite: '#F4F6F9', grayLight: '#E8ECF2', navyBorder: '#243652' }

function Skeleton({ w = '100%', h = 16, r = 8 }: { w?: string | number; h?: number; r?: number }) {
  return (
    <div style={{ width: w, height: h, borderRadius: r, background: 'linear-gradient(90deg, #E8ECF2 25%, #F4F6F9 50%, #E8ECF2 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.4s infinite' }} />
  )
}

export default function AthleteLoading() {
  return (
    <>
      <style>{`
        @keyframes shimmer { 0% { background-position: 200% 0 } 100% { background-position: -200% 0 } }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: ${C.offWhite}; }
      `}</style>
      <div style={{ minHeight: '100vh', background: C.offWhite, fontFamily: "'Space Grotesk', sans-serif" }}>
        {/* Header skeleton */}
        <div style={{ background: C.navy, padding: '1rem 1.25rem 1.25rem' }}>
          <div style={{ maxWidth: 520, margin: '0 auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <div style={{ width: 52, height: 52, borderRadius: '50%', background: C.navyBorder }} />
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 140, height: 16, borderRadius: 6, background: C.navyBorder }} />
                <div style={{ width: 100, height: 12, borderRadius: 6, background: C.navyBorder }} />
              </div>
              <div style={{ width: 52, height: 52, borderRadius: '50%', background: C.navyBorder }} />
            </div>
            <div style={{ height: 5, background: C.navyBorder, borderRadius: 3 }} />
          </div>
        </div>

        {/* Cards skeleton */}
        <div style={{ maxWidth: 520, margin: '0 auto', padding: '1rem 1rem 7rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {[80, 80, 140].map((h, i) => (
            <div key={i} style={{ background: '#fff', border: `1.5px solid ${C.grayLight}`, borderRadius: 16, padding: '1.25rem', display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 52, height: 52, borderRadius: 14, background: C.grayLight, flexShrink: 0 }} />
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <Skeleton w="40%" h={10} />
                <Skeleton w="70%" h={16} />
              </div>
            </div>
          ))}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {[0, 1].map(i => (
              <div key={i} style={{ background: '#fff', border: `1.5px solid ${C.grayLight}`, borderRadius: 14, padding: '1rem' }}>
                <Skeleton w="50%" h={10} r={6} />
                <div style={{ marginTop: 10 }}><Skeleton w="40%" h={28} r={6} /></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}
