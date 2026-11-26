/**
 * Pure rules linking a rare photo request to the exact watermarked photo that
 * answered it. The database stores the link in `photo_requests.evidence_id`;
 * these helpers keep HQ's viewer pinned to that photo instead of silently
 * showing a newer, unrelated upload.
 */

export interface PhotoProofRequestLink {
  status: string
  evidenceId?: string | null
  officerId: string
  createdAt: Date | string
}

export interface EvidenceCandidate {
  id: string
  officerId: string
  createdAt: Date | string
}

function ms(value: Date | string): number {
  const parsed = value instanceof Date ? value.getTime() : Date.parse(value)
  return Number.isNaN(parsed) ? 0 : parsed
}

/**
 * The photo that answers this request, if any.
 * A fulfilled request always wins with its stored evidence id. A pending
 * request can only be answered by a later photo from the same officer.
 */
export function selectFulfillmentEvidenceId(
  request: PhotoProofRequestLink,
  evidence: EvidenceCandidate[]
): string | null {
  if (request.status === 'FULFILLED' && request.evidenceId) return request.evidenceId
  if (request.status !== 'PENDING') return null

  const requestedAt = ms(request.createdAt)
  return (
    evidence
      .filter(
        (photo) =>
          photo.officerId === request.officerId &&
          (!requestedAt || ms(photo.createdAt) >= requestedAt)
      )
      .sort((a, b) => ms(b.createdAt) - ms(a.createdAt))[0]?.id || null
  )
}

/** URL HQ uses to stream the exact photo bytes, with a safe fallback to latest. */
export function evidencePhotoUrl(officerId: string, evidenceId?: string | null): string {
  const params = new URLSearchParams({ officerId })
  if (evidenceId) params.set('evidenceId', evidenceId)
  params.set('latest', '1')
  return `/api/field/evidence?${params.toString()}`
}
