// src/lib/planReorder.ts
// Przeciąganie w edytorze planu (w obrębie jednego treningu): przestawienie
// ćwiczenia razem z jego wariantami (1a/1b...) i przestawienie całego bloku.
// Czyste funkcje — wyliczają nową kolejność i listę zmian do zapisania.
import { sortWithVariants } from '@/lib/exerciseVariants'

type Ex = { id?: number; block_id: number; exercise_order: number; variant_of?: number | null; variant_athlete_ids?: number[] | null }

export type OrderUpdate = { id: number; block_id: number; exercise_order: number }

// Przeniesienie ćwiczenia (i jego wariantów) na miejsce ćwiczenia targetBaseId
// albo — gdy targetBaseId = null — na koniec bloku docelowego. W tym samym bloku
// działa jak przesunięcie w liście (w dół → ląduje za celem, w górę → przed nim).
export function moveExercise<E extends Ex>(fromExs: E[], toExs: E[], exId: number, fromBlockId: number, toBlockId: number, targetBaseId: number | null) {
  const sameBlock = fromBlockId === toBlockId
  const bases = (list: E[]) => sortWithVariants(list).filter(e => e.variant_of == null)
  const movingBase = fromExs.find(e => e.id === exId)
  if (!movingBase) return null
  const movingVariants = fromExs.filter(e => e.variant_of === exId)

  let srcOrder: E[] = []
  let dstOrder: E[]
  if (sameBlock) {
    const orig = bases(fromExs)
    const fromIdx = orig.findIndex(e => e.id === exId)
    const toIdx = targetBaseId == null ? orig.length - 1 : orig.findIndex(e => e.id === targetBaseId)
    if (fromIdx < 0 || toIdx < 0 || fromIdx === toIdx) return null
    dstOrder = orig.slice()
    dstOrder.splice(fromIdx, 1)
    dstOrder.splice(toIdx, 0, movingBase)
  } else {
    srcOrder = bases(fromExs).filter(e => e.id !== exId)
    const dst = bases(toExs)
    const at = targetBaseId == null ? dst.length : dst.findIndex(e => e.id === targetBaseId)
    dstOrder = dst.slice()
    dstOrder.splice(at < 0 ? dst.length : at, 0, movingBase)
  }

  const updates: OrderUpdate[] = []
  // nowa kolejność bazy + jej warianty (ten sam numer slotu i blok co baza)
  const renumber = (order: E[], blockId: number, allExs: E[]) => order.flatMap((base, i) => {
    const group = [base, ...allExs.filter(v => v.variant_of === base.id)]
    return group.map(e => {
      const next = { ...e, block_id: blockId, exercise_order: i + 1 }
      if (e.id != null && (e.block_id !== blockId || e.exercise_order !== i + 1)) updates.push({ id: e.id, block_id: blockId, exercise_order: i + 1 })
      return next
    })
  })

  const allForDst = sameBlock ? fromExs : [...toExs, ...movingVariants]
  const newTo = renumber(dstOrder, toBlockId, allForDst)
  const newFrom = sameBlock ? newTo : renumber(srcOrder, fromBlockId, fromExs)
  return { from: newFrom, to: newTo, updates }
}

// Przeniesienie bloku na miejsce bloku targetId w obrębie dnia (przesunięcie w liście)
export function moveBlock<B extends { id: number; block_order: number }>(dayBlocks: B[], blockId: number, targetId: number) {
  const orig = [...dayBlocks].sort((a, b) => a.block_order - b.block_order)
  const fromIdx = orig.findIndex(b => b.id === blockId)
  const toIdx = orig.findIndex(b => b.id === targetId)
  if (fromIdx < 0 || toIdx < 0 || fromIdx === toIdx) return null
  const order = orig.slice()
  const [moved] = order.splice(fromIdx, 1)
  order.splice(toIdx, 0, moved)
  const updates = order.flatMap((b, i) => (b.block_order !== i + 1 ? [{ id: b.id, block_order: i + 1 }] : []))
  return { blocks: order.map((b, i) => ({ ...b, block_order: i + 1 })), updates }
}
