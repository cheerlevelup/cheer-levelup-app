// src/app/athlete/training/loading.tsx
const C = { navy: '#0D1B2A', offWhite: '#F4F6F9', grayLight: '#E8ECF2', navyBorder: '#243652', gold: '#F5C842' }

function Skeleton({ w = '100%', h = 16, r = 8 }: { w?: string | number; h?: number; r?: number }) {
  return <div style={{ width: w, height: h, borderRadius: r, background: 'linear-gradient(90deg, #E8ECF2 25%, #F4F6F9 50%, #E8ECF2 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.4s infinite' }} />
}

export default function TrainingLoading() {
  return (
    <>
      <style>{`@keyframes shimmer { 0% { background-position: 200% 0 } 100% { background-position: -200% 0 } } * { box-sizing: border-box; margin: 0; padding: 0; } body { background: ${C.offWhite}; }`}</style>
      <div style={{ minHeight: '100vh', background: C.offWhite }}>
        <div style={{ background: C.navy, padding: '1rem 1.25rem 0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.875rem' }}>
            <div style={{ width: 44, height: 44, borderRadius: '50%', background: C.navyBorder }} />
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 120, height: 14, borderRadius: 6, background: C.navyBorder }} />
              <div style={{ width: 80, height: 10, borderRadius: 6, background: C.navyBorder }} />
            </div>
            <div style={{ width: 44, height: 44, borderRadius: '50%', background: C.navyBorder }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingBottom: '0.875rem' }}>
            <div style={{ width: 80, height: 24, borderRadius: 12, background: C.gold + '44' }} />
            <div style={{ height: 5, flex: 1, background: C.navyBorder, borderRadius: 3 }} />
          </div>
          <div style={{ paddingBottom: '0.75rem' }}>
            <div style={{ height: 5, background: C.navyBorder, borderRadius: 3 }} />
          </div>
        </div>
        <div style={{ padding: '1rem', maxWidth: 520, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ background: '#fff', border: `1.5px solid ${C.grayLight}`, borderRadius: 14, padding: '1rem' }}>
            <Skeleton w="60%" h={16} r={8} />
            <div style={{ marginTop: 10 }}><Skeleton w="100%" h={12} r={6} /></div>
          </div>
          {[0, 1, 2].map(i => (
            <div key={i} style={{ background: '#fff', border: `1.5px solid ${C.grayLight}`, borderRadius: 14, padding: '1rem', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 9, background: C.grayLight, flexShrink: 0 }} />
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <Skeleton w="65%" h={14} />
                <Skeleton w="40%" h={10} />
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                {[0,1,2].map(j => <div key={j} style={{ width: 7, height: 7, borderRadius: '50%', background: C.grayLight }} />)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
