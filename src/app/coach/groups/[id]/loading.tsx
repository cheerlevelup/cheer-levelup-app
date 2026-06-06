// src/app/coach/groups/[id]/loading.tsx
const C = { navy: '#0D1B2A', offWhite: '#F4F6F9', grayLight: '#E8ECF2', navyBorder: '#243652', navyLight: '#1A2E45' }

function Sk({ w = '100%', h = 14, r = 6 }: { w?: string | number; h?: number; r?: number }) {
  return <div style={{ width: w, height: h, borderRadius: r, background: 'linear-gradient(90deg, #E8ECF2 25%, #F4F6F9 50%, #E8ECF2 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.4s infinite' }} />
}

export default function GroupLoading() {
  return (
    <>
      <style>{`@keyframes shimmer { 0% { background-position: 200% 0 } 100% { background-position: -200% 0 } } * { box-sizing: border-box; margin: 0; padding: 0; } body { background: ${C.offWhite}; }`}</style>
      <div style={{ minHeight: '100vh', background: C.offWhite }}>
        <div style={{ background: C.navy, padding: '1rem 1.25rem 1.35rem' }}>
          <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 70, height: 32, borderRadius: 10, background: C.navyLight }} />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ width: 120, height: 10, borderRadius: 4, background: C.navyLight }} />
              <div style={{ width: 200, height: 18, borderRadius: 6, background: C.navyLight }} />
            </div>
          </div>
        </div>
        <div style={{ background: C.navyLight, height: 44, borderBottom: `1.5px solid ${C.navyBorder}` }} />
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '1.25rem 1rem', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ background: '#fff', border: `1.5px solid ${C.grayLight}`, borderRadius: 14, padding: '1rem', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Sk w="30%" h={12} />
            <div style={{ overflowX: 'auto' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '180px repeat(5, 80px)', gap: 1, minWidth: 580 }}>
                {Array.from({ length: 24 }).map((_, i) => (
                  <div key={i} style={{ height: 36, background: i < 6 ? C.navy : (i % 2 === 0 ? '#F4F6F9' : '#fff'), borderRadius: 4 }} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
